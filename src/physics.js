// Fahrermodell: der Kurs schwingt kritisch gedämpft auf einen Zielwinkel ein (Antippen: Tipp-Winkel,
// Halten: vertieft sich stetig, Loslassen: Falllinie). Dadurch hat die Spur nie einen Knick.
// Bremsen: Drehen kostet Tempo (Hauptbremse), große Winkel bremsen bis zum Stillstand,
// beide Daumen = Schneepflug. Ohne Eingabe nähert sich das Tempo weich dem Endtempo,
// weil der Luftwiderstand quadratisch wächst.
import { C } from './constants.js';

const D2R = Math.PI / 180;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (t) => t * t * (3 - 2 * t);

export const TREE = 0;
export const ROCK = 1;

export function createSkier() {
  return {
    x: 0, y: 0, y0: 0,
    v: 0,
    theta: 0,      // Richtung: 0 = Falllinie, positiv = rechts, 90° = quer zum Hang
    omega: 0,      // Drehgeschwindigkeit in rad/s
    target: 0,     // Zielwinkel, auf den der Kurs einschwingt
    holdT: 0,      // wie lange die aktuelle Seite schon gehalten wird
    carve: 0,      // 0..1 für Spurbreite und Spray
    brake: 0,      // aktuelle Bremsverzögerung (Debug)
    side: 0,       // -1 links, 1 rechts, 0 losgelassen
    plow: false,   // beide Daumen: Schneepflug, geradeaus bremsen
    plowK: 0,      // Pflugstellung 0..1: die Ski gehen weich in den Pflug und zurück (Bild, Spur, Spray, Ton)
    alive: true,
    // hockeyT: -1,   // < 0 = kein Hockeystop; sonst verstrichene Zeit seit dem Auslösen (game.js/render.js) — deaktiviert
  };
}

export function press(s, side) {
  if (s.side !== side) s.holdT = 0;
  s.side = side;
}

export function release(s) {
  s.side = 0;
}

export function setPlow(s, on) {
  s.plow = !!on;
  if (on) s.holdT = 0; // nach dem Pflug beginnt der verbleibende Daumen wie ein neuer Tipp
}

// Ansprechzeit wächst mit dem Tempo (Gewicht auf den Skiern): linear zwischen den beiden Referenztempi
function turnT(v) {
  const lo = C.TURN_T_SPEED_LO_KMH / 3.6, hi = C.TURN_T_SPEED_HI_KMH / 3.6;
  const k = clamp((v - lo) / Math.max(0.1, hi - lo), 0, 1);
  return C.TURN_T + (C.TURN_T_FAST - C.TURN_T) * k;
}

// Ein Physik-Schritt.
// maxKmh: Endtempo des Modus (game.js gibt im Super-G SG_MAX_SPEED_KMH mit)
export function updateSkier(s, dt, maxKmh = C.MAX_SPEED_KMH) {
  const maxHead = C.MAX_HEADING_DEG * D2R;

  // Hockeystop deaktiviert (Tim und Jürgen wollen ihn nicht) — auskommentiert statt gelöscht.
  // if (s.hockeyT < 0 && s.side !== 0 && !s.plow && s.v >= C.HOCKEY_MIN_KMH / 3.6 && s.holdT >= C.HOCKEY_HOLD_S) {
  //   s.hockeyT = 0;
  // }
  // if (s.hockeyT >= 0) {
  //   s.target = s.side * maxHead;
  //   const T = C.HOCKEY_SNAP_T;
  //   s.omega += ((s.target - s.theta) / (T * T) - (2 * s.omega) / T) * dt;
  //   s.theta += s.omega * dt;
  //   if (s.theta > maxHead) { s.theta = maxHead; s.omega = 0; }
  //   else if (s.theta < -maxHead) { s.theta = -maxHead; s.omega = 0; }
  //   s.carve = clamp(Math.abs(s.theta) / D2R / 90, 0, 1);
  //   s.plowK += (0 - s.plowK) * (1 - Math.exp(-dt / C.PLOW_EASE_S));
  //   s.v *= Math.exp(-dt / C.HOCKEY_DECEL_T);
  //   s.x += s.v * Math.sin(s.theta) * dt;
  //   s.y += s.v * Math.cos(s.theta) * dt;
  //   s.hockeyT += dt;
  //   if (s.hockeyT >= C.HOCKEY_DUR_S || s.v < 0.15) s.hockeyT = -1;
  //   return;
  // }

  // Zielwinkel: Halten = Tipp-Winkel + Vertiefung, Loslassen oder Schneepflug = Falllinie
  let T;
  if (s.side !== 0 && !s.plow) {
    s.target = s.side * Math.min(maxHead, (C.TURN_TAP_DEG + C.TURN_DEEPEN_DEG_S * s.holdT) * D2R);
    s.holdT += dt;
    T = turnT(s.v);
  } else {
    s.target = 0;
    T = C.RETURN_T;
  }
  // Kritisch gedämpftes Einschwingen: weicher Beginn, zügige Mitte, sanftes Ende, kein Knick
  s.omega += ((s.target - s.theta) / (T * T) - (2 * s.omega) / T) * dt;
  s.theta += s.omega * dt;
  if (s.theta > maxHead) { s.theta = maxHead; if (s.omega > 0) s.omega = 0; }
  else if (s.theta < -maxHead) { s.theta = -maxHead; if (s.omega < 0) s.omega = 0; }
  if (s.side === 0 && Math.abs(s.theta) < 1e-4 && Math.abs(s.omega) < 1e-3) { s.theta = 0; s.omega = 0; }

  const absDeg = Math.abs(s.theta) / D2R;
  s.carve = clamp(absDeg / 90, 0, 1);

  // Bremsen: Drehen (Hauptanteil) + Winkel (ab BRAKE_START_DEG, voll ab BRAKE_FULL_DEG) + Schneepflug
  const t = clamp((absDeg - C.BRAKE_START_DEG) / Math.max(1, C.BRAKE_FULL_DEG - C.BRAKE_START_DEG), 0, 1);
  const brakeAngle = smoothstep(t) * (C.BRAKE_MIN + C.BRAKE_K * s.v);
  const brakeTurn = C.TURN_BRAKE_K * Math.abs(s.omega) * s.v;
  const brakePlow = s.plow ? C.PLOW_MIN + C.PLOW_K * s.v : 0;
  s.plowK += ((s.plow ? 1 : 0) - s.plowK) * (1 - Math.exp(-dt / C.PLOW_EASE_S));
  s.brake = brakeAngle + brakeTurn + brakePlow;

  const cos = Math.cos(s.theta);
  const sin = Math.sin(s.theta);
  const vMax = maxKmh / 3.6;
  // Widerstand hebt den Hangabtrieb knapp über vMax auf, damit die Anzeige das Endtempo auch erreicht
  const vT = vMax * 1.02;
  const drag = C.G_SLOPE * (s.v / vT) * (s.v / vT);
  const a = C.G_SLOPE * cos - drag - s.brake;
  s.v = clamp(s.v + a * dt, 0, vMax);

  s.x += s.v * sin * dt;
  s.y += s.v * cos * dt;
}

// Fahrermodell: der Kurs schwingt kritisch gedämpft auf einen Zielwinkel ein (Antippen: Tipp-Winkel,
// Halten: vertieft sich stetig). Nach dem Loslassen bleibt der Schrägwinkel und driftet nur langsam
// zur Falllinie zurück. Dadurch hat die Spur nie einen Knick.
// Bremsen wächst mit Winkel und Tempo bis zum Stillstand. Ohne Eingabe nähert sich das Tempo
// weich dem Endtempo, weil der Luftwiderstand quadratisch wächst.
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
    alive: true,
  };
}

export function press(s, side) {
  if (s.side !== side) s.holdT = 0;
  s.side = side;
}

export function release(s) {
  s.side = 0;
}

// Ansprechzeit wächst mit dem Tempo (Gewicht auf den Skiern): linear zwischen den beiden Referenztempi
function turnT(v) {
  const lo = C.TURN_T_SPEED_LO_KMH / 3.6, hi = C.TURN_T_SPEED_HI_KMH / 3.6;
  const k = clamp((v - lo) / Math.max(0.1, hi - lo), 0, 1);
  return C.TURN_T + (C.TURN_T_FAST - C.TURN_T) * k;
}

// Ein Physik-Schritt.
export function updateSkier(s, dt) {
  const maxHead = C.MAX_HEADING_DEG * D2R;

  if (s.side !== 0) {
    // Halten: Zielwinkel = Tipp-Winkel + Vertiefung; kritisch gedämpftes Einschwingen
    // (weicher Beginn, zügige Mitte, sanftes Ende, kein Knick)
    s.target = s.side * Math.min(maxHead, (C.TURN_TAP_DEG + C.TURN_DEEPEN_DEG_S * s.holdT) * D2R);
    s.holdT += dt;
    const T = turnT(s.v);
    s.omega += ((s.target - s.theta) / (T * T) - (2 * s.omega) / T) * dt;
    s.theta += s.omega * dt;
  } else {
    // Losgelassen: Restdrehung klingt schnell ab, dann langsame Drift zur Falllinie
    s.target = 0;
    const mag = Math.abs(s.theta);
    const rate = Math.min(mag / dt, Math.max(mag / C.RETURN_T, C.RETURN_MIN_DEG_S * D2R));
    const wanted = -Math.sign(s.theta) * rate;
    s.omega += (wanted - s.omega) * (1 - Math.exp(-dt / C.RETURN_DAMP_S));
    const before = s.theta;
    s.theta += s.omega * dt;
    if (before !== 0 && Math.sign(s.theta) !== Math.sign(before)) { s.theta = 0; s.omega = 0; }
  }
  if (s.theta > maxHead) { s.theta = maxHead; if (s.omega > 0) s.omega = 0; }
  else if (s.theta < -maxHead) { s.theta = -maxHead; if (s.omega < 0) s.omega = 0; }
  if (s.side === 0 && Math.abs(s.theta) < 1e-4 && Math.abs(s.omega) < 1e-3) { s.theta = 0; s.omega = 0; }

  const absDeg = Math.abs(s.theta) / D2R;
  s.carve = clamp(absDeg / 90, 0, 1);

  // Bremsen: 0 unterhalb BRAKE_START_DEG, voll ab BRAKE_FULL_DEG, und je schneller desto härter
  const t = clamp((absDeg - C.BRAKE_START_DEG) / Math.max(1, C.BRAKE_FULL_DEG - C.BRAKE_START_DEG), 0, 1);
  s.brake = smoothstep(t) * (C.BRAKE_MIN + C.BRAKE_K * s.v);

  const cos = Math.cos(s.theta);
  const sin = Math.sin(s.theta);
  const vMax = C.MAX_SPEED_KMH / 3.6;
  // Widerstand hebt den Hangabtrieb knapp über vMax auf, damit die Anzeige das Endtempo auch erreicht
  const vT = vMax * 1.02;
  const drag = C.G_SLOPE * (s.v / vT) * (s.v / vT);
  const a = C.G_SLOPE * cos - drag - s.brake;
  s.v = clamp(s.v + a * dt, 0, vMax);

  s.x += s.v * sin * dt;
  s.y += s.v * cos * dt;
}

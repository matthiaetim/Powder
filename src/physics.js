// Fahrermodell: der Kurs schwingt kritisch gedämpft auf einen Zielwinkel ein (Antippen: Tipp-Winkel,
// Halten: vertieft sich stetig, Loslassen: Falllinie). Dadurch hat die Spur nie einen Knick.
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

// Ein Physik-Schritt.
export function updateSkier(s, dt) {
  const maxHead = C.MAX_HEADING_DEG * D2R;

  // Zielwinkel: Antippen = Tipp-Winkel, Halten vertieft, Loslassen = Falllinie
  let T;
  if (s.side !== 0) {
    s.target = s.side * Math.min(maxHead, (C.TURN_TAP_DEG + C.TURN_DEEPEN_DEG_S * s.holdT) * D2R);
    s.holdT += dt;
    T = C.TURN_T;
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

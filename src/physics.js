// Fahrermodell: Halten dreht gleichmäßig weiter, Loslassen schwingt zur Falllinie zurück.
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
    omega: 0,
    carve: 0,      // 0..1 für Spurbreite und Spray
    brake: 0,      // aktuelle Bremsverzögerung (Debug)
    side: 0,       // -1 links, 1 rechts, 0 losgelassen
    alive: true,
  };
}

export function press(s, side) {
  const maxHead = C.MAX_HEADING_DEG * D2R;
  s.side = side;
  s.theta = clamp(s.theta + side * C.TURN_KICK_DEG * D2R, -maxHead, maxHead);
}

export function release(s) {
  s.side = 0;
}

// Ein Physik-Schritt.
export function updateSkier(s, dt) {
  const maxHead = C.MAX_HEADING_DEG * D2R;
  const prev = s.theta;

  if (s.side !== 0) {
    s.theta = clamp(s.theta + s.side * C.TURN_RATE_DEG_S * D2R * dt, -maxHead, maxHead);
  } else if (s.theta !== 0) {
    // Rückkehr zur Falllinie: exponentiell, aber mindestens RETURN_MIN_DEG_S schnell
    const mag = Math.abs(s.theta);
    const step = Math.max(mag * (1 - Math.exp(-dt / C.RETURN_S)), C.RETURN_MIN_DEG_S * D2R * dt);
    s.theta -= Math.sign(s.theta) * Math.min(mag, step);
  }
  s.omega = (s.theta - prev) / dt;

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

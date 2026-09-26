// Hockeystop nach dem Ziel (Super-G und Duell): der Fahrer reißt die Ski quer, rutscht in der alten Fahrtrichtung
// weiter und bremst scharf bis zum Stand. Beim Ziel wird festgehalten, wo er war, wohin und wie schnell er fuhr;
// alles Weitere folgt geschlossen aus der Zeit seit dem Ziel (g.finT). So hängen Fahrer (game.js coast) und Wolke
// (hockey-view.js) exakt aneinander, Pause und Fresh müssen nichts zurücksetzen, und ein Tipp, der die Animation
// überspringt, landet sauber im Endzustand.
import { C } from './constants.js';

// dir: Fahrtrichtung beim Ziel (wie skier.theta, 0 = Falllinie), side: zu dieser Seite kommen die Ski quer, nämlich
// zu der er gerade lehnt (geradeaus: rechts).
export function startStop(s) {
  return { x0: s.x, y0: s.y, dir: s.theta, th0: s.theta, v0: s.v, side: s.theta >= 0 ? 1 : -1 };
}

// Verzögerung a + b·v bis zum Stand: v(t) = (v0 + a/b)·e^(−bt) − a/b, Stand nach T = ln(1 + b·v0/a) / b
export function stopTime(st) {
  const a = C.STOP_DECEL_MIN, b = C.STOP_DECEL_K;
  return st.v0 > 0 ? Math.log(1 + (b * st.v0) / a) / b : 0;
}
export function speedAt(st, t) {
  const a = C.STOP_DECEL_MIN, b = C.STOP_DECEL_K;
  return Math.max(0, (st.v0 + a / b) * Math.exp(-b * t) - a / b);
}
export function distAt(st, t) {
  const a = C.STOP_DECEL_MIN, b = C.STOP_DECEL_K;
  const u = Math.min(t, stopTime(st));
  return ((st.v0 + a / b) / b) * (1 - Math.exp(-b * u)) - (a / b) * u;
}

// Stellung der Ski: schwingt von der Fahrtrichtung schnell auf quer
export function headingAt(st, t) {
  const target = (st.side * Math.PI) / 2;
  return target + (st.th0 - target) * Math.exp(-t / C.STOP_TURN_S);
}

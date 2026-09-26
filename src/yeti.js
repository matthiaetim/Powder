// Easter Egg (Classic): Yeti-Spuren. Alle paar Läufe liegt irgendwo zwischen YETI_Y_MIN und YETI_Y_MAX eine Reihe
// großer Fußabdrücke im Schnee, hangabwärts, und hört mitten im Hang auf. Keine Figur, kein Hinweis, keine Regler:
// wann und wo, entscheidet der Zufall, damit auch die Entwickler es nicht vorhersehen.
// Die Abdrücke liegen im freien Korridor (world.js), man kann ihnen also folgen; wer darüberfährt, verwischt sie
// wie den Credit.
import { C } from './constants.js';
import { laneX, laneHalf } from './world.js';
import { loadYetiIn, saveYetiIn } from './storage.js';

const TAU = Math.PI * 2;
const between = (a, b) => a + Math.random() * (b - a);
const nextGap = () => C.YETI_EVERY_MIN + Math.floor(Math.random() * (C.YETI_EVERY_MAX - C.YETI_EVERY_MIN + 1));

// Beim Start jedes Classic-Laufs: zählt den gespeicherten Abstand herunter und legt, wenn er abgelaufen ist, die Spur.
// Der Lauf verbraucht sie, auch wenn der Fahrer vorher stürzt. Beim allerersten Mal wird der Abstand erst gewürfelt.
export function rollYeti(world) {
  let left = loadYetiIn();
  if (!(left > 0)) left = nextGap();
  left--;
  if (left > 0) { saveYetiIn(left); return null; }
  saveYetiIn(nextGap());
  return createYeti(world);
}

// Länge und Beginn gewürfelt. Das Minimum zweier Zufallszahlen macht frühe Stellen wahrscheinlicher: rund drei
// Viertel der Spuren beginnen in der ersten Hälfte der Spanne. Die Länge ist Bogenlänge, die Spur endet so
// spätestens bei YETI_Y_MAX.
export function createYeti(world) {
  const len = between(C.YETI_LEN_MIN_M, C.YETI_LEN_MAX_M);
  const y0 = C.YETI_Y_MIN + (C.YETI_Y_MAX - C.YETI_Y_MIN - len) * Math.min(Math.random(), Math.random());
  // Der Yeti schlendert um die Korridor-Mitte, bleibt aber mit beiden Füßen im freien Streifen
  const wander = Math.max(0, laneHalf(y0) - C.YETI_GAIT_M - C.YETI_FOOT_W_M);
  const amp = wander * between(0.4, 1), wave = between(25, 60), ph = Math.random() * TAU;
  const pathX = (y) => laneX(world, y) + amp * Math.sin((TAU * y) / wave + ph);
  const prints = [];
  let side = Math.random() < 0.5 ? -1 : 1;
  let y = y0, x = pathX(y0), arc = 0, next = 0;
  const dy = 0.05;
  while (arc <= len) {
    const ny = y + dy, nx = pathX(ny);
    const seg = Math.hypot(nx - x, dy);
    if (arc >= next) {
      // Quer zur Laufrichtung abwechselnd links und rechts, die Zehen zeigen hangabwärts in Laufrichtung
      const ux = (nx - x) / seg, uy = dy / seg;
      prints.push({ x: x - uy * side * C.YETI_GAIT_M, y: y + ux * side * C.YETI_GAIT_M, a: Math.atan2(ux, uy), side, wear: 0 });
      side = -side;
      next += C.YETI_STRIDE_M;
    }
    arc += seg;
    x = nx; y = ny;
  }
  return { prints, y0, y1: y };
}

// Überfahren verwischt: solange Ski, Brett oder Kufen über einem Abdruck sind, nimmt er je Meter Fahrt
// YETI_WIPE_PER_M an Deckkraft ab. Eine Überfahrt dauert rund 1 m, zwei löschen ihn fast. Die Reichweite quer
// deckt Ski, Brett und Kufen ab (0,3 m um die Fahrermitte).
export function updateYeti(yt, s, dt) {
  if (!yt || s.y < yt.y0 - 2 || s.y > yt.y1 + 2) return;
  const reachX = C.YETI_FOOT_W_M / 2 + 0.3, reachY = C.YETI_FOOT_L_M / 2 + 0.1;
  for (const p of yt.prints) {
    if (p.wear >= 1 || Math.abs(p.y - s.y) > reachY || Math.abs(p.x - s.x) > reachX) continue;
    p.wear = Math.min(1, p.wear + C.YETI_WIPE_PER_M * s.v * dt);
  }
}

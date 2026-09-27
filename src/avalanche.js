// Die Lawine (Modus Lawine): eine Front, die von oben nachrückt. Sie hält ein Tempo (Pace), das mit der Laufzeit
// steigt. Ist der Fahrer schneller, lauert sie knapp über dem oberen Bildrand; ist er langsamer, schließt sie
// mit der Differenz auf. Als Fahrertempo wertet sie (AV_DIAG_K) das Tempo entlang der Ski, nicht nur den
// Höhenverlust, sonst wäre jede Schrägfahrt trotz Tempo ein Einholen. Steht er, kommt sie nach AV_STALL_S an
// den Bildrand und rollt mit Pace-Tempo heran.
// Gnade beim Schuss (AV_MERCY_K): fährt er gerade bergab, spielt sie nur einen Teil ihres Tempo-Vorsprungs aus;
// je stärker die Kurve, desto mehr davon. Der Schneepflug zählt nicht als Schuss.
// Startphase (AV_INTRO_M): bis dahin rollt holdAvalanche sie beim Losfahren ins Bild und hält sie dort, danach
// übernimmt updateAvalanche.
import { C } from './constants.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (t) => t * t * (3 - 2 * t);
const D2R = Math.PI / 180;

export function createAvalanche(skierY) {
  return {
    frontY: skierY - C.AV_START_GAP_M, // Vorderkante in Weltkoordinaten
    gap: C.AV_START_GAP_M,             // Abstand zum Fahrer in m
    speed: 0, pace: 0,                 // aktuelles Tempo und Pace in m/s
    stallT: 0,                         // wie lange der Fahrer schon steht
    roll: 0,                           // zurückgelegter Weg der Front (treibt die Animation)
    t: 0,
    near: 0,                           // 0 = lauert, 1 = beim Fahrer (Warnschnee)
    threat: 0,                         // 0 = außerhalb des Bildes, 1 = beim Fahrer (Beben)
    mercy: 0,                          // 1 = volle Gnade beim Schuss; 0 = Kurve, Pflug oder Gnade aus, volles Tempo (Debug)
    breaks: 0,                         // wie oft sie nach Stillstand an den Bildrand gesprungen ist (Ton: Krachen)
  };
}

// Pace in m/s: steigt linear mit der Laufzeit vom Start- zum Endtempo.
export function paceSpeed(runT) {
  const k = clamp(runT / Math.max(1, C.AV_RAMP_S), 0, 1);
  return (C.AV_PACE0_KMH + (C.AV_PACE1_KMH - C.AV_PACE0_KMH) * k) / 3.6;
}

// Werte für Anzeige, Ton und Warnschnee aus dem Abstand
function measure(av, skier, topDist) {
  av.gap = skier.y - av.frontY;
  av.near = clamp(1 - av.gap / (topDist + C.AV_LURK_M), 0, 1);
  av.threat = clamp(1 - av.gap / topDist, 0, 1);
}

// Startphase: vor dem Start wartet die Front AV_INTRO_OUT_M über dem Bildrand, ab dem Losfahren (runT) rollt sie in
// AV_INTRO_ENTER_S herein und fährt dann AV_INTRO_IN_M im Bild mit Fahrer und Kamera mit. Das Hereinrollen bremst
// zum Ende ab (ease-out), sonst schlüge sie hart auf der Endposition auf. Kein Erwischen und kein Stillstand-Zähler,
// sonst holte ein Anfahren unter AV_STALL_KMH sie beim Übergang sofort an den Bildrand.
export function holdAvalanche(av, skier, runT, dt, topDist) {
  av.t += dt;
  av.pace = paceSpeed(runT);
  av.stallT = 0;
  av.mercy = 0;
  const way = C.AV_INTRO_OUT_M + C.AV_INTRO_IN_M; // Weg vom Warten bis ins Bild, relativ zum Bildrand
  const k = C.AV_INTRO_ENTER_S > 0 ? clamp(runT / C.AV_INTRO_ENTER_S, 0, 1) : 1;
  const rest = 1 - k;
  // Tempo analytisch (Fahrer hangabwärts plus Hereinrollen), nicht aus dem Positionssprung: der erste Aufruf holt sie
  // von AV_START_GAP_M in die Wartestellung, das wäre sonst ein Riesenwert für Wolkenfluss und Sturz-Schub.
  const down = skier.alive ? Math.max(0, skier.v * Math.cos(skier.theta)) : 0;
  av.speed = down + (runT > 0 && k < 1 ? (2 * way * rest) / C.AV_INTRO_ENTER_S : 0);
  av.roll += av.speed * dt;
  av.frontY = skier.y - Math.max(C.AV_CATCH_M + 1, topDist + C.AV_INTRO_OUT_M - way * (1 - rest * rest));
  measure(av, skier, topDist);
}

// topDist: Abstand vom Fahrer zum oberen Bildrand in m. Gibt true zurück, wenn sie den Fahrer erwischt.
export function updateAvalanche(av, skier, runT, dt, topDist) {
  av.t += dt;
  const pace = paceSpeed(runT);
  av.pace = pace;
  const down = skier.alive ? skier.v * Math.cos(skier.theta) : 0; // Tempo hangabwärts
  // Was sie als Fahrertempo wertet: hangabwärts plus AV_DIAG_K des Anteils, der in der Schrägfahrt steckt.
  // Bei 1 zählt das volle Tempo entlang der Ski, bei 0 nur der Höhenverlust (Verhalten bis v0.11.1).
  const ref = skier.alive ? down + clamp(C.AV_DIAG_K, 0, 1) * (Math.max(0, skier.v) - down) : 0;
  const credit = ref - down; // so viel langsamer rollt sie, als ihr Pace vorgibt
  // Stillstand: nach AV_STALL_S wird die Front an den Bildrand geholt und rollt herein
  if (skier.alive && ref < C.AV_STALL_KMH / 3.6) av.stallT += dt; else av.stallT = 0;
  const enter = topDist + C.AV_ENTER_M;
  if (av.stallT >= C.AV_STALL_S && av.gap > enter) { av.frontY = skier.y - enter; av.breaks++; }
  // Tempo: mindestens Pace. Hinter dem Lauerabstand rückt sie schneller nach, als der Fahrer fährt.
  // Im Lauerbereich gilt die Gnade: beim Schuss rollt sie mit Fahrertempo minus AV_MERCY_KMH plus dem Anteil
  // hard ihres Vorsprungs bis zum Pace. hard ist mindestens 1 - AV_MERCY_K (bei 0 % Gnade also immer 1, volles
  // Tempo) und wächst mit dem Kurvenanteil (smoothstep zwischen AV_MERCY_DEG und AV_CURVE_DEG) oder dem Pflug.
  const lurk = topDist + C.AV_LURK_M;
  const deg = Math.abs(skier.theta) / D2R;
  const curve = smoothstep(clamp((deg - C.AV_MERCY_DEG) / Math.max(1, C.AV_CURVE_DEG - C.AV_MERCY_DEG), 0, 1));
  const hard = skier.alive ? Math.max(curve, skier.plowK, 1 - clamp(C.AV_MERCY_K, 0, 1)) : 1;
  av.mercy = 1 - hard;
  // Ihr Tempo: Pace abzüglich der Schrägfahrt-Gutschrift, so gewinnt sie genau mit Pace minus gewertetem Tempo.
  let sp = Math.max(0, pace - credit);
  if (skier.alive && av.gap > lurk) sp = Math.max(sp, Math.max(0, down) + C.AV_FOLLOW_MS);
  else if (skier.alive) {
    const merciful = Math.max(0, down - C.AV_MERCY_KMH / 3.6);
    if (sp > merciful) sp = merciful + hard * (sp - merciful);
  }
  av.speed = sp;
  av.frontY += sp * dt;
  av.roll += sp * dt;
  measure(av, skier, topDist);
  return skier.alive && av.gap <= C.AV_CATCH_M;
}

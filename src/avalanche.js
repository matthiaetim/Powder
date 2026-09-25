// Die Lawine (Chase): eine Front, die von oben nachrückt. Sie hält ein Tempo (Pace), das mit der Laufzeit
// steigt. Ist der Fahrer schneller, lauert sie knapp über dem oberen Bildrand; ist er langsamer, schließt sie
// mit der Differenz auf. Steht er, kommt sie nach AV_STALL_S an den Bildrand und rollt mit Pace-Tempo heran.
// Gnade beim Schuss (AV_MERCY_K, Standard aus): fährt er gerade bergab, spielt sie nur einen Teil ihres Tempo-
// Vorsprungs aus; je stärker die Kurve, desto mehr davon. Der Schneepflug zählt nicht als Schuss.
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

// topDist: Abstand vom Fahrer zum oberen Bildrand in m. Gibt true zurück, wenn sie den Fahrer erwischt.
export function updateAvalanche(av, skier, runT, dt, topDist) {
  av.t += dt;
  const pace = paceSpeed(runT);
  av.pace = pace;
  const down = skier.alive ? skier.v * Math.cos(skier.theta) : 0; // Tempo hangabwärts
  // Stillstand: nach AV_STALL_S wird die Front an den Bildrand geholt und rollt herein
  if (skier.alive && down < C.AV_STALL_KMH / 3.6) av.stallT += dt; else av.stallT = 0;
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
  let sp = pace;
  if (skier.alive && av.gap > lurk) sp = Math.max(sp, Math.max(0, down) + C.AV_FOLLOW_MS);
  else if (skier.alive) {
    const merciful = Math.max(0, down - C.AV_MERCY_KMH / 3.6);
    if (pace > merciful) sp = merciful + hard * (pace - merciful);
  }
  av.speed = sp;
  av.frontY += sp * dt;
  av.roll += sp * dt;
  av.gap = skier.y - av.frontY;
  av.near = clamp(1 - av.gap / lurk, 0, 1);
  av.threat = clamp(1 - av.gap / topDist, 0, 1);
  return skier.alive && av.gap <= C.AV_CATCH_M;
}

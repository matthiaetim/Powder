// Die Lawine: eine Front, die von oben nachrückt und mit der Distanz schneller wird.
import { C } from './constants.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function createAvalanche(skierY) {
  return { frontY: skierY - C.AV_START_GAP_M, speed: 0, gap: C.AV_START_GAP_M, t: 0 };
}

// frozen: im Ready-Zustand bleibt sie stehen. Gibt true zurück, wenn sie den Fahrer erwischt.
export function updateAvalanche(av, skier, dist, dt, frozen) {
  av.t += dt;
  if (!frozen) {
    let sp = Math.min(C.AV_MAX_MS, C.AV_BASE_MS + C.AV_RAMP_PER_M * dist);
    if (C.AV_RUBBER && av.gap > C.AV_MAX_GAP_M) sp = Math.max(sp, skier.v * Math.cos(skier.theta) + 2);
    av.speed = sp;
    av.frontY += sp * dt;
  }
  av.gap = skier.y - av.frontY;
  return av.gap <= C.AV_CATCH_M;
}

// 0 = weit weg, 1 = direkt hinter dem Fahrer.
export function avalancheVisibility(av) {
  return clamp((C.AV_VISIBLE_GAP_M - av.gap) / C.AV_VISIBLE_GAP_M, 0, 1);
}

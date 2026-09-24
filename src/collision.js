// Kreis-gegen-Kreis in den 3×3 Zellen um den Fahrer. In der Luft zählen Felsen nicht.
import { C } from './constants.js';
import { ROCK, TREE } from './physics.js';

export function checkCollision(world, s) {
  const size = C.CELL_M;
  const cx = Math.floor(s.x / size);
  const cy = Math.floor(s.y / size);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cell = world.cells.get(cx + dx + ',' + (cy + dy));
      if (!cell) continue;
      const objs = cell.objs;
      for (let i = 0; i < objs.length; i++) {
        const o = objs[i];
        if (o.y - s.y > 2 || s.y - o.y > 2) continue;
        if (s.airborne && (o.t === ROCK || (o.t === TREE && C.JUMP_CLEARS_TREES))) continue;
        const rr = C.SKIER_R + o.r;
        const ddx = o.x - s.x, ddy = o.y - s.y;
        if (ddx * ddx + ddy * ddy < rr * rr) return o;
      }
    }
  }
  return null;
}

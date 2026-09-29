// Slalom: orangefarbener Fangzaun am Pistenrand, Innenkante SL_PISTE_HALF_M je Seite der Pistenmitte (fence-view.js
// zeichnet ihn), nach Jürgens Entwurf. Das Netz ist elastisch: wer hineinfährt, taucht bis SL_NET_GIVE_M ein, eine
// Feder (SL_NET_SPRING) drückt ihn zurück, die Fahrt nach außen klingt ab (SL_NET_DAMP_S), und einmal je Anprall geht
// Tempo verloren (SL_FENCE_KEEP, danach SL_FENCE_BUMP_S Pause, sonst bremste jedes Entlangrutschen weiter). Kein Sturz.
// Die Beule im Netz (cs.fence) folgt dem Fahrer, solange er drin ist, und schwingt danach gedämpft zurück.
// Reines Modul ohne DOM wie gates.js.
import { C } from './constants.js';
import { laneX } from './world.js';
import { cv } from './gates.js';

// Innenkante des Zauns als Abstand zur Pistenmitte. Mit Zielstadion verengt er sich auf den letzten Metern weich
// auf die Breite des Zielbogens (Trichter).
export function halfAt(cs, y) {
  const h = cv(cs.spec, 'pisteHalf');
  if (!cs.spec.stadium) return h;
  const y0 = cs.finishY - C.STAD_FUNNEL_M, y1 = cs.finishY - C.STAD_FUNNEL_END_M;
  if (y <= y0 || y1 <= y0) return h;
  const fin = Math.min(h, C.STAD_FIN_HALF_M);
  if (y >= y1) return fin;
  const u = (y - y0) / (y1 - y0);
  return h + (fin - h) * u * u * (3 - 2 * u);
}

// Zustand der Beule: Lage (Welt-y), Seite, Tiefe in m (negativ = schwingt nach innen über), Geschwindigkeit
function stateOf(cs) {
  return cs.fence || (cs.fence = { y: 0, side: 1, depth: 0, vel: 0, bumpT: 0 });
}

// Freies Netz: die Beule schwingt gedämpft zurück. Auch nach dem Ziel (game.js coast), dort fängt der Zaun nicht mehr.
export function fenceRelax(cs, dt) {
  const f = stateOf(cs);
  f.bumpT = Math.max(0, f.bumpT - dt);
  if (f.depth === 0 && f.vel === 0) return;
  f.vel += (-C.SL_NET_K * f.depth - C.SL_NET_D * f.vel) * dt;
  f.depth += f.vel * dt;
  if (Math.abs(f.depth) < 0.005 && Math.abs(f.vel) < 0.02) { f.depth = 0; f.vel = 0; }
}

// Ein Schritt nach der Physik. Gibt true zurück bei einem neuen Anprall (Ton).
export function fenceClamp(cs, w, s, dt) {
  const f = stateOf(cs);
  const c = laneX(w, s.y), h = halfAt(cs, s.y) - C.SKIER_R - 0.05;
  const dx = s.x - c, side = Math.sign(dx) || 1;
  let pen = Math.abs(dx) - h;
  if (pen <= 0) { fenceRelax(cs, dt); return false; }
  f.bumpT = Math.max(0, f.bumpT - dt);
  // im Netz: nicht weiter als SL_NET_GIVE_M, die Feder schiebt zurück, der Winkel nach außen klingt schnell ab
  pen = Math.min(pen, C.SL_NET_GIVE_M);
  pen = Math.max(0, pen - C.SL_NET_SPRING * pen * dt);
  s.x = c + side * (h + pen);
  if (Math.sign(s.theta) === side) { s.theta *= Math.exp(-dt / C.SL_NET_DAMP_S); s.omega = 0; }
  f.vel = (pen - f.depth) / Math.max(dt, 1e-3);
  f.depth = pen;
  f.y = s.y;
  f.side = side;
  if (f.bumpT > 0) return false;
  f.bumpT = C.SL_FENCE_BUMP_S;
  s.v *= C.SL_FENCE_KEEP;
  return true;
}

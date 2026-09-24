// Schneepartikel: fester Pool, keine Allokation pro Frame.
import { C } from './constants.js';

export function createParticles() {
  const p = [];
  for (let i = 0; i < C.PARTICLE_POOL; i++) p.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, r: 1, tone: 0 });
  return { p, next: 0 };
}

export function clearParticles(ps) {
  for (const p of ps.p) p.life = 0;
}

export function spawnParticle(ps, x, y, vx, vy, life, r, tone) {
  const p = ps.p[ps.next];
  ps.next = (ps.next + 1) % ps.p.length;
  p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.r = r; p.tone = tone;
}

export function updateParticles(ps, dt) {
  const damp = Math.exp(-dt * 6);
  const arr = ps.p;
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    if (p.life <= 0) continue;
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= damp;
    p.vy *= damp;
  }
}

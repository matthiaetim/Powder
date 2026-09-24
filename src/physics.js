// Fahrermodell: Richtung (Basis aus Tipps + Carve aus Halten), Tempo, Sprung, Position.
import { C } from './constants.js';

const D2R = Math.PI / 180;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => t * t * (3 - 2 * t);

export const TREE = 0;
export const ROCK = 1;

export function createSkier() {
  return {
    x: 0, y: 0, y0: 0,
    v: 0,
    thetaBase: 0, thetaBaseTarget: 0, thetaCarve: 0, theta: 0, omega: 0,
    airborne: false, airT: 0, jumpCooldown: 0,
    carve: 0,
    side: 0, pressT: 0, carveAtPress: 0,
    alive: true,
  };
}

// Finger runter: ab sofort läuft die Carve-Rampe.
export function press(s, side) {
  s.side = side;
  s.pressT = 0;
  s.carveAtPress = s.thetaCarve;
}

// Loslassen nach einem Hold: ein Teil des Carves bleibt als Grundrichtung.
export function release(s) {
  if (s.side !== 0) {
    const max = C.BASE_MAX_DEG * D2R;
    const commit = C.HOLD_COMMIT_FRAC * s.thetaCarve;
    s.thetaBase = clamp(s.thetaBase + commit, -max, max);
    s.thetaBaseTarget = s.thetaBase;
    s.thetaCarve -= commit;
  }
  s.side = 0;
  s.pressT = 0;
}

// Kurzer Tipp: genau ein Schritt, unabhängig von der Tipp-Dauer.
export function tap(s, side, baseAtPress) {
  const max = C.BASE_MAX_DEG * D2R;
  const turn = C.TAP_TURN_DEG * D2R * (s.airborne ? C.AIR_TURN_FACTOR : 1);
  s.thetaBaseTarget = clamp(baseAtPress + side * turn, -max, max);
  s.thetaCarve = s.carveAtPress;
  s.side = 0;
  s.pressT = 0;
}

// Doppeltipp: der erste Tipp wird zurückgenommen, damit ein Doppeltipp ein reiner Sprung ist.
export function undoTap(s, baseAtPress) {
  s.thetaBaseTarget = baseAtPress;
}

export function jump(s) {
  if (s.airborne || s.jumpCooldown > 0 || !s.alive) return false;
  s.airborne = true;
  s.airT = 0;
  return true;
}

// 0..1, Flughöhe als Parabel.
export function jumpHeight(s) {
  if (!s.airborne) return 0;
  const t = s.airT / C.JUMP_AIR_S;
  return 4 * t * (1 - t);
}

// Ein Physik-Schritt. Gibt true zurück, wenn der Fahrer in diesem Schritt gelandet ist.
export function updateSkier(s, dt) {
  const baseMax = C.BASE_MAX_DEG * D2R;
  const carveMax = C.CARVE_MAX_DEG * D2R;
  const headMax = C.MAX_HEADING_DEG * D2R;

  if (C.FALL_LINE_PULL_DEG_S > 0 && s.side === 0) {
    const pull = C.FALL_LINE_PULL_DEG_S * D2R * dt;
    if (Math.abs(s.thetaBaseTarget) <= pull) s.thetaBaseTarget = 0;
    else s.thetaBaseTarget -= Math.sign(s.thetaBaseTarget) * pull;
  }

  s.thetaBase += (s.thetaBaseTarget - s.thetaBase) * (1 - Math.exp(-dt / C.TAP_EASE_S));
  s.thetaBase = clamp(s.thetaBase, -baseMax, baseMax);

  if (s.side !== 0) {
    s.pressT += dt;
    const k = smoothstep(clamp((s.pressT * 1000) / C.HOLD_RAMP_MS, 0, 1));
    const rate = lerp(C.HOLD_RATE_MIN_DEG_S, C.HOLD_RATE_MAX_DEG_S, k) * D2R * (s.airborne ? C.AIR_TURN_FACTOR : 1);
    s.thetaCarve = clamp(s.thetaCarve + s.side * rate * dt, -carveMax, carveMax);
  } else {
    s.thetaCarve *= Math.exp(-dt / C.CARVE_RELEASE_S);
  }

  const prevTheta = s.theta;
  s.theta = clamp(s.thetaBase + s.thetaCarve, -headMax, headMax);
  s.omega = (s.theta - prevTheta) / dt;
  s.carve = Math.abs(s.thetaCarve) / carveMax;

  const cos = Math.cos(s.theta);
  const sin = Math.sin(s.theta);
  let a = C.G_SLOPE * cos - C.DRAG_QUAD * s.v * s.v;
  if (!s.airborne) a -= C.EDGE_DRAG * sin * sin * s.v + C.SCRUB_K * Math.abs(s.omega) * s.v;
  s.v = Math.max(0, s.v + a * dt);

  let landed = false;
  if (s.airborne) {
    s.airT += dt;
    if (s.airT >= C.JUMP_AIR_S) {
      s.airborne = false;
      s.airT = 0;
      s.v *= C.LAND_SPEED_FACTOR;
      s.jumpCooldown = C.JUMP_COOLDOWN_S;
      landed = true;
    }
  } else if (s.jumpCooldown > 0) {
    s.jumpCooldown -= dt;
  }

  s.x += s.v * sin * dt;
  s.y += s.v * cos * dt;
  return landed;
}

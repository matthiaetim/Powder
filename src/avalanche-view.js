// Die Lawine im Bild: eine Staublawine, wie auf den Fotos. Eine weiße Wolkenfront aus runden Wülsten quillt von oben
// herab. Die Wülste sind von oben links beleuchtet wie das Relief der Bäume; ihre Schattenseiten und die Rinnen
// dazwischen sind blaugrau, nur so hebt sich Weiß vom Schnee ab. Der Körper brodelt: Wülste wachsen, wandern vor und
// vergehen. An der Vorderkante kugeln Wülste heraus und werden vom nächsten überrollt, davor stiebt Staub über den
// Schnee. Je näher sie kommt, desto mehr Pulverschnee hängt in der Luft, das Bild wird milchig.
// Alles ist aus Zeit und Weg der Front berechnet (kein Zustand pro Bild), Pause und Fresh müssen nichts zurücksetzen.
// Die Wülste hängen an Welt-x: beim Kameraschwenk ziehen sie mit dem Hang, nicht mit dem Bild.
import { C } from './constants.js';

const TAU = Math.PI * 2;
const frac = (v) => v - Math.floor(v);
const hash = (n) => frac(Math.sin(n * 12.9898 + 78.233) * 43758.5453); // deterministisches Rauschen 0..1
const smooth = (u) => u * u * (3 - 2 * u);

// Wulst-Sprites: ein Wulst ist ein Blumenkohl aus Teilkugeln (Varianten in CLUSTERS, Koordinaten und Radien in
// Einheiten des Wulstradius um seinen Mittelpunkt). Jede Teilkugel hat Glanz oben links und einen weichen Schatten
// unten rechts, der ganze Wulst wirft einen Schatten nach unten rechts. Im Sprite sitzt der Mittelpunkt bei
// SPRITE_CX/CY der Kantenlänge, der Wulstradius ist SPRITE_R davon: rechts unten braucht der Schatten Platz.
const CLUSTERS = [
  [[0, 0.05, 1], [-0.55, -0.45, 0.62], [0.5, -0.5, 0.55], [0.05, -0.75, 0.42], [-0.9, 0.15, 0.48], [0.85, 0.1, 0.5]],
  [[0.05, 0, 1], [-0.6, -0.35, 0.7], [0.6, -0.4, 0.5], [-0.15, -0.78, 0.4], [0.85, 0.2, 0.45]],
  [[-0.05, 0.05, 0.95], [0.45, -0.55, 0.6], [-0.5, -0.55, 0.5], [0.9, 0.05, 0.45], [-0.9, 0.05, 0.45], [0.1, -0.95, 0.3]],
  [[0, 0, 1], [-0.7, -0.2, 0.6], [0.7, -0.25, 0.6], [0, -0.75, 0.5], [-0.35, -0.9, 0.3]],
];
// Jedes Sprite liegt in mehreren Größen vor (Kantenlänge in Gerätepixeln), gezeichnet wird die kleinste, die nicht
// vergrößert werden muss. Die Sprites werden ohne Glättung gezeichnet (siehe drawCloud), und dabei darf ein Sprite
// höchstens um 2× verkleinert werden, sonst fallen zu viele Pixel weg und die weichen Ränder werden körnig.
const LOBE_PX = [28, 56, 112, 224];
const DUST_PX = [24, 48, 96];
const SPRITE_R = 0.33;
const SPRITE_CX = 0.46;
const SPRITE_CY = 0.4;

// Reihen des Wolkenkörpers von hinten nach vorn: Abstand hinter der Front, Wulstradius und Rasterabstand in m.
// Vorn kleinteilig und dicht, hinten größer und im Dunst.
const ROWS = [
  { d: 14.8, r: 3.2, sp: 5.7 },
  { d: 10.8, r: 3.0, sp: 4.9 },
  { d: 7.4, r: 2.6, sp: 4.2 },
  { d: 4.6, r: 2.2, sp: 3.6 },
  { d: 2.2, r: 1.9, sp: 3.1 },
];
const ROW_DRIFT_M = 1.4;    // so weit wandert ein Wulst des Körpers in seinem Zyklus nach vorn
const CORE_EDGE_M = 3.4;    // Unterkante des Wolkeninneren hinter der Front, wellig, unter den vorderen Reihen
const CORE_FADE_M = 18;     // darüber geht das Innere in den fernen Dunst über
// Vorderkante: zwei Lagen von Wülsten, die aus dem Körper herauskugeln. Große, langsame Ballen geben der Front ihre
// Form (im Foto sind die vordersten die größten), kleine, schnelle darüber das Brodeln. sp: Raster in m, rate:
// Zyklen je Brodel-Zyklus (min..max), r: Radius am Anfang und am Ende in m, start: so weit hinter der Front beginnt
// der Weg, reach: so weit vor die Front reicht der Wulst am Ende (AV_CATCH_M in constants.js ist 0).
const FRONT_BIG = { sp: 4.6, rate: [0.35, 0.6], r: [1.4, 3.2], start: 4.5, reach: 0.6, seed: 23.7 };
const FRONT_SMALL = { sp: 1.6, rate: [0.8, 1.3], r: [0.7, 2.2], start: 2.8, reach: 0.9, seed: 11.1 };
const DUST_SP_M = 1.8;      // Raster der Staubwölkchen vor der Front
const DUST_REACH_M = 6;     // so weit stiebt der Staub vor die Front (AV_ENTER_M in constants.js passt dazu)
const GROUND_SHADOW_M = 3;  // so weit fällt der Schatten der Wolke vor ihr auf den Schnee
const FLOW_PER_S = 0.55;    // Brodeln: Zyklen pro Sekunde, auch wenn die Front steht …
const FLOW_PER_M = 0.02;    // … plus Zyklen je Meter Weg der Front: bei 145 km/h kugelt es gut doppelt so schnell

function makeLobe(parts, n) {
  const c = document.createElement('canvas');
  c.width = n; c.height = n;
  const x = c.getContext('2d');
  const cx = n * SPRITE_CX, cy = n * SPRITE_CY, R = n * SPRITE_R, sh = C.AV_SHADE_RGB;
  const disc = (px, py, r, stops) => {
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    for (const [k, col] of stops) g.addColorStop(k, col);
    x.fillStyle = g;
    x.beginPath();
    x.arc(px, py, r, 0, TAU);
    x.fill();
  };
  // Schatten des ganzen Wulstes auf Nachbarn und Schnee, nach unten rechts
  disc(cx + 0.4 * R, cy + 0.5 * R, 1.15 * R, [[0, `rgba(${sh},0.4)`], [0.5, `rgba(${sh},0.25)`], [1, `rgba(${sh},0)`]]);
  // Teilkugeln: die rechts unten zuerst, die links oben liegen darüber. Jede hat ihren Schatten nach unten rechts,
  // darüber die Kugel selbst: Glanz oben links, zur Schattenseite hin blaugrau, am Rand weich auslaufend, ohne Linie.
  const order = parts.slice().sort((a, b) => (b[0] + b[1]) - (a[0] + a[1]));
  for (const [dx, dy, dr] of order) {
    const px = cx + dx * R, py = cy + dy * R, r = dr * R;
    disc(px + 0.3 * r, py + 0.35 * r, 1.05 * r, [[0, `rgba(${sh},0.6)`], [0.5, `rgba(${sh},0.4)`], [1, `rgba(${sh},0)`]]);
    const g = x.createRadialGradient(px - 0.28 * r, py - 0.3 * r, 0, px, py, r);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.55, '#FFFFFF');
    g.addColorStop(0.82, `rgb(${C.AV_LIT_RGB})`);
    g.addColorStop(1, `rgba(${C.AV_CORE_RGB},0)`);
    x.fillStyle = g;
    x.beginPath();
    x.arc(px, py, r, 0, TAU);
    x.fill();
  }
  return c;
}

// Staubwölkchen: sehr weich, fast nur Weiß. Auf dem Schnee sieht man es vor allem über dem Bodenschatten der Front.
function makeDust(n) {
  const c = document.createElement('canvas');
  c.width = n; c.height = n;
  const x = c.getContext('2d');
  const m = n / 2;
  const g = x.createRadialGradient(m, m, 0, m, m, m);
  g.addColorStop(0, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  g.addColorStop(0.8, `rgba(${C.AV_LIT_RGB},0.18)`);
  g.addColorStop(1, `rgba(${C.AV_LIT_RGB},0)`);
  x.fillStyle = g;
  x.fillRect(0, 0, n, n);
  return c;
}

// Einmal vorgerendert: die Wulst-Varianten und das Staubwölkchen, je in allen Größen.
export function makeAvSprites() {
  return { lobes: CLUSTERS.map((parts) => LOBE_PX.map((n) => makeLobe(parts, n))), dust: DUST_PX.map(makeDust) };
}

// Die kleinste Größe, die für eine Kantenlänge von px Gerätepixeln nicht vergrößert werden muss
function level(imgs, px) {
  for (let k = 0; k < imgs.length; k++) if (imgs[k].width >= px) return imgs[k];
  return imgs[imgs.length - 1];
}

// Wulst mit Radius rPx (CSS-Pixel) um (x, y); v wählt die Variante, dpr die Sprite-Größe
function lobeAt(ctx, spr, v, x, y, rPx, dpr) {
  if (rPx < 0.5) return;
  const e = rPx / SPRITE_R;
  ctx.drawImage(level(spr.lobes[v % spr.lobes.length], e * dpr), x - SPRITE_CX * e, y - SPRITE_CY * e, e, e);
}

export function drawAvalanche(R, g, ox, oy, t) {
  const av = g.av, S = R.Sv;
  const fy = av.frontY * S + oy;          // Vorderkante im Bild
  if (fy < -(DUST_REACH_M + 1.5) * S) return; // was vor der Front liegt, reicht höchstens so weit
  const { ctx, W, H } = R;
  // Pulverschnee in der Luft: je näher die Front, desto milchiger das ganze Bild
  if (av.threat > 0) {
    ctx.fillStyle = `rgba(${C.AV_HAZE_RGB},${(C.AV_HAZE_ALPHA * av.threat).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
  // av.t statt der Bildzeit: steht die Simulation (Pause), steht auch die Wolke
  drawCloud(ctx, R.sprites.av, W, H, fy, S, ox, av.t * FLOW_PER_S + av.roll * FLOW_PER_M, av.t, R.dpr);
}

// Die Wolke selbst, auch für die Vorschaukarte (render.js): Vorderkante bei fy (CSS-Pixel), Maßstab S (px/m),
// ox = Bild-x von Welt-x 0, flow = Fortschritt des Brodelns in Zyklen, t = Zeit in s für kleine Wackler,
// dpr = Gerätepixel je CSS-Pixel (wählt die Sprite-Größe).
export function drawCloud(ctx, spr, W, H, fy, S, ox, flow, t, dpr) {
  const sh = C.AV_SHADE_RGB;
  const { dust } = spr;
  // Die Front ist nicht gerade: sie wellt sich quer zum Hang und die Wellen wandern langsam (in m, zu Welt-x)
  const wave = (xm) => 1.0 * Math.sin(xm * 0.53 + flow * 0.6) * Math.sin(xm * 0.19 + 2.1) + 0.4 * Math.sin(xm * 1.1 - flow * 0.9);
  // Wolkeninneres: was zwischen den Wülsten durchscheint. Vom oberen Bildrand bis kurz hinter die Front, Unterkante
  // wellig unter den vorderen Reihen; nach oben hin heller, ferner Dunst.
  const edgeY = fy - CORE_EDGE_M * S;
  const stepX = Math.max(4, S);
  if (edgeY + 1.2 * S > 0) {
    const grad = ctx.createLinearGradient(0, Math.max(0, edgeY - CORE_FADE_M * S), 0, edgeY);
    grad.addColorStop(0, `rgb(${C.AV_FAR_RGB})`);
    grad.addColorStop(1, `rgb(${C.AV_CORE_RGB})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-1, -1);
    for (let x = 0; x <= W + stepX; x += stepX) ctx.lineTo(x, edgeY + wave((x - ox) / S) * S);
    ctx.lineTo(W + 1, -1);
    ctx.closePath();
    ctx.fill();
  }
  // Bodenschatten: die Wolke wirft ihren Schatten vor sich auf den Schnee, der Welle der Front folgend
  if (fy + (GROUND_SHADOW_M + 1.2) * S > 0 && fy - 2 * S < H) {
    const grad = ctx.createLinearGradient(0, fy - 0.8 * S, 0, fy + GROUND_SHADOW_M * S);
    grad.addColorStop(0, `rgba(${sh},0.3)`);
    grad.addColorStop(1, `rgba(${sh},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    for (let x = 0; x <= W + stepX; x += stepX) {
      const y = fy + (wave((x - ox) / S) - 0.8) * S;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    for (let x = W + stepX; x >= 0; x -= stepX) ctx.lineTo(x, fy + (wave((x - ox) / S) + GROUND_SHADOW_M) * S);
    ctx.closePath();
    ctx.fill();
  }
  // Sprites ohne Glättung: sie sind selbst weich, und ein geglättetes, skaliertes drawImage kostet beim Rastern auf
  // der CPU ein Vielfaches (Chrome misst 10×). Die Größenstaffel oben hält den Sprung unter 2×, das sieht man nicht.
  ctx.imageSmoothingEnabled = false;
  // Körper: Reihen von Wülsten, hinten zuerst und je Reihe von rechts nach links, so fällt der Schatten jedes
  // Wulstes auf den Nachbarn rechts und auf die Reihe dahinter, deren Schattenseite unter der nächsten Reihe
  // hervorschaut: das sind die Rinnen. Jeder Wulst lebt in einem Zyklus: er wächst schnell, bleibt, vergeht und
  // wandert dabei ein Stück nach vorn. So brodelt die Masse.
  for (let ri = 0; ri < ROWS.length; ri++) {
    const row = ROWS[ri];
    const yRow = fy - row.d * S, reach = row.r * 2.2 * S; // Schultern, Schatten und Welle reichen über den Radius hinaus
    if (yRow - reach > H || yRow + reach < 0) continue;
    const spPx = row.sp * S;
    const i0 = Math.floor(-ox / spPx) - 1, i1 = Math.ceil((W - ox) / spPx) + 1;
    for (let i = i1; i >= i0; i--) {
      const s = i * 7.13 + ri * 3.71;
      const u = frac(flow * (0.7 + 0.6 * hash(s)) + hash(s + 1));
      const bump = Math.pow(Math.sin(Math.PI * u), 0.4);
      const xm = (i + 0.5 * (ri & 1) + (hash(s + 2) - 0.5) * 0.7) * row.sp;
      const y = yRow + ((hash(s + 3) - 0.5) * 0.9 + (u - 0.5) * ROW_DRIFT_M + wave(xm)) * S;
      lobeAt(ctx, spr, Math.floor(hash(s + 4) * 4), xm * S + ox, y, row.r * (0.8 + 0.4 * hash(s + 5)) * bump * S, dpr);
    }
  }
  // Vorderkante: erst die großen Ballen, darüber die kleinen
  frontLobes(ctx, spr, W, fy, S, ox, flow, wave, dpr, FRONT_BIG);
  frontLobes(ctx, spr, W, fy, S, ox, flow, wave, dpr, FRONT_SMALL);
  // Staub: Wölkchen, die vor der Front über den Schnee stieben, wachsen und verwehen
  const d0 = Math.floor(-ox / (DUST_SP_M * S)) - 1, d1 = Math.ceil((W - ox) / (DUST_SP_M * S)) + 1;
  for (let j = d0; j <= d1; j++) {
    const s = j * 9.77 + 3.3;
    const u = frac(flow * (0.5 + 0.4 * hash(s)) + hash(s + 1));
    const xm = (j + (hash(s + 2) - 0.5)) * DUST_SP_M + Math.sin(t * 0.9 + s) * 0.5;
    const y = fy + (wave(xm) + 0.2 + DUST_REACH_M * u) * S;
    const r = (0.5 + 1.4 * u) * S;
    ctx.globalAlpha = (1 - u) * 0.7;
    ctx.drawImage(level(dust, 2 * r * dpr), xm * S + ox - r, y - r, 2 * r, 2 * r);
  }
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true;
}

// Eine Lage Wülste an der Vorderkante (FRONT_BIG, FRONT_SMALL): jeder kugelt in seinem Zyklus aus dem Körper heraus
// und wächst dabei, dann wird er vom nächsten überrollt: er fällt zurück und löst sich auf.
function frontLobes(ctx, spr, W, fy, S, ox, flow, wave, dpr, L) {
  const j0 = Math.floor(-ox / (L.sp * S)) - 1, j1 = Math.ceil((W - ox) / (L.sp * S)) + 1;
  for (let j = j1; j >= j0; j--) {
    const s = j * 5.37 + L.seed;
    const u = frac(flow * (L.rate[0] + (L.rate[1] - L.rate[0]) * hash(s)) + hash(s + 1));
    const k = smooth(Math.min(1, u / 0.6));
    const late = Math.max(0, (u - 0.6) / 0.4);
    ctx.globalAlpha = u < 0.12 ? u / 0.12 : u > 0.72 ? (1 - u) / 0.28 : 1;
    const xm = (j + (hash(s + 2) - 0.5) * 0.8) * L.sp;
    const r = (L.r[0] + (L.r[1] - L.r[0]) * k) * (0.9 + 0.2 * hash(s + 3));
    const yc = -L.start + (L.start + L.reach - r) * k - 0.8 * late * late + wave(xm);
    lobeAt(ctx, spr, Math.floor(hash(s + 4) * 4), xm * S + ox, fy + yc * S, r * S, dpr);
  }
  ctx.globalAlpha = 1;
}

// Piste durchrechnen: die Bot-Fahrer aus dem Duell (src/bot.js) fahren die feste Strecke mit der echten Physik.
// Aufruf: node tools/piste-sim.mjs [Läufe je Stufe, Standard 20] [--levels 2,3] [--route easy|hard] [--set KEY=WERT …]
// --levels: nur diese Bot-Stufen (1 Anfänger … 6 Legende). --route: an jeder Gabelung der leichtere Zweig (Standard)
// oder der schwerere. --set: eine Konstante für diesen Lauf überschreiben, zum Ausprobieren, bevor der Wert in
// constants.js landet.
// Je Stufe: wie viele Läufe die 7000 m und das Ziel erreichen, mittlere Weite, Stürze und Zeit. Ein Lauf endet wie im
// Spiel mit dem Sturz nach den freien (PISTE_FREE_CRASHES). Die Strecke ist immer dieselbe, der Seed des Bots würfelt
// nur, welche Hindernisse er zu spät sieht. Die anderen Fahrer und alles, was am Pistenrand steht, sind dabei
// (piste-life.js). Nicht dabei: Sprünge (der Bot fährt über Kicker hinweg), das Fangnetz am Ziehweg und die Wand der
// Steilkurve (beides fängt im Spiel auf, hier stürzt der Bot am Wald dahinter) und die Dunkelheit im Flutlicht. Die
// Zahlen sind also eine Schätzung, die am Ziehweg und im Funpark eher zu streng ist und im Dunkeln zu milde.
import { C } from '../src/constants.js';
import { createWorld } from '../src/world.js';
import { createPiste, worldOpts, paceAt, levelAt, onPiste, centerAt } from '../src/piste.js';
import { createLife, moveNpcs } from '../src/piste-life.js';
import { createBot, advanceBot } from '../src/bot.js';

const args = process.argv.slice(2);
const runs = Math.max(1, parseInt(args[0], 10) || 20);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : ''; };
const levels = opt('--levels') ? opt('--levels').split(',').map(Number) : C.BOT_LEVELS.map((_, i) => i + 1);
const hard = opt('--route') === 'hard';
args.forEach((a, i) => {
  if (a !== '--set') return;
  const [key, val] = String(args[i + 1]).split('=');
  if (!(key in C)) throw new Error('unbekannte Konstante ' + key);
  C[key] = JSON.parse(val);
  console.log(`${key} = ${val}`);
});
const fin = C.PISTE_FINISH_M;
const piste = createPiste(C.PISTE_SEED);
const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
// Zweig je Gabelung: der mit der kleineren Farbe (blau < rot < schwarz) ist der leichtere
const laneFor = (y) => {
  for (const f of piste.forks) if (y >= f.y0 && y <= f.y1) return (f.grades[1] > f.grades[0]) === hard ? 1 : 0;
  return 0;
};

console.log(`Piste ${fin} m, Seed ${C.PISTE_SEED}, ${runs} Läufe je Stufe, ${C.PISTE_FREE_CRASHES} freie Stürze, Gabelungen: ${hard ? 'schwerer' : 'leichter'} Zweig, ${piste.npcs.length} andere Fahrer`);
console.log('Stufe            ≥7000 m   im Ziel   Weite Ø   Stürze Ø   Zeit im Ziel Ø   beste Zeit   Tempo Ø   neben der Piste');
for (const level of levels) {
  let far = 0, done = 0, sumM = 0, sumC = 0, sumT = 0, sumKmh = 0, off = 0, steps = 0, bestT = Infinity;
  const crashAt = [], causes = {};
  for (let k = 0; k < runs; k++) {
    const world = createWorld(C.PISTE_SEED, { ...worldOpts(piste), center: (y) => centerAt(piste, y, laneFor(y)) });
    const life = createLife(piste);
    const stat = piste.hits;
    let hi = 0;
    const extra = () => {
      const out = life.npcs.slice();
      const s = b.s;
      while (hi < stat.length && stat[hi].y < s.y - 8) hi++;
      for (let i = hi; i < stat.length && stat[i].y <= s.y + 140; i++) out.push(stat[i]);
      return out;
    };
    const b = createBot({
      seed: 1000 + k * 7919, level, target: fin, pause: C.PISTE_CRASH_PAUSE_S, world,
      pace: (s) => paceAt(piste, s.x, s.y), extra, onStep: (bot, dt) => moveNpcs(life, bot.s, dt),
    });
    let seen = 0, m = 0;
    for (let t = 0.5; t < 3600 && !b.done; t += 0.5) {
      advanceBot(b, t);
      steps++;
      if (b.state === 'run' && !onPiste(piste, b.s.x, b.s.y)) off++;
      if (b.crashes > seen) {
        seen = b.crashes; crashAt.push(Math.round(b.s.y));
        const c = b.hit.k === 'npc' ? 'Fahrer' : typeof b.hit.f === 'string' ? b.hit.f : 'Wald';
        causes[c] = (causes[c] || 0) + 1;
      }
      if (b.crashes > C.PISTE_FREE_CRASHES) break; // der Sturz nach den freien beendet den Lauf
    }
    m = b.done ? fin : Math.min(fin, b.s.y);
    if (m >= 7000) far++;
    if (b.done) { done++; sumT += b.fin; sumKmh += (fin / b.fin) * 3.6; bestT = Math.min(bestT, b.fin); }
    sumM += m; sumC += Math.min(b.crashes, C.PISTE_FREE_CRASHES + 1);
  }
  const name = C.BOT_LEVELS[level - 1].name.padEnd(16);
  console.log(`${name} ${String(Math.round((far / runs) * 100)).padStart(5)} %  ${String(Math.round((done / runs) * 100)).padStart(6)} %  ${String(Math.round(sumM / runs)).padStart(7)} m  ${(sumC / runs).toFixed(1).padStart(8)}  ${(done ? fmtT(sumT / done) : '–').padStart(15)}  ${(done ? fmtT(bestT) : '–').padStart(10)}  ${(done ? Math.round(sumKmh / done) + ' km/h' : '–').padStart(8)}  ${((off / steps) * 100).toFixed(0).padStart(6)} %`);
  if (crashAt.length) {
    const by = {};
    for (const y of crashAt) { const km = Math.floor(y / 1000); by[km] = (by[km] || 0) + 1; }
    console.log('   Stürze je Kilometer: ' + Object.entries(by).map(([km, n]) => `${km}–${Number(km) + 1} km: ${n}`).join(', '));
    console.log('   Stürze woran: ' + Object.entries(causes).map(([c, n]) => `${c}: ${n}`).join(', '));
  }
}

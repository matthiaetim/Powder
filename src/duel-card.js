// Kachel „Duell“ (DOM) auf der Fresh-Seite, wie die anderen Kacheln über body[data-panel="duel"] sichtbar (hud.js).
// Drei Ansichten aus einem Satz Elemente: Beitritt (Name, neuer Raum, Code eingeben), Lobby (Raum-Code, Teilen,
// Startnummern, Zielschild, Los/Bereit, Code eingeben) und Ergebnis (Sieger, Zeiten, Stürze, Zähler, Revanche). Gegen
// den Bot (Knopf „Gegen Bot“) stehen in der Lobby statt Raum-Code und Beitreten die sechs Stufen zur Wahl. Zeigt
// den Stand aus duel.js (view) an und reicht Tipps weiter. Eingabefelder, Regler und der Teilen-Knopf tragen .native:
// input.js lässt ihnen den nativen Tipp, nur so kommen Tastatur, Wischen und der click für navigator.share.
import { C } from './constants.js';
import { isTuned } from './tune.js';
import { drawRiderPreview } from './render.js';
import { t } from './i18n.js';

export function createDuelCard(doc, g, duel, { onTap, board, fmtClock, nf, nf1, onLeave }) {
  const $ = (id) => doc.getElementById(id);
  const card = $('duel-card'), noteEl = $('duel-note'), errEl = $('duel-error');
  const nameRow = $('duel-name-row'), nameIn = $('duel-name'), createBtn = $('btn-duel-create');
  const codeRow = $('duel-code-row'), codeEl = $('duel-code'), shareBtn = $('btn-duel-share');
  const bibsEl = $('duel-bibs'), targetEl = $('duel-target'), targetVal = $('duel-target-val'), range = $('duel-target-range');
  const goBtn = $('btn-duel-go'), verdictEl = $('duel-verdict'), linesEl = $('duel-lines'), againBtn = $('btn-duel-again');
  const joinRow = $('duel-join-row'), codeIn = $('duel-code-in'), joinBtn = $('btn-duel-join'), leaveBtn = $('btn-duel-leave');
  const levelsEl = $('duel-levels'), botBtn = $('btn-duel-bot'), humanBtn = $('btn-duel-human');
  range.min = String(C.DUEL_TARGET_MIN_M);
  range.max = String(C.DUEL_TARGET_MAX_M);
  range.step = String(C.DUEL_TARGET_STEP_M);
  let sliding = false; // Regler unter dem Finger: den Wert nicht aus dem Raum zurückschreiben
  let shareNote = '';

  const el = (tag, cls, text) => {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const meters = (m) => nf.format(m) + ' m';
  const levelBtns = C.BOT_LEVELS.map((lv, i) => {
    const b = el('button', 'duel-level', String(i + 1));
    b.type = 'button';
    onTap(b, () => duel.setBotLevel(i + 1));
    levelsEl.append(b);
    return b;
  });
  const crashText = (n) => (n === 0 ? t('duel.crash0') : n === 1 ? t('duel.crash1') : t('duel.crashN', { n: nf.format(n) }));

  // Startnummer eines Spielers (Host 1, Gast 2); ohne Spieler eine gestrichelte Leerstelle
  function bib(num, p, mine, v) {
    if (!p) return el('div', 'bib empty', t('duel.waitingOpp'));
    const b = el('div', 'bib' + (mine ? ' me' : ''));
    const cv = el('canvas', 'rider-preview');
    drawRiderPreview(cv, p.rider, 40);
    let state = mine ? t('duel.you') : '';
    if (num === 1) state = mine ? t(v.vsBot ? 'duel.you' : 'duel.youHost') : t('duel.host');
    if (num === 2 && p.ready) { state = t(mine ? 'duel.youReady' : 'duel.ready'); b.classList.add('ready'); }
    if (num === 2 && !p.ready) state = t(mine ? 'duel.you' : 'duel.notReady');
    if (p.bot) state = t('duel.botLevel', { n: p.bot });
    if (!mine && v.oppVersion && !v.versionOk) { state = t('duel.version', { v: v.oppVersion }); b.classList.add('warn'); }
    if (!mine && v.oppGone) { state = t('duel.gone'); b.classList.add('warn'); }
    b.append(el('div', 'bib-num', String(num)), cv, el('div', 'bib-name', p.name), el('div', 'bib-state', state));
    return b;
  }

  function renderResult(v) {
    const r = v.verdict;
    const oppName = (v.opp && v.opp.name) || (r && r.oppName) || t('duel.opponent');
    verdictEl.replaceChildren();
    let title, sub = '';
    if (!r) {
      title = t(v.myFin > 0 ? 'duel.finish' : 'duel.over');
      sub = v.out ? t('duel.timeOut') : t('duel.waitFor', { n: oppName }) + (v.oppLive && v.oppLive.y > 0 ? t('duel.at', { m: meters(Math.floor(v.oppLive.y)) }) : '');
    } else {
      title = t(r.result === 'w' ? 'duel.won' : r.result === 'l' ? 'duel.lost' : 'duel.draw');
      if (r.reason === 'gone') sub = t('duel.isGone', { n: oppName });
      else if (r.reason === 'out') sub = r.result === 'w' ? t(v.vsBot ? 'duel.slower' : 'duel.oppTimeOut', { n: oppName }) : t('duel.timeOut');
    }
    verdictEl.append(doc.createTextNode(title));
    if (sub) verdictEl.append(el('span', 'sub', sub));
    const mine = el('div', 'duel-line me');
    mine.append(el('span', '', t('duel.me')), el('span', 'num', v.myFin > 0 ? fmtClock(v.myFin, false) : v.outY > 0 ? meters(Math.floor(v.outY)) : t('noFinish')), el('span', 'sub', crashText(v.myCrashes)));
    const theirs = el('div', 'duel-line');
    const ol = v.oppLive;
    const oppFin = r ? r.oppFin : ol && ol.fin > 0 ? ol.fin : 0;
    const oppDone = r ? true : !!(ol && ol.done);
    theirs.append(el('span', '', oppName),
      // der Bot hört auf, sobald er verloren hat: statt „kein Ziel“ steht, wie weit er war
      el('span', 'num', oppFin > 0 ? fmtClock(oppFin, false) : oppDone && !(v.vsBot && ol && ol.y > 0) ? t('noFinish') : ol && ol.y > 0 ? meters(Math.floor(ol.y)) : '…'),
      el('span', 'sub', ol ? crashText(ol.c || 0) : ''));
    linesEl.replaceChildren(mine, theirs);
    if (v.tally) {
      const tl = v.tally;
      linesEl.append(el('div', 'duel-tally', t('duel.tally', { n: oppName, w: tl.w, l: tl.l }) + (tl.d ? t('duel.tallyDraw', { d: tl.d }) : '')));
    }
    againBtn.hidden = !r; // erst wenn das Ergebnis feststeht, sonst risse der Host dem anderen den Lauf weg
    if (v.role === 'host') againBtn.textContent = v.oppWantsRematch ? t('duel.againWants', { n: oppName }) : t('duel.again');
    else againBtn.textContent = t(v.ready ? 'duel.againAsked' : 'duel.againAsk');
  }

  function render() {
    const v = duel.view();
    const view = v.phase === 'result' || (v.phase === 'race' && v.done) ? 'result'
      : v.phase === 'lobby' || v.phase === 'count' || v.phase === 'race' ? 'lobby' : 'join';
    card.dataset.view = view;
    const show = (node, on) => { node.hidden = !on; };
    show(nameRow, view === 'join' && !v.hasName);
    show(createBtn, view === 'join' && v.hasName);
    const lobbyOpen = view === 'lobby' && v.phase === 'lobby';
    show(codeRow, view === 'lobby' && !v.vsBot);
    show(levelsEl, view === 'lobby' && v.vsBot);
    // Gegen den Bot geht es, solange kein Mitspieler im Raum ist; zurück zum Mitspieler aus der Bot-Lobby
    show(botBtn, view === 'join' || (lobbyOpen && !v.vsBot && v.role === 'host' && !v.guest));
    show(humanBtn, lobbyOpen && v.vsBot);
    show(bibsEl, view === 'lobby');
    show(targetEl, view === 'lobby');
    show(goBtn, view === 'lobby');
    show(verdictEl, view === 'result');
    show(linesEl, view === 'result');
    show(againBtn, view === 'result' && !!v.verdict);
    show(joinRow, view !== 'result' && v.hasName && !v.vsBot);
    errEl.textContent = v.error || '';

    if (view === 'join') {
      noteEl.textContent = v.notice || t(!v.hasName ? 'duel.needName' : v.busy ? 'duel.connecting'
        : !v.netOk ? 'duel.needNet' : 'duel.joinHint');
      if (v.pendingCode && !codeIn.value) codeIn.value = v.pendingCode;
      if (nameIn.value === '' && v.myName) nameIn.value = v.myName;
      return;
    }
    if (view === 'lobby') {
      codeEl.textContent = v.code.split('').join(' ');
      if (codeIn.value === v.code) codeIn.value = ''; // der eigene Code gehört nicht ins Feld zum Beitreten
      const hostBib = bib(1, v.host, v.role === 'host', v), guestBib = bib(2, v.guest, v.role === 'guest', v);
      bibsEl.replaceChildren(hostBib, guestBib);
      if (!sliding) { range.value = String(v.target); targetVal.textContent = meters(v.target); }
      range.disabled = v.role !== 'host';
      levelBtns.forEach((b, i) => {
        b.classList.toggle('active', i + 1 === v.botLevel);
        b.disabled = v.phase !== 'lobby';
        b.setAttribute('aria-label', t('duel.level', { i: i + 1, name: t('bot.' + (i + 1)) }));
      });
      const hints = [];
      if (v.phase === 'count') hints.push(t('duel.starting'));
      else if (v.vsBot) hints.push(t('duel.botHint'), t('duel.botPause'));
      else if (v.role === 'host') hints.push(v.guest ? (v.canGo ? t('duel.allReady') : v.versionOk ? t('duel.waitReady', { n: v.guest.name }) : t('duel.reload')) : t('duel.shareHint'));
      else hints.push(v.ready ? t('duel.waitHost', { n: v.host ? v.host.name : t('duel.theHost') }) : t('duel.tapReady'));
      hints.push(t('duel.pause', { v: nf1.format(v.pause) }));
      if (isTuned()) hints.push(t('duel.tuned'));
      if (shareNote) hints.push(shareNote);
      if (v.role && !v.streaming) hints.push(t('duel.noStream'));
      noteEl.textContent = hints.join(' · ');
      if (v.role === 'host') { goBtn.textContent = t(v.phase === 'count' ? 'duel.starting' : 'duel.go'); goBtn.disabled = !v.canGo || v.phase === 'count'; }
      else { goBtn.textContent = t(v.phase === 'count' ? 'duel.starting' : v.ready ? 'duel.readyBtnOn' : 'duel.readyBtn'); goBtn.disabled = v.phase === 'count'; }
      return;
    }
    noteEl.textContent = v.notice || (v.round > 1 ? t('duel.round', { n: v.round }) : '');
    renderResult(v);
  }

  // Name wie bei der Bestenliste: dieselbe Identität, gespeichert beim Verlassen des Felds; danach geht es weiter
  nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); nameIn.blur(); } });
  nameIn.addEventListener('blur', () => {
    if (!board.setName(nameIn.value)) { nameIn.value = board.name(); return; }
    duel.open(duel.view().pendingCode);
  });
  codeIn.addEventListener('input', () => { codeIn.value = codeIn.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, C.DUEL_CODE_LEN); });
  codeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); codeIn.blur(); duel.join(codeIn.value); } });
  onTap(joinBtn, () => { codeIn.blur(); duel.join(codeIn.value); });
  onTap(createBtn, () => duel.create());
  onTap(botBtn, () => duel.openBot());
  onTap(humanBtn, () => duel.openHuman());
  onTap(goBtn, () => {
    const v = duel.view();
    if (v.role === 'host') duel.go(); else duel.setReady(!v.ready);
  });
  onTap(againBtn, () => duel.rematch());
  // Zurück sofort, das Austragen aus dem Raum läuft im Hintergrund weiter (leave räumt den Stand vor dem ersten await)
  onTap(leaveBtn, () => { const p = duel.leave(); onLeave(); return p; });
  // Teilen braucht eine echte Nutzergeste: der Knopf ist .native, deshalb kommt hier ein click
  shareBtn.addEventListener('click', () => {
    const data = duel.shareData();
    shareNote = '';
    if (navigator.share) {
      navigator.share(data).catch(() => { /* abgebrochen */ });
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(`${data.text} ${data.url}`).then(() => { shareNote = t('duel.copied'); render(); }, () => {});
    } else shareNote = t('duel.tellCode', { c: duel.view().code });
    render();
  });
  range.addEventListener('pointerdown', () => { sliding = true; });
  range.addEventListener('input', () => { targetVal.textContent = meters(Number(range.value)); duel.setTarget(Number(range.value)); });
  const slideEnd = () => { sliding = false; render(); };
  range.addEventListener('change', slideEnd);
  range.addEventListener('pointerup', slideEnd);
  range.addEventListener('pointercancel', slideEnd);

  duel.onChange(render);
  render();
  return { render };
}

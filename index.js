// Mémoire : ton appli d'origine (HTML et code inchangés), livrée en plugin.
// Ses données sont dans le dossier du plugin, que NeoBase sauvegarde (synchro cloud et sauvegardes) ; à la première ouverture elle reprend ce que tu avais dans NeoBase.
// Elle demande l'accès complet pour utiliser les outils d'interface de NeoBase. NeoBase ne l'ouvre que si elle est signée.
const HTML = "<div class=\"appWrap\">\n      <div class=\"agHead\"><span class=\"label\">Mémoire</span><span class=\"hint\" id=\"mmInfo\"></span><div class=\"agNav\"><select class=\"f\" id=\"mmSize\" style=\"width:200px;font-size:14px;padding:6px 10px\"><option value=\"4x3\">Facile · 6 paires</option><option value=\"4x4\" selected>Normal · 8 paires</option><option value=\"5x4\">10 paires</option><option value=\"6x4\">Difficile · 12 paires</option><option value=\"6x5\">15 paires</option><option value=\"6x6\">Expert · 18 paires</option><option value=\"8x5\">20 paires</option><option value=\"8x6\">Maître · 24 paires</option></select><button class=\"btn px\" id=\"mmNew\">NOUVELLE PARTIE</button></div></div>\n      <div id=\"mmGrid\"></div>\n      <div class=\"hint\">Retrouve les paires de logos en un minimum de coups.</div>\n    </div>";
/*CSS-MOVED*/ const CSS = `#mmGrid{display:grid;grid-template-columns:repeat(4,110px);gap:12px;justify-content:center}
.mmCard{all:unset;cursor:var(--cp,pointer);width:var(--card,110px);height:var(--card,110px);display:grid;place-items:center;background:var(--violet);box-shadow:0 0 0 3px var(--line2),inset 0 0 0 6px rgba(255,255,255,.08);font:28px var(--title);color:rgba(255,255,255,.5)}
.mmCard:hover{background:#9d74f5}
.mmCard.up{background:var(--win)}
.mmCard.done{opacity:.55;box-shadow:0 0 0 3px var(--magenta)}
.mmCard img{width:min(52px,calc(var(--card,110px) - 16px));height:auto;image-rendering:pixelated}
`;  // le style de ce plugin (il utilise les variables du thème de NeoBase)
export default async function (ctx) {
  const view = ctx.view;
  if (!ctx.host) { view.textContent = "Ce plugin doit être approuvé par NeoBase pour s'ouvrir."; return; }
  const host = ctx.host, { el, toast, sfx, ask, newTab, pixIcon, PIX, WX } = host;
  const folder = ctx.folder, legacy = ctx.legacy || {};
  ctx.host.addStyle(CSS);
  view.innerHTML = HTML;
  const $ = id => id === "memoryApp" ? view : (view.querySelector('#' + id) || document.getElementById(id));  // les identifiants de ta vue d'abord, puis ceux de la page (fenêtres, menus)
  const doc = async n => { try { return await folder.read(n); } catch { return null; } };
  const __icon = () => ctx.icon;  // l'icône de ce plugin
  const LEGACY_GAMES = {"top":[],"best":"^memory"};
  let games = await doc('games');
  if (games == null) {  // première ouverture : tu retrouves tes records et tes parties d'avant
    const old = legacy.api ? await legacy.api('games').catch(() => null) : null; games = { best: {} };
    if (old) { const re = new RegExp(LEGACY_GAMES.best); for (const [k, v] of Object.entries(old.best || {})) if (re.test(k)) games.best[k] = v; for (const k of LEGACY_GAMES.top) if (old[k] !== undefined) games[k] = old[k]; await folder.write('games', games); }
  }
  games = { best: {}, ...games };
  let gamesTimer = null;
  const saveGames = () => { clearTimeout(gamesTimer); gamesTimer = setTimeout(() => { gamesTimer = null; folder.write('games', games).catch(() => {}); }, 500); };
  const best = (k, v, higher = true) => { const b = games.best[k]; if (b == null || (higher ? v > b : v < b)) { games.best[k] = v; saveGames(); return true; } return false; };
  const gstore = (k, init) => (games[k] ??= init);  // la section d'un jeu
function gameLoop(st, appKey, update, draw) {
  cancelAnimationFrame(st.raf);
  const STEP = 1000 / 60; let acc = 0, last = performance.now();
  const frame = t => {
    if (!view.classList.contains('on')) { st.raf = 0; if (st.mode === 'play') st.mode = 'pause'; return; }  // leaving the tab pauses the game
    st.raf = requestAnimationFrame(frame);
    acc += Math.min(200, t - last); last = t;
    while (acc >= STEP) { if (st.mode === 'play') update(); st.tick++; acc -= STEP; }
    draw();
  };
  st.raf = requestAnimationFrame(frame);
}
function gameText(g, w, lines, y0) {  // centred pixel-font lines over a dark band
  g.fillStyle = 'rgba(11,3,28,.72)'; g.fillRect(0, y0 - 14, w, lines.length * 14 + 14);
  g.textAlign = 'center';
  lines.forEach(([text, color, size], i) => { g.fillStyle = color; g.font = (size || 8) + 'px "Press Start 2P", monospace'; g.fillText(text, w / 2, y0 + i * 14); });
  g.textAlign = 'left';
}
const px = (g, color, x, y, w = 1, h = 1) => { g.fillStyle = color; g.fillRect(Math.round(x), Math.round(y), w, h); };
function sprite(g, rows, x, y, pal) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c) px(g, c, x + i, y + j); } }); }
  // ---- ton code d'origine ----
/* ---------- jeu "Mémoire": find the pairs of NeoBase logos, from 6 to 18 pairs ---------- */
let mm = null;
function mmStart() {
  const [cols, rows] = $('mmSize').value.split('x').map(Number), pairs = cols * rows / 2;
  const keys = Object.keys(ART).sort(() => Math.random() - .5).slice(0, pairs), cards = [...keys, ...keys].sort(() => Math.random() - .5);
  clearInterval(mm?.timer);
  mm = {cards: cards.map(k => ({k, up: false, done: false})), open: [], moves: 0, t0: 0, end: 0, lock: false, timer: null, cols, rows, pairs};
  mmRender();
}
function mmRender() {
  const secs = mm.t0 ? Math.floor(((mm.end || Date.now()) - mm.t0) / 1000) : 0, b = games?.best['memory' + mm.pairs], found = mm.cards.filter(c => c.done).length / 2;
  $('mmInfo').textContent = found + ' / ' + mm.pairs + ' paires · ' + mm.moves + ' coups · ' + secs + ' s' + (b ? ' · record ' + b + ' coups' : '');
  const size = Math.min(110, Math.floor(Math.min(($('memoryApp').clientWidth || 900) - 120, 900) / mm.cols) - 12, Math.floor((innerHeight - 260) / mm.rows) - 12);
  $('mmGrid').style.gridTemplateColumns = `repeat(${mm.cols}, ${size}px)`; $('mmGrid').style.setProperty('--card', size + 'px');
  $('mmGrid').replaceChildren(...mm.cards.map((c, i) => {
    const d = el('button', 'mmCard' + (c.up || c.done ? ' up' : '') + (c.done ? ' done' : ''));
    if (c.up || c.done) { const im = el('img'); im.src = __icon(c.k); d.append(im); } else d.append(el('span', '', '?'));
    d.onclick = () => mmFlip(i);
    return d;
  }));
}
function mmFlip(i) {
  const c = mm.cards[i]; if (mm.lock || c.up || c.done) return;
  if (!mm.t0) { mm.t0 = Date.now(); mm.timer = setInterval(() => view.classList.contains('on') && mmRender(), 1000); }
  c.up = true; mm.open.push(c); sfx('click');
  if (mm.open.length === 2) {
    mm.moves++;
    const [a, b] = mm.open;
    if (a.k === b.k) { a.done = b.done = true; mm.open = []; sfx('notify');
      if (mm.cards.every(x => x.done)) { clearInterval(mm.timer); mm.end = Date.now(); const rec = best('memory' + mm.pairs, mm.moves, false); setTimeout(() => toast('Gagné en ' + mm.moves + ' coups et ' + Math.round((mm.end - mm.t0) / 1000) + ' s' + (rec ? ' : nouveau record !' : '')), 200); } }
    else { mm.lock = true; setTimeout(() => { a.up = b.up = false; mm.open = []; mm.lock = false; mmRender(); }, 800); }
  }
  mmRender();
}
$('mmNew').onclick = mmStart;
$('mmSize').onchange = mmStart;  // (non indenté : les textes sur plusieurs lignes restent exactement les tiens)
  // ---- fin ----
  ctx.onOpen(() => { if (!mm) mmStart(); else mmRender(); });
}

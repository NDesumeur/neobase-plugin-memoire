// lancé par le test « local » de NeoDex : retourne toutes les cartes, vérifie que les dessins sont variés et vont par paires
module.exports = async ({ pj, sleep }) => {
  await sleep(500);
  const r = await pj(`(async () => { const cards = [...document.querySelectorAll('.mmCard')]; const seen = []; for (let i = 0; i < Math.min(12, cards.length); i++) { document.querySelectorAll('.mmCard')[i].click(); await new Promise(r => setTimeout(r, 150)); seen.push(...[...document.querySelectorAll('.mmCard img')].map(im => im.src.length + ':' + im.src.slice(-24))); if (i % 2) await new Promise(r => setTimeout(r, 1300)); } return seen; })()`);
  const kinds = new Set(r);
  if (kinds.size < 3) throw new Error(kinds.size + ' dessin(s) différent(s) seulement sur ' + r.length + ' images vues');
  return kinds.size + ' dessins différents sur ' + r.length + ' images vues';
};

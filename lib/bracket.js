// Single-elimination bracket with byes. Rounds are arrays of matches: { p1, p2, bye, winner }.
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function advance(rounds, r, slot, winner) {
  rounds[r][slot].winner = winner;
  if (r + 1 < rounds.length) {
    const next = rounds[r + 1][slot >> 1];
    if (slot % 2 === 0) next.p1 = winner; else next.p2 = winner;
  }
}
function build(playerIds) {
  const ps = shuffle(playerIds);
  let size = 1; while (size < ps.length) size *= 2;
  const byes = size - ps.length;
  let i = 0; const first = [];
  for (let k = 0; k < size / 2; k++) {
    first.push(k < byes ? { p1: ps[i++], p2: null, bye: true } : { p1: ps[i++], p2: ps[i++], bye: false });
  }
  const rounds = [first];
  for (let n = size / 4; n >= 1; n /= 2) rounds.push(Array.from({ length: n }, () => ({ p1: null, p2: null, bye: false })));
  first.forEach((m, k) => { if (m.bye) advance(rounds, 0, k, m.p1); });
  return rounds;
}
module.exports = { build };

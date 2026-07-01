// check-today-scores.js — diagnóstico das partidas de hoje e pontuação
const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  // ── 1. Partidas de hoje (30/06) ──────────────────────────────────────────
  const startOfDay = new Date('2026-06-30T00:00:00Z');
  const endOfDay = new Date('2026-07-01T00:00:00Z');

  const todayMatches = await db.collection('matches').find({
    kickoffAt: { $gte: startOfDay, $lt: endOfDay },
  }).toArray();

  console.log(`\n=== Partidas de hoje (${todayMatches.length}) ===`);
  for (const m of todayMatches) {
    console.log(
      `[${m.status}] ${m.homeTeam} x ${m.awayTeam}` +
      ` | placar: ${m.officialHomeScore ?? '?'}-${m.officialAwayScore ?? '?'}` +
      ` | winner: ${m.winner ?? '-'}` +
      ` | penaltyWinner: ${m.penaltyWinner ?? '-'}` +
      ` | _id: ${m._id}`,
    );
  }

  // ── 2. Para cada partida de hoje, mostra palpites + pontos ───────────────
  const users = await db.collection('users').find({}, { projection: { _id: 1, name: 1 } }).toArray();
  const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u.name]));

  for (const m of todayMatches) {
    const preds = await db.collection('predictions').find({ matchId: m._id }).toArray();
    if (preds.length === 0) continue;

    console.log(`\n  ${m.homeTeam} x ${m.awayTeam} (resultado: ${m.officialHomeScore ?? '?'}-${m.officialAwayScore ?? '?'})`);
    console.log(`  ${'Nome'.padEnd(15)} | Palpite | Pts   | exact | outcome | autoFill`);
    console.log(`  ${'-'.repeat(65)}`);

    for (const p of preds.sort((a, b) => (userMap[a.userId] ?? '').localeCompare(userMap[b.userId] ?? ''))) {
      const name = (userMap[p.userId.toString()] ?? p.userId.toString().slice(-6)).padEnd(15);
      const pred = `${p.predictedHomeScore}x${p.predictedAwayScore}`.padEnd(7);
      const pts = String(p.pointsAwarded ?? 'null').padEnd(6);
      const exact = String(p.exactScoreHit ?? false).padEnd(6);
      const out = String(p.outcomeHit ?? false).padEnd(8);
      const auto = p.isAutoFilled ? 'AUTO' : '';

      // Verificar se a pontuação está errada
      const homeOk = m.officialHomeScore !== null && m.officialAwayScore !== null;
      let expectedPoints = null;
      if (homeOk) {
        const predWin = p.predictedHomeScore > p.predictedAwayScore ? 'home'
          : p.predictedAwayScore > p.predictedHomeScore ? 'away' : 'draw';
        const actWin = m.officialHomeScore > m.officialAwayScore ? 'home'
          : m.officialAwayScore > m.officialHomeScore ? 'away' : 'draw';
        const isExact = p.predictedHomeScore === m.officialHomeScore && p.predictedAwayScore === m.officialAwayScore;
        expectedPoints = isExact ? 'exact' : predWin === actWin ? 'outcome' : '0';
      }

      const mismatch =
        p.pointsAwarded === null ? '' :
          expectedPoints === 'exact' && !p.exactScoreHit ? ' ⚠️ DEVERIA SER EXATO' :
            expectedPoints === 'outcome' && !p.outcomeHit ? ' ⚠️ DEVERIA SER OUTCOME' :
              expectedPoints === '0' && p.pointsAwarded > 0 ? ' ⚠️ DEVERIA SER 0' :
                expectedPoints === 'exact' && p.outcomeHit && p.pointsAwarded < 2 ? ' ⚠️ PONTOS ABAIXO DO ESPERADO' : '';

      console.log(`  ${name} | ${pred} | ${pts} | ${exact} | ${out} | ${auto}${mismatch}`);
    }
  }

  // ── 3. Resumo geral de pontuação por usuário ─────────────────────────────
  console.log('\n=== Totais por usuário (todas as partidas) ===');
  const allPreds = await db.collection('predictions').find(
    { pointsAwarded: { $ne: null }, isAutoFilled: { $ne: true } },
    { projection: { userId: 1, pointsAwarded: 1 } },
  ).toArray();

  const totals = {};
  for (const p of allPreds) {
    const uid = p.userId.toString();
    totals[uid] = (totals[uid] || 0) + (p.pointsAwarded || 0);
  }
  const ranked = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([uid, pts]) => `${(userMap[uid] ?? uid.slice(-6)).padEnd(15)} ${pts} pts`);

  ranked.forEach(r => console.log('  ' + r));

  // ── 4. Palpites com pontosAwarded=null para partidas finalizadas ─────────
  console.log('\n=== Palpites sem pontos em partidas FINISHED ===');
  const finishedIds = (await db.collection('matches').find({ status: 'finished' }, { projection: { _id: 1, homeTeam: 1, awayTeam: 1 } }).toArray());
  const finishedIdSet = new Set(finishedIds.map(m => m._id.toString()));
  const finishedMatchMap = Object.fromEntries(finishedIds.map(m => [m._id.toString(), `${m.homeTeam} x ${m.awayTeam}`]));

  const nullPreds = await db.collection('predictions').find(
    { pointsAwarded: null },
    { projection: { userId: 1, matchId: 1 } },
  ).toArray();

  const orphanedNulls = nullPreds.filter(p => finishedIdSet.has(p.matchId.toString()));
  if (orphanedNulls.length === 0) {
    console.log('  ✅ Nenhum palpite sem pontos em partidas finalizadas');
  } else {
    console.log(`  ⚠️ ${orphanedNulls.length} palpites sem pontos em partidas finalizadas:`);
    for (const p of orphanedNulls.slice(0, 20)) {
      console.log(`    - ${userMap[p.userId.toString()] ?? p.userId.toString().slice(-6)} → ${finishedMatchMap[p.matchId.toString()] ?? p.matchId}`);
    }
  }

  await mongoose.disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });

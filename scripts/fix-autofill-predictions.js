// fix-autofill-predictions.js
// Corrige predições marcadas como isAutoFilled=true que possuem placar manual real (não 0×0).
// Limpa o flag e força recálculo via NestJS context.
const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const users = await db.collection('users').find({}, { projection: { _id: 1, name: 1 } }).toArray();
  const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u.name]));

  const matches = await db.collection('matches').find(
    { status: 'finished' },
    { projection: { _id: 1, homeTeam: 1, awayTeam: 1, officialHomeScore: 1, officialAwayScore: 1 } },
  ).toArray();
  const matchMap = Object.fromEntries(matches.map(m => [m._id.toString(), m]));

  // Find all isAutoFilled=true predictions that have a non-zero score
  const suspiciousPreds = await db.collection('predictions').find({
    isAutoFilled: true,
    $or: [
      { predictedHomeScore: { $gt: 0 } },
      { predictedAwayScore: { $gt: 0 } },
    ],
  }).toArray();

  if (suspiciousPreds.length === 0) {
    console.log('✅ Nenhuma predição isAutoFilled com placar não-zero encontrada.');
    await mongoose.disconnect();
    return;
  }

  console.log(`⚠️  Encontradas ${suspiciousPreds.length} predições suspeitas (isAutoFilled=true mas score != 0x0):\n`);

  for (const p of suspiciousPreds) {
    const userName = userMap[p.userId?.toString()] ?? p.userId?.toString().slice(-6);
    const match = matchMap[p.matchId?.toString()];
    const matchLabel = match ? `${match.homeTeam} x ${match.awayTeam} (${match.officialHomeScore}-${match.officialAwayScore})` : p.matchId?.toString();
    console.log(`  ${userName.padEnd(15)} | ${matchLabel} | palpite: ${p.predictedHomeScore}x${p.predictedAwayScore} | pts: ${p.pointsAwarded}`);
  }

  console.log('\nCorrigindo...');

  // Fix: set isAutoFilled=false and reset points
  const ids = suspiciousPreds.map(p => p._id);
  const result = await db.collection('predictions').updateMany(
    { _id: { $in: ids } },
    { $set: { isAutoFilled: false, pointsAwarded: null, exactScoreHit: false, outcomeHit: false } },
  );

  console.log(`✅ Corrigidas ${result.modifiedCount} predições.`);
  console.log('\nAgora chame POST /ranking/recalculate para recalcular os pontos.');

  await mongoose.disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });

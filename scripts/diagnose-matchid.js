// diagnose-matchid.js
const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const matches = await db.collection('matches').find({
    kickoffAt: { $gte: new Date('2026-06-30'), $lt: new Date('2026-07-01') },
  }).toArray();

  console.log('Matches hoje:', matches.map(m => m._id.toString() + ' => ' + m.homeTeam + ' x ' + m.awayTeam));

  const samplePred = await db.collection('predictions').findOne({});
  if (samplePred) {
    console.log('\nSample prediction:');
    console.log('  matchId type:', samplePred.matchId?.constructor?.name, '| value:', samplePred.matchId);
    console.log('  userId type:', samplePred.userId?.constructor?.name);
    console.log('  pointsAwarded:', samplePred.pointsAwarded);
    console.log('  predicted:', samplePred.predictedHomeScore, 'x', samplePred.predictedAwayScore);
  }

  const users = await db.collection('users').find({}, { projection: { _id: 1, name: 1 } }).toArray();
  const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u.name]));

  for (const m of matches) {
    const byObjId = await db.collection('predictions').countDocuments({ matchId: m._id });
    const byStr   = await db.collection('predictions').countDocuments({ matchId: m._id.toString() });
    console.log('\n' + m.homeTeam + ' x ' + m.awayTeam + ' [' + m.status + ']');
    console.log('  placar DB: ' + m.officialHomeScore + '-' + m.officialAwayScore + ' | winner: ' + m.winner);
    console.log('  preds by ObjectId: ' + byObjId + ' | by String: ' + byStr);

    // fetch whichever works
    const preds = await db.collection('predictions').find({
      matchId: byObjId > 0 ? m._id : m._id.toString(),
    }).toArray();

    for (const p of preds) {
      const name = (userMap[p.userId?.toString()] ?? p.userId?.toString().slice(-6) ?? '?').padEnd(14);
      console.log(
        '  ' + name +
        ' palpite=' + p.predictedHomeScore + 'x' + p.predictedAwayScore +
        ' pts=' + p.pointsAwarded +
        ' exact=' + p.exactScoreHit +
        ' outcome=' + p.outcomeHit +
        (p.isAutoFilled ? ' [AUTO]' : ''),
      );
    }
  }

  // Ranking geral
  console.log('\n=== Ranking atual ===');
  const allPreds = await db.collection('predictions').find(
    { pointsAwarded: { $ne: null } },
  ).toArray();
  const totals = {};
  for (const p of allPreds) {
    const uid = p.userId?.toString();
    if (!uid) continue;
    totals[uid] = (totals[uid] || 0) + (p.pointsAwarded || 0);
  }
  Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .forEach(([uid, pts]) => {
      console.log('  ' + (userMap[uid] ?? uid.slice(-6)).padEnd(15) + pts + ' pts');
    });

  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });

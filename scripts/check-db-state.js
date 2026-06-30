// check-db-state.js
const mongoose = require('mongoose');
require('dotenv').config();
async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const matchCount   = await db.collection('matches').countDocuments();
  const numericCount = await db.collection('matches').countDocuments({ externalId: /^\d+$/ });
  const wc26Count    = await db.collection('matches').countDocuments({ externalId: /^wc26-/ });
  const predCount    = await db.collection('predictions').countDocuments();

  console.log('matches total:', matchCount, ' numeric:', numericCount, ' wc26-*:', wc26Count);
  console.log('predictions total:', predCount);

  const matchIds = new Set(
    (await db.collection('matches').find({}, { projection: { _id: 1 } }).toArray())
      .map(m => m._id.toString()),
  );
  const preds = await db.collection('predictions').find({}, { projection: { matchId: 1, pointsAwarded: 1, userId: 1 } }).toArray();
  const orphans = preds.filter(p => !matchIds.has(p.matchId.toString()));
  console.log('orphaned predictions:', orphans.length);

  const userTotals = {};
  for (const p of preds) {
    if (p.pointsAwarded !== null && p.pointsAwarded !== undefined) {
      const uid = p.userId.toString().slice(-6);
      userTotals[uid] = (userTotals[uid] || 0) + p.pointsAwarded;
    }
  }
  const ranked = Object.entries(userTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log('Top 5:', ranked.map(r => r[0] + '=' + r[1] + 'pts').join(', '));
  await mongoose.disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });

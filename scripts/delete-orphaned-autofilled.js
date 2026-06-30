// delete-orphaned-autofilled.js
// Deletes all isAutoFilled=true predictions whose matchId points to a deleted match.
const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

    // Use raw collection access to avoid schema conflicts
  const db = mongoose.connection.db;
  const matchIds = new Set(
    (await db.collection('matches').find({}, { projection: { _id: 1 } }).toArray())
      .map(m => m._id.toString()),
  );

  const sample = await db.collection('predictions').findOne({});
  console.log('Sample prediction keys:', sample ? Object.keys(sample) : 'none');
  console.log('Sample isAutoFilled:', sample ? sample.isAutoFilled : 'n/a');

  const allPreds = await db.collection('predictions').find({}, { projection: { _id: 1, matchId: 1, isAutoFilled: 1 } }).toArray();
  console.log('Total predictions:', allPreds.length);
  const orphanIds = allPreds
    .filter(p => p.isAutoFilled === true && !matchIds.has(p.matchId.toString()))
    .map(p => p._id);

  console.log('Orfaos auto-filled encontrados:', orphanIds.length);
  if (orphanIds.length === 0) { await mongoose.disconnect(); return; }

  const result = await db.collection('predictions').deleteMany({ _id: { $in: orphanIds } });
  console.log('Deletados:', result.deletedCount);
  console.log('Palpites restantes:', await db.collection('predictions').countDocuments());
  await mongoose.disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });

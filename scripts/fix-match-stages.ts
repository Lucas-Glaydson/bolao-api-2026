/**
 * Migration script: fix wrongly-staged knockout matches and remove generated-* placeholders.
 * Run with: npx ts-node -r tsconfig-paths/register scripts/fix-match-stages.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { MatchRepository } from '../src/infrastructure/database/repositories';
import { MatchStage } from '../src/domain/entities';
import * as https from 'https';

const STAGE_MAP: Record<string, MatchStage> = {
  GROUP_STAGE:    MatchStage.GROUP_STAGE,
  LAST_32:        MatchStage.ROUND_OF_32,
  ROUND_OF_32:    MatchStage.ROUND_OF_32,
  LAST_16:        MatchStage.ROUND_OF_16,
  ROUND_OF_16:    MatchStage.ROUND_OF_16,
  QUARTER_FINALS: MatchStage.QUARTER_FINALS,
  SEMI_FINALS:    MatchStage.SEMI_FINALS,
  THIRD_PLACE:    MatchStage.THIRD_PLACE,
  FINAL:          MatchStage.FINAL,
};

function fetchAllMatches(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    https.get(
      {
        hostname: 'api.football-data.org',
        path: '/v4/competitions/2000/matches',
        headers: { 'X-Auth-Token': process.env.EXTERNAL_FOOTBALL_API_KEY || '' },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data).matches || []);
          } catch (e) {
            reject(e);
          }
        });
      },
    ).on('error', reject);
  });
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  // Access the raw Mongoose model via the repository's injected model
  const matchRepo = app.get(MatchRepository);
  const model = (matchRepo as any).matchModel;

  console.log('🔧 Step 1: Delete generated-* placeholder records...');
  const delResult = await model.deleteMany({ externalId: /^generated-/ }).exec();
  console.log(`   Deleted ${delResult.deletedCount} generated-* records`);

  console.log('🌐 Step 2: Fetch all matches from API...');
  const apiMatches = await fetchAllMatches();
  console.log(`   Got ${apiMatches.length} matches from API`);

  console.log('🔧 Step 3: Fix stage + date for each API record in DB...');
  let fixed = 0;
  let skipped = 0;

  for (const m of apiMatches) {
    const correctStage = STAGE_MAP[m.stage] ?? MatchStage.GROUP_STAGE;
    const kickoffAt = new Date(m.utcDate);
    const homeTeam = m.homeTeam?.name || m.homeTeam?.shortName || 'TBD';
    const awayTeam = m.awayTeam?.name || m.awayTeam?.shortName || 'TBD';

    const result = await model.updateOne(
      { externalId: String(m.id) },
      {
        $set: {
          stage: correctStage,
          kickoffAt,
          homeTeam,
          awayTeam,
        },
      },
    ).exec();

    if (result.modifiedCount > 0) {
      fixed++;
    } else {
      skipped++;
    }
  }

  console.log(`   Fixed: ${fixed}, unchanged: ${skipped}`);

  console.log('\n📊 Final DB state:');
  const total = await model.countDocuments();
  const byStage = await model.aggregate([
    { $group: { _id: '$stage', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  console.log(`   Total matches: ${total}`);
  byStage.forEach((s: any) => console.log(`   ${s._id}: ${s.count}`));

  await app.close();
  console.log('\n✅ Migration complete!');
}

bootstrap().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

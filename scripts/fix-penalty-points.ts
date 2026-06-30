/**
 * fix-penalty-points.ts
 *
 * Sets penaltyWinner on a specific finished knockout match (searched by team name)
 * and force-recalculates all predictions for that match using the updated logic.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/fix-penalty-points.ts \
 *     --home "Netherlands" --away "Morocco" --winner away
 *
 * Defaults (no args): Netherlands vs Morocco, Morocco (away) wins on penalties.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import {
  MatchRepository,
  PredictionRepository,
  ScoreRuleRepository,
} from '../src/infrastructure/database/repositories';
import { MatchWinner } from '../src/domain/entities';

// ── Helpers ───────────────────────────────────────────────────────────────────

function norm(name = ''): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

const ALIASES: Record<string, string> = {
  holanda: 'netherlands', ned: 'netherlands', holland: 'netherlands',
  marrocos: 'morocco', mar: 'morocco',
};
function canon(name = ''): string { const n = norm(name); return ALIASES[n] ?? n; }

function calcPoints(
  predHome: number, predAway: number,
  realHome: number, realAway: number,
  basePoints: number, exactBonus: number,
  tiebreakWinner: 'home' | 'away' | null,
  penaltyWinner: 'home' | 'away' | null,
): { points: number; exactScore: boolean; outcomeHit: boolean } {
  if (predHome === realHome && predAway === realAway) {
    if (penaltyWinner !== null && tiebreakWinner === penaltyWinner) {
      return { points: basePoints + exactBonus + 1, exactScore: true, outcomeHit: true };
    }
    return { points: basePoints + exactBonus, exactScore: true, outcomeHit: true };
  }
  const pw = predHome > predAway ? 'home' : predAway > predHome ? 'away' : 'draw';
  const rw = realHome > realAway ? 'home' : realAway > realHome ? 'away' : 'draw';
  if (pw === rw) {
    if (penaltyWinner !== null && predHome === predAway && tiebreakWinner === penaltyWinner) {
      return { points: basePoints + 1, exactScore: false, outcomeHit: true };
    }
    return { points: basePoints, exactScore: false, outcomeHit: true };
  }
  return { points: 0, exactScore: false, outcomeHit: false };
}

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(key: string, fallback: string): string {
  const idx = args.indexOf(`--${key}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const TARGET_HOME   = getArg('home',   'Netherlands');
const TARGET_AWAY   = getArg('away',   'Morocco');
const WINNER_SIDE   = (getArg('winner', 'away') === 'home' ? 'home' : 'away') as 'home' | 'away';

// ── Main ──────────────────────────────────────────────────────────────────────

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const matchRepo = app.get(MatchRepository);
  const predRepo  = app.get(PredictionRepository);
  const ruleRepo  = app.get(ScoreRuleRepository);

  // Find the target match (try both home/away orderings)
  const all = await matchRepo.findAll();
  const match = all.find(m => {
    const h = canon(m.homeTeam);
    const a = canon(m.awayTeam);
    const th = canon(TARGET_HOME);
    const ta = canon(TARGET_AWAY);
    return (h === th && a === ta) || (h === ta && a === th);
  });

  if (!match) {
    console.error(`❌  Match "${TARGET_HOME}" vs "${TARGET_AWAY}" not found in DB.`);
    console.log('All team pairs:');
    all.slice(0, 20).forEach(m => console.log(`  ${m.homeTeam} vs ${m.awayTeam}`));
    await app.close();
    process.exit(1);
  }

  console.log(`\n✅  Found: ${match.homeTeam} vs ${match.awayTeam}`);
  console.log(`    id      : ${match.id}`);
  console.log(`    score   : ${match.officialHomeScore} x ${match.officialAwayScore}`);
  console.log(`    status  : ${match.status}`);
  console.log(`    winner  : ${match.winner ?? 'null'}`);
  console.log(`    penaltyWinner: ${match.penaltyWinner ?? 'null'}`);

  // Determine actual penalty winner side relative to this specific match doc
  // (Morocco might be home or away depending on which team is listed first)
  const homeCanon = canon(match.homeTeam);
  const awayCanon = canon(TARGET_AWAY);
  const penaltySide: 'home' | 'away' =
    homeCanon === canon(WINNER_SIDE === 'away' ? TARGET_AWAY : TARGET_HOME) ? 'home' : 'away';

  // Simpler: just use WINNER_SIDE as-is (the caller passes --winner relative to the original home/away)
  const penaltyWinner = WINNER_SIDE;
  const penaltyWinnerEnum = penaltyWinner === 'home' ? MatchWinner.HOME : MatchWinner.AWAY;

  console.log(`\n📝  Setting penaltyWinner = '${penaltyWinner}' (${penaltyWinner === 'home' ? match.homeTeam : match.awayTeam})`);

  const updated = await matchRepo.update(match.id, {
    penaltyWinner: penaltyWinnerEnum,
  });
  if (!updated) { console.error('❌  Failed to update match'); await app.close(); process.exit(1); }
  console.log('✅  Match.penaltyWinner saved');

  // Score rule for this stage
  const rule = await ruleRepo.findByStage(match.stage);
  if (!rule?.active) {
    console.error(`❌  No active score rule for stage ${match.stage}`);
    await app.close();
    process.exit(1);
  }

  if (match.officialHomeScore === null || match.officialAwayScore === null) {
    console.error('❌  Match has no official score yet — cannot recalculate');
    await app.close();
    process.exit(1);
  }

  // Recalculate all predictions for this match
  const preds = await predRepo.findByMatch(match.id);
  console.log(`\n📊  Recalculating ${preds.length} prediction(s) for this match...`);

  let updatedPreds = 0;
  let unchanged    = 0;

  for (const pred of preds) {
    if (pred.isAutoFilled) { unchanged++; continue; }

    const result = calcPoints(
      pred.predictedHomeScore,
      pred.predictedAwayScore,
      match.officialHomeScore,
      match.officialAwayScore,
      rule.basePoints,
      rule.exactScoreBonus,
      pred.tiebreakWinner,
      penaltyWinner,
    );

    const changed =
      result.points     !== pred.pointsAwarded ||
      result.exactScore !== pred.exactScoreHit  ||
      result.outcomeHit !== pred.outcomeHit;

    const tag = changed ? '→ UPDATED' : '  ok';
    console.log(
      `  [${tag}] userId=${pred.userId} | pred=${pred.predictedHomeScore}x${pred.predictedAwayScore}` +
      ` tiebreak=${pred.tiebreakWinner ?? 'null'} | ${pred.pointsAwarded ?? '?'} → ${result.points} pts`,
    );

    if (changed) {
      await predRepo.update(pred.id, {
        pointsAwarded: result.points,
        exactScoreHit: result.exactScore,
        outcomeHit:    result.outcomeHit,
      });
      updatedPreds++;
    } else {
      unchanged++;
    }
  }

  console.log(`\n🏁  Done: ${updatedPreds} prediction(s) updated, ${unchanged} unchanged`);
  await app.close();
}

bootstrap().catch(err => {
  console.error(err);
  process.exit(1);
});

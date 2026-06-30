/**
 * recover-orphaned-predictions.ts
 *
 * Recupera os 704 palpites órfãos usando canEditUntil (= kickoffAt - 1h)
 * como âncora para identificar a partida correta.
 *
 * Lógica:
 *   orphan.canEditUntil + 1h ≈ match.kickoffAt
 *   → tolerance ±10 min (600 000 ms)
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import {
  MatchRepository,
  PredictionRepository,
  ScoreRuleRepository,
} from '../src/infrastructure/database/repositories';
import { MatchStatus, MatchWinner } from '../src/domain/entities';

function calcPoints(
  predHome: number, predAway: number, realHome: number, realAway: number,
  basePoints: number, exactBonus: number,
  tiebreakWinner: 'home' | 'away' | null, matchWinner: MatchWinner | null,
): { points: number; exactScore: boolean; outcomeHit: boolean } {
  if (predHome === realHome && predAway === realAway) {
    const hasPenalty = realHome === realAway && matchWinner !== null && matchWinner !== MatchWinner.DRAW;
    if (hasPenalty && tiebreakWinner === matchWinner) return { points: basePoints + exactBonus + 1, exactScore: true, outcomeHit: true };
    return { points: basePoints + exactBonus, exactScore: true, outcomeHit: true };
  }
  const predW = predHome > predAway ? 'home' : predAway > predHome ? 'away' : 'draw';
  const realW = realHome > realAway ? 'home' : realAway > realHome ? 'away' : 'draw';
  if (predW === realW) {
    if (matchWinner !== null && matchWinner !== MatchWinner.DRAW && predHome === predAway && tiebreakWinner === matchWinner)
      return { points: basePoints + 1, exactScore: false, outcomeHit: true };
    return { points: basePoints, exactScore: false, outcomeHit: true };
  }
  return { points: 0, exactScore: false, outcomeHit: false };
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const matchRepo = app.get(MatchRepository);
  const predRepo  = app.get(PredictionRepository);
  const ruleRepo  = app.get(ScoreRuleRepository);

  const allMatches = await matchRepo.findAll();
  const allPreds   = await predRepo.findAll();
  const allMatchIds = new Set(allMatches.map(m => m.id));

  const orphans  = allPreds.filter(p => !allMatchIds.has(p.matchId));
  const valid    = allPreds.filter(p => allMatchIds.has(p.matchId));

  console.log(`Total palpites  : ${allPreds.length}`);
  console.log(`Válidos         : ${valid.length}`);
  console.log(`Órfãos          : ${orphans.length}`);

  if (orphans.length === 0) {
    console.log('✅ Nenhum órfão. Nada a fazer.');
    await app.close();
    return;
  }

  // Build kickoff lookup: kickoffMs (rounded to minute) → match[]
  // canEditUntil = kickoffAt - 1h  →  kickoffAt = canEditUntil + 1h
  const TOLERANCE_MS = 10 * 60_000; // ±10 min
  const matchByKickoff = new Map<number, typeof allMatches[0][]>();
  for (const m of allMatches) {
    const k = m.kickoffAt.getTime();
    // Store in buckets every 10 min for fast lookup
    for (let offset = -TOLERANCE_MS; offset <= TOLERANCE_MS; offset += 60_000) {
      const bucket = Math.round((k + offset) / 60_000) * 60_000;
      if (!matchByKickoff.has(bucket)) matchByKickoff.set(bucket, []);
      matchByKickoff.get(bucket)!.push(m);
    }
  }

  // Also build: matchId → numeric match (for conflict detection)
  const validByUserMatch = new Map<string, string>(); // `userId_matchId` → pred.id
  for (const p of valid) {
    validByUserMatch.set(`${p.userId}_${p.matchId}`, p.id);
  }

  let recovered = 0;
  let ambiguous = 0;
  let noMatch   = 0;
  let conflicts = 0;

  console.log('\n── Recuperando órfãos ──');

  for (const pred of orphans) {
    // Infer kickoffAt from canEditUntil
    const inferredKickoff = new Date(pred.canEditUntil.getTime() + 60 * 60_000);
    const bucket = Math.round(inferredKickoff.getTime() / 60_000) * 60_000;

    const candidates = matchByKickoff.get(bucket) ?? [];
    // Deduplicate candidates
    const unique = [...new Map(candidates.map(m => [m.id, m])).values()];

    if (unique.length === 0) {
      noMatch++;
      console.log(`  ⚠ Sem match: userId=${pred.userId} canEditUntil=${pred.canEditUntil.toISOString()}`);
      continue;
    }

    // If multiple matches at same time, pick by userId preference:
    // a user should not have two predictions for the same match,
    // but may have one prediction per match.
    // Filter out matches the user already has a valid prediction for.
    const noConflict = unique.filter(
      m => !validByUserMatch.has(`${pred.userId}_${m.id}`),
    );

    if (noConflict.length === 0) {
      conflicts++;
      // User already has a prediction for every match at this time → skip
      continue;
    }

    if (noConflict.length > 1) {
      // True ambiguity: multiple matches at same time, user doesn't have any
      // Take the first one and warn
      ambiguous++;
    }

    const targetMatch = noConflict[0];

    // Re-link the orphan to this match
    await predRepo.update(pred.id, { matchId: targetMatch.id } as any);
    validByUserMatch.set(`${pred.userId}_${targetMatch.id}`, pred.id);
    recovered++;

    if (recovered <= 30) {
      console.log(`  ↗ ${pred.userId} → ${targetMatch.homeTeam} × ${targetMatch.awayTeam} (${pred.predictedHomeScore}×${pred.predictedAwayScore})`);
    }
  }

  if (recovered > 30) console.log(`  ... e mais ${recovered - 30}`);
  console.log(`\nRecuperados: ${recovered} | Ambíguos: ${ambiguous} | Sem match: ${noMatch} | Conflitos: ${conflicts}`);

  // ── Recalcular todos os pontos ─────────────────────────────────────────────
  console.log('\n── Recalculando pontos ──');
  const rules = await ruleRepo.findAll();
  const ruleByStage = new Map(rules.map(r => [r.stage, r]));
  const finishedMatches = (await matchRepo.findAll()).filter(
    m => m.status === MatchStatus.FINISHED && m.officialHomeScore !== null,
  );

  let calc = 0, err = 0;
  for (const match of finishedMatches) {
    const rule = ruleByStage.get(match.stage);
    if (!rule?.active) continue;
    const preds = await predRepo.findByMatch(match.id);
    for (const pred of preds) {
      try {
        if (pred.isAutoFilled) {
          await predRepo.update(pred.id, { pointsAwarded: 0, exactScoreHit: false, outcomeHit: false });
          calc++; continue;
        }
        const result = calcPoints(
          pred.predictedHomeScore, pred.predictedAwayScore,
          match.officialHomeScore!, match.officialAwayScore!,
          rule.basePoints, rule.exactScoreBonus,
          pred.tiebreakWinner, match.winner,
        );
        await predRepo.update(pred.id, {
          pointsAwarded: result.points, exactScoreHit: result.exactScore, outcomeHit: result.outcomeHit,
          lockedAt: pred.lockedAt ?? new Date(),
        });
        calc++;
      } catch (e: any) { err++; }
    }
  }
  console.log(`Pontos recalculados: ${calc} palpites | Erros: ${err}`);

  // ── Ranking final ──────────────────────────────────────────────────────────
  console.log('\n── Ranking final ──');
  const finalPreds = await predRepo.findAll();
  const allFinalMatchIds = new Set((await matchRepo.findAll()).map(m => m.id));
  const finalOrphans = finalPreds.filter(p => !allFinalMatchIds.has(p.matchId));

  const byUser = new Map<string, number>();
  for (const p of finalPreds) {
    if (p.pointsAwarded === null) continue;
    byUser.set(p.userId, (byUser.get(p.userId) ?? 0) + p.pointsAwarded);
  }
  const ranked = [...byUser.entries()].sort((a, b) => b[1] - a[1]);
  ranked.slice(0, 10).forEach(([uid, pts], i) => console.log(`  #${i + 1}  ${uid}  ${pts} pts`));

  console.log(`\nÓrfãos restantes: ${finalOrphans.length}`);
  console.log('✅ Concluído!');
  await app.close();
}

bootstrap().catch(err => { console.error(err.message); process.exit(1); });

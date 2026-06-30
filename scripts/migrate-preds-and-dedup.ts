/**
 * migrate-preds-and-dedup.ts
 *
 * Passo 1 — Valida vínculos partida → palpite (chaves primárias)
 * Passo 2 — Migra palpites de wc26-* para o numeric-ID e elimina duplicatas
 * Passo 3 — Recalcula pontos + push summary
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import {
  MatchRepository,
  PredictionRepository,
  ScoreRuleRepository,
} from '../src/infrastructure/database/repositories';
import { MatchStatus, MatchWinner } from '../src/domain/entities';

function normalize(name = ''): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
}

const ALIASES: Record<string, string> = {
  czechia: 'czechrepublic', czechrepublic: 'czechrepublic',
  cotedivoire: 'ivorycoast', ivorycoast: 'ivorycoast',
  capeverdeislands: 'capeverde', capeverde: 'capeverde',
  republicofkorea: 'southkorea', southkorea: 'southkorea', korea: 'southkorea',
  democraticrepublicofthecongo: 'drcongo', drcongo: 'drcongo', congodrc: 'drcongo', congodr: 'drcongo',
  bosniaherzegovina: 'bosniaandherzegovina', bosniaandherzegovina: 'bosniaandherzegovina',
  unitedstates: 'usa', usa: 'usa',
};

function canon(name = ''): string {
  const n = normalize(name);
  return ALIASES[n] ?? n;
}

function calcPoints(
  predHome: number, predAway: number, realHome: number, realAway: number,
  basePoints: number, exactBonus: number,
  tiebreakWinner: 'home' | 'away' | null, matchWinner: MatchWinner | null,
): { points: number; exactScore: boolean; outcomeHit: boolean } {
  if (predHome === realHome && predAway === realAway) {
    const hasPenaltyWin = realHome === realAway && matchWinner !== null && matchWinner !== MatchWinner.DRAW;
    if (hasPenaltyWin && tiebreakWinner === matchWinner) return { points: basePoints + exactBonus + 1, exactScore: true, outcomeHit: true };
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

  /* ════════════════════════════════════════════════════════
     PASSO 1 — Validar vínculos via chaves primárias
  ════════════════════════════════════════════════════════ */
  console.log('\n══ PASSO 1: Validando vínculos partida ↔ palpite ══\n');

  const allMatches = await matchRepo.findAll();
  const allPreds   = await predRepo.findAll();

  const numericMatches  = allMatches.filter(m => /^\d+$/.test(m.externalId));
  const wc26Matches     = allMatches.filter(m => m.externalId.startsWith('wc26-'));

  // Map each match._id → predictions[]
  const predsByMatch = new Map<string, typeof allPreds>();
  for (const p of allPreds) {
    if (!predsByMatch.has(p.matchId)) predsByMatch.set(p.matchId, []);
    predsByMatch.get(p.matchId)!.push(p);
  }

  // Orphaned predictions (matchId references a deleted match)
  const allMatchIds = new Set(allMatches.map(m => m.id));
  const orphanPreds = allPreds.filter(p => !allMatchIds.has(p.matchId));

  console.log(`Total partidas   : ${allMatches.length}  (numeric: ${numericMatches.length} | wc26-*: ${wc26Matches.length})`);
  console.log(`Total palpites   : ${allPreds.length}`);
  console.log(`  → em numeric-ID: ${numericMatches.reduce((n, m) => n + (predsByMatch.get(m.id)?.length ?? 0), 0)}`);
  console.log(`  → em wc26-*    : ${wc26Matches.reduce((n, m) => n + (predsByMatch.get(m.id)?.length ?? 0), 0)}`);
  console.log(`  → ÓRFÃOS (ref. partida deletada): ${orphanPreds.length}`);

  // Find duplicate pairs (same teams, one numeric + one wc26-*)
  // Build: canonKey → { numeric: Match | null, wc26: Match[] }
  type Pair = { numeric: typeof allMatches[0] | null; wc26: typeof allMatches[0][] };
  const pairsByKey = new Map<string, Pair>();

  for (const m of allMatches) {
    const k  = `${canon(m.homeTeam)}__${canon(m.awayTeam)}`;
    const kr = `${canon(m.awayTeam)}__${canon(m.homeTeam)}`;
    // Try forward key first, then reversed
    const key = pairsByKey.has(k) ? k : pairsByKey.has(kr) ? kr : k;

    if (!pairsByKey.has(key)) pairsByKey.set(key, { numeric: null, wc26: [] });
    const pair = pairsByKey.get(key)!;
    if (/^\d+$/.test(m.externalId))        pair.numeric = m;
    else if (m.externalId.startsWith('wc26-')) pair.wc26.push(m);
  }

  const dupPairs = [...pairsByKey.values()].filter(p => p.numeric && p.wc26.length > 0);
  console.log(`\nPares duplicados encontrados: ${dupPairs.length}`);
  for (const p of dupPairs) {
    const numPreds = predsByMatch.get(p.numeric!.id)?.length ?? 0;
    const wc26Preds = p.wc26.reduce((n, m) => n + (predsByMatch.get(m.id)?.length ?? 0), 0);
    console.log(`  ${p.numeric!.homeTeam} × ${p.numeric!.awayTeam}`);
    console.log(`    numeric  ${p.numeric!.externalId}: ${numPreds} palpites | score: ${p.numeric!.officialHomeScore ?? 'null'}–${p.numeric!.officialAwayScore ?? 'null'} | ${p.numeric!.status}`);
    for (const w of p.wc26) {
      const wp = predsByMatch.get(w.id)?.length ?? 0;
      console.log(`    wc26-*   ${w.externalId}: ${wp} palpites | score: ${w.officialHomeScore ?? 'null'}–${w.officialAwayScore ?? 'null'} | ${w.status}`);
    }
  }

  /* ════════════════════════════════════════════════════════
     PASSO 2 — Migrar palpites wc26-* → numeric-ID e deletar duplicatas
  ════════════════════════════════════════════════════════ */
  console.log('\n══ PASSO 2: Migrando palpites e removendo duplicatas ══\n');

  let migratedPreds = 0;
  let deletedMatches = 0;

  for (const pair of dupPairs) {
    const numericMatch = pair.numeric!;

    for (const wc26Match of pair.wc26) {
      const wc26Preds = predsByMatch.get(wc26Match.id) ?? [];

      // Migrate each prediction from wc26-* → numeric-ID
      for (const pred of wc26Preds) {
        // Check if numeric match already has a prediction from this user
        const existingOnNumeric = (predsByMatch.get(numericMatch.id) ?? [])
          .find(p => p.userId === pred.userId);

        if (existingOnNumeric) {
          // Both exist — keep the one with more data (has a value), delete the other
          console.log(`  ⚠ Conflito userId ${pred.userId}: mantendo palpite numeric-ID, descartando wc26-* pred`);
        } else {
          // Safe to migrate: update prediction.matchId to numeric match's _id
          await predRepo.update(pred.id, { matchId: numericMatch.id } as any);
          migratedPreds++;
          console.log(`  ↗ Migrado palpite ${pred.id} (user ${pred.userId}): wc26 → numeric-ID (${numericMatch.homeTeam} × ${numericMatch.awayTeam})`);
        }
      }

      // Now delete the wc26-* match (predictions were migrated or had no preds)
      await matchRepo.delete(wc26Match.id);
      deletedMatches++;
      console.log(`  🗑  Deletado ${wc26Match.externalId} (${wc26Match.homeTeam} × ${wc26Match.awayTeam})`);
    }
  }

  console.log(`\nPalpites migrados: ${migratedPreds} | Partidas deletadas: ${deletedMatches}`);

  /* ════════════════════════════════════════════════════════
     PASSO 3 — Recalcular pontos de todas as partidas finalizadas
  ════════════════════════════════════════════════════════ */
  console.log('\n══ PASSO 3: Recalculando pontos ══\n');

  const rules = await ruleRepo.findAll();
  const ruleByStage = new Map(rules.map(r => [r.stage, r]));

  // Work only with numeric-ID finished matches (canonical source)
  const finishedMatches = (await matchRepo.findAll()).filter(
    m => m.status === MatchStatus.FINISHED && m.officialHomeScore !== null,
  );

  let calc = 0, skip = 0, err = 0;

  for (const match of finishedMatches) {
    const rule = ruleByStage.get(match.stage);
    if (!rule?.active) { skip++; continue; }

    const preds = await predRepo.findByMatch(match.id);
    if (preds.length === 0) { skip++; continue; }

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
      } catch (e: any) { err++; console.error(`  ❌ ${pred.id}: ${e.message}`); }
    }
  }

  console.log(`Recalculados: ${calc} | Ignorados: ${skip} | Erros: ${err}`);

  // ── Ranking final ──────────────────────────────────────────────────────────
  console.log('\n══ RANKING FINAL ══\n');
  const finalPreds = await predRepo.findAll();
  const byUser = new Map<string, number>();
  for (const p of finalPreds) {
    if (p.pointsAwarded === null) continue;
    byUser.set(p.userId, (byUser.get(p.userId) ?? 0) + p.pointsAwarded);
  }
  const ranked = [...byUser.entries()].sort((a, b) => b[1] - a[1]);
  ranked.forEach(([uid, pts], i) => console.log(`  #${i + 1}  uid:${uid}  ${pts} pts`));

  // ── Estado final de partidas ───────────────────────────────────────────────
  const finalMatches = await matchRepo.findAll();
  const finalNumeric = finalMatches.filter(m => /^\d+$/.test(m.externalId));
  const finalWc26    = finalMatches.filter(m => m.externalId.startsWith('wc26-'));

  // Check for remaining duplicates
  const finalPairCheck = new Map<string, number>();
  for (const m of finalMatches) {
    const k = `${canon(m.homeTeam)}__${canon(m.awayTeam)}`;
    finalPairCheck.set(k, (finalPairCheck.get(k) ?? 0) + 1);
  }
  const remainingDups = [...finalPairCheck.values()].filter(c => c > 1).length;

  console.log(`\n📊 Estado final:`);
  console.log(`  Partidas: ${finalMatches.length}  (numeric: ${finalNumeric.length} | wc26-*: ${finalWc26.length})`);
  console.log(`  Duplicatas restantes: ${remainingDups}`);
  console.log(`  Palpites: ${finalPreds.length}`);
  console.log(`  Com pontos calculados: ${finalPreds.filter(p => p.pointsAwarded !== null).length}`);
  console.log(`  Órfãos pós-limpeza: ${finalPreds.filter(p => !new Set(finalMatches.map(m => m.id)).has(p.matchId)).length}`);

  await app.close();
  console.log('\n✅ Concluído!');
}

bootstrap().catch(err => { console.error(err.message); process.exit(1); });

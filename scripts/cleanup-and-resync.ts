/**
 * cleanup-and-resync.ts
 *
 * 10-step script that:
 *   1.  Shows current DB state (counts + duplicate detection)
 *   2.  Fetches all games from worldcup26.ir
 *   3.  Fetches team flags from worldcup26.ir
 *   4.  Fetches stadiums for proper UTC conversion
 *   5.  Enriches scores from ESPN (live / recently finished)
 *   6.  Maps worldcup26 games → existing DB matches (by team names)
 *   7.  Updates every existing match (score, status, winner, logos, kickoff)
 *   8.  Deletes orphan wc26-* duplicates (no predictions, twin already updated)
 *   9.  Resets + recalculates points for all finished matches
 *  10.  Shows final summary
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register scripts/cleanup-and-resync.ts
 */

import { NestFactory } from '@nestjs/core';
import axios from 'axios';
import { AppModule } from '../src/app.module';
import {
  MatchRepository,
  PredictionRepository,
  ScoreRuleRepository,
} from '../src/infrastructure/database/repositories';
import { MatchStatus, MatchWinner } from '../src/domain/entities';

/* ── helpers ──────────────────────────────────────────────────────────────── */

function normalize(name = ''): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function step(n: number, msg: string) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  PASSO ${n}: ${msg}`);
  console.log('─'.repeat(60));
}

async function fetchJSON(url: string): Promise<any> {
  const res = await axios.get(url, { timeout: 12_000 });
  return res.data;
}

function localDateToUtc(localDate: string, region?: string, country?: string): Date {
  const m = localDate.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!m) return new Date(localDate);
  const [, mo, day, y, h, mi] = m;
  let brtOffset = 0;
  if (region === 'Eastern') brtOffset = 1;
  else if (region === 'Western') brtOffset = 4;
  else if (region === 'Central') brtOffset = country === 'Mexico' ? 3 : 2;
  return new Date(Date.UTC(+y, +mo - 1, +day, +h + 3 + brtOffset, +mi));
}

/* ── main ─────────────────────────────────────────────────────────────────── */

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const matchRepo = app.get(MatchRepository);
  const predRepo  = app.get(PredictionRepository);
  const ruleRepo  = app.get(ScoreRuleRepository);

  /* ════════════════════════════════════════════════════════════════════════
     PASSO 1 — Estado atual do banco
  ════════════════════════════════════════════════════════════════════════ */
  step(1, 'Estado atual do banco');

  const allMatches = await matchRepo.findAll();
  const allPreds   = await predRepo.findAll();

  const numericMatches = allMatches.filter(m => /^\d+$/.test(m.externalId));
  const wc26Matches    = allMatches.filter(m => m.externalId.startsWith('wc26-'));
  const generatedMatches = allMatches.filter(m => m.externalId.startsWith('generated-'));
  const otherMatches   = allMatches.filter(
    m => !numericMatches.includes(m) && !wc26Matches.includes(m) && !generatedMatches.includes(m),
  );

  console.log(`Total de partidas  : ${allMatches.length}`);
  console.log(`  Numeric ID       : ${numericMatches.length}  (football-data.org)`);
  console.log(`  wc26-*           : ${wc26Matches.length}  (worldcup26.ir)`);
  console.log(`  generated-*      : ${generatedMatches.length}  (knockout gerado)`);
  console.log(`  outros           : ${otherMatches.length}`);
  console.log(`Total de palpites  : ${allPreds.length}`);

  // Detect duplicates: same teams, two different docs
  const teamKeyCount = new Map<string, number>();
  for (const m of allMatches) {
    const k = `${normalize(m.homeTeam)}__${normalize(m.awayTeam)}`;
    teamKeyCount.set(k, (teamKeyCount.get(k) ?? 0) + 1);
  }
  const duplicates = [...teamKeyCount.entries()].filter(([, c]) => c > 1);
  console.log(`Duplicatas detectadas: ${duplicates.length} pares de times`);
  if (duplicates.length > 0) {
    for (const [key] of duplicates.slice(0, 5)) {
      const [home, away] = key.split('__');
      console.log(`  ↳ ${home} vs ${away}`);
    }
    if (duplicates.length > 5) console.log(`  ... e mais ${duplicates.length - 5}`);
  }

  /* ════════════════════════════════════════════════════════════════════════
     PASSO 2 — Buscar jogos do worldcup26.ir
  ════════════════════════════════════════════════════════════════════════ */
  step(2, 'Buscando jogos de worldcup26.ir');

  const gamesData = await fetchJSON('https://worldcup26.ir/get/games');
  const rawGames: any[] = gamesData?.games ?? gamesData?.data ?? (Array.isArray(gamesData) ? gamesData : []);
  const wc26Games = rawGames.map((g: any) => ({
    ...g,
    id: String(g.id),
    finished: g.finished === true || g.finished === 'TRUE' || g.finished === 'true',
    home_score: g.home_score != null ? Number(g.home_score) : 0,
    away_score: g.away_score != null ? Number(g.away_score) : 0,
  }));

  console.log(`worldcup26.ir retornou ${wc26Games.length} jogos`);
  console.log(`  Finalizados: ${wc26Games.filter((g: any) => g.finished).length}`);
  console.log(`  Agendados  : ${wc26Games.filter((g: any) => !g.finished).length}`);

  /* ════════════════════════════════════════════════════════════════════════
     PASSO 3 — Buscar flags dos times
  ════════════════════════════════════════════════════════════════════════ */
  step(3, 'Buscando flags/escudos dos times');

  const teamsData = await fetchJSON('https://worldcup26.ir/get/teams');
  const teamsArr: any[] = teamsData?.teams ?? teamsData?.data ?? (Array.isArray(teamsData) ? teamsData : []);
  const teamsMap = new Map<string, any>(teamsArr.map((t: any) => [String(t.id), t]));

  const withFlags = teamsArr.filter((t: any) => !!t.flag).length;
  console.log(`Times carregados: ${teamsArr.length} (${withFlags} com flag URL)`);

  /* ════════════════════════════════════════════════════════════════════════
     PASSO 4 — Buscar estádios para conversão de fuso horário
  ════════════════════════════════════════════════════════════════════════ */
  step(4, 'Buscando estádios para conversão UTC');

  const stadData = await fetchJSON('https://worldcup26.ir/get/stadiums');
  const stadArr: any[] = stadData?.stadiums ?? stadData?.data ?? (Array.isArray(stadData) ? stadData : []);
  const stadMap = new Map<string, any>(stadArr.map((s: any) => [String(s.id), s]));

  console.log(`Estádios carregados: ${stadArr.length}`);
  for (const s of stadArr) {
    console.log(`  ${s.name ?? s.id} → região: ${s.region ?? 'desconhecida'} (${s.city ?? ''})`);
  }

  /* ════════════════════════════════════════════════════════════════════════
     PASSO 5 — Enriquecer com placares ao vivo (ESPN)
  ════════════════════════════════════════════════════════════════════════ */
  step(5, 'Buscando placares ao vivo no ESPN');

  const ESPN_URL =
    'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/scoreboard?limit=200&dates=20260601-20260730';

  try {
    const espnData = await fetchJSON(ESPN_URL);
    const events: any[] = espnData?.events ?? [];

    // Build lookup: "homeNorm__awayNorm" → game (reference)
    const gameLookup = new Map<string, any>();
    for (const g of wc26Games) {
      const k = `${normalize(g.home_team_name_en ?? '')}__${normalize(g.away_team_name_en ?? '')}`;
      if (k !== '__') gameLookup.set(k, g);
    }

    let espnUpdated = 0;
    for (const event of events) {
      const comp = event.competitions?.[0];
      if (!comp) continue;
      const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
      const away = comp.competitors?.find((c: any) => c.homeAway === 'away');
      if (!home || !away) continue;

      const k = `${normalize(home.team?.displayName ?? '')}__${normalize(away.team?.displayName ?? '')}`;
      const game = gameLookup.get(k);
      if (!game) continue;

      const finished: boolean = comp.status?.type?.completed ?? false;
      const inProgress: boolean = comp.status?.type?.state === 'in';

      game.home_score = parseInt(home.score ?? '0') || 0;
      game.away_score = parseInt(away.score ?? '0') || 0;
      game.finished = finished;
      if (inProgress) game._live = true;

      // Penalty winner
      if (finished && home.score === away.score) {
        if (home.winner === true) game._penaltyWinner = 'home';
        else if (away.winner === true) game._penaltyWinner = 'away';
      }

      espnUpdated++;
    }

    console.log(`ESPN: ${events.length} eventos recebidos, ${espnUpdated} jogos atualizados`);
  } catch (err) {
    console.warn(`⚠️  ESPN indisponível: ${err.message} (usando apenas worldcup26.ir)`);
  }

  /* ════════════════════════════════════════════════════════════════════════
     PASSO 6 — Mapear jogos wc26 → partidas existentes no banco
  ════════════════════════════════════════════════════════════════════════ */
  step(6, 'Mapeando worldcup26 → registros existentes no DB');

  // Refresh allMatches after potential previous runs
  const currentMatches = await matchRepo.findAll();

  // Map: normalizedTeamKey → existing match
  const existingByTeam = new Map<string, typeof currentMatches[0]>();
  for (const m of currentMatches) {
    const k = `${normalize(m.homeTeam)}__${normalize(m.awayTeam)}`;
    existingByTeam.set(k, m);
  }

  let mapped = 0;
  let notMapped = 0;
  const mappingLog: string[] = [];

  for (const g of wc26Games) {
    const homeNorm = normalize(g.home_team_name_en ?? '');
    const awayNorm = normalize(g.away_team_name_en ?? '');
    if (!homeNorm || !awayNorm) continue;

    const k = `${homeNorm}__${awayNorm}`;
    const existing = existingByTeam.get(k);
    if (existing) {
      mapped++;
      g._targetExternalId = existing.externalId;
    } else {
      notMapped++;
      g._targetExternalId = `wc26-${g.id}`;
      mappingLog.push(`  ⚠ Sem match no DB: ${g.home_team_name_en} vs ${g.away_team_name_en}`);
    }
  }

  console.log(`Mapeados: ${mapped} | Sem match no DB (novos): ${notMapped}`);
  if (mappingLog.length > 0) {
    console.log('Partidas sem correspondência (serão criadas):');
    mappingLog.slice(0, 10).forEach(l => console.log(l));
  }

  /* ════════════════════════════════════════════════════════════════════════
     PASSO 7 — Atualizar todas as partidas (placar, status, logo, kickoff)
  ════════════════════════════════════════════════════════════════════════ */
  step(7, 'Atualizando partidas no banco');

  let updatedCount = 0;
  let createdCount = 0;
  let errCount = 0;

  for (const g of wc26Games) {
    try {
      const homeNorm = normalize(g.home_team_name_en ?? '');
      const awayNorm = normalize(g.away_team_name_en ?? '');
      if (!homeNorm || !awayNorm) continue;

      const stadium = stadMap.get(String(g.stadium_id));
      const homeTeamObj = teamsMap.get(String(g.home_team_id));
      const awayTeamObj = teamsMap.get(String(g.away_team_id));

      const kickoffAt = g.local_date
        ? localDateToUtc(g.local_date, stadium?.region, stadium?.country_en)
        : undefined;

      const finished: boolean = g.finished === true || g.finished === 'TRUE';
      const officialHomeScore = finished ? (g.home_score ?? null) : null;
      const officialAwayScore = finished ? (g.away_score ?? null) : null;

      let status: MatchStatus;
      if (finished) status = MatchStatus.FINISHED;
      else if (g._live) status = MatchStatus.LIVE;
      else status = MatchStatus.SCHEDULED;

      let winner: MatchWinner | null = null;
      if (finished && officialHomeScore !== null && officialAwayScore !== null) {
        if (officialHomeScore > officialAwayScore)        winner = MatchWinner.HOME;
        else if (officialAwayScore > officialHomeScore)   winner = MatchWinner.AWAY;
        else if (g._penaltyWinner === 'home')             winner = MatchWinner.HOME;
        else if (g._penaltyWinner === 'away')             winner = MatchWinner.AWAY;
        else                                              winner = MatchWinner.DRAW;
      }

      const targetExtId: string = g._targetExternalId;
      const existingInDB = existingByTeam.get(`${homeNorm}__${awayNorm}`);

      const updatePayload: any = {
        externalId:       targetExtId,
        status,
        officialHomeScore,
        officialAwayScore,
        winner,
        syncedAt:         new Date(),
        ...(kickoffAt ? { kickoffAt } : {}),
        ...(homeTeamObj?.flag ? { homeTeamLogo: homeTeamObj.flag } : {}),
        ...(awayTeamObj?.flag ? { awayTeamLogo: awayTeamObj.flag } : {}),
        // Only update team names if they are missing/Unknown
        ...((!existingInDB || existingInDB.homeTeam === 'Unknown')
          ? { homeTeam: g.home_team_name_en?.trim() || `Time ${g.home_team_id}` }
          : {}),
        ...((!existingInDB || existingInDB.awayTeam === 'Unknown')
          ? { awayTeam: g.away_team_name_en?.trim() || `Time ${g.away_team_id}` }
          : {}),
      };

      await matchRepo.upsertByExternalId(targetExtId, updatePayload);

      if (existingInDB) {
        updatedCount++;
        if (finished) {
          console.log(`  ✅ ${g.home_team_name_en} ${officialHomeScore}–${officialAwayScore} ${g.away_team_name_en} [${status}]`);
        }
      } else {
        createdCount++;
      }
    } catch (err) {
      errCount++;
      console.error(`  ❌ Erro: ${g.home_team_name_en} vs ${g.away_team_name_en}: ${err.message}`);
    }
  }

  console.log(`\nAtualizados: ${updatedCount} | Criados: ${createdCount} | Erros: ${errCount}`);

  /* ════════════════════════════════════════════════════════════════════════
     PASSO 8 — Deletar duplicatas wc26-* sem palpites
  ════════════════════════════════════════════════════════════════════════ */
  step(8, 'Removendo duplicatas wc26-* sem palpites');

  // After the upserts above, reload matches
  const matchesAfterUpdate = await matchRepo.findAll();
  const numericAfter = matchesAfterUpdate.filter(m => /^\d+$/.test(m.externalId));
  const wc26After    = matchesAfterUpdate.filter(m => m.externalId.startsWith('wc26-'));

  // A wc26-* match is an orphan if a numeric-ID match exists for the same teams
  const numericByTeam = new Map<string, string>();
  for (const m of numericAfter) {
    numericByTeam.set(`${normalize(m.homeTeam)}__${normalize(m.awayTeam)}`, m.id);
  }

  let deletedOrphans = 0;
  let skippedWithPreds = 0;

  for (const wc26Match of wc26After) {
    const k = `${normalize(wc26Match.homeTeam)}__${normalize(wc26Match.awayTeam)}`;
    // Only delete if there's a numeric-ID twin (the "real" one with predictions)
    if (!numericByTeam.has(k)) continue;

    // Check if this wc26-* match has any predictions
    const preds = await predRepo.findByMatch(wc26Match.id);
    if (preds.length > 0) {
      console.log(`  ⚠️  ${wc26Match.homeTeam} vs ${wc26Match.awayTeam}: wc26-* tem ${preds.length} palpite(s) — mantido`);
      skippedWithPreds++;
      continue;
    }

    await matchRepo.delete(wc26Match.id);
    deletedOrphans++;
    console.log(`  🗑️  Deletado duplicata: ${wc26Match.externalId} (${wc26Match.homeTeam} vs ${wc26Match.awayTeam})`);
  }

  console.log(`\nDuplicatas deletadas: ${deletedOrphans} | Mantidas (têm palpites): ${skippedWithPreds}`);

  /* ════════════════════════════════════════════════════════════════════════
     PASSO 9 — Resetar e recalcular pontos de partidas finalizadas
  ════════════════════════════════════════════════════════════════════════ */
  step(9, 'Recalculando pontos de todas as partidas finalizadas');

  const finishedMatches = (await matchRepo.findAll()).filter(
    m => m.status === MatchStatus.FINISHED && m.officialHomeScore !== null,
  );
  const rules = await ruleRepo.findAll();
  const ruleByStage = new Map(rules.map(r => [r.stage, r]));

  let pointsReset = 0;
  let pointsCalc = 0;
  let pointsErr = 0;

  for (const match of finishedMatches) {
    const rule = ruleByStage.get(match.stage);
    if (!rule || !rule.active) continue;

    const predictions = await predRepo.findByMatch(match.id);
    if (predictions.length === 0) continue;

    for (const pred of predictions) {
      try {
        // Reset first
        await predRepo.update(pred.id, {
          pointsAwarded: null,
          exactScoreHit: false,
          outcomeHit: false,
        });
        pointsReset++;

        // Skip auto-filled
        if (pred.isAutoFilled) {
          await predRepo.update(pred.id, { pointsAwarded: 0, exactScoreHit: false, outcomeHit: false });
          pointsCalc++;
          continue;
        }

        // Calculate
        const result = calcPoints(
          pred.predictedHomeScore,
          pred.predictedAwayScore,
          match.officialHomeScore!,
          match.officialAwayScore!,
          rule.basePoints,
          rule.exactScoreBonus,
          pred.tiebreakWinner,
          match.winner,
        );

        await predRepo.update(pred.id, {
          pointsAwarded: result.points,
          exactScoreHit: result.exactScore,
          outcomeHit: result.outcomeHit,
          lockedAt: pred.lockedAt ?? new Date(),
        });
        pointsCalc++;
      } catch (err) {
        pointsErr++;
        console.error(`  ❌ Erro no palpite ${pred.id}: ${err.message}`);
      }
    }
  }

  console.log(`Palpites resetados: ${pointsReset} | Recalculados: ${pointsCalc} | Erros: ${pointsErr}`);

  /* ════════════════════════════════════════════════════════════════════════
     PASSO 10 — Resumo final
  ════════════════════════════════════════════════════════════════════════ */
  step(10, 'Resumo final');

  const finalMatches = await matchRepo.findAll();
  const finalPreds   = await predRepo.findAll();
  const finalNumeric = finalMatches.filter(m => /^\d+$/.test(m.externalId));
  const finalWc26    = finalMatches.filter(m => m.externalId.startsWith('wc26-'));
  const finalGen     = finalMatches.filter(m => m.externalId.startsWith('generated-'));
  const finalFinished = finalMatches.filter(m => m.status === MatchStatus.FINISHED);
  const finalLive     = finalMatches.filter(m => m.status === MatchStatus.LIVE);
  const finalSched    = finalMatches.filter(m => m.status === MatchStatus.SCHEDULED);

  // Check for remaining duplicates
  const finalTeamCount = new Map<string, number>();
  for (const m of finalMatches) {
    const k = `${normalize(m.homeTeam)}__${normalize(m.awayTeam)}`;
    finalTeamCount.set(k, (finalTeamCount.get(k) ?? 0) + 1);
  }
  const remainingDups = [...finalTeamCount.entries()].filter(([, c]) => c > 1).length;

  console.log(`\n📊 ESTADO FINAL DO BANCO`);
  console.log(`  Total de partidas : ${finalMatches.length}`);
  console.log(`    Numeric ID      : ${finalNumeric.length}`);
  console.log(`    wc26-*          : ${finalWc26.length}`);
  console.log(`    generated-*     : ${finalGen.length}`);
  console.log(`  Status:`);
  console.log(`    Finalizadas     : ${finalFinished.length}`);
  console.log(`    Ao vivo         : ${finalLive.length}`);
  console.log(`    Agendadas       : ${finalSched.length}`);
  console.log(`  Total de palpites : ${finalPreds.length}`);
  console.log(`  Duplicatas restantes: ${remainingDups}`);

  if (remainingDups === 0) {
    console.log('\n✅ Nenhuma duplicata! Banco limpo e atualizado.');
  } else {
    console.log(`\n⚠️  Ainda há ${remainingDups} pares duplicados.`);
    console.log('    Eles foram mantidos pois ambos têm palpites vinculados.');
    console.log('    Verifique manualmente se necessário.');
  }

  // Show finished matches summary
  console.log('\n📋 Partidas finalizadas:');
  for (const m of finalFinished.slice(0, 20)) {
    console.log(
      `  ${m.homeTeam} ${m.officialHomeScore ?? '?'}–${m.officialAwayScore ?? '?'} ${m.awayTeam}` +
      (m.winner ? ` (${m.winner})` : ''),
    );
  }
  if (finalFinished.length > 20) console.log(`  ... e mais ${finalFinished.length - 20}`);

  await app.close();
  console.log('\n🎉 Concluído!');
}

/* ── scoring logic (mirror of CalculatePointsUseCase) ──────────────────────── */

function calcPoints(
  predHome: number, predAway: number,
  realHome: number, realAway: number,
  basePoints: number, exactBonus: number,
  tiebreakWinner: 'home' | 'away' | null,
  matchWinner: MatchWinner | null,
): { points: number; exactScore: boolean; outcomeHit: boolean } {
  // Exact score
  if (predHome === realHome && predAway === realAway) {
    const isDrawScore    = realHome === realAway;
    const hasPenaltyWin  = isDrawScore && matchWinner !== null && matchWinner !== MatchWinner.DRAW;
    if (hasPenaltyWin && tiebreakWinner === matchWinner) {
      return { points: basePoints + exactBonus + 1, exactScore: true, outcomeHit: true };
    }
    return { points: basePoints + exactBonus, exactScore: true, outcomeHit: true };
  }

  // Correct outcome
  const predWinner = predHome > predAway ? 'home' : predAway > predHome ? 'away' : 'draw';
  const realWinner = realHome > realAway ? 'home' : realAway > realHome ? 'away' : 'draw';

  if (predWinner === realWinner) {
    const matchWentToPenalties = matchWinner !== null && matchWinner !== MatchWinner.DRAW;
    const predictedDraw = predHome === predAway;
    if (matchWentToPenalties && predictedDraw && tiebreakWinner === matchWinner) {
      return { points: basePoints + 1, exactScore: false, outcomeHit: true };
    }
    return { points: basePoints, exactScore: false, outcomeHit: true };
  }

  return { points: 0, exactScore: false, outcomeHit: false };
}

bootstrap().catch(err => {
  console.error('\n❌ Script falhou:', err.message);
  process.exit(1);
});

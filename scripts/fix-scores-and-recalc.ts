import { NestFactory } from '@nestjs/core';
import axios from 'axios';
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

// Team name aliases: handles API name differences (football-data.org ↔ worldcup26.ir)
const ALIASES: Record<string, string> = {
  czechia: 'czechrepublic',
  czechrepublic: 'czechrepublic',
  cotedivoire: 'ivorycoast',
  ivorycoast: 'ivorycoast',
  capeverdeislands: 'capeverde',
  capeverde: 'capeverde',
  republicofkorea: 'southkorea',
  southkorea: 'southkorea',
  korea: 'southkorea',
  democraticrepublicofthecongo: 'drcongo',
  drcongo: 'drcongo',
  congodrc: 'drcongo',
  congodr: 'drcongo',
  bosniaherzegovina: 'bosniaandherzegovina',
  bosniaandherzegovina: 'bosniaandherzegovina',
  unitedstates: 'usa',
  usa: 'usa',
};

function canon(name = ''): string {
  const n = normalize(name);
  return ALIASES[n] ?? n;
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

function calcPoints(
  predHome: number, predAway: number,
  realHome: number, realAway: number,
  basePoints: number, exactBonus: number,
  tiebreakWinner: 'home' | 'away' | null,
  matchWinner: MatchWinner | null,
): { points: number; exactScore: boolean; outcomeHit: boolean } {
  if (predHome === realHome && predAway === realAway) {
    const hasPenaltyWin = realHome === realAway && matchWinner !== null && matchWinner !== MatchWinner.DRAW;
    if (hasPenaltyWin && tiebreakWinner === matchWinner) {
      return { points: basePoints + exactBonus + 1, exactScore: true, outcomeHit: true };
    }
    return { points: basePoints + exactBonus, exactScore: true, outcomeHit: true };
  }
  const predWinner = predHome > predAway ? 'home' : predAway > predHome ? 'away' : 'draw';
  const realWinner = realHome > realAway ? 'home' : realAway > realHome ? 'away' : 'draw';
  if (predWinner === realWinner) {
    const matchWentToPenalties = matchWinner !== null && matchWinner !== MatchWinner.DRAW;
    if (matchWentToPenalties && predHome === predAway && tiebreakWinner === matchWinner) {
      return { points: basePoints + 1, exactScore: false, outcomeHit: true };
    }
    return { points: basePoints, exactScore: false, outcomeHit: true };
  }
  return { points: 0, exactScore: false, outcomeHit: false };
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const matchRepo = app.get(MatchRepository);
  const predRepo  = app.get(PredictionRepository);
  const ruleRepo  = app.get(ScoreRuleRepository);

  // ── DIAGNÓSTICO ────────────────────────────────────────────────────────────
  console.log('\n══ DIAGNÓSTICO ══');
  const allMatches = await matchRepo.findAll();
  const numericMatches = allMatches.filter(m => /^\d+$/.test(m.externalId));
  const nullScoreNumeric = numericMatches.filter(m => m.officialHomeScore === null);
  const finishedNumeric = numericMatches.filter(m => m.status === MatchStatus.FINISHED);
  const allPreds = await predRepo.findAll();
  const withPoints = allPreds.filter(p => p.pointsAwarded !== null);
  const withPositive = allPreds.filter(p => (p.pointsAwarded ?? 0) > 0);

  console.log(`Partidas numeric-ID   : ${numericMatches.length}`);
  console.log(`  → finalizadas       : ${finishedNumeric.length}`);
  console.log(`  → sem placar (null) : ${nullScoreNumeric.length}`);
  console.log(`Palpites totais       : ${allPreds.length}`);
  console.log(`  → com pontos calc   : ${withPoints.length}`);
  console.log(`  → pontos > 0        : ${withPositive.length}`);
  console.log('\nAmostra numeric-ID sem placar:');
  nullScoreNumeric.slice(0, 5).forEach(m =>
    console.log(`  ${m.homeTeam} vs ${m.awayTeam} | status: ${m.status} | score: ${m.officialHomeScore}-${m.officialAwayScore}`));

  // ── BUSCAR worldcup26.ir ───────────────────────────────────────────────────
  console.log('\n══ BUSCANDO DADOS WORLDCUP26.IR ══');
  const [gd, td, sd] = await Promise.all([
    axios.get('https://worldcup26.ir/get/games',   { timeout: 12000 }).then(r => r.data),
    axios.get('https://worldcup26.ir/get/teams',   { timeout: 12000 }).then(r => r.data),
    axios.get('https://worldcup26.ir/get/stadiums',{ timeout: 12000 }).then(r => r.data),
  ]);
  const wc26Games: any[] = (gd?.games ?? gd?.data ?? (Array.isArray(gd) ? gd : [])).map((g: any) => ({
    ...g,
    id: String(g.id),
    finished: g.finished === true || g.finished === 'TRUE' || g.finished === 'true',
    home_score: g.home_score != null ? Number(g.home_score) : 0,
    away_score: g.away_score != null ? Number(g.away_score) : 0,
  }));
  const teamsMap = new Map<string, any>((td?.teams ?? td?.data ?? []).map((t: any) => [String(t.id), t]));
  const stadMap  = new Map<string, any>((sd?.stadiums ?? sd?.data ?? []).map((s: any) => [String(s.id), s]));
  console.log(`worldcup26.ir: ${wc26Games.length} jogos | ${[...teamsMap.values()].filter(t => t.flag).length}/48 flags`);

  // ── TENTAR ESPN ────────────────────────────────────────────────────────────
  try {
    const espn = await axios.get(
      'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/scoreboard?limit=200&dates=20260601-20260730',
      { timeout: 8000 },
    ).then(r => r.data);
    const events: any[] = espn?.events ?? [];
    const gameLookup = new Map<string, any>();
    for (const g of wc26Games) {
      const k = `${canon(g.home_team_name_en)}__${canon(g.away_team_name_en)}`;
      if (k !== '__') gameLookup.set(k, g);
    }
    let espnHit = 0;
    for (const ev of events) {
      const comp = ev.competitions?.[0];
      const home = comp?.competitors?.find((c: any) => c.homeAway === 'home');
      const away = comp?.competitors?.find((c: any) => c.homeAway === 'away');
      if (!home || !away) continue;
      const k = `${canon(home.team?.displayName)}__${canon(away.team?.displayName)}`;
      const game = gameLookup.get(k);
      if (!game) continue;
      const finished: boolean = comp.status?.type?.completed ?? false;
      game.home_score = parseInt(home.score ?? '0') || 0;
      game.away_score = parseInt(away.score ?? '0') || 0;
      game.finished = finished;
      if (comp.status?.type?.state === 'in') game._live = true;
      if (finished && home.score === away.score) {
        if (home.winner) game._penaltyWinner = 'home';
        else if (away.winner) game._penaltyWinner = 'away';
      }
      espnHit++;
    }
    console.log(`ESPN: ${events.length} eventos, ${espnHit} atualizados`);
  } catch (e: any) {
    console.warn(`ESPN indisponível: ${e.message}`);
  }

  // ── CONSTRUIR MAPA CANÔNICO wc26 por times (com e sem inversão) ───────────
  // key = "canonHome__canonAway" → { game, reversed: false }
  // also "canonAway__canonHome" → { game, reversed: true } for orientation lookup
  type WcEntry = { game: any; reversed: boolean };
  const wc26ByTeams = new Map<string, WcEntry>();
  for (const g of wc26Games) {
    const hc = canon(g.home_team_name_en ?? '');
    const ac = canon(g.away_team_name_en ?? '');
    if (!hc || !ac) continue;
    wc26ByTeams.set(`${hc}__${ac}`, { game: g, reversed: false });
    wc26ByTeams.set(`${ac}__${hc}`, { game: g, reversed: true });
  }

  // ── ATUALIZAR PARTIDAS NUMERIC-ID COM PLACARES CORRETOS ───────────────────
  console.log('\n══ ATUALIZANDO NUMERIC-ID COM PLACARES ══');
  let updated = 0, notFound = 0;

  for (const match of numericMatches) {
    const hc = canon(match.homeTeam);
    const ac = canon(match.awayTeam);
    const key = `${hc}__${ac}`;

    const entry = wc26ByTeams.get(key);
    if (!entry) {
      notFound++;
      console.warn(`  ⚠ Sem match wc26: ${match.homeTeam} vs ${match.awayTeam}`);
      continue;
    }

    const { game: g, reversed } = entry;
    const finished: boolean = g.finished === true || g.finished === 'TRUE';

    // When orientation is reversed: home in DB = away in wc26, so swap scores
    const homeScore = reversed ? g.away_score : g.home_score;
    const awayScore = reversed ? g.home_score : g.away_score;

    const stadium  = stadMap.get(String(g.stadium_id));
    const homeTeamObj = teamsMap.get(String(g.home_team_id));
    const awayTeamObj = teamsMap.get(String(g.away_team_id));
    // When reversed, home flag in DB comes from wc26 away team (and vice-versa)
    const homeFlag = reversed ? awayTeamObj?.flag : homeTeamObj?.flag;
    const awayFlag = reversed ? homeTeamObj?.flag : awayTeamObj?.flag;

    const kickoffAt = g.local_date ? localDateToUtc(g.local_date, stadium?.region, stadium?.country_en) : undefined;

    let status: MatchStatus;
    if (finished)      status = MatchStatus.FINISHED;
    else if (g._live)  status = MatchStatus.LIVE;
    else               status = MatchStatus.SCHEDULED;

    const officialHomeScore = finished ? homeScore : null;
    const officialAwayScore = finished ? awayScore : null;

    let winner: MatchWinner | null = null;
    if (finished && officialHomeScore !== null && officialAwayScore !== null) {
      if (officialHomeScore > officialAwayScore)       winner = MatchWinner.HOME;
      else if (officialAwayScore > officialHomeScore)  winner = MatchWinner.AWAY;
      else if (g._penaltyWinner === (reversed ? 'away' : 'home')) winner = MatchWinner.HOME;
      else if (g._penaltyWinner === (reversed ? 'home' : 'away')) winner = MatchWinner.AWAY;
      else                                             winner = MatchWinner.DRAW;
    }

    const payload: any = {
      status, officialHomeScore, officialAwayScore, winner, syncedAt: new Date(),
      ...(kickoffAt                ? { kickoffAt }                : {}),
      ...(homeFlag                 ? { homeTeamLogo: homeFlag }   : {}),
      ...(awayFlag                 ? { awayTeamLogo: awayFlag }   : {}),
    };

    await matchRepo.upsertByExternalId(match.externalId, payload);
    updated++;

    if (finished) {
      const orient = reversed ? ' (invertido)' : '';
      console.log(`  ✅ ${match.homeTeam} ${officialHomeScore}–${officialAwayScore} ${match.awayTeam}${orient}`);
    }
  }
  console.log(`\nAtualizados: ${updated} | Não encontrados: ${notFound}`);

  // ── RECALCULAR PONTOS ──────────────────────────────────────────────────────
  console.log('\n══ RECALCULANDO PONTOS ══');

  const rules = await ruleRepo.findAll();
  const ruleByStage = new Map(rules.map(r => [r.stage, r]));
  const finishedAll = (await matchRepo.findAll()).filter(
    m => /^\d+$/.test(m.externalId) && m.status === MatchStatus.FINISHED && m.officialHomeScore !== null,
  );

  let reset = 0, calc = 0, err = 0;
  for (const match of finishedAll) {
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
        reset++; calc++;
      } catch (e: any) { err++; }
    }
  }
  console.log(`Recalculados: ${calc} palpites | Erros: ${err}`);

  // ── RANKING FINAL ──────────────────────────────────────────────────────────
  console.log('\n══ RANKING ══');
  const finalPreds = await predRepo.findAll();
  const byUser = new Map<string, number>();
  for (const p of finalPreds) {
    if (p.pointsAwarded === null) continue;
    byUser.set(p.userId, (byUser.get(p.userId) ?? 0) + p.pointsAwarded);
  }
  const sorted = [...byUser.entries()].sort((a, b) => b[1] - a[1]);
  sorted.forEach(([uid, pts], i) => console.log(`  #${i+1} userId:${uid} → ${pts} pts`));

  await app.close();
  console.log('\n✅ Concluído!');
}

bootstrap().catch(err => { console.error(err.message); process.exit(1); });

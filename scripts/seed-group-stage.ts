/**
 * Seed script: All 72 group-stage matches of the 2026 FIFA World Cup.
 *
 * Run with:
 *   npx ts-node -r tsconfig-paths/register scripts/seed-group-stage.ts
 *
 * The script UPSERTS every match by externalId (wc26-g{GROUP}-r{ROUND}-{shortLabel}).
 * If the record already exists it will be updated with the real teams & scores.
 * After seeding, it fires GenerateKnockoutMatchesUseCase to rebuild the bracket.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { MatchRepository } from '../src/infrastructure/database/repositories';
import { GenerateKnockoutMatchesUseCase } from '../src/application/use-cases/match/generate-knockout-matches.use-case';
import { MatchStage, MatchStatus, MatchWinner } from '../src/domain/entities';

// ------------------------------------------------------------------
// Helper types
// ------------------------------------------------------------------
interface MatchSeed {
  externalId: string;
  group: string;
  round: number;
  roundLabel: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: Date;
  status: MatchStatus;
  officialHomeScore: number | null;
  officialAwayScore: number | null;
  winner: MatchWinner | null;
}

function winner(home: number, away: number): MatchWinner {
  if (home > away) return MatchWinner.HOME;
  if (away > home) return MatchWinner.AWAY;
  return MatchWinner.DRAW;
}

function finished(
  id: string, group: string, round: number,
  home: string, away: string,
  kickoff: Date,
  hs: number, as_: number,
): MatchSeed {
  return {
    externalId: id,
    group,
    round,
    roundLabel: `Group ${group} - ${round}`,
    homeTeam: home,
    awayTeam: away,
    kickoffAt: kickoff,
    status: MatchStatus.FINISHED,
    officialHomeScore: hs,
    officialAwayScore: as_,
    winner: winner(hs, as_),
  };
}

function scheduled(
  id: string, group: string, round: number,
  home: string, away: string,
  kickoff: Date,
): MatchSeed {
  return {
    externalId: id,
    group,
    round,
    roundLabel: `Group ${group} - ${round}`,
    homeTeam: home,
    awayTeam: away,
    kickoffAt: kickoff,
    status: MatchStatus.SCHEDULED,
    officialHomeScore: null,
    officialAwayScore: null,
    winner: null,
  };
}

// ------------------------------------------------------------------
// All 72 group-stage matches (source: Wikipedia / FIFA, as of 2026-06-24)
// ------------------------------------------------------------------
const GROUP_STAGE_MATCHES: MatchSeed[] = [

  // ========== GROUP A: Mexico, South Korea, Czech Republic, South Africa ==========
  finished('wc26-gA-r1-MEX-RSA', 'A', 1, 'Mexico', 'South Africa',      new Date('2026-06-11T19:00:00Z'), 2, 0),
  finished('wc26-gA-r1-KOR-CZE', 'A', 1, 'South Korea', 'Czech Republic', new Date('2026-06-12T02:00:00Z'), 2, 1),
  finished('wc26-gA-r2-CZE-RSA', 'A', 2, 'Czech Republic', 'South Africa', new Date('2026-06-18T16:00:00Z'), 1, 1),
  finished('wc26-gA-r2-MEX-KOR', 'A', 2, 'Mexico', 'South Korea',         new Date('2026-06-19T01:00:00Z'), 1, 0),
  finished('wc26-gA-r3-CZE-MEX', 'A', 3, 'Czech Republic', 'Mexico',     new Date('2026-06-25T01:00:00Z'), 0, 3),
  finished('wc26-gA-r3-RSA-KOR', 'A', 3, 'South Africa', 'South Korea',  new Date('2026-06-25T01:00:00Z'), 1, 0),

  // ========== GROUP B: Switzerland, Canada, Bosnia and Herzegovina, Qatar ==========
  finished('wc26-gB-r1-CAN-BIH', 'B', 1, 'Canada', 'Bosnia and Herzegovina', new Date('2026-06-12T19:00:00Z'), 1, 1),
  finished('wc26-gB-r1-QAT-SUI', 'B', 1, 'Qatar', 'Switzerland',              new Date('2026-06-13T19:00:00Z'), 1, 1),
  finished('wc26-gB-r2-SUI-BIH', 'B', 2, 'Switzerland', 'Bosnia and Herzegovina', new Date('2026-06-18T19:00:00Z'), 4, 1),
  finished('wc26-gB-r2-CAN-QAT', 'B', 2, 'Canada', 'Qatar',                   new Date('2026-06-18T22:00:00Z'), 6, 0),
  finished('wc26-gB-r3-SUI-CAN', 'B', 3, 'Switzerland', 'Canada',             new Date('2026-06-24T19:00:00Z'), 2, 1),
  finished('wc26-gB-r3-BIH-QAT', 'B', 3, 'Bosnia and Herzegovina', 'Qatar',   new Date('2026-06-24T19:00:00Z'), 3, 1),

  // ========== GROUP C: Brazil, Morocco, Scotland, Haiti ==========
  finished('wc26-gC-r1-BRA-MAR', 'C', 1, 'Brazil', 'Morocco',    new Date('2026-06-13T22:00:00Z'), 1, 1),
  finished('wc26-gC-r1-HAI-SCO', 'C', 1, 'Haiti', 'Scotland',    new Date('2026-06-14T01:00:00Z'), 0, 1),
  finished('wc26-gC-r2-SCO-MAR', 'C', 2, 'Scotland', 'Morocco',  new Date('2026-06-19T22:00:00Z'), 0, 1),
  finished('wc26-gC-r2-BRA-HAI', 'C', 2, 'Brazil', 'Haiti',      new Date('2026-06-20T00:30:00Z'), 3, 0),
  finished('wc26-gC-r3-SCO-BRA', 'C', 3, 'Scotland', 'Brazil',  new Date('2026-06-24T22:00:00Z'), 0, 3),
  finished('wc26-gC-r3-MAR-HAI', 'C', 3, 'Morocco', 'Haiti',    new Date('2026-06-24T22:00:00Z'), 4, 2),

  // ========== GROUP D: United States, Australia, Paraguay, Turkey ==========
  finished('wc26-gD-r1-USA-PAR', 'D', 1, 'United States', 'Paraguay', new Date('2026-06-13T01:00:00Z'), 4, 1),
  finished('wc26-gD-r1-AUS-TUR', 'D', 1, 'Australia', 'Turkey',       new Date('2026-06-14T04:00:00Z'), 2, 0),
  finished('wc26-gD-r2-USA-AUS', 'D', 2, 'United States', 'Australia', new Date('2026-06-19T19:00:00Z'), 2, 0),
  finished('wc26-gD-r2-TUR-PAR', 'D', 2, 'Turkey', 'Paraguay',        new Date('2026-06-20T03:00:00Z'), 0, 1),
  scheduled('wc26-gD-r3-TUR-USA', 'D', 3, 'Turkey', 'United States',  new Date('2026-06-26T02:00:00Z')),
  scheduled('wc26-gD-r3-PAR-AUS', 'D', 3, 'Paraguay', 'Australia',    new Date('2026-06-26T02:00:00Z')),

  // ========== GROUP E: Germany, Ivory Coast, Ecuador, Curaçao ==========
  finished('wc26-gE-r1-GER-CUW', 'E', 1, 'Germany', 'Curaçao',       new Date('2026-06-14T17:00:00Z'), 7, 1),
  finished('wc26-gE-r1-CIV-ECU', 'E', 1, 'Ivory Coast', 'Ecuador',   new Date('2026-06-14T23:00:00Z'), 1, 0),
  finished('wc26-gE-r2-GER-CIV', 'E', 2, 'Germany', 'Ivory Coast',   new Date('2026-06-20T20:00:00Z'), 2, 1),
  finished('wc26-gE-r2-ECU-CUW', 'E', 2, 'Ecuador', 'Curaçao',       new Date('2026-06-21T01:00:00Z'), 0, 0),
  scheduled('wc26-gE-r3-CUW-CIV', 'E', 3, 'Curaçao', 'Ivory Coast', new Date('2026-06-25T20:00:00Z')),
  scheduled('wc26-gE-r3-ECU-GER', 'E', 3, 'Ecuador', 'Germany',      new Date('2026-06-26T01:00:00Z')),

  // ========== GROUP F: Netherlands, Japan, Sweden, Tunisia ==========
  finished('wc26-gF-r1-NED-JPN', 'F', 1, 'Netherlands', 'Japan', new Date('2026-06-14T20:00:00Z'), 2, 2),
  finished('wc26-gF-r1-SWE-TUN', 'F', 1, 'Sweden', 'Tunisia',    new Date('2026-06-15T02:00:00Z'), 5, 1),
  finished('wc26-gF-r2-NED-SWE', 'F', 2, 'Netherlands', 'Sweden', new Date('2026-06-20T17:00:00Z'), 5, 1),
  finished('wc26-gF-r2-TUN-JPN', 'F', 2, 'Tunisia', 'Japan',      new Date('2026-06-21T04:00:00Z'), 0, 4),
  scheduled('wc26-gF-r3-JPN-SWE', 'F', 3, 'Japan', 'Sweden',     new Date('2026-06-25T23:00:00Z')),
  scheduled('wc26-gF-r3-TUN-NED', 'F', 3, 'Tunisia', 'Netherlands', new Date('2026-06-26T00:00:00Z')),

  // ========== GROUP G: Egypt, Iran, Belgium, New Zealand ==========
  finished('wc26-gG-r1-BEL-EGY', 'G', 1, 'Belgium', 'Egypt',        new Date('2026-06-15T19:00:00Z'), 1, 1),
  finished('wc26-gG-r1-IRN-NZL', 'G', 1, 'Iran', 'New Zealand',     new Date('2026-06-16T01:00:00Z'), 2, 2),
  finished('wc26-gG-r2-BEL-IRN', 'G', 2, 'Belgium', 'Iran',         new Date('2026-06-21T19:00:00Z'), 0, 0),
  finished('wc26-gG-r2-NZL-EGY', 'G', 2, 'New Zealand', 'Egypt',    new Date('2026-06-22T01:00:00Z'), 1, 3),
  scheduled('wc26-gG-r3-EGY-IRN', 'G', 3, 'Egypt', 'Iran',          new Date('2026-06-27T03:00:00Z')),
  scheduled('wc26-gG-r3-NZL-BEL', 'G', 3, 'New Zealand', 'Belgium', new Date('2026-06-27T03:00:00Z')),

  // ========== GROUP H: Spain, Uruguay, Cape Verde, Saudi Arabia ==========
  finished('wc26-gH-r1-ESP-CPV', 'H', 1, 'Spain', 'Cape Verde',       new Date('2026-06-15T16:00:00Z'), 0, 0),
  finished('wc26-gH-r1-KSA-URU', 'H', 1, 'Saudi Arabia', 'Uruguay',   new Date('2026-06-15T22:00:00Z'), 1, 1),
  finished('wc26-gH-r2-ESP-KSA', 'H', 2, 'Spain', 'Saudi Arabia',     new Date('2026-06-21T16:00:00Z'), 4, 0),
  finished('wc26-gH-r2-URU-CPV', 'H', 2, 'Uruguay', 'Cape Verde',     new Date('2026-06-21T22:00:00Z'), 2, 2),
  scheduled('wc26-gH-r3-CPV-KSA', 'H', 3, 'Cape Verde', 'Saudi Arabia', new Date('2026-06-27T00:00:00Z')),
  scheduled('wc26-gH-r3-URU-ESP', 'H', 3, 'Uruguay', 'Spain',           new Date('2026-06-27T00:00:00Z')),

  // ========== GROUP I: France, Norway, Senegal, Iraq ==========
  finished('wc26-gI-r1-FRA-SEN', 'I', 1, 'France', 'Senegal',   new Date('2026-06-16T19:00:00Z'), 3, 1),
  finished('wc26-gI-r1-IRQ-NOR', 'I', 1, 'Iraq', 'Norway',      new Date('2026-06-16T22:00:00Z'), 1, 4),
  finished('wc26-gI-r2-FRA-IRQ', 'I', 2, 'France', 'Iraq',      new Date('2026-06-22T21:00:00Z'), 3, 0),
  finished('wc26-gI-r2-NOR-SEN', 'I', 2, 'Norway', 'Senegal',   new Date('2026-06-23T00:00:00Z'), 3, 2),
  scheduled('wc26-gI-r3-NOR-FRA', 'I', 3, 'Norway', 'France',   new Date('2026-06-26T19:00:00Z')),
  scheduled('wc26-gI-r3-SEN-IRQ', 'I', 3, 'Senegal', 'Iraq',    new Date('2026-06-26T19:00:00Z')),

  // ========== GROUP J: Argentina, Austria, Algeria, Jordan ==========
  finished('wc26-gJ-r1-ARG-ALG', 'J', 1, 'Argentina', 'Algeria', new Date('2026-06-17T01:00:00Z'), 3, 0),
  finished('wc26-gJ-r1-AUT-JOR', 'J', 1, 'Austria', 'Jordan',    new Date('2026-06-17T04:00:00Z'), 3, 1),
  finished('wc26-gJ-r2-ARG-AUT', 'J', 2, 'Argentina', 'Austria', new Date('2026-06-22T17:00:00Z'), 2, 0),
  finished('wc26-gJ-r2-JOR-ALG', 'J', 2, 'Jordan', 'Algeria',    new Date('2026-06-23T03:00:00Z'), 1, 2),
  scheduled('wc26-gJ-r3-ALG-AUT', 'J', 3, 'Algeria', 'Austria',  new Date('2026-06-28T02:00:00Z')),
  scheduled('wc26-gJ-r3-JOR-ARG', 'J', 3, 'Jordan', 'Argentina', new Date('2026-06-28T02:00:00Z')),

  // ========== GROUP K: Colombia, Portugal, DR Congo, Uzbekistan ==========
  finished('wc26-gK-r1-POR-COD', 'K', 1, 'Portugal', 'DR Congo',     new Date('2026-06-17T17:00:00Z'), 1, 1),
  finished('wc26-gK-r1-UZB-COL', 'K', 1, 'Uzbekistan', 'Colombia',   new Date('2026-06-18T02:00:00Z'), 1, 3),
  finished('wc26-gK-r2-POR-UZB', 'K', 2, 'Portugal', 'Uzbekistan',   new Date('2026-06-23T17:00:00Z'), 5, 0),
  finished('wc26-gK-r2-COL-COD', 'K', 2, 'Colombia', 'DR Congo',     new Date('2026-06-24T04:00:00Z'), 1, 0),
  scheduled('wc26-gK-r3-COL-POR', 'K', 3, 'Colombia', 'Portugal',    new Date('2026-06-27T23:30:00Z')),
  scheduled('wc26-gK-r3-COD-UZB', 'K', 3, 'DR Congo', 'Uzbekistan',  new Date('2026-06-27T23:30:00Z')),

  // ========== GROUP L: England, Ghana, Croatia, Panama ==========
  finished('wc26-gL-r1-ENG-CRO', 'L', 1, 'England', 'Croatia', new Date('2026-06-17T20:00:00Z'), 4, 2),
  finished('wc26-gL-r1-GHA-PAN', 'L', 1, 'Ghana', 'Panama',    new Date('2026-06-17T23:00:00Z'), 1, 0),
  finished('wc26-gL-r2-ENG-GHA', 'L', 2, 'England', 'Ghana',   new Date('2026-06-23T20:00:00Z'), 0, 0),
  finished('wc26-gL-r2-PAN-CRO', 'L', 2, 'Panama', 'Croatia',  new Date('2026-06-23T23:00:00Z'), 0, 1),
  scheduled('wc26-gL-r3-PAN-ENG', 'L', 3, 'Panama', 'England', new Date('2026-06-27T21:00:00Z')),
  scheduled('wc26-gL-r3-CRO-GHA', 'L', 3, 'Croatia', 'Ghana',  new Date('2026-06-27T21:00:00Z')),
];

// ------------------------------------------------------------------
// Bootstrap
// ------------------------------------------------------------------
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const matchRepo = app.get(MatchRepository);
  const generateKnockout = app.get(GenerateKnockoutMatchesUseCase);

  console.log('🌱 Seeding 72 group-stage matches for FIFA World Cup 2026...');

  let upserted = 0;
  let errors = 0;

  for (const m of GROUP_STAGE_MATCHES) {
    try {
      await matchRepo.upsertByExternalId(m.externalId, {
        externalId: m.externalId,
        competition: 'FIFA World Cup 2026',
        stage: MatchStage.GROUP_STAGE,
        group: m.group as any,
        round: m.round,
        roundLabel: m.roundLabel,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        kickoffAt: m.kickoffAt,
        status: m.status,
        officialHomeScore: m.officialHomeScore,
        officialAwayScore: m.officialAwayScore,
        winner: m.winner,
        syncedAt: new Date(),
      });
      upserted++;
      const score = m.status === MatchStatus.FINISHED
        ? `${m.officialHomeScore}-${m.officialAwayScore}`
        : 'agendado';
      console.log(`  ✅ ${m.roundLabel}: ${m.homeTeam} ${score} ${m.awayTeam}`);
    } catch (err) {
      console.error(`  ❌ Error upserting ${m.externalId}:`, err.message);
      errors++;
    }
  }

  console.log(`\n📊 Resultado: ${upserted} inseridos/atualizados, ${errors} erros`);

  // Rebuild knockout bracket based on real group standings
  console.log('\n🏆 Recalculando bracket das oitavas...');
  try {
    const result = await generateKnockout.execute();
    console.log(`✅ ${result.generated} criados, ${result.updated} atualizados nas oitavas`);
  } catch (err) {
    console.error('❌ Erro ao gerar oitavas:');
  }

  await app.close();
  console.log('\n🎉 Seed concluído!');
}

bootstrap().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

import { Injectable, Logger } from '@nestjs/common';
import { MatchRepository } from '@infrastructure/database/repositories';
import { MatchStage, MatchStatus } from '@domain/entities';
import { CalculateGroupStandingsUseCase, GroupStanding, TeamStanding } from './calculate-group-standings.use-case';

/**
 * FIFA 2026 World Cup — Round of 32 bracket generator
 *
 * 32 teams = 24 group toppers (1st + 2nd from 12 groups)
 *          +  8 best 3rd-place teams (out of 12)
 *
 * Fixed group pairings (1st of one plays 2nd of the other):
 *   A ↔ B  |  C ↔ F  |  D ↔ E
 *   G ↔ H  |  I ↔ J  |  K ↔ L
 *
 * Brazil (Group C) always faces Group F:
 *   If Brazil finishes 1st → plays 2nd of Group F
 *   If Brazil finishes 2nd → plays 1st of Group F
 *
 * 3rd-place teams (matches R32-3rd-1 to R32-3rd-4):
 *   Best 8 of 12 3rd-placed teams ranked by:
 *   points → goal difference → goals scored
 *   Seeded bracket: 1st vs 8th, 2nd vs 7th, 3rd vs 6th, 4th vs 5th.
 */
@Injectable()
export class GenerateKnockoutMatchesUseCase {
  private readonly logger = new Logger(GenerateKnockoutMatchesUseCase.name);

  /** Fixed group pairings: 1st of `home` group plays 2nd of `away` group. */
  private static readonly GROUP_PAIR_BRACKETS = [
    { id: 'R32-1',  home: 'A', homePos: 0, away: 'B', awayPos: 1 }, // A1 vs B2
    { id: 'R32-2',  home: 'B', homePos: 0, away: 'A', awayPos: 1 }, // B1 vs A2
    { id: 'R32-3',  home: 'C', homePos: 0, away: 'F', awayPos: 1 }, // C1 vs F2 ← Brazil if 1st
    { id: 'R32-4',  home: 'F', homePos: 0, away: 'C', awayPos: 1 }, // F1 vs C2 ← Brazil if 2nd
    { id: 'R32-5',  home: 'D', homePos: 0, away: 'E', awayPos: 1 }, // D1 vs E2
    { id: 'R32-6',  home: 'E', homePos: 0, away: 'D', awayPos: 1 }, // E1 vs D2
    { id: 'R32-7',  home: 'G', homePos: 0, away: 'H', awayPos: 1 }, // G1 vs H2
    { id: 'R32-8',  home: 'H', homePos: 0, away: 'G', awayPos: 1 }, // H1 vs G2
    { id: 'R32-9',  home: 'I', homePos: 0, away: 'J', awayPos: 1 }, // I1 vs J2
    { id: 'R32-10', home: 'J', homePos: 0, away: 'I', awayPos: 1 }, // J1 vs I2
    { id: 'R32-11', home: 'K', homePos: 0, away: 'L', awayPos: 1 }, // K1 vs L2
    { id: 'R32-12', home: 'L', homePos: 0, away: 'K', awayPos: 1 }, // L1 vs K2
  ] as const;

  constructor(
    private readonly matchRepository: MatchRepository,
    private readonly calculateStandingsUseCase: CalculateGroupStandingsUseCase,
  ) {}

  async execute(): Promise<{ generated: number; updated: number }> {
    this.logger.log('Generating/updating Round of 32 knockout matches');

    const standings = await this.calculateStandingsUseCase.execute();

    const allGroupMatches = await this.matchRepository.findByStage(MatchStage.GROUP_STAGE);
    const logoMap = new Map<string, string>();
    allGroupMatches.forEach((m) => {
      if (m.homeTeamLogo) logoMap.set(m.homeTeam, m.homeTeamLogo);
      if (m.awayTeamLogo) logoMap.set(m.awayTeam, m.awayTeamLogo);
    });

    // Position 0 = 1st, 1 = 2nd, 2 = 3rd, 3 = 4th
    const groupPositions = new Map<string, string[]>();
    standings.forEach((group) => {
      const positions: string[] = [];
      for (let i = 0; i < 4; i++) {
        positions.push(group.teams[i]?.team ?? `TBD-${group.group}${i + 1}`);
      }
      groupPositions.set(group.group, positions);
    });

    // Clean up any old generated R16 matches (old format) before regenerating R32
    const deletedOldR16 = await this.matchRepository.deleteGeneratedByStage(MatchStage.ROUND_OF_16);
    if (deletedOldR16 > 0) {
      this.logger.log(`Removed ${deletedOldR16} old R16 generated matches (upgrading to R32)`);
    }

    // Load existing R32 generated matches
    const existingR32 = await this.matchRepository.findByStage(MatchStage.ROUND_OF_32);

    let generated = 0;
    let updated = 0;

    // ── 12 fixed group-pair matches ─────────────────────────────────────────
    for (const b of GenerateKnockoutMatchesUseCase.GROUP_PAIR_BRACKETS) {
      const homeTeam = groupPositions.get(b.home)?.[b.homePos] ?? `TBD-${b.home}${b.homePos + 1}`;
      const awayTeam = groupPositions.get(b.away)?.[b.awayPos] ?? `TBD-${b.away}${b.awayPos + 1}`;
      const roundLabel = `32 avos de final - ${b.id}`;

      const existing = existingR32.find(
        (m) => m.roundLabel === roundLabel || m.externalId === `generated-${b.id}`,
      );

      if (existing) {
        await this.matchRepository.update(existing.id, {
          homeTeam,
          homeTeamLogo: logoMap.get(homeTeam) ?? existing.homeTeamLogo,
          awayTeam,
          awayTeamLogo: logoMap.get(awayTeam) ?? existing.awayTeamLogo,
          roundLabel,
        });
        updated++;
        this.logger.log(`Updated ${b.id}: ${homeTeam} vs ${awayTeam}`);
      } else {
        await this.matchRepository.create({
          externalId: `generated-${b.id}`,
          competition: 'FIFA World Cup 2026',
          stage: MatchStage.ROUND_OF_32,
          roundLabel,
          homeTeam,
          homeTeamLogo: logoMap.get(homeTeam),
          awayTeam,
          awayTeamLogo: logoMap.get(awayTeam),
          kickoffAt: new Date('2026-06-28T00:00:00Z'), // placeholder; real date from API sync
          status: MatchStatus.SCHEDULED,
          officialHomeScore: null,
          officialAwayScore: null,
          winner: null,
          syncedAt: new Date(),
        });
        generated++;
        this.logger.log(`Created ${b.id}: ${homeTeam} vs ${awayTeam}`);
      }
    }

    // ── 4 matches for the 8 best 3rd-place teams ────────────────────────────
    const best8Third = this.getBest8ThirdPlaceTeams(standings);

    for (let i = 0; i < 4; i++) {
      const matchId = `R32-3rd-${i + 1}`;
      // Seeded: 1st vs 8th, 2nd vs 7th, 3rd vs 6th, 4th vs 5th
      const homeTeam = best8Third[i]?.team ?? `TBD-3rd-${i + 1}`;
      const awayTeam = best8Third[7 - i]?.team ?? `TBD-3rd-${8 - i}`;
      const roundLabel = `32 avos de final - ${matchId}`;

      const existing = existingR32.find(
        (m) => m.roundLabel === roundLabel || m.externalId === `generated-${matchId}`,
      );

      if (existing) {
        await this.matchRepository.update(existing.id, {
          homeTeam,
          homeTeamLogo: logoMap.get(homeTeam) ?? existing.homeTeamLogo,
          awayTeam,
          awayTeamLogo: logoMap.get(awayTeam) ?? existing.awayTeamLogo,
          roundLabel,
        });
        updated++;
        this.logger.log(`Updated ${matchId}: ${homeTeam} vs ${awayTeam}`);
      } else {
        await this.matchRepository.create({
          externalId: `generated-${matchId}`,
          competition: 'FIFA World Cup 2026',
          stage: MatchStage.ROUND_OF_32,
          roundLabel,
          homeTeam,
          homeTeamLogo: logoMap.get(homeTeam),
          awayTeam,
          awayTeamLogo: logoMap.get(awayTeam),
          kickoffAt: new Date('2026-06-28T00:00:00Z'),
          status: MatchStatus.SCHEDULED,
          officialHomeScore: null,
          officialAwayScore: null,
          winner: null,
          syncedAt: new Date(),
        });
        generated++;
        this.logger.log(`Created ${matchId}: ${homeTeam} vs ${awayTeam}`);
      }
    }

    this.logger.log(`R32 complete: ${generated} generated, ${updated} updated`);
    return { generated, updated };
  }

  /**
   * Ranks the 3rd-place teams from all 12 groups and returns the best 8.
   * Ranking: points → goal difference → goals scored.
   */
  private getBest8ThirdPlaceTeams(standings: GroupStanding[]): TeamStanding[] {
    const thirdPlace: TeamStanding[] = [];

    for (const group of standings) {
      if (group.teams.length >= 3) {
        thirdPlace.push(group.teams[2]);
      }
    }

    thirdPlace.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });

    return thirdPlace.slice(0, 8);
  }
}


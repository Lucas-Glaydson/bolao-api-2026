import { Injectable, Logger } from '@nestjs/common';
import { MatchRepository } from '@infrastructure/database/repositories';
import { Match, MatchStatus, MatchStage, MatchWinner, GroupLabel } from '@domain/entities';

export interface TeamStanding {
  team: string;
  teamLogo?: string;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface GroupStanding {
  group: GroupLabel;
  teams: TeamStanding[];
  qualified: string[]; // Top 2 teams
}

@Injectable()
export class CalculateGroupStandingsUseCase {
  private readonly logger = new Logger(CalculateGroupStandingsUseCase.name);

  constructor(private readonly matchRepository: MatchRepository) {}

  async execute(): Promise<GroupStanding[]> {
    this.logger.log('Calculating group standings');

    const groups: GroupLabel[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    const standings: GroupStanding[] = [];

    // Pre-fetch all group_stage matches once (efficient — avoids N+1 queries)
    const allGroupStageMatches = await this.matchRepository.findByStage(MatchStage.GROUP_STAGE);
    this.logger.log(`Group stage matches in DB: ${allGroupStageMatches.length}`);

    // Short-circuit: if there are no group stage matches in the DB at all,
    // return empty standings immediately — no point iterating 12 groups.
    if (allGroupStageMatches.length === 0) {
      const total = (await this.matchRepository.findAll()).length;
      this.logger.warn(
        `No group_stage matches found! Total matches in DB: ${total}. ` +
        `Run POST /matches/sync to populate group stage data.`,
      );
      return groups.map((group) => ({ group, teams: [], qualified: [] }));
    }

    for (const group of groups) {
      let groupMatches = allGroupStageMatches.filter((m) => m.group === group);

      // Fallback: matches synced before the mapStage fix may lack the group field.
      // Filter by roundLabel pattern (e.g. "Group A - 1").
      if (groupMatches.length === 0) {
        const g = group.toLowerCase();
        groupMatches = allGroupStageMatches.filter(
          (m) =>
            (m.roundLabel || '').toLowerCase().includes(`group ${g} `) ||
            (m.roundLabel || '').toLowerCase().includes(`group ${g}-`) ||
            (m.roundLabel || '').toLowerCase().startsWith(`group ${g}`),
        );
      }

      const finishedMatches = groupMatches.filter(
        (m) => m.status === MatchStatus.FINISHED,
      );

      // Build logo map from match data
      const logoMap = new Map<string, string>();
      groupMatches.forEach((match) => {
        if (match.homeTeamLogo) logoMap.set(match.homeTeam, match.homeTeamLogo);
        if (match.awayTeamLogo) logoMap.set(match.awayTeam, match.awayTeamLogo);
      });

      // Get all unique teams in the group
      const teams = new Set<string>();
      groupMatches.forEach((match) => {
        teams.add(match.homeTeam);
        teams.add(match.awayTeam);
      });

      const teamStats = new Map<string, TeamStanding>();

      // Initialize team stats
      teams.forEach((team) => {
        teamStats.set(team, {
          team,
          teamLogo: logoMap.get(team),
          points: 0,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
        });
      });

      // Calculate stats from finished matches
      finishedMatches.forEach((match) => {
        const homeScore = match.useManualScore && match.manualHomeScore != null
          ? match.manualHomeScore
          : match.officialHomeScore;
        const awayScore = match.useManualScore && match.manualAwayScore != null
          ? match.manualAwayScore
          : match.officialAwayScore;

        if (homeScore == null || awayScore == null) return;

        const homeStats = teamStats.get(match.homeTeam)!;
        const awayStats = teamStats.get(match.awayTeam)!;

        homeStats.played++;
        awayStats.played++;

        homeStats.goalsFor += homeScore;
        homeStats.goalsAgainst += awayScore;
        awayStats.goalsFor += awayScore;
        awayStats.goalsAgainst += homeScore;

        if (homeScore > awayScore) {
          // Home win
          homeStats.points += 3;
          homeStats.won++;
          awayStats.lost++;
        } else if (awayScore > homeScore) {
          // Away win
          awayStats.points += 3;
          awayStats.won++;
          homeStats.lost++;
        } else {
          // Draw
          homeStats.points += 1;
          awayStats.points += 1;
          homeStats.drawn++;
          awayStats.drawn++;
        }

        homeStats.goalDifference = homeStats.goalsFor - homeStats.goalsAgainst;
        awayStats.goalDifference = awayStats.goalsFor - awayStats.goalsAgainst;
      });

      // Sort teams by FIFA rules:
      // 1. Points
      // 2. Goal difference
      // 3. Goals scored
      // 4. Head-to-head (simplified here)
      const sortedTeams = Array.from(teamStats.values()).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference)
          return b.goalDifference - a.goalDifference;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        return a.team.localeCompare(b.team); // Alphabetical as tiebreaker
      });

      const qualified = sortedTeams.slice(0, 2).map((t) => t.team);

      standings.push({
        group,
        teams: sortedTeams,
        qualified,
      });

      this.logger.log(
        `Group ${group}: ${qualified[0]} (1st), ${qualified[1]} (2nd)`,
      );
    }

    return standings;
  }
}

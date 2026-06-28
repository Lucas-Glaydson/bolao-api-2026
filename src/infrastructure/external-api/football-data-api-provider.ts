import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { IFootballApiProvider } from './football-api-provider.interface';
import { Match, MatchStatus, MatchStage, MatchWinner } from '../../domain/entities';

/**
 * Adapter for the football-data.org v4 API.
 *
 * Free tier covers FIFA World Cup (competition ID 2000).
 * Register at: https://www.football-data.org/client/register
 *
 * .env:
 *   EXTERNAL_FOOTBALL_API_BASE_URL=https://api.football-data.org/v4
 *   EXTERNAL_FOOTBALL_API_KEY=<token from football-data.org>
 */
@Injectable()
export class FootballDataApiProvider implements IFootballApiProvider {
  private readonly logger = new Logger(FootballDataApiProvider.name);
  private readonly httpClient: AxiosInstance;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  /** football-data.org competition ID for the FIFA World Cup */
  private static readonly WC_COMPETITION = 2000;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('externalApi.baseUrl') || '';
    this.apiKey  = this.configService.get<string>('externalApi.apiKey')  || '';

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: { 'X-Auth-Token': this.apiKey },
      timeout: 15000,
    });
  }

  /** Fetch all World Cup 2026 fixtures in one request. */
  async fetchMatches(): Promise<Partial<Match>[]> {
    try {
      this.logger.log('Fetching all WC 2026 matches from football-data.org');

      const response = await this.httpClient.get(
        `/competitions/${FootballDataApiProvider.WC_COMPETITION}/matches`,
      );

      const matches: any[] = response.data.matches || [];
      this.logger.log(`football-data.org returned ${matches.length} matches`);
      return matches.map((m) => this.normalizeMatch(m));
    } catch (error) {
      this.logger.error(
        'Error fetching matches from football-data.org',
        error.response?.data?.message ?? error.message,
      );
      throw error;
    }
  }

  /** Fetch a single fixture by its football-data.org match id. */
  async fetchMatchById(externalId: string): Promise<Partial<Match> | null> {
    try {
      this.logger.log(`Fetching match ${externalId} from football-data.org`);

      const response = await this.httpClient.get(`/matches/${externalId}`);
      if (!response.data) return null;
      return this.normalizeMatch(response.data);
    } catch (error) {
      this.logger.error(
        `Error fetching match ${externalId} from football-data.org`,
        error.response?.data?.message ?? error.message,
      );
      return null;
    }
  }

  // ── Normalisation ──────────────────────────────────────────────────────────

  private normalizeMatch(apiMatch: any): Partial<Match> {
    const score    = apiMatch.score     || {};
    const fullTime = score.fullTime     || {};
    const homeTeam = apiMatch.homeTeam  || {};
    const awayTeam = apiMatch.awayTeam  || {};

    const status = this.mapStatus(apiMatch.status);

    let winner: MatchWinner | null = null;
    if (
      fullTime.home != null &&
      fullTime.away != null &&
      (status === MatchStatus.FINISHED)
    ) {
      if (fullTime.home > fullTime.away)      winner = MatchWinner.HOME;
      else if (fullTime.away > fullTime.home) winner = MatchWinner.AWAY;
      else                                    winner = MatchWinner.DRAW;
    }

    const stageStr  = apiMatch.stage || '';
    const groupStr  = apiMatch.group || '';          // e.g. "GROUP_C"
    const matchday  = apiMatch.matchday ?? undefined;
    const stage     = this.mapStage(stageStr);
    const group     = this.extractGroup(groupStr) as any;
    const roundLabel = this.buildRoundLabel(stageStr, groupStr, matchday);

    return {
      externalId:         apiMatch.id?.toString(),
      competition:        'FIFA World Cup 2026',
      stage,
      group,
      round:              stage === MatchStage.GROUP_STAGE ? matchday : undefined,
      roundLabel,
      homeTeam:           homeTeam.name       || homeTeam.shortName || undefined,
      homeTeamLogo:       homeTeam.crest      || undefined,
      awayTeam:           awayTeam.name       || awayTeam.shortName || undefined,
      awayTeamLogo:       awayTeam.crest      || undefined,
      kickoffAt:          new Date(apiMatch.utcDate),
      status,
      officialHomeScore:  fullTime.home  ?? null,
      officialAwayScore:  fullTime.away  ?? null,
      winner,
      syncedAt:           new Date(),
    };
  }

  /** football-data.org status → internal MatchStatus */
  private mapStatus(s: string): MatchStatus {
    switch (s) {
      case 'IN_PLAY':
      case 'PAUSED':    return MatchStatus.LIVE;
      case 'FINISHED':  return MatchStatus.FINISHED;
      case 'POSTPONED': return MatchStatus.POSTPONED;
      case 'CANCELLED':
      case 'SUSPENDED': return MatchStatus.CANCELLED;
      default:          return MatchStatus.SCHEDULED; // TIMED, SCHEDULED, etc.
    }
  }

  /** football-data.org stage string → internal MatchStage
   *
   * football-data.org v4 uses LAST_32 / LAST_16 for knockout rounds.
   * The legacy aliases ROUND_OF_32 / ROUND_OF_16 are kept as fallback.
   */
  private mapStage(s: string): MatchStage {
    switch (s) {
      case 'GROUP_STAGE':    return MatchStage.GROUP_STAGE;
      case 'LAST_32':
      case 'ROUND_OF_32':    return MatchStage.ROUND_OF_32;
      case 'LAST_16':
      case 'ROUND_OF_16':    return MatchStage.ROUND_OF_16;
      case 'QUARTER_FINALS': return MatchStage.QUARTER_FINALS;
      case 'SEMI_FINALS':    return MatchStage.SEMI_FINALS;
      case 'THIRD_PLACE':    return MatchStage.THIRD_PLACE;
      case 'FINAL':          return MatchStage.FINAL;
      default:               return MatchStage.GROUP_STAGE;
    }
  }

  /** "GROUP_C" → "C" */
  private extractGroup(groupStr: string): string | undefined {
    if (!groupStr) return undefined;
    const m = groupStr.match(/GROUP_([A-L])/i);
    return m ? m[1].toUpperCase() : undefined;
  }

  private buildRoundLabel(
    stage: string,
    group: string,
    matchday?: number,
  ): string {
    if (stage === 'GROUP_STAGE') {
      const g = this.extractGroup(group) ?? '?';
      return `Group ${g} - ${matchday ?? '?'}`;
    }
    const labels: Record<string, string> = {
      LAST_32:        '32 avos de final',
      ROUND_OF_32:    '32 avos de final',
      LAST_16:        'Oitavas de final',
      ROUND_OF_16:    'Oitavas de final',
      QUARTER_FINALS: 'Quartas de final',
      SEMI_FINALS:    'Semifinais',
      THIRD_PLACE:    'Terceiro lugar',
      FINAL:          'Final',
    };
    return labels[stage] ?? stage;
  }
}


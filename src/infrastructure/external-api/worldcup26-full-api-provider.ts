import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { IFootballApiProvider } from './football-api-provider.interface';
import { Match, MatchStage, MatchStatus, MatchWinner } from '../../domain/entities';

/* ─────────────────────────────────────────────────────────────────────────────
   Interfaces for worldcup26.ir API responses
───────────────────────────────────────────────────────────────────────────── */

interface Wc26Game {
  id: string | number;
  type: string;        // "group" | "R32" | "R16" | "QF" | "SF" | "F" | "3rd"
  group: string;       // "A"-"L" for group stage, "R32" etc. for knockout
  matchday: string | number;
  stadium_id: string | number;
  local_date: string;  // "MM/DD/YYYY HH:mm" — stadium local time
  home_team_name_en?: string;
  away_team_name_en?: string;
  home_team_id?: string | number;
  away_team_id?: string | number;
  home_score?: number | null;
  away_score?: number | null;
  finished?: string | boolean;  // "TRUE" | "FALSE" | true | false
}

interface Wc26Team {
  id: string | number;
  name_en?: string;
  flag?: string;
}

interface Wc26Stadium {
  id: string | number;
  region?: string;     // "Eastern" | "Central" | "Western"
  country_en?: string; // "Mexico" etc.
}

/* ─────────────────────────────────────────────────────────────────────────────
   ESPN team name normalization aliases (same as frontend project)
───────────────────────────────────────────────────────────────────────────── */

const TEAM_NAME_ALIASES: Record<string, string> = {
  'unitedstates': 'usa',
  'us': 'usa',
  'unitedstatesofamerica': 'usa',
  'brasil': 'brazil',
  'ing': 'england',
  'alemanha': 'germany',
  'ger': 'germany',
  'arg': 'argentina',
  'franca': 'france',
  'fra': 'france',
  'espanha': 'spain',
  'esp': 'spain',
  'holanda': 'netherlands',
  'ned': 'netherlands',
  'por': 'portugal',
  'italia': 'italy',
  'ita': 'italy',
  'mex': 'mexico',
  'can': 'canada',
  'aus': 'australia',
  'southkorea': 'korea',
  'republicofkorea': 'korea',
  'coriadosul': 'korea',
  'ivorycoast': 'cotedivoire',
  'cotedivoire': 'cotedivoire',
  'costadoelfim': 'cotedivoire',
  'democraticrepublicofthecongo': 'drcongo',
  'congodr': 'drcongo',
  'congodrc': 'drcongo',
  'saudiarabia': 'saudiarabia',
  'arabiesaoudite': 'saudiarabia',
  'newzealand': 'newzealand',
};

const ESPN_SCOREBOARD_URL =
  'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/scoreboard?limit=200&dates=20260601-20260730';

const BASE_URL = 'https://worldcup26.ir';

/* ─────────────────────────────────────────────────────────────────────────────
   Provider
───────────────────────────────────────────────────────────────────────────── */

@Injectable()
export class WorldCup26FullApiProvider implements IFootballApiProvider {
  private readonly logger = new Logger(WorldCup26FullApiProvider.name);

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Normalises a team name for fuzzy matching: lowercase, no accents, no non-alpha chars. */
  private normalizeTeamName(name = ''): string {
    const n = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
    return TEAM_NAME_ALIASES[n] ?? n;
  }

  /** Whether a worldcup26.ir game is marked as finished. */
  private isFinished(g: Wc26Game): boolean {
    return g.finished === 'TRUE' || g.finished === true;
  }

  /**
   * Converts a worldcup26.ir "MM/DD/YYYY HH:mm" local stadium time to a UTC Date.
   *
   * All World Cup 2026 venues are in North America.  worldcup26.ir stores the
   * kickoff time in the local clock of each stadium city.  Offsets to UTC:
   *   Eastern  (EDT)          → UTC-4  (+4 h to reach UTC)
   *   Central  US (CDT)       → UTC-5  (+5 h)
   *   Central  Mexico         → UTC-6  (+6 h)  (Mexico abolished DST in 2023)
   *   Western  (PDT)          → UTC-7  (+7 h)
   *
   * The formula used by the reference frontend project is:
   *   UTC = local + (3 + brtOffset)   where BRT = UTC-3
   *   Eastern  → brtOffset=1 → UTC = local + 4 ✓
   *   Central  US → brtOffset=2 → UTC = local + 5 ✓
   *   Central  MX → brtOffset=3 → UTC = local + 6 ✓
   *   Western  → brtOffset=4 → UTC = local + 7 ✓
   */
  private localDateToUtc(localDate: string, stadium: Wc26Stadium | undefined): Date {
    const m = localDate.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
    if (!m) return new Date(localDate);

    const [, mo, day, y, h, mi] = m;

    let brtOffset = 0;
    if (stadium) {
      if (stadium.region === 'Eastern') brtOffset = 1;
      else if (stadium.region === 'Western') brtOffset = 4;
      else if (stadium.region === 'Central') brtOffset = stadium.country_en === 'Mexico' ? 3 : 2;
    }

    // Date.UTC handles hour overflow (e.g. 25h → next day)
    return new Date(
      Date.UTC(+y, +mo - 1, +day, +h + 3 + brtOffset, +mi),
    );
  }

  /** Maps worldcup26.ir type/group to our MatchStage enum. */
  private mapStage(type: string, group: string): MatchStage {
    const t = (type || '').toUpperCase();
    const g = (group || '').toUpperCase();
    if (t === 'GROUP' || t === 'GROUP_STAGE') return MatchStage.GROUP_STAGE;
    if (t === 'R32' || g === 'R32') return MatchStage.ROUND_OF_32;
    if (t === 'R16' || g === 'R16') return MatchStage.ROUND_OF_16;
    if (t === 'QF' || g === 'QF') return MatchStage.QUARTER_FINALS;
    if (t === 'SF' || g === 'SF') return MatchStage.SEMI_FINALS;
    if (t === '3RD' || g === '3RD' || t === 'THIRD_PLACE') return MatchStage.ROUND_OF_16; // fallback
    if (t === 'F' || g === 'FINAL') return MatchStage.FINAL;
    return MatchStage.GROUP_STAGE;
  }

  /** Builds a human-readable round label. */
  private buildRoundLabel(stage: MatchStage, group: string | undefined, round: number | undefined): string {
    switch (stage) {
      case MatchStage.GROUP_STAGE:   return `Grupo ${group ?? ''} — Rodada ${round ?? ''}`;
      case MatchStage.ROUND_OF_32:   return 'Rodada de 32';
      case MatchStage.ROUND_OF_16:   return 'Oitavas de Final';
      case MatchStage.QUARTER_FINALS: return 'Quartas de Final';
      case MatchStage.SEMI_FINALS:   return 'Semifinal';
      case MatchStage.FINAL:         return 'Final';
      default:                       return stage;
    }
  }

  // ── Data fetchers ─────────────────────────────────────────────────────────

  private async fetchWc26<T>(path: string): Promise<T> {
    const res = await axios.get<T>(`${BASE_URL}${path}`, { timeout: 10_000 });
    return res.data;
  }

  private async fetchAllGames(): Promise<Wc26Game[]> {
    const data = await this.fetchWc26<any>('/get/games');
    const arr: any[] = data?.games ?? data?.data ?? (Array.isArray(data) ? data : []);
    return arr.map((g: any) => ({
      ...g,
      id: String(g.id),
      finished: g.finished === true || g.finished === 'TRUE' || g.finished === 'true' ? 'TRUE' : 'FALSE',
      home_score: g.home_score != null ? Number(g.home_score) : 0,
      away_score: g.away_score != null ? Number(g.away_score) : 0,
    }));
  }

  private async fetchTeamsMap(): Promise<Map<string, Wc26Team>> {
    try {
      const data = await this.fetchWc26<any>('/get/teams');
      const arr: any[] = data?.teams ?? data?.data ?? (Array.isArray(data) ? data : []);
      const map = new Map<string, Wc26Team>();
      for (const t of arr) map.set(String(t.id), t);
      return map;
    } catch (err) {
      this.logger.warn(`Could not fetch teams: ${err.message}`);
      return new Map();
    }
  }

  private async fetchStadiumsMap(): Promise<Map<string, Wc26Stadium>> {
    try {
      const data = await this.fetchWc26<any>('/get/stadiums');
      const arr: any[] = data?.stadiums ?? data?.data ?? (Array.isArray(data) ? data : []);
      const map = new Map<string, Wc26Stadium>();
      for (const s of arr) map.set(String(s.id), s);
      return map;
    } catch (err) {
      this.logger.warn(`Could not fetch stadiums: ${err.message}`);
      return new Map();
    }
  }

  /**
   * Fetches live/finished scores from ESPN and merges them into the games array.
   * ESPN is used as a secondary source so we always have up-to-date placards.
   * Returns the same array with scores mutated in-place.
   */
  private async mergeEspnScores(games: Wc26Game[]): Promise<void> {
    try {
      const res = await axios.get<any>(ESPN_SCOREBOARD_URL, { timeout: 8_000 });
      const events: any[] = res.data?.events ?? [];

      this.logger.debug(`ESPN returned ${events.length} events`);

      // Build lookup: "homeNorm__awayNorm" → game
      const lookup = new Map<string, Wc26Game>();
      for (const g of games) {
        const homeNorm = this.normalizeTeamName(g.home_team_name_en);
        const awayNorm = this.normalizeTeamName(g.away_team_name_en);
        if (homeNorm && awayNorm) {
          lookup.set(`${homeNorm}__${awayNorm}`, g);
        }
      }

      let updated = 0;
      for (const event of events) {
        const comp = event.competitions?.[0];
        if (!comp) continue;

        const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
        const away = comp.competitors?.find((c: any) => c.homeAway === 'away');
        if (!home || !away) continue;

        const key = `${this.normalizeTeamName(home.team?.displayName)}__${this.normalizeTeamName(away.team?.displayName)}`;
        const game = lookup.get(key);
        if (!game) continue;

        const finished: boolean = comp.status?.type?.completed ?? false;
        const inProgress: boolean = comp.status?.type?.state === 'in';

        game.home_score = parseInt(home.score ?? '0') || 0;
        game.away_score = parseInt(away.score ?? '0') || 0;
        game.finished = finished ? 'TRUE' : 'FALSE';
        if (inProgress) (game as any)._live = true;

        // Capture penalty winner: ESPN marks the winning team with winner=true.
        // Compare parsed numeric scores to avoid string vs number issues.
        const homeGoals = parseInt(home.score ?? '0') || 0;
        const awayGoals = parseInt(away.score ?? '0') || 0;
        if (finished && homeGoals === awayGoals) {
          const homeWon = home.winner === true || home.winner === 'true';
          const awayWon = away.winner === true || away.winner === 'true';
          if (homeWon) (game as any)._penaltyWinner = 'home';
          else if (awayWon) (game as any)._penaltyWinner = 'away';
        }

        updated++;
      }

      this.logger.log(`ESPN: updated scores for ${updated} / ${games.length} matches`);
    } catch (err) {
      this.logger.warn(`ESPN fetch failed (using worldcup26.ir scores only): ${err.message}`);
    }
  }

  // ── IFootballApiProvider implementation ──────────────────────────────────

  /**
   * Fallback penalty-winner inference using the bracket.
   *
   * When ESPN doesn't supply a `winner` flag on competitors (e.g. API lag,
   * missing data), we can still deduce who advanced: the loser of a knockout
   * draw is eliminated and won't appear in any future match, while the winner
   * will. For semi-finals both teams get another game (final / 3rd-place), so
   * this heuristic is intentionally skipped for those — we rely on ESPN there.
   */
  private inferPenaltyWinnersFromBracket(games: Wc26Game[]): void {
    // Knockout stage type codes from worldcup26.ir
    const knockoutTypes = new Set(['R32', 'R16', 'QF', 'SF', 'F', '3RD', 'THIRD_PLACE']);

    // Teams that appear in at least one non-finished (future) match
    const teamsWithFutureMatch = new Set<string>();
    for (const g of games) {
      if (!this.isFinished(g)) {
        if (g.home_team_name_en) teamsWithFutureMatch.add(g.home_team_name_en.trim());
        if (g.away_team_name_en) teamsWithFutureMatch.add(g.away_team_name_en.trim());
      }
    }

    for (const g of games) {
      // Skip: already have penalty winner, not finished, not a knockout draw
      if (
        (g as any)._penaltyWinner ||
        !this.isFinished(g) ||
        !knockoutTypes.has((g.type || '').toUpperCase()) ||
        g.home_score == null ||
        g.away_score == null ||
        Number(g.home_score) !== Number(g.away_score)
      ) {
        continue;
      }

      const homeAdv = !!(g.home_team_name_en && teamsWithFutureMatch.has(g.home_team_name_en.trim()));
      const awayAdv = !!(g.away_team_name_en && teamsWithFutureMatch.has(g.away_team_name_en.trim()));

      // Only infer when exactly one team advanced (eliminates SF ambiguity)
      if (homeAdv && !awayAdv) {
        (g as any)._penaltyWinner = 'home';
        this.logger.log(
          `Bracket inference: ${g.home_team_name_en} won on penalties vs ${g.away_team_name_en}`,
        );
      } else if (awayAdv && !homeAdv) {
        (g as any)._penaltyWinner = 'away';
        this.logger.log(
          `Bracket inference: ${g.away_team_name_en} won on penalties vs ${g.home_team_name_en}`,
        );
      }
    }
  }

  async fetchMatches(): Promise<Partial<Match>[]> {
    this.logger.log('Fetching all matches from worldcup26.ir + ESPN');

    const [games, teamsMap, stadiumsMap] = await Promise.all([
      this.fetchAllGames(),
      this.fetchTeamsMap(),
      this.fetchStadiumsMap(),
    ]);

    this.logger.log(`worldcup26.ir returned ${games.length} games`);

    // Enrich with live ESPN scores
    await this.mergeEspnScores(games);

    // Fallback: infer penalty winner from the bracket when ESPN data is missing
    this.inferPenaltyWinnersFromBracket(games);

    return games.map((g) => this.mapGameToMatch(g, teamsMap, stadiumsMap));
  }

  async fetchMatchById(externalId: string): Promise<Partial<Match> | null> {
    // worldcup26.ir has no per-match endpoint → fetch all and filter
    // externalId format: "wc26-{id}"
    const wc26Id = externalId.replace(/^wc26-/, '');
    try {
      const matches = await this.fetchMatches();
      return matches.find((m) => m.externalId === externalId || m.externalId === `wc26-${wc26Id}`) ?? null;
    } catch (err) {
      this.logger.error(`fetchMatchById(${externalId}) failed: ${err.message}`);
      return null;
    }
  }

  // ── Mapper ────────────────────────────────────────────────────────────────

  private mapGameToMatch(
    g: Wc26Game & { _live?: boolean; _penaltyWinner?: 'home' | 'away' },
    teamsMap: Map<string, Wc26Team>,
    stadiumsMap: Map<string, Wc26Stadium>,
  ): Partial<Match> {
    const stage = this.mapStage(g.type, g.group);
    const isGroupStage = stage === MatchStage.GROUP_STAGE;
    const groupLabel = isGroupStage ? (g.group as any) : undefined;
    const round = g.matchday != null ? Number(g.matchday) : undefined;
    const roundLabel = this.buildRoundLabel(stage, groupLabel, round);

    // Resolve team flags
    const homeTeam = teamsMap.get(String(g.home_team_id));
    const awayTeam = teamsMap.get(String(g.away_team_id));
    const homeTeamLogo = homeTeam?.flag ?? undefined;
    const awayTeamLogo = awayTeam?.flag ?? undefined;

    // Kickoff UTC time
    const stadium = stadiumsMap.get(String(g.stadium_id));
    const kickoffAt = g.local_date
      ? this.localDateToUtc(g.local_date, stadium)
      : new Date();

    // Scores
    const finished = this.isFinished(g);
    const officialHomeScore = finished && g.home_score != null ? g.home_score : null;
    const officialAwayScore = finished && g.away_score != null ? g.away_score : null;

    // Status
    let status: MatchStatus;
    if (finished) {
      status = MatchStatus.FINISHED;
    } else if (g._live) {
      status = MatchStatus.LIVE;
    } else {
      const now = Date.now();
      const kickoffMs = kickoffAt.getTime();
      // If kickoff passed by more than 90 min and no score, treat as live
      status = kickoffMs < now - 90 * 60_000 ? MatchStatus.LIVE : MatchStatus.SCHEDULED;
    }

    // Winner (regulation-time result only — DRAW stays DRAW even after penalties)
    let winner: MatchWinner | null = null;
    let penaltyWinner: MatchWinner | null = null;
    if (finished && officialHomeScore !== null && officialAwayScore !== null) {
      if (officialHomeScore > officialAwayScore) winner = MatchWinner.HOME;
      else if (officialAwayScore > officialHomeScore) winner = MatchWinner.AWAY;
      else {
        winner = MatchWinner.DRAW;
        if (g._penaltyWinner === 'home') penaltyWinner = MatchWinner.HOME;
        else if (g._penaltyWinner === 'away') penaltyWinner = MatchWinner.AWAY;
      }
    }

    return {
      externalId:        `wc26-${g.id}`,
      competition:       'FIFA World Cup 2026',
      stage,
      group:             groupLabel,
      round,
      roundLabel,
      homeTeam:          g.home_team_name_en?.trim() || `Time ${g.home_team_id}`,
      homeTeamLogo,
      awayTeam:          g.away_team_name_en?.trim() || `Time ${g.away_team_id}`,
      awayTeamLogo,
      kickoffAt,
      status,
      officialHomeScore,
      officialAwayScore,
      winner,
      ...(penaltyWinner !== null ? { penaltyWinner } : {}),
      syncedAt:          new Date(),
    };
  }
}

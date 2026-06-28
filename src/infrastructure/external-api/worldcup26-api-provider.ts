import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

const BASE_URL = 'https://worldcup26.ir';

export interface WorldCup26Game {
  homeTeam: string | undefined;
  awayTeam: string | undefined;
  /** local_date string as returned by the API: "MM/DD/YYYY HH:mm" */
  localDate: string;
}

/**
 * Adapter for the https://worldcup26.ir unofficial API.
 *
 * Used as a fallback to resolve R32 (round of 32) team names when
 * football-data.org has not yet published them.
 *
 * Matching strategy: worldcup26.ir stores local stadium times for each
 * match, so there is no single UTC offset.  However, when both the DB
 * (sorted by kickoffAt ASC) and the worldcup26.ir response (sorted by
 * localDate ASC) are ordered chronologically they always produce the
 * same positional sequence.  Therefore matches are aligned 1-to-1 by
 * index after both lists are sorted.
 */
@Injectable()
export class WorldCup26ApiProvider {
  private readonly logger = new Logger(WorldCup26ApiProvider.name);

  /**
   * Returns all R32 games from worldcup26.ir sorted by local_date ASC.
   * Games with no team data (home_team_id === "0") still appear in the
   * list – with homeTeam / awayTeam set to undefined – so that index
   * alignment against the DB list is preserved.
   */
  async fetchR32GamesSorted(): Promise<WorldCup26Game[]> {
    this.logger.log('Fetching R32 games from worldcup26.ir');

    const response = await axios.get(`${BASE_URL}/get/games`, {
      timeout: 10000,
    });

    const allGames: any[] = response.data?.games ?? [];

    const r32 = allGames.filter((g: any) => g.group === 'R32');

    // Sort by local_date string: "MM/DD/YYYY HH:mm" → parse as Date for correct ordering
    r32.sort((a: any, b: any) => {
      return this._parseLocalDate(a.local_date) - this._parseLocalDate(b.local_date);
    });

    return r32.map((g: any) => ({
      homeTeam:  g.home_team_name_en?.trim() || undefined,
      awayTeam:  g.away_team_name_en?.trim() || undefined,
      localDate: g.local_date,
    }));
  }

  /**
   * Parses "MM/DD/YYYY HH:mm" into a numeric timestamp for sorting.
   * No timezone conversion needed — just lexicographic-style numeric sort.
   */
  private _parseLocalDate(localDate: string): number {
    if (!localDate) return 0;
    // "MM/DD/YYYY HH:mm"
    const [datePart, timePart] = localDate.split(' ');
    const [month, day, year] = (datePart ?? '').split('/');
    const [hour, minute] = (timePart ?? '00:00').split(':');
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    ).getTime();
  }
}

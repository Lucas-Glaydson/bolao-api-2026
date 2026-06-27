import { Match } from '../../domain/entities';

export interface IFootballApiProvider {
  fetchMatches(): Promise<Partial<Match>[]>;
  fetchMatchById(externalId: string): Promise<Partial<Match> | null>;
}

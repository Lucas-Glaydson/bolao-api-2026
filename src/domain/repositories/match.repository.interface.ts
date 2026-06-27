import { Match, MatchStage, MatchStatus, GroupLabel } from '../entities';

export interface IMatchRepository {
  create(data: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>): Promise<Match>;
  findById(id: string): Promise<Match | null>;
  findByExternalId(externalId: string): Promise<Match | null>;
  findAll(): Promise<Match[]>;
  findByStage(stage: MatchStage): Promise<Match[]>;
  findByStageAndGroup(stage: MatchStage, group: GroupLabel): Promise<Match[]>;
  findByStatus(status: MatchStatus): Promise<Match[]>;
  findUpcoming(limit?: number): Promise<Match[]>;
  update(id: string, data: Partial<Match>): Promise<Match | null>;
  upsertByExternalId(externalId: string, data: Partial<Match>): Promise<Match>;
  delete(id: string): Promise<boolean>;
}

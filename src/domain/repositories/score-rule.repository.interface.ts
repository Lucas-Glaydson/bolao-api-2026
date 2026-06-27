import { ScoreRule, MatchStage } from '../entities';

export interface IScoreRuleRepository {
  create(data: Omit<ScoreRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<ScoreRule>;
  findById(id: string): Promise<ScoreRule | null>;
  findByStage(stage: MatchStage): Promise<ScoreRule | null>;
  findAll(): Promise<ScoreRule[]>;
  findActive(): Promise<ScoreRule[]>;
  update(id: string, data: Partial<ScoreRule>): Promise<ScoreRule | null>;
  delete(id: string): Promise<boolean>;
}

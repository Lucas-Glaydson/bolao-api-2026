import { MatchStage } from './match.entity';

export interface ScoreRule {
  id: string;
  stage: MatchStage;
  basePoints: number;
  exactScoreBonus: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

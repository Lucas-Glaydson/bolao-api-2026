import { MatchStage } from './match.entity';

export interface StageControl {
  id: string;
  stage: MatchStage;
  isOpen: boolean;
  openedAt: Date | null;
  closedAt: Date | null;
  allowPredictions: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

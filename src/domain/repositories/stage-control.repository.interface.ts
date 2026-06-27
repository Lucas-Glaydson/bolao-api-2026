import { StageControl, MatchStage } from '../entities';

export interface IStageControlRepository {
  create(data: Omit<StageControl, 'id' | 'createdAt' | 'updatedAt'>): Promise<StageControl>;
  findById(id: string): Promise<StageControl | null>;
  findByStage(stage: MatchStage): Promise<StageControl | null>;
  findAll(): Promise<StageControl[]>;
  findOpen(): Promise<StageControl[]>;
  update(id: string, data: Partial<StageControl>): Promise<StageControl | null>;
  delete(id: string): Promise<boolean>;
}

import { Prediction } from '../entities';

export interface IPredictionRepository {
  create(data: Omit<Prediction, 'id' | 'createdAt' | 'updatedAt'>): Promise<Prediction>;
  findById(id: string): Promise<Prediction | null>;
  findByUserAndMatch(userId: string, matchId: string): Promise<Prediction | null>;
  findByUser(userId: string): Promise<Prediction[]>;
  findByMatch(matchId: string): Promise<Prediction[]>;
  findAll(): Promise<Prediction[]>;
  update(id: string, data: Partial<Prediction>): Promise<Prediction | null>;
  upsertByUserAndMatch(userId: string, matchId: string, data: Partial<Prediction>): Promise<Prediction>;
  delete(id: string): Promise<boolean>;
  findByMatchIds(matchIds: string[]): Promise<Prediction[]>;
}

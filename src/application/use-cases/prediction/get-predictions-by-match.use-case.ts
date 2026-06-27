import { Injectable } from '@nestjs/common';
import { PredictionRepository } from '../../../infrastructure/database/repositories';
import { Prediction } from '../../../domain/entities';

@Injectable()
export class GetPredictionsByMatchUseCase {
  constructor(private readonly predictionRepository: PredictionRepository) {}

  async execute(matchId: string): Promise<Prediction[]> {
    return this.predictionRepository.findByMatch(matchId);
  }
}

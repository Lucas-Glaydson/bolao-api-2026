import { Injectable } from '@nestjs/common';
import { PredictionRepository } from '../../../infrastructure/database/repositories';
import { Prediction } from '../../../domain/entities';

@Injectable()
export class GetMyPredictionsUseCase {
  constructor(private readonly predictionRepository: PredictionRepository) {}

  async execute(userId: string): Promise<Prediction[]> {
    return this.predictionRepository.findByUser(userId);
  }
}

import { Injectable } from '@nestjs/common';
import { PredictionRepository } from '../../../infrastructure/database/repositories';
import { Prediction } from '../../../domain/entities';

@Injectable()
export class GetAllPredictionsUseCase {
  constructor(private readonly predictionRepository: PredictionRepository) {}

  async execute(): Promise<Prediction[]> {
    return this.predictionRepository.findAll();
  }
}

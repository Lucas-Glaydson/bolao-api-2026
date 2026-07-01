import { Module } from '@nestjs/common';
import { PredictionsController } from '../presentation/controllers/predictions.controller';
import {
  UpsertPredictionUseCase,
  GetMyPredictionsUseCase,
  GetPredictionsByMatchUseCase,
  GetAllPredictionsUseCase,
} from '../application/use-cases/prediction';
import { RankingModule } from './ranking.module';

@Module({
  imports: [RankingModule],
  controllers: [PredictionsController],
  providers: [
    UpsertPredictionUseCase,
    GetMyPredictionsUseCase,
    GetPredictionsByMatchUseCase,
    GetAllPredictionsUseCase,
  ],
})
export class PredictionsModule {}

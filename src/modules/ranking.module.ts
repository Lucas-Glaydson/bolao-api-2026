import { Module } from '@nestjs/common';
import { RankingController } from '../presentation/controllers/ranking.controller';
import { StagesController } from '../presentation/controllers/stages.controller';
import {
  CalculatePointsUseCase,
  GetRankingUseCase,
  OpenStageUseCase,
  CloseStageUseCase,
  GetAllStagesUseCase,
} from '../application/use-cases/ranking';

@Module({
  controllers: [RankingController, StagesController],
  providers: [
    CalculatePointsUseCase,
    GetRankingUseCase,
    OpenStageUseCase,
    CloseStageUseCase,
    GetAllStagesUseCase,
  ],
  exports: [CalculatePointsUseCase],
})
export class RankingModule {}

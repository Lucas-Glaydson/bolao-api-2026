import { Module } from '@nestjs/common';
import { MatchesController } from '../presentation/controllers/matches.controller';
import {
  SyncMatchesUseCase,
  SmartSyncMatchesUseCase,
  GetAllMatchesUseCase,
  GetMatchByIdUseCase,
  GetMatchesByStageUseCase,
  GetUpcomingMatchesUseCase,
  CalculateGroupStandingsUseCase,
  GenerateKnockoutMatchesUseCase,
  AutoCalculatePointsUseCase,
  AutoFillMissingPredictionsUseCase,
} from '../application/use-cases/match';
import {
  FootballDataApiProvider,
  IFootballApiProvider,
} from '../infrastructure/external-api';
import { RankingModule } from './ranking.module';

@Module({
  imports: [RankingModule],
  controllers: [MatchesController],
  providers: [
    {
      provide: 'IFootballApiProvider',
      useClass: FootballDataApiProvider,
    },
    SyncMatchesUseCase,
    SmartSyncMatchesUseCase,
    GetAllMatchesUseCase,
    GetMatchByIdUseCase,
    GetMatchesByStageUseCase,
    GetUpcomingMatchesUseCase,
    CalculateGroupStandingsUseCase,
    GenerateKnockoutMatchesUseCase,
    AutoCalculatePointsUseCase,
    AutoFillMissingPredictionsUseCase,
  ],
  exports: [
    CalculateGroupStandingsUseCase,
    GenerateKnockoutMatchesUseCase,
  ],
})
export class MatchesModule {}

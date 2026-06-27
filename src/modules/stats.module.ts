import { Module } from '@nestjs/common';
import { StatsController } from '../presentation/controllers/stats.controller';
import { GetDashboardStatsUseCase } from '../application/use-cases/stats';

@Module({
  controllers: [StatsController],
  providers: [GetDashboardStatsUseCase],
})
export class StatsModule {}

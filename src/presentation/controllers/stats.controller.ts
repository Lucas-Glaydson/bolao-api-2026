import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { DashboardStatsDto } from '../dtos/stats';
import { GetDashboardStatsUseCase } from '../../application/use-cases/stats';

@ApiTags('stats')
@ApiBearerAuth('JWT-auth')
@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(
    private readonly getDashboardStatsUseCase: GetDashboardStatsUseCase,
  ) {}

  @Get('dashboard')
  async getDashboard(): Promise<DashboardStatsDto> {
    return this.getDashboardStatsUseCase.execute();
  }
}

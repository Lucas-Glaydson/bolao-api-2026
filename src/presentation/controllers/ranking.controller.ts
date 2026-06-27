import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '../../domain/entities';
import {
  RankingEntryDto,
  CalculatePointsResponseDto,
} from '../dtos/ranking';
import {
  CalculatePointsUseCase,
  GetRankingUseCase,
} from '../../application/use-cases/ranking';

@ApiTags('ranking')
@ApiBearerAuth('JWT-auth')
@Controller('ranking')
@UseGuards(JwtAuthGuard)
export class RankingController {
  constructor(
    private readonly calculatePointsUseCase: CalculatePointsUseCase,
    private readonly getRankingUseCase: GetRankingUseCase,
  ) {}

  @Post('recalculate')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async recalculate(): Promise<CalculatePointsResponseDto> {
    const result = await this.calculatePointsUseCase.execute();
    return {
      ...result,
      message: `Recalculated points for ${result.processed} predictions with ${result.errors} errors`,
    };
  }

  @Get()
  async getRanking(): Promise<RankingEntryDto[]> {
    const ranking = await this.getRankingUseCase.execute();
    
    // Add position to each entry
    return ranking.map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));
  }

  @Get('scoreboard')
  async getScoreboard(): Promise<{ ranking: RankingEntryDto[]; totalUsers: number }> {
    const ranking = await this.getRankingUseCase.execute();
    
    return {
      ranking: ranking.map((entry, index) => ({
        ...entry,
        position: index + 1,
      })),
      totalUsers: ranking.length,
    };
  }
}

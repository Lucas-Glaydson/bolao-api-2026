import { Controller, Get, Post, Patch, Param, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
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
import { ScoreRuleRepository } from '../../infrastructure/database/repositories';

class UpdateScoreRuleDto {
  @ApiPropertyOptional({ example: 1, description: 'Pontos base por acerto de resultado' })
  @IsOptional()
  @IsInt()
  @Min(0)
  basePoints?: number;

  @ApiPropertyOptional({ example: 2, description: 'Bônus por placar exato' })
  @IsOptional()
  @IsInt()
  @Min(0)
  exactScoreBonus?: number;

  @ApiPropertyOptional({ example: true, description: 'Se a regra está ativa' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

@ApiTags('ranking')
@ApiBearerAuth('JWT-auth')
@Controller('ranking')
@UseGuards(JwtAuthGuard)
export class RankingController {
  constructor(
    private readonly calculatePointsUseCase: CalculatePointsUseCase,
    private readonly getRankingUseCase: GetRankingUseCase,
    private readonly scoreRuleRepository: ScoreRuleRepository,
  ) {}

  @Post('recalculate')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Recalcular todos os pontos (Admin only)',
    description:
      'Força o recálculo de todos os palpites de todas as partidas finalizadas, ' +
      'corrigindo pontos calculados incorretamente por placar desatualizado.',
  })
  async recalculate(): Promise<CalculatePointsResponseDto> {
    // forceRecalculate=true ignores the "already calculated" skip — always overwrites
    const result = await this.calculatePointsUseCase.execute(true);
    return {
      ...result,
      message: `Recalculated points for ${result.processed} predictions with ${result.errors} errors`,
    };
  }

  @Get()
  async getRanking(): Promise<RankingEntryDto[]> {
    const ranking = await this.getRankingUseCase.execute();
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

  @Get('score-rules')
  @ApiOperation({ summary: 'Listar todas as regras de pontuação por fase' })
  async getScoreRules() {
    const rules = await this.scoreRuleRepository.findAll();
    return rules;
  }

  @Patch('score-rules/:id')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Atualizar regra de pontuação de uma fase (Admin only)' })
  @ApiBody({ type: UpdateScoreRuleDto })
  async updateScoreRule(
    @Param('id') id: string,
    @Body() dto: UpdateScoreRuleDto,
  ) {
    const updated = await this.scoreRuleRepository.update(id, {
      ...(dto.basePoints !== undefined && { basePoints: dto.basePoints }),
      ...(dto.exactScoreBonus !== undefined && { exactScoreBonus: dto.exactScoreBonus }),
      ...(dto.active !== undefined && { active: dto.active }),
    });
    if (!updated) throw new NotFoundException('Score rule not found');
    return updated;
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Post,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { IsInt, IsOptional, IsIn, IsBoolean, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UserRole } from '../../domain/entities';
import {
  CreatePredictionDto,
  PredictionResponseDto,
  PredictionWithUserDto,
} from '../dtos/prediction';
import {
  UpsertPredictionUseCase,
  GetMyPredictionsUseCase,
  GetPredictionsByMatchUseCase,
  GetAllPredictionsUseCase,
} from '../../application/use-cases/prediction';
import { CalculatePointsUseCase } from '../../application/use-cases/ranking';
import { PredictionRepository, UserRepository } from '../../infrastructure/database/repositories';

class AdminOverridePredictionDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional() @IsInt() @Min(0)
  predictedHomeScore?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional() @IsInt() @Min(0)
  predictedAwayScore?: number;

  @ApiPropertyOptional({ example: 'away', enum: ['home', 'away'] })
  @IsOptional() @IsIn(['home', 'away'])
  tiebreakWinner?: 'home' | 'away';

  @ApiPropertyOptional({ example: false, description: 'Resetar flag de auto-fill' })
  @IsOptional() @IsBoolean()
  isAutoFilled?: boolean;

  @ApiPropertyOptional({ example: null, description: 'Forçar pontuação manualmente (null = recalcular)' })
  @IsOptional() @IsInt() @Min(0)
  pointsAwarded?: number | null;
}

@ApiTags('predictions')
@ApiBearerAuth('JWT-auth')
@Controller('predictions')
@UseGuards(JwtAuthGuard)
export class PredictionsController {
  constructor(
    private readonly upsertPredictionUseCase: UpsertPredictionUseCase,
    private readonly getMyPredictionsUseCase: GetMyPredictionsUseCase,
    private readonly getPredictionsByMatchUseCase: GetPredictionsByMatchUseCase,
    private readonly getAllPredictionsUseCase: GetAllPredictionsUseCase,
    private readonly userRepository: UserRepository,
    private readonly predictionRepository: PredictionRepository,
    private readonly calculatePointsUseCase: CalculatePointsUseCase,
  ) {}

  @Put(':matchId')
  @ApiOperation({ summary: 'Criar ou atualizar palpite' })
  @ApiBody({ type: CreatePredictionDto })
  async upsert(
    @CurrentUser() user: any,
    @Param('matchId') matchId: string,
    @Body() dto: CreatePredictionDto,
  ): Promise<PredictionResponseDto> {
    const prediction = await this.upsertPredictionUseCase.execute(
      user.id,
      matchId,
      dto.predictedHomeScore,
      dto.predictedAwayScore,
      dto.tiebreakWinner,
    );

    return this.toResponseDto(prediction);
  }

  @Get('me')
  async getMyPredictions(@CurrentUser() user: any): Promise<PredictionResponseDto[]> {
    const predictions = await this.getMyPredictionsUseCase.execute(user.id);
    return predictions.map((p) => this.toResponseDto(p));
  }

  @Get('board')
  async getAllPredictions(): Promise<PredictionWithUserDto[]> {
    const [predictions, allUsers] = await Promise.all([
      this.getAllPredictionsUseCase.execute(),
      this.userRepository.findAll(),
    ]);

    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    return predictions.map((prediction) => {
      const user = userMap.get(prediction.userId);
      return {
        id: prediction.id,
        userId: prediction.userId,
        userName: user?.name || 'Unknown',
        userEmail: user?.email || 'Unknown',
        matchId: prediction.matchId,
        predictedHomeScore: prediction.predictedHomeScore,
        predictedAwayScore: prediction.predictedAwayScore,
        tiebreakWinner: prediction.tiebreakWinner,
        pointsAwarded: prediction.pointsAwarded,
        exactScoreHit: prediction.exactScoreHit,
        outcomeHit: prediction.outcomeHit,
        createdAt: prediction.createdAt,
      };
    });
  }

  @Get('match/:matchId')
  async getByMatch(@Param('matchId') matchId: string): Promise<PredictionWithUserDto[]> {
    const [predictions, allUsers] = await Promise.all([
      this.getPredictionsByMatchUseCase.execute(matchId),
      this.userRepository.findAll(),
    ]);

    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    return predictions.map((prediction) => {
      const user = userMap.get(prediction.userId);
      return {
        id: prediction.id,
        userId: prediction.userId,
        userName: user?.name || 'Unknown',
        userEmail: user?.email || 'Unknown',
        matchId: prediction.matchId,
        predictedHomeScore: prediction.predictedHomeScore,
        predictedAwayScore: prediction.predictedAwayScore,
        tiebreakWinner: prediction.tiebreakWinner,
        pointsAwarded: prediction.pointsAwarded,
        exactScoreHit: prediction.exactScoreHit,
        outcomeHit: prediction.outcomeHit,
        createdAt: prediction.createdAt,
      };
    });
  }

  /**
   * Admin: override/correct any user's prediction for any match.
   * Sets isAutoFilled=false by default, then recalculates points for that match.
   *
   * PATCH /predictions/admin/:userId/:matchId
   */
  @Patch('admin/:userId/:matchId')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Sobrescrever palpite de qualquer usuário (Admin only)',
    description:
      'Permite corrigir palpites auto-preenchidos ou errados. ' +
      'Reseta isAutoFilled=false por padrão e recalcula os pontos da partida.',
  })
  @ApiBody({ type: AdminOverridePredictionDto })
  async adminOverridePrediction(
    @Param('userId') userId: string,
    @Param('matchId') matchId: string,
    @Body() dto: AdminOverridePredictionDto,
  ): Promise<PredictionResponseDto> {
    const existing = await this.predictionRepository.findByUserAndMatch(userId, matchId);
    if (!existing) {
      throw new Error(`No prediction found for user ${userId} on match ${matchId}`);
    }

    const updated = await this.predictionRepository.update(existing.id, {
      ...(dto.predictedHomeScore !== undefined && { predictedHomeScore: dto.predictedHomeScore }),
      ...(dto.predictedAwayScore !== undefined && { predictedAwayScore: dto.predictedAwayScore }),
      ...(dto.tiebreakWinner !== undefined && { tiebreakWinner: dto.tiebreakWinner }),
      // Default: clear the auto-fill flag unless caller explicitly sets it
      isAutoFilled: dto.isAutoFilled ?? false,
      // Reset points so they get recalculated
      pointsAwarded: dto.pointsAwarded !== undefined ? dto.pointsAwarded : null,
      exactScoreHit: false,
      outcomeHit: false,
    });

    if (!updated) throw new Error('Prediction update failed');

    // Recalculate points for this match immediately
    try {
      await this.calculatePointsUseCase.executeForMatch(matchId);
    } catch {
      // non-fatal, can be triggered manually via /ranking/recalculate
    }

    return this.toResponseDto(updated);
  }

  /**
   * Admin: reset isAutoFilled flag for all predictions of a match,
   * then recalculate points. Useful to mass-fix a match where auto-fill
   * accidentally overwrote manual predictions.
   *
   * POST /predictions/admin/fix-autofill/:matchId
   */
  @Post('admin/fix-autofill/:matchId')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Corrigir flag isAutoFilled de uma partida inteira (Admin only)',
    description:
      'Reseta isAutoFilled=false em TODOS os palpites com score > 0×0 de uma partida, ' +
      'depois recalcula os pontos. Corrige casos onde o auto-fill sobrescreveu palpites manuais.',
  })
  async fixAutoFillForMatch(
    @Param('matchId') matchId: string,
  ): Promise<{ fixed: number; message: string }> {
    const predictions = await this.predictionRepository.findByMatch(matchId);

    let fixed = 0;
    for (const p of predictions) {
      // A prediction with a non-zero score that's marked as auto-fill is suspicious
      const hasRealScore = p.predictedHomeScore !== 0 || p.predictedAwayScore !== 0;
      if (p.isAutoFilled && hasRealScore) {
        await this.predictionRepository.update(p.id, {
          isAutoFilled: false,
          pointsAwarded: null,
          exactScoreHit: false,
          outcomeHit: false,
        });
        fixed++;
      }
    }

    // Recalculate all predictions for this match with force
    await this.calculatePointsUseCase.executeForMatch(matchId);

    return {
      fixed,
      message: `Cleared isAutoFilled on ${fixed} predictions and recalculated points for match ${matchId}`,
    };
  }

  private toResponseDto(prediction: any): PredictionResponseDto {
    return {
      id: prediction.id,
      userId: prediction.userId,
      matchId: prediction.matchId,
      predictedHomeScore: prediction.predictedHomeScore,
      predictedAwayScore: prediction.predictedAwayScore,
      tiebreakWinner: prediction.tiebreakWinner,
      lockedAt: prediction.lockedAt,
      canEditUntil: prediction.canEditUntil,
      pointsAwarded: prediction.pointsAwarded,
      exactScoreHit: prediction.exactScoreHit,
      outcomeHit: prediction.outcomeHit,
      createdAt: prediction.createdAt,
      updatedAt: prediction.updatedAt,
    };
  }
}

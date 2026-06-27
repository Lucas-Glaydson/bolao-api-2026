import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
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
import { UserRepository } from '../../infrastructure/database/repositories';

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
    const predictions = await this.getAllPredictionsUseCase.execute();
    
    // Fetch user data for each prediction
    const enrichedPredictions = await Promise.all(
      predictions.map(async (prediction) => {
        const user = await this.userRepository.findById(prediction.userId);
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
      }),
    );

    return enrichedPredictions;
  }

  @Get('match/:matchId')
  async getByMatch(@Param('matchId') matchId: string): Promise<PredictionWithUserDto[]> {
    const predictions = await this.getPredictionsByMatchUseCase.execute(matchId);
    
    // Fetch user data for each prediction
    const enrichedPredictions = await Promise.all(
      predictions.map(async (prediction) => {
        const user = await this.userRepository.findById(prediction.userId);
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
      }),
    );

    return enrichedPredictions;
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

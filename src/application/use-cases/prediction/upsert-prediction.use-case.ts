import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  PredictionRepository,
  MatchRepository,
  StageControlRepository,
} from '../../../infrastructure/database/repositories';
import { Prediction } from '../../../domain/entities';

@Injectable()
export class UpsertPredictionUseCase {
  constructor(
    private readonly predictionRepository: PredictionRepository,
    private readonly matchRepository: MatchRepository,
    private readonly stageControlRepository: StageControlRepository,
  ) {}

  async execute(
    userId: string,
    matchId: string,
    predictedHomeScore: number,
    predictedAwayScore: number,
    tiebreakWinner?: 'home' | 'away',
  ): Promise<Prediction> {
    // Get match
    const match = await this.matchRepository.findById(matchId);
    if (!match) {
      throw new NotFoundException('Match not found');
    }

    // Check if stage is open for predictions
    const stageControl = await this.stageControlRepository.findByStage(match.stage);
    if (!stageControl || !stageControl.isOpen || !stageControl.allowPredictions) {
      throw new BadRequestException(
        'This stage is not open for predictions yet',
      );
    }

    // Check if match is still open for predictions (1 hour before kickoff)
    const now = new Date();
    const oneHourBeforeKickoff = new Date(
      match.kickoffAt.getTime() - 60 * 60 * 1000,
    );

    if (now >= oneHourBeforeKickoff) {
      throw new BadRequestException(
        'Predictions are closed for this match. Must be made at least 1 hour before kickoff.',
      );
    }

    // Calculate when the prediction can be edited until
    const canEditUntil = oneHourBeforeKickoff;

    // Upsert prediction
    const prediction = await this.predictionRepository.upsertByUserAndMatch(
      userId,
      matchId,
      {
        predictedHomeScore,
        predictedAwayScore,
        tiebreakWinner: tiebreakWinner ?? null,
        canEditUntil,
        lockedAt: null,
        pointsAwarded: null,
        exactScoreHit: false,
        outcomeHit: false,
      },
    );

    return prediction;
  }
}

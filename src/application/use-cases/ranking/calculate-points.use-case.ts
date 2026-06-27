import { Injectable, Logger } from '@nestjs/common';
import {
  MatchRepository,
  PredictionRepository,
  ScoreRuleRepository,
} from '../../../infrastructure/database/repositories';
import { MatchStatus, MatchWinner } from '../../../domain/entities';

@Injectable()
export class CalculatePointsUseCase {
  private readonly logger = new Logger(CalculatePointsUseCase.name);

  constructor(
    private readonly matchRepository: MatchRepository,
    private readonly predictionRepository: PredictionRepository,
    private readonly scoreRuleRepository: ScoreRuleRepository,
  ) {}

  async execute(): Promise<{ processed: number; errors: number }> {
    this.logger.log('Starting points calculation');

    try {
      // Get all finished matches
      const finishedMatches = await this.matchRepository.findByStatus(
        MatchStatus.FINISHED,
      );

      let processed = 0;
      let errors = 0;

      for (const match of finishedMatches) {
        try {
          // Get score rule for this stage
          const scoreRule = await this.scoreRuleRepository.findByStage(
            match.stage,
          );
          if (!scoreRule || !scoreRule.active) {
            this.logger.warn(`No active score rule for stage ${match.stage}`);
            continue;
          }

          // Get all predictions for this match
          const predictions = await this.predictionRepository.findByMatch(
            match.id,
          );

          for (const prediction of predictions) {
            // Skip if already calculated
            if (prediction.pointsAwarded !== null) {
              continue;
            }

            // Skip if match has no official scores
            if (match.officialHomeScore === null || match.officialAwayScore === null) {
              continue;
            }

            // Calculate points
            const result = this.calculatePredictionPoints(
              prediction.predictedHomeScore,
              prediction.predictedAwayScore,
              match.officialHomeScore,
              match.officialAwayScore,
              scoreRule.basePoints,
              scoreRule.exactScoreBonus,
              prediction.tiebreakWinner,
              match.winner,
            );

            // Update prediction with points
            await this.predictionRepository.update(prediction.id, {
              pointsAwarded: result.points,
              exactScoreHit: result.exactScore,
              outcomeHit: result.outcomeHit,
              lockedAt: new Date(),
            });

            processed++;
          }
        } catch (error) {
          this.logger.error(
            `Error processing match ${match.id}`,
            error.message,
          );
          errors++;
        }
      }

      this.logger.log(
        `Points calculation completed: ${processed} processed, ${errors} errors`,
      );

      return { processed, errors };
    } catch (error) {
      this.logger.error('Error in points calculation', error.message);
      throw error;
    }
  }

  private calculatePredictionPoints(
    predictedHome: number,
    predictedAway: number,
    actualHome: number,
    actualAway: number,
    basePoints: number,
    exactBonus: number,
    tiebreakWinner: 'home' | 'away' | null,
    matchWinner: MatchWinner | null,
  ): { points: number; exactScore: boolean; outcomeHit: boolean } {
    // Exact score
    if (predictedHome === actualHome && predictedAway === actualAway) {
      // For draws with exact score, also require correct tiebreakWinner if match has a winner
      const isDraw = predictedHome === predictedAway;
      if (isDraw && matchWinner && matchWinner !== MatchWinner.DRAW) {
        const tiebreakCorrect = tiebreakWinner === matchWinner;
        return {
          points: tiebreakCorrect ? basePoints + exactBonus : 0,
          exactScore: tiebreakCorrect,
          outcomeHit: tiebreakCorrect,
        };
      }
      return {
        points: basePoints + exactBonus,
        exactScore: true,
        outcomeHit: true,
      };
    }

    // Check outcome
    const predictedWinner = this.determineWinner(predictedHome, predictedAway);
    const actualWinner = this.determineWinner(actualHome, actualAway);

    if (predictedWinner === actualWinner) {
      // For draws, require tiebreakWinner to match match.winner
      if (predictedWinner === MatchWinner.DRAW && matchWinner && matchWinner !== MatchWinner.DRAW) {
        const tiebreakCorrect = tiebreakWinner === matchWinner;
        return {
          points: tiebreakCorrect ? basePoints : 0,
          exactScore: false,
          outcomeHit: tiebreakCorrect,
        };
      }
      return {
        points: basePoints,
        exactScore: false,
        outcomeHit: true,
      };
    }

    return {
      points: 0,
      exactScore: false,
      outcomeHit: false,
    };
  }

  private determineWinner(
    homeScore: number,
    awayScore: number,
  ): MatchWinner {
    if (homeScore > awayScore) return MatchWinner.HOME;
    if (awayScore > homeScore) return MatchWinner.AWAY;
    return MatchWinner.DRAW;
  }
}

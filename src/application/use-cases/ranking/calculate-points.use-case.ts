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

          // A penalty match is one that has an explicit penaltyWinner set.
          // We always recalculate predictions for these matches because the
          // penalty winner may have been synced after the initial calculation.
          const isPenaltyMatch = match.penaltyWinner !== null;

          for (const prediction of predictions) {
            // Skip if already calculated, unless it's a penalty match
            // (penalty winner may have been set after the first run)
            if (prediction.pointsAwarded !== null && !isPenaltyMatch) {
              continue;
            }

            // Skip if match has no official scores
            if (match.officialHomeScore === null || match.officialAwayScore === null) {
              continue;
            }

            // Auto-filled predictions always receive 0 pts
            if (prediction.isAutoFilled) {
              await this.predictionRepository.update(prediction.id, {
                pointsAwarded: 0,
                exactScoreHit: false,
                outcomeHit: false,
              });
              processed++;
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
              match.penaltyWinner,
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
    penaltyWinner: MatchWinner | null,
  ): { points: number; exactScore: boolean; outcomeHit: boolean } {
    // ── Exact score ───────────────────────────────────────────────────────────
    if (predictedHome === actualHome && predictedAway === actualAway) {
      // Exact draw + correct penalty winner → +1 tiebreak bonus
      if (penaltyWinner !== null && tiebreakWinner === penaltyWinner) {
        return {
          points: basePoints + exactBonus + 1,
          exactScore: true,
          outcomeHit: true,
        };
      }

      // Exact score in every other case (including wrong/missing tiebreak) → 2 pts
      return {
        points: basePoints + exactBonus,
        exactScore: true,
        outcomeHit: true,
      };
    }

    // ── Correct outcome (winner or draw) ─────────────────────────────────────
    const predictedWinner = this.determineWinner(predictedHome, predictedAway);
    const actualWinner = this.determineWinner(actualHome, actualAway);

    if (predictedWinner === actualWinner) {
      // Predicted draw + match went to penalties + correct penalty winner → 2 pts
      const predictedDraw = predictedHome === predictedAway;
      if (penaltyWinner !== null && predictedDraw && tiebreakWinner === penaltyWinner) {
        return { points: basePoints + 1, exactScore: false, outcomeHit: true };
      }

      // Correct outcome only → basePoints (1 pt)
      return { points: basePoints, exactScore: false, outcomeHit: true };
    }

    return { points: 0, exactScore: false, outcomeHit: false };
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

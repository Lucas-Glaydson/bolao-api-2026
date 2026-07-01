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

  /**
   * Calculates points for all finished matches.
   * @param forceRecalculate When true, recalculates even if pointsAwarded is already set.
   *   Use this for admin-triggered recalculations or after score corrections.
   */
  async execute(forceRecalculate = false): Promise<{ processed: number; errors: number }> {
    this.logger.log(`Starting points calculation${forceRecalculate ? ' (FORCED)' : ''}`);

    try {
      // Get all finished matches
      const finishedMatches = await this.matchRepository.findByStatus(
        MatchStatus.FINISHED,
      );

      let processed = 0;
      let errors = 0;

      for (const match of finishedMatches) {
        try {
          const result = await this._calculateForMatch(match, forceRecalculate);
          processed += result.processed;
          errors += result.errors;
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

  /**
   * Recalculates points for a single match. Always forces recalculation
   * (ignores existing pointsAwarded). Used after manual score updates.
   */
  async executeForMatch(matchId: string): Promise<{ processed: number; errors: number }> {
    const match = await this.matchRepository.findById(matchId);
    if (!match) {
      this.logger.warn(`executeForMatch: match ${matchId} not found`);
      return { processed: 0, errors: 0 };
    }
    if (match.officialHomeScore === null || match.officialAwayScore === null) {
      this.logger.warn(`executeForMatch: match ${matchId} has no official scores`);
      return { processed: 0, errors: 0 };
    }
    return this._calculateForMatch(match, true);
  }

  private async _calculateForMatch(
    match: import('../../../domain/entities').Match,
    forceRecalculate: boolean,
  ): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      // Get score rule for this stage
      const scoreRule = await this.scoreRuleRepository.findByStage(
        match.stage,
      );
      if (!scoreRule || !scoreRule.active) {
        this.logger.warn(`No active score rule for stage ${match.stage}`);
        return { processed, errors };
      }

      // Get all predictions for this match
      const predictions = await this.predictionRepository.findByMatch(
        match.id,
      );

      // A penalty match is one that has an explicit penaltyWinner set.
      const isPenaltyMatch = match.penaltyWinner !== null;

      for (const prediction of predictions) {
        // Skip if already calculated, unless:
        //  - forcing recalculation (admin action / score correction), OR
        //  - it's a penalty match (penalty winner may have arrived later)
        if (prediction.pointsAwarded !== null && !isPenaltyMatch && !forceRecalculate) {
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

        this.logger.debug(
          `Match ${match.homeTeam} ${match.officialHomeScore}-${match.officialAwayScore} ${match.awayTeam}` +
          ` | predicted ${prediction.predictedHomeScore}-${prediction.predictedAwayScore}` +
          ` | points: ${result.points} (exact: ${result.exactScore}, outcome: ${result.outcomeHit})`,
        );

        // Update prediction with points
        await this.predictionRepository.update(prediction.id, {
          pointsAwarded: result.points,
          exactScoreHit: result.exactScore,
          outcomeHit: result.outcomeHit,
          lockedAt: prediction.lockedAt ?? new Date(),
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

    return { processed, errors };
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

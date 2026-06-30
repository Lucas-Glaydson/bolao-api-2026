import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MatchRepository, PredictionRepository } from '@infrastructure/database/repositories';
import { MatchStatus } from '@domain/entities';
import { CalculatePointsUseCase } from '../ranking/calculate-points.use-case';

/**
 * Automatically calculates points for predictions when matches finish
 * Runs every 5 minutes to check for newly finished matches
 */
@Injectable()
export class AutoCalculatePointsUseCase {
  private readonly logger = new Logger(AutoCalculatePointsUseCase.name);
  private processedMatches = new Set<string>();

  constructor(
    private readonly matchRepository: MatchRepository,
    private readonly predictionRepository: PredictionRepository,
    private readonly calculatePointsUseCase: CalculatePointsUseCase,
  ) {}

  async execute(): Promise<{ processed: number; errors: number }> {
    this.logger.log('Checking for finished matches to calculate points');

    try {
      // Find all finished matches
      const finishedMatches = await this.matchRepository.findByStatus(
        MatchStatus.FINISHED,
      );

      let processed = 0;
      let errors = 0;

      for (const match of finishedMatches) {
        const matchId = match.id;

        // Cache key includes penaltyWinner so that when the sync sets
        // penaltyWinner on a previously-processed match, this loop detects
        // the state change and triggers recalculation automatically.
        const cacheKey = `${matchId}:${match.penaltyWinner ?? 'null'}`;

        if (this.processedMatches.has(cacheKey)) {
          continue;
        }

        try {
          // Get all predictions for this match
          const predictions = await this.predictionRepository.findByMatch(
            matchId,
          );

          if (predictions.length === 0) {
            this.logger.debug(`No predictions for match ${matchId}`);
            this.processedMatches.add(cacheKey);
            continue;
          }

          const isPenaltyMatch = match.penaltyWinner !== null;

          // Recalculate when:
          // 1. Any prediction is still uncalculated (pointsAwarded === null), OR
          // 2. It's a penalty match — penaltyWinner may have just been synced
          //    and the tiebreak bonus needs to be (re)applied.
          const needsCalculation =
            isPenaltyMatch ||
            predictions.some((p) => p.pointsAwarded === null);

          if (!needsCalculation) {
            this.logger.debug(
              `All predictions already calculated for match ${matchId}`,
            );
            this.processedMatches.add(cacheKey);
            continue;
          }

          processed++;
          this.processedMatches.add(cacheKey);

          this.logger.log(
            `✅ Marked match for points calculation: ${match.homeTeam} vs ${match.awayTeam}` +
            `${isPenaltyMatch ? ` (penalty: ${match.penaltyWinner})` : ''} (${predictions.length} predictions)`,
          );
        } catch (error) {
          this.logger.error(
            `Error checking match ${matchId}`,
            (error as Error).message,
          );
          errors++;
        }
      }

      // If there are matches to process, trigger the main calculation
      if (processed > 0) {
        this.logger.log(`🔄 Triggering points calculation for ${processed} matches`);
        try {
          const result = await this.calculatePointsUseCase.execute();
          this.logger.log(
            `📊 Points calculation complete: ${result.processed} predictions processed`,
          );
        } catch (error) {
          this.logger.error('Error in points calculation', (error as Error).message);
        }
      }

      if (processed > 0) {
        this.logger.log(
          `📊 Auto-calculation complete: ${processed} matches checked, ${errors} errors`,
        );
      }

      return { processed, errors };
    } catch (error) {
      this.logger.error('Error in auto calculate points', (error as Error).message);
      throw error;
    }
  }

  /**
   * Clear the processed matches cache periodically to allow recalculation
   * if there are score corrections
   */
  resetCache() {
    this.logger.log('Resetting processed matches cache');
    this.processedMatches.clear();
  }

  /**
   * Cron job: Check for finished matches every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    this.logger.debug('Cron job: Auto-calculating points for finished matches');
    await this.execute();
  }

  /**
   * Reset cache daily at midnight to allow recalculations
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  handleCacheClearCron() {
    this.resetCache();
  }
}

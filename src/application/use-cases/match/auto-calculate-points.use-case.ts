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

        // Cache key includes scores and penaltyWinner so that score corrections
        // or late penalty-winner syncs are detected and trigger recalculation.
        const cacheKey = `${matchId}:${match.officialHomeScore ?? '?'}:${match.officialAwayScore ?? '?'}:${match.penaltyWinner ?? 'null'}`;

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

          // If the cache key is new (scores or penaltyWinner changed, or match just finished),
          // always recalculate — this corrects previously wrong points from stale scores.
          const needsCalculation =
            isPenaltyMatch ||
            predictions.some((p) => p.pointsAwarded === null) ||
            predictions.length > 0; // new cacheKey → always recalculate

          if (!needsCalculation) {
            this.logger.debug(
              `No predictions for match ${matchId}, skipping`,
            );
            this.processedMatches.add(cacheKey);
            continue;
          }

          this.processedMatches.add(cacheKey);
          processed++;

          this.logger.log(
            `✅ Recalculating points: ${match.homeTeam} ${match.officialHomeScore ?? '?'}-${match.officialAwayScore ?? '?'} ${match.awayTeam}` +
            `${isPenaltyMatch ? ` (penalty: ${match.penaltyWinner})` : ''} (${predictions.length} predictions)`,
          );

          // Recalculate this specific match with force=true to correct any stale points
          try {
            const matchResult = await this.calculatePointsUseCase.executeForMatch(matchId);
            this.logger.debug(`Match ${matchId}: ${matchResult.processed} predictions updated`);
          } catch (error) {
            this.logger.error(`Error calculating points for match ${matchId}`, (error as Error).message);
            errors++;
          }
        } catch (error) {
          this.logger.error(
            `Error checking match ${matchId}`,
            (error as Error).message,
          );
          errors++;
        }
      }

      if (processed > 0) {
        this.logger.log(`� Auto-calculation complete: ${processed} matches recalculated, ${errors} errors`);
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

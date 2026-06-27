import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  MatchRepository,
  PredictionRepository,
  UserRepository,
} from '@infrastructure/database/repositories';
import { MatchStatus } from '@domain/entities';

/**
 * Automatically creates a locked 0x0 prediction for every active user
 * who did not submit a prediction before the 1-hour cutoff.
 *
 * Runs every minute to catch matches as soon as their window closes.
 */
@Injectable()
export class AutoFillMissingPredictionsUseCase {
  private readonly logger = new Logger(AutoFillMissingPredictionsUseCase.name);

  /** Tracks matches already filled so we don't re-query on every tick */
  private readonly filledMatches = new Set<string>();

  constructor(
    private readonly matchRepository: MatchRepository,
    private readonly predictionRepository: PredictionRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(): Promise<{ filled: number; errors: number }> {
    const now = new Date();
    let filled = 0;
    let errors = 0;

    try {
      // Find all scheduled matches whose prediction window has just closed:
      // kickoffAt - 1h <= now  (lock time reached or passed)
      // and kickoffAt + 2h > now  (give a 2-hour buffer after kickoff to still catch stragglers)
      const scheduledMatches = await this.matchRepository.findByStatus(MatchStatus.SCHEDULED);

      const lockedMatches = scheduledMatches.filter((m) => {
        const lockTime = new Date(m.kickoffAt.getTime() - 60 * 60 * 1000);
        const cutoff = new Date(m.kickoffAt.getTime() + 2 * 60 * 60 * 1000);
        return now >= lockTime && now < cutoff;
      });

      if (lockedMatches.length === 0) return { filled, errors };

      // Fetch all active users once
      const allUsers = await this.userRepository.findAll();
      const activeUsers = allUsers.filter((u) => u.isActive);

      if (activeUsers.length === 0) return { filled, errors };

      for (const match of lockedMatches) {
        if (this.filledMatches.has(match.id)) continue;

        try {
          // Get existing predictions for this match
          const existing = await this.predictionRepository.findByMatch(match.id);
          const usersWithPrediction = new Set(existing.map((p) => p.userId));

          const canEditUntil = new Date(match.kickoffAt.getTime() - 60 * 60 * 1000);

          let matchFilled = 0;
          for (const user of activeUsers) {
            if (usersWithPrediction.has(user.id)) continue;

            try {
              await this.predictionRepository.upsertByUserAndMatch(user.id, match.id, {
                predictedHomeScore: 0,
                predictedAwayScore: 0,
                tiebreakWinner: null,
                canEditUntil,
                lockedAt: now,
                pointsAwarded: null,
                exactScoreHit: false,
                outcomeHit: false,
              });
              matchFilled++;
              filled++;
            } catch (err) {
              this.logger.error(
                `Failed to auto-fill prediction for user ${user.id} on match ${match.id}`,
                err.message,
              );
              errors++;
            }
          }

          if (matchFilled > 0) {
            this.logger.log(
              `✅ Auto-filled ${matchFilled} missing predictions for ${match.homeTeam} vs ${match.awayTeam}`,
            );
          }

          this.filledMatches.add(match.id);
        } catch (err) {
          this.logger.error(`Error processing match ${match.id}`, err.message);
          errors++;
        }
      }
    } catch (err) {
      this.logger.error('Error in AutoFillMissingPredictionsUseCase', err.message);
      throw err;
    }

    return { filled, errors };
  }

  /**
   * Cron job: runs every minute to catch matches as soon as their window closes.
   */
  @Cron('* * * * *')
  async handleCron() {
    await this.execute();
  }
}

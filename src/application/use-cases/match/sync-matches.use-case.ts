import { Injectable, Logger, Inject, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MatchRepository } from '@infrastructure/database/repositories';
import type { IFootballApiProvider } from '@infrastructure/external-api';
import { MatchStage } from '@domain/entities';
import { GenerateKnockoutMatchesUseCase } from './generate-knockout-matches.use-case';
import { AutoCalculatePointsUseCase } from './auto-calculate-points.use-case';

@Injectable()
export class SyncMatchesUseCase implements OnApplicationBootstrap {
  private readonly logger = new Logger(SyncMatchesUseCase.name);

  constructor(
    private readonly matchRepository: MatchRepository,
    @Inject('IFootballApiProvider')
    private readonly footballApiProvider: IFootballApiProvider,
    private readonly generateKnockoutUseCase: GenerateKnockoutMatchesUseCase,
    private readonly autoCalculatePointsUseCase: AutoCalculatePointsUseCase,
  ) {}

  /**
   * Runs once when the application starts.
   * Performs a full API sync so that real fixture data always replaces
   * any locally-seeded placeholder matches (wc26-*) from day one.
   */
  async onApplicationBootstrap(): Promise<void> {
    const apiKey = this.footballApiProvider['apiKey'] as string | undefined;
    if (!apiKey) {
      this.logger.warn('Startup sync skipped — EXTERNAL_FOOTBALL_API_KEY not configured');
      return;
    }
    this.logger.log('🚀 Startup sync: fetching latest fixture data from external API...');
    try {
      await this.execute();
    } catch (err) {
      this.logger.error(`Startup sync failed: ${err.message}`);
    }
  }

  /**
   * Daily sync at 06:00 UTC — refreshes all fixtures once per day.
   * Costs 1 API request/day regardless of how many matches there are.
   */
  @Cron('0 6 * * *')
  async handleDailyCron(): Promise<void> {
    this.logger.log('Daily cron: syncing all fixtures from external API');
    await this.execute();
  }

  async execute(): Promise<{ synced: number; errors: number }> {
    this.logger.log('Starting match synchronization');

    const apiKey = this.footballApiProvider['apiKey'] as string | undefined;
    const baseUrl = this.footballApiProvider['baseUrl'] as string | undefined;
    if (!apiKey || !baseUrl) {
      this.logger.error(
        'External API not configured! Set EXTERNAL_FOOTBALL_API_BASE_URL and ' +
        'EXTERNAL_FOOTBALL_API_KEY in your .env file, then restart the server.',
      );
      return { synced: 0, errors: 0 };
    }

    try {
      const matches = await this.footballApiProvider.fetchMatches();
      let synced = 0;
      let errors = 0;

      for (const match of matches) {
        try {
          if (!match.externalId) {
            this.logger.warn('Match without externalId, skipping');
            errors++;
            continue;
          }
          await this.matchRepository.upsertByExternalId(
            match.externalId,
            match,
          );
          synced++;
        } catch (error) {
          this.logger.error(
            `Error syncing match ${match.externalId}`,
            error.message,
          );
          errors++;
        }
      }

      this.logger.log(
        `Match synchronization completed: ${synced} synced, ${errors} errors`,
      );

      // Remove seeded placeholder matches now that real API data is in the DB.
      // Prevents double-counting in standings (wc26-* duplicates numeric-ID docs).
      if (synced > 0) {
        try {
          const deleted = await this.matchRepository.deleteSeedPlaceholders();
          if (deleted > 0) {
            this.logger.log(
              `🧹 Removed ${deleted} seeded placeholder matches (wc26-* / generated-*) — API data is now the source of truth`,
            );
          }
        } catch (error) {
          this.logger.error('Error removing seed placeholders', error.message);
        }
      }

      // After syncing matches, update knockout brackets only if the API
      // does NOT yet provide R32 matches (early in the tournament).
      // Once the API provides them, its data is authoritative — generating
      // fake records would create duplicates with wrong dates.
      try {
        const r32Matches = await this.matchRepository.findByStage(MatchStage.ROUND_OF_32);
        const apiR32 = r32Matches.filter((m) => /^\d+$/.test(m.externalId));

        if (apiR32.length === 0) {
          this.logger.log('🏆 API has no R32 data yet — generating bracket from group standings...');
          const knockoutResult = await this.generateKnockoutUseCase.execute();
          if (knockoutResult.generated > 0 || knockoutResult.updated > 0) {
            this.logger.log(
              `✅ Bracket: ${knockoutResult.generated} created, ${knockoutResult.updated} updated`,
            );
          }
        } else {
          this.logger.log(`🏆 API provides ${apiR32.length} R32 matches — skipping bracket generation`);
        }
      } catch (error) {
        this.logger.error('Error updating knockout matches', error.message);
      }

      // Calculate points for any newly finished matches
      try {
        this.logger.log('📊 Calculating points for finished matches...');
        const pointsResult = await this.autoCalculatePointsUseCase.execute();
        if (pointsResult.processed > 0) {
          this.logger.log(
            `✅ Calculated points for ${pointsResult.processed} matches`,
          );
        }
      } catch (error) {
        this.logger.error('Error calculating points', error.message);
      }

      return { synced, errors };
    } catch (error) {
      this.logger.error('Error in match synchronization', error.message);
      throw error;
    }
  }

  /**
   * Fetches only the matches with Unknown teams from the external API.
   * Called on-demand by the controller so the response always has fresh data.
   * Uses individual match requests (not the bulk endpoint) to save quota.
   */
  async syncUnknownMatches(): Promise<number> {
    const apiKey = this.footballApiProvider['apiKey'] as string | undefined;
    if (!apiKey) return 0;

    const all = await this.matchRepository.findAll();
    const unknowns = all.filter(
      (m) => m.homeTeam === 'Unknown' || m.awayTeam === 'Unknown',
    );

    if (unknowns.length === 0) return 0;

    let updated = 0;
    await Promise.all(
      unknowns.map(async (match) => {
        try {
          const fresh = await this.footballApiProvider.fetchMatchById(match.externalId);
          if (
            fresh &&
            fresh.homeTeam &&
            fresh.awayTeam &&
            fresh.homeTeam !== 'Unknown' &&
            fresh.awayTeam !== 'Unknown'
          ) {
            await this.matchRepository.upsertByExternalId(match.externalId, fresh);
            updated++;
          }
        } catch {
          // ignore individual fetch errors
        }
      }),
    );

    if (updated > 0) {
      this.logger.log(`🔄 On-demand sync: updated ${updated} matches with resolved teams`);
    }

    return updated;
  }
}



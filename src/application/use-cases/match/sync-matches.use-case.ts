import { Injectable, Logger, Inject, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MatchRepository } from '@infrastructure/database/repositories';
import type { IFootballApiProvider } from '@infrastructure/external-api';
import { WorldCup26ApiProvider } from '@infrastructure/external-api';
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
    private readonly worldCup26Provider: WorldCup26ApiProvider,
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
   * Sync every 5 minutes to keep scores and statuses up to date.
   * worldcup26.ir + ESPN have no request quota so frequent syncing is fine.
   */
  @Cron('*/5 * * * *')
  async handleCron(): Promise<void> {
    this.logger.log('Cron: syncing all fixtures from worldcup26.ir + ESPN');
    await this.execute();
  }

  async execute(): Promise<{ synced: number; errors: number }> {
    this.logger.log('Starting match synchronization');

    try {
      const matches = await this.footballApiProvider.fetchMatches();
      let synced = 0;
      let errors = 0;

      // ── Build lookup maps from existing DB matches ──────────────────────
      // This lets us find the correct externalId regardless of which API
      // originally created the match (football-data.org numeric vs wc26-*).
      const allExisting = await this.matchRepository.findAll();
      const byExternalId = new Map(allExisting.map((m) => [m.externalId, m]));
      const byTeamKey = new Map(
        allExisting.map((m) => [
          `${this._normalizeTeam(m.homeTeam)}__${this._normalizeTeam(m.awayTeam)}`,
          m,
        ]),
      );

      for (const match of matches) {
        try {
          if (!match.externalId) {
            this.logger.warn('Match without externalId, skipping');
            errors++;
            continue;
          }

          // ── Smart ID resolution ─────────────────────────────────────────
          // Priority 1: exact externalId match (normal path)
          // Priority 2: same teams (forward) → reuse existing doc's externalId
          // Priority 3: same teams reversed (home/away swapped between APIs)
          let targetExtId = match.externalId;
          if (!byExternalId.has(match.externalId) && match.homeTeam && match.awayTeam) {
            const fwdKey = `${this._normalizeTeam(match.homeTeam)}__${this._normalizeTeam(match.awayTeam)}`;
            const revKey = `${this._normalizeTeam(match.awayTeam)}__${this._normalizeTeam(match.homeTeam)}`;

            const existing = byTeamKey.get(fwdKey) ?? byTeamKey.get(revKey);
            if (existing) {
              targetExtId = existing.externalId;
              this.logger.debug(
                `Smart match: ${match.homeTeam} vs ${match.awayTeam} → reusing externalId ${targetExtId}`,
              );
            }
          }

          await this.matchRepository.upsertByExternalId(targetExtId, {
            ...match,
            externalId: targetExtId,
          });
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

      // After syncing matches, update knockout brackets only if worldcup26.ir
      // does NOT yet provide R32 matches (early in the tournament).
      try {
        const r32Matches = await this.matchRepository.findByStage(MatchStage.ROUND_OF_32);
        // wc26- prefix IDs are the canonical IDs for worldcup26.ir
        const apiR32 = r32Matches.filter((m) => /^(wc26-|\d+)/.test(m.externalId));

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
    const all = await this.matchRepository.findAll();
    const unknowns = all.filter(
      (m) => m.homeTeam === 'Unknown' || m.awayTeam === 'Unknown',
    );

    if (unknowns.length === 0) return 0;

    let updated = 0;

    // Resolve via worldcup26.ir full provider first
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

    // Also try the dedicated worldcup26.ir R32 fallback for any still-Unknown matches
    const updatedFromWC26 = await this.syncUnknownMatchesFromWorldCup26();
    return updated + updatedFromWC26;
  }

  /**
   * Fetches R32 games from worldcup26.ir and fills in team names for any
   * DB matches that still show "Unknown".
   *
   * Matching strategy: both lists (DB sorted by kickoffAt ASC and
   * worldcup26.ir sorted by local_date ASC) produce the same chronological
   * order, so they are aligned 1-to-1 by array index.
   */
  async syncUnknownMatchesFromWorldCup26(): Promise<number> {
    try {
      const dbR32 = await this.matchRepository.findByStage(MatchStage.ROUND_OF_32);
      const stillUnknown = dbR32.filter((m) => m.homeTeam === 'Unknown' || m.awayTeam === 'Unknown');
      if (stillUnknown.length === 0) return 0;

      const wc26Games = await this.worldCup26Provider.fetchR32GamesSorted();

      if (wc26Games.length !== dbR32.length) {
        this.logger.warn(
          `worldcup26.ir returned ${wc26Games.length} R32 games but DB has ${dbR32.length} — skipping fallback sync`,
        );
        return 0;
      }

      let updated = 0;
      for (let i = 0; i < dbR32.length; i++) {
        const dbMatch = dbR32[i];
        const wc26 = wc26Games[i];

        if (
          (dbMatch.homeTeam !== 'Unknown' && dbMatch.awayTeam !== 'Unknown') ||
          !wc26.homeTeam ||
          !wc26.awayTeam
        ) {
          continue;
        }

        await this.matchRepository.upsertByExternalId(dbMatch.externalId, {
          homeTeam: wc26.homeTeam,
          awayTeam: wc26.awayTeam,
        });
        this.logger.log(
          `🌐 worldcup26.ir resolved: ${wc26.homeTeam} vs ${wc26.awayTeam} (externalId ${dbMatch.externalId})`,
        );
        updated++;
      }

      if (updated > 0) {
        this.logger.log(`🌐 worldcup26.ir fallback: resolved ${updated} R32 matches`);
      }

      return updated;
    } catch (err) {
      this.logger.warn(`worldcup26.ir fallback failed: ${err.message}`);
      return 0;
    }
  }

  /** Canonical alias map: resolves API-specific team name differences. */
  private static readonly TEAM_ALIASES: Record<string, string> = {
    czechia: 'czechrepublic',
    czechrepublic: 'czechrepublic',
    cotedivoire: 'ivorycoast',
    ivorycoast: 'ivorycoast',
    capeverdeislands: 'capeverde',
    capeverde: 'capeverde',
    republicofkorea: 'southkorea',
    southkorea: 'southkorea',
    korea: 'southkorea',
    democraticrepublicofthecongo: 'drcongo',
    drcongo: 'drcongo',
    congodrc: 'drcongo',
    congodr: 'drcongo',
    bosniaherzegovina: 'bosniaandherzegovina',
    bosniaandherzegovina: 'bosniaandherzegovina',
    unitedstates: 'usa',
    usa: 'usa',
  };

  /** Normalise a team name for cross-API fuzzy matching. */
  private _normalizeTeam(name = ''): string {
    const n = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
    return SyncMatchesUseCase.TEAM_ALIASES[n] ?? n;
  }
}



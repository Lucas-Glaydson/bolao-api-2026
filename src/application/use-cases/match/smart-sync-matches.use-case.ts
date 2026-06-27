import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MatchRepository } from '@infrastructure/database/repositories';
import type { IFootballApiProvider } from '@infrastructure/external-api';
import { Match, MatchStage, MatchStatus } from '@domain/entities';
import { GenerateKnockoutMatchesUseCase } from './generate-knockout-matches.use-case';
import { AutoCalculatePointsUseCase } from './auto-calculate-points.use-case';

/**
 * Smart post-match sync — conserves the 100 req/day API quota.
 *
 * Two timing buckets:
 *
 * 1. GROUP STAGE (no extra time / penalties possible):
 *    - First check: 130 min after kickoff (2 h 10 min — game is over)
 *    - Re-check interval: 60 min (rare, only if API returned "live" by mistake)
 *
 * 2. KNOCKOUT STAGES (extra time + penalties possible):
 *    - First check: 130 min after kickoff (game may have ended in normal time)
 *    - Re-check interval: 15 min
 *      → Catches extra time (30 min) and penalty shootout (~20 min) in near real-time
 *      → Worst case: 3 extra API calls per knockout match
 *
 * Worst-case daily API usage example (R16 day: 4 matches):
 *   4 matches × (1 normal check + up to 3 re-checks) = ≤16 req/day — well within 100.
 */
@Injectable()
export class SmartSyncMatchesUseCase {
  private readonly logger = new Logger(SmartSyncMatchesUseCase.name);

  // ── Group stage timing ──────────────────────────────────────────────────────
  /** Minutes after kickoff before we first check a group stage match. */
  private readonly GROUP_MINUTES_AFTER_KICKOFF = 130; // 2 h 10 min
  /** Minimum re-check gap for group stage (no ET/penalties, so 1 h is fine). */
  private readonly GROUP_RECHECK_INTERVAL_MINUTES = 60;

  // ── Knockout stage timing ───────────────────────────────────────────────────
  /** Same first-check threshold (normal time ends around 2 h). */
  private readonly KNOCKOUT_MINUTES_AFTER_KICKOFF = 130;
  /**
   * Re-check every 15 min for knockout matches so we capture:
   *   extra time 1st half  (+15 min)
   *   extra time 2nd half  (+15 min)
   *   penalty shootout     (~20 min)
   */
  private readonly KNOCKOUT_RECHECK_INTERVAL_MINUTES = 15;

  private static readonly GROUP_STAGES = [MatchStage.GROUP_STAGE];
  private static readonly KNOCKOUT_STAGES = [
    MatchStage.ROUND_OF_32,
    MatchStage.ROUND_OF_16,
    MatchStage.QUARTER_FINALS,
    MatchStage.SEMI_FINALS,
    MatchStage.FINAL,
  ];

  constructor(
    private readonly matchRepository: MatchRepository,
    @Inject('IFootballApiProvider')
    private readonly footballApiProvider: IFootballApiProvider,
    private readonly generateKnockoutUseCase: GenerateKnockoutMatchesUseCase,
    private readonly autoCalculatePointsUseCase: AutoCalculatePointsUseCase,
  ) {}

  /** Run every 5 minutes to react to matches finishing (including ET and penalties). */
  @Cron('*/5 * * * *')
  async handleCron(): Promise<void> {
    await this.execute();
  }

  async execute(): Promise<{ synced: number; skipped: number; errors: number }> {
    const apiKey = this.footballApiProvider['apiKey'] as string | undefined;
    const baseUrl = this.footballApiProvider['baseUrl'] as string | undefined;

    if (!apiKey || !baseUrl) {
      return { synced: 0, skipped: 0, errors: 0 };
    }

    // ── Fetch candidates from both buckets ─────────────────────────────────
    const [groupCandidates, knockoutCandidates] = await Promise.all([
      this.matchRepository.findNeedingPostMatchSync(
        this.GROUP_MINUTES_AFTER_KICKOFF,
        this.GROUP_RECHECK_INTERVAL_MINUTES,
        SmartSyncMatchesUseCase.GROUP_STAGES,
      ),
      this.matchRepository.findNeedingPostMatchSync(
        this.KNOCKOUT_MINUTES_AFTER_KICKOFF,
        this.KNOCKOUT_RECHECK_INTERVAL_MINUTES,
        SmartSyncMatchesUseCase.KNOCKOUT_STAGES,
      ),
    ]);

    // Merge and deduplicate (same externalId shouldn't appear in both, but be safe)
    const seen = new Set<string>();
    const candidates: Match[] = [];
    for (const m of [...groupCandidates, ...knockoutCandidates]) {
      if (!seen.has(m.externalId)) {
        seen.add(m.externalId);
        candidates.push(m);
      }
    }

    if (candidates.length === 0) {
      return { synced: 0, skipped: 0, errors: 0 };
    }

    const knockoutCount = knockoutCandidates.length;
    this.logger.log(
      `Smart sync: ${candidates.length} match(es) to update` +
        (knockoutCount > 0 ? ` (${knockoutCount} knockout — penalties mode)` : ''),
    );

    let synced = 0;
    let skipped = 0;
    let errors = 0;
    let knockoutRebuildNeeded = false;
    let pointsRecalcNeeded = false;

    for (const match of candidates) {
      try {
        const updated = await this.footballApiProvider.fetchMatchById(match.externalId);

        if (!updated) {
          this.logger.warn(
            `Smart sync: no data for fixture ${match.externalId} — bumping syncedAt`,
          );
          await this.matchRepository.upsertByExternalId(match.externalId, {
            syncedAt: new Date(),
          });
          skipped++;
          continue;
        }

        const wasFinished =
          match.status === MatchStatus.FINISHED ||
          match.status === MatchStatus.CANCELLED ||
          match.status === MatchStatus.POSTPONED;

        await this.matchRepository.upsertByExternalId(match.externalId, {
          ...updated,
          syncedAt: new Date(),
        });

        const isNowFinished =
          updated.status === MatchStatus.FINISHED ||
          updated.status === MatchStatus.CANCELLED ||
          updated.status === MatchStatus.POSTPONED;

        if (!wasFinished && isNowFinished) {
          knockoutRebuildNeeded = true;
          pointsRecalcNeeded = true;
        }

        const isKnockout = SmartSyncMatchesUseCase.KNOCKOUT_STAGES.includes(match.stage);
        this.logger.log(
          `Smart sync ✅ fixture ${match.externalId} ` +
            `[${isKnockout ? 'KNOCKOUT' : 'GROUP'}] ` +
            `(${match.homeTeam} vs ${match.awayTeam}) → ${updated.status ?? 'unknown'}` +
            (updated.officialHomeScore != null
              ? ` | ${updated.officialHomeScore}-${updated.officialAwayScore}`
              : ''),
        );
        synced++;
      } catch (error) {
        this.logger.error(`Smart sync ❌ fixture ${match.externalId}: ${error.message}`);
        errors++;
      }
    }

    if (knockoutRebuildNeeded) {
      try {
        const r = await this.generateKnockoutUseCase.execute();
        if (r.updated > 0 || r.generated > 0) {
          this.logger.log(
            `Smart sync: bracket updated (${r.generated} new, ${r.updated} updated)`,
          );
        }
      } catch (err) {
        this.logger.error(`Smart sync: bracket rebuild error — ${err.message}`);
      }
    }

    if (pointsRecalcNeeded) {
      try {
        const r = await this.autoCalculatePointsUseCase.execute();
        if (r.processed > 0) {
          this.logger.log(`Smart sync: points recalculated for ${r.processed} match(es)`);
        }
      } catch (err) {
        this.logger.error(`Smart sync: points recalc error — ${err.message}`);
      }
    }

    this.logger.log(
      `Smart sync complete: ${synced} synced, ${skipped} skipped, ${errors} errors`,
    );

    return { synced, skipped, errors };
  }
}


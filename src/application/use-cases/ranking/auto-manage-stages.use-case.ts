import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  MatchRepository,
  StageControlRepository,
} from '@infrastructure/database/repositories';
import { MatchStage, MatchStatus } from '@domain/entities';

/**
 * Rules
 * ─────
 * OPEN   — stage has at least one SCHEDULED match AND the first kickoff is
 *           within OPEN_WINDOW_HOURS from now (default 48 h).
 *
 * CLOSE  — every match in the stage is FINISHED / CANCELLED / POSTPONED
 *           (nothing left to predict or calculate).
 *
 * Runs once at boot and then every hour so manual overrides are
 * respected and stages transition cleanly as the tournament progresses.
 */
@Injectable()
export class AutoManageStagesUseCase implements OnApplicationBootstrap {
  private readonly logger = new Logger(AutoManageStagesUseCase.name);

  /** How many hours before the first match of a stage to open predictions */
  private static readonly OPEN_WINDOW_HOURS = 48;

  private static readonly STAGE_ORDER: Record<MatchStage, number> = {
    [MatchStage.GROUP_STAGE]:    1,
    [MatchStage.ROUND_OF_32]:    2,
    [MatchStage.ROUND_OF_16]:    3,
    [MatchStage.QUARTER_FINALS]: 4,
    [MatchStage.SEMI_FINALS]:    5,
    [MatchStage.THIRD_PLACE]:    6,
    [MatchStage.FINAL]:          7,
  };

  private static readonly TERMINAL_STATUSES = new Set([
    MatchStatus.FINISHED,
    MatchStatus.CANCELLED,
    MatchStatus.POSTPONED,
  ]);

  constructor(
    private readonly matchRepository: MatchRepository,
    private readonly stageControlRepository: StageControlRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('🚀 Startup: running stage auto-management...');
    try {
      await this.execute();
    } catch (err) {
      this.logger.error(`Startup stage management failed: ${err.message}`);
    }
  }

  /** Runs every hour */
  @Cron('0 * * * *')
  async handleCron(): Promise<void> {
    await this.execute();
  }

  async execute(): Promise<{ opened: string[]; closed: string[] }> {
    const now = new Date();
    const windowMs = AutoManageStagesUseCase.OPEN_WINDOW_HOURS * 60 * 60 * 1000;
    const openThreshold = new Date(now.getTime() + windowMs);

    const opened: string[] = [];
    const closed: string[] = [];

    for (const stage of Object.values(MatchStage)) {
      try {
        const matches = await this.matchRepository.findByStage(stage);
        if (matches.length === 0) continue;

        const scheduled = matches.filter((m) => m.status === MatchStatus.SCHEDULED);
        const allDone   = matches.every((m) =>
          AutoManageStagesUseCase.TERMINAL_STATUSES.has(m.status),
        );

        // Ensure the stage_control record exists
        let sc = await this.stageControlRepository.findByStage(stage);
        if (!sc) {
          sc = await this.stageControlRepository.create({
            stage,
            isOpen: false,
            openedAt: null,
            closedAt: null,
            allowPredictions: false,
            displayOrder: AutoManageStagesUseCase.STAGE_ORDER[stage] ?? 99,
          });
        }

        // ── CLOSE: all matches terminal ──────────────────────────────────
        if (allDone && sc.isOpen) {
          await this.stageControlRepository.update(sc.id, {
            isOpen: false,
            closedAt: now,
            allowPredictions: false,
          });
          closed.push(stage);
          this.logger.log(`🔒 Closed stage: ${stage} (all matches finished)`);
          continue;
        }

        // ── OPEN: upcoming matches with known teams within the window ────
        const firstKnown = scheduled
          .filter(
            (m) =>
              m.homeTeam &&
              !m.homeTeam.startsWith('TBD') &&
              m.homeTeam !== 'Unknown' &&
              m.awayTeam &&
              !m.awayTeam.startsWith('TBD') &&
              m.awayTeam !== 'Unknown',
          )
          .map((m) => m.kickoffAt)
          .sort((a, b) => a.getTime() - b.getTime())[0];

        if (firstKnown && firstKnown <= openThreshold && !sc.isOpen) {
          await this.stageControlRepository.update(sc.id, {
            isOpen: true,
            openedAt: now,
            allowPredictions: true,
          });
          opened.push(stage);
          this.logger.log(
            `🔓 Opened stage: ${stage} (first known match at ${firstKnown.toISOString()})`,
          );
        }
      } catch (err) {
        this.logger.error(`Error managing stage ${stage}: ${err.message}`);
      }
    }

    if (opened.length > 0 || closed.length > 0) {
      this.logger.log(
        `Stage management: opened [${opened.join(', ')}], closed [${closed.join(', ')}]`,
      );
    }

    return { opened, closed };
  }
}

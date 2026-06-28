import { Injectable } from '@nestjs/common';
import { StageControlRepository } from '../../../infrastructure/database/repositories';
import { MatchStage } from '../../../domain/entities';

const ALL_STAGES: { stage: MatchStage; displayOrder: number }[] = [
  { stage: MatchStage.GROUP_STAGE,    displayOrder: 1 },
  { stage: MatchStage.ROUND_OF_32,    displayOrder: 2 },
  { stage: MatchStage.ROUND_OF_16,    displayOrder: 3 },
  { stage: MatchStage.QUARTER_FINALS, displayOrder: 4 },
  { stage: MatchStage.SEMI_FINALS,    displayOrder: 5 },
  { stage: MatchStage.THIRD_PLACE,    displayOrder: 6 },
  { stage: MatchStage.FINAL,          displayOrder: 7 },
];

@Injectable()
export class GetAllStagesUseCase {
  constructor(
    private readonly stageControlRepository: StageControlRepository,
  ) {}

  async execute() {
    const existing = await this.stageControlRepository.findAll();
    const existingStages = new Set(existing.map((s) => s.stage));

    // Create missing stage control records with default closed state
    for (const { stage, displayOrder } of ALL_STAGES) {
      if (!existingStages.has(stage)) {
        await this.stageControlRepository.create({
          stage,
          isOpen: false,
          openedAt: null,
          closedAt: null,
          allowPredictions: false,
          displayOrder,
        });
      }
    }

    return this.stageControlRepository.findAll();
  }
}

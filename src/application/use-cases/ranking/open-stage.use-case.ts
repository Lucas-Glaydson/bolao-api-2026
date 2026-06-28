import { Injectable } from '@nestjs/common';
import { StageControlRepository } from '../../../infrastructure/database/repositories';
import { MatchStage } from '../../../domain/entities';

const STAGE_ORDER: Record<MatchStage, number> = {
  [MatchStage.GROUP_STAGE]:    1,
  [MatchStage.ROUND_OF_32]:    2,
  [MatchStage.ROUND_OF_16]:    3,
  [MatchStage.QUARTER_FINALS]: 4,
  [MatchStage.SEMI_FINALS]:    5,
  [MatchStage.THIRD_PLACE]:    6,
  [MatchStage.FINAL]:          7,
};

@Injectable()
export class OpenStageUseCase {
  constructor(
    private readonly stageControlRepository: StageControlRepository,
  ) {}

  async execute(stage: MatchStage) {
    let stageControl = await this.stageControlRepository.findByStage(stage);

    if (!stageControl) {
      // Create the record on-the-fly so admins can open any stage at any time
      stageControl = await this.stageControlRepository.create({
        stage,
        isOpen: false,
        openedAt: null,
        closedAt: null,
        allowPredictions: false,
        displayOrder: STAGE_ORDER[stage] ?? 99,
      });
    }

    return this.stageControlRepository.update(stageControl.id, {
      isOpen: true,
      openedAt: new Date(),
      allowPredictions: true,
    });
  }
}

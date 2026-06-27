import { Injectable, NotFoundException } from '@nestjs/common';
import { StageControlRepository } from '../../../infrastructure/database/repositories';
import { MatchStage } from '../../../domain/entities';

@Injectable()
export class OpenStageUseCase {
  constructor(
    private readonly stageControlRepository: StageControlRepository,
  ) {}

  async execute(stage: MatchStage) {
    let stageControl = await this.stageControlRepository.findByStage(stage);

    if (!stageControl) {
      throw new NotFoundException('Stage control not found');
    }

    return this.stageControlRepository.update(stageControl.id, {
      isOpen: true,
      openedAt: new Date(),
      allowPredictions: true,
    });
  }
}

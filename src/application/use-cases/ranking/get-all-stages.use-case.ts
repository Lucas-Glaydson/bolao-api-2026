import { Injectable } from '@nestjs/common';
import { StageControlRepository } from '../../../infrastructure/database/repositories';

@Injectable()
export class GetAllStagesUseCase {
  constructor(
    private readonly stageControlRepository: StageControlRepository,
  ) {}

  async execute() {
    return this.stageControlRepository.findAll();
  }
}

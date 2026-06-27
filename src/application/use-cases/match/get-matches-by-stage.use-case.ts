import { Injectable } from '@nestjs/common';
import { MatchRepository } from '../../../infrastructure/database/repositories';
import { Match, MatchStage } from '../../../domain/entities';

@Injectable()
export class GetMatchesByStageUseCase {
  constructor(private readonly matchRepository: MatchRepository) {}

  async execute(stage: MatchStage): Promise<Match[]> {
    return this.matchRepository.findByStage(stage);
  }
}

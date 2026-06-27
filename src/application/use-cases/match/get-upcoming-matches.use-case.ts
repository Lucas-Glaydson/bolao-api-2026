import { Injectable } from '@nestjs/common';
import { MatchRepository } from '../../../infrastructure/database/repositories';
import { Match } from '../../../domain/entities';

@Injectable()
export class GetUpcomingMatchesUseCase {
  constructor(private readonly matchRepository: MatchRepository) {}

  async execute(limit?: number): Promise<Match[]> {
    return this.matchRepository.findUpcoming(limit);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { MatchRepository } from '../../../infrastructure/database/repositories';
import { Match } from '../../../domain/entities';

@Injectable()
export class GetMatchByIdUseCase {
  constructor(private readonly matchRepository: MatchRepository) {}

  async execute(id: string): Promise<Match> {
    const match = await this.matchRepository.findById(id);
    if (!match) {
      throw new NotFoundException('Match not found');
    }
    return match;
  }
}

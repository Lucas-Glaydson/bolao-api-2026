import { Injectable } from '@nestjs/common';
import { MatchRepository } from '../../../infrastructure/database/repositories';
import { Match } from '../../../domain/entities';

@Injectable()
export class GetAllMatchesUseCase {
  constructor(private readonly matchRepository: MatchRepository) {}

  async execute(): Promise<Match[]> {
    return this.matchRepository.findAll();
  }
}

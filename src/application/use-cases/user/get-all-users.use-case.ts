import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../../infrastructure/database/repositories';
import { User } from '../../../domain/entities';

@Injectable()
export class GetAllUsersUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(): Promise<User[]> {
    return this.userRepository.findAll();
  }
}

import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '../../../infrastructure/database/repositories';
import { User, UserRole } from '../../../domain/entities';

@Injectable()
export class CreateUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(
    name: string,
    email: string,
    password: string,
    role: UserRole,
  ): Promise<User> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await this.userRepository.create({
      name,
      email,
      passwordHash,
      role,
      isActive: true,
      mustChangePassword: true,
    });

    return user;
  }
}

import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '@infrastructure/database/repositories';

@Injectable()
export class ChangePasswordUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from the current password');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await this.userRepository.update(userId, {
      passwordHash: newPasswordHash,
      mustChangePassword: false,
    });
  }
}

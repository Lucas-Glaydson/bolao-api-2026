import { Module } from '@nestjs/common';
import { UsersController } from '../presentation/controllers/users.controller';
import {
  CreateUserUseCase,
  GetAllUsersUseCase,
  GetUserByIdUseCase,
} from '../application/use-cases/user';

@Module({
  controllers: [UsersController],
  providers: [CreateUserUseCase, GetAllUsersUseCase, GetUserByIdUseCase],
})
export class UsersModule {}

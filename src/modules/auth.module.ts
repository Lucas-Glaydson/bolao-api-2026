import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from '../presentation/controllers/auth.controller';
import { LoginUseCase, ChangePasswordUseCase } from '../application/use-cases/auth';
import { JwtStrategy } from '../presentation/guards/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret') || 'default_secret',
        signOptions: { expiresIn: configService.get<string>('jwt.expiresIn') || '7d' } as any,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [LoginUseCase, ChangePasswordUseCase, JwtStrategy],
  exports: [JwtStrategy, PassportModule],
})
export class AuthModule {}

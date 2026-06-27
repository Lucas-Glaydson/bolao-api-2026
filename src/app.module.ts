import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { config } from './infrastructure/config/configuration';
import { DatabaseModule } from './infrastructure/database/database.module';
import { AuthModule } from './modules/auth.module';
import { UsersModule } from './modules/users.module';
import { MatchesModule } from './modules/matches.module';
import { PredictionsModule } from './modules/predictions.module';
import { RankingModule } from './modules/ranking.module';
import { StatsModule } from './modules/stats.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [config],
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri'),
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    UsersModule,
    MatchesModule,
    PredictionsModule,
    RankingModule,
    StatsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

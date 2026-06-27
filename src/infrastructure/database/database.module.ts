import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  UserDocument,
  UserSchema,
  MatchDocument,
  MatchSchema,
  PredictionDocument,
  PredictionSchema,
  ScoreRuleDocument,
  ScoreRuleSchema,
  StageControlDocument,
  StageControlSchema,
} from './schemas';
import {
  UserRepository,
  MatchRepository,
  PredictionRepository,
  ScoreRuleRepository,
  StageControlRepository,
} from './repositories';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserDocument.name, schema: UserSchema },
      { name: MatchDocument.name, schema: MatchSchema },
      { name: PredictionDocument.name, schema: PredictionSchema },
      { name: ScoreRuleDocument.name, schema: ScoreRuleSchema },
      { name: StageControlDocument.name, schema: StageControlSchema },
    ]),
  ],
  providers: [
    UserRepository,
    MatchRepository,
    PredictionRepository,
    ScoreRuleRepository,
    StageControlRepository,
  ],
  exports: [
    UserRepository,
    MatchRepository,
    PredictionRepository,
    ScoreRuleRepository,
    StageControlRepository,
  ],
})
export class DatabaseModule {}

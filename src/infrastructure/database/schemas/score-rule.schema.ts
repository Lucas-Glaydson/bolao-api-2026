import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { MatchStage } from '../../../domain/entities';

export type ScoreRuleDocumentType = ScoreRuleDocument & Document;

@Schema({ timestamps: true, collection: 'score_rules' })
export class ScoreRuleDocument {
  @Prop({ required: true, enum: Object.values(MatchStage), unique: true })
  stage: MatchStage;

  @Prop({ required: true })
  basePoints: number;

  @Prop({ required: true, default: 2 })
  exactScoreBonus: number;

  @Prop({ required: true, default: true })
  active: boolean;
}

export const ScoreRuleSchema = SchemaFactory.createForClass(ScoreRuleDocument);

// Create indexes
ScoreRuleSchema.index({ stage: 1 });
ScoreRuleSchema.index({ active: 1 });

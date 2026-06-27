import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { MatchStage } from '../../../domain/entities';

export type StageControlDocumentType = StageControlDocument & Document;

@Schema({ timestamps: true, collection: 'stage_controls' })
export class StageControlDocument {
  @Prop({ required: true, enum: Object.values(MatchStage), unique: true })
  stage: MatchStage;

  @Prop({ required: true, default: false })
  isOpen: boolean;

  @Prop({ type: Date, default: null })
  openedAt: Date | null;

  @Prop({ type: Date, default: null })
  closedAt: Date | null;

  @Prop({ required: true, default: false })
  allowPredictions: boolean;

  @Prop({ required: true })
  displayOrder: number;
}

export const StageControlSchema = SchemaFactory.createForClass(StageControlDocument);

// Create indexes
StageControlSchema.index({ stage: 1 });
StageControlSchema.index({ isOpen: 1 });
StageControlSchema.index({ displayOrder: 1 });

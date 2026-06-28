import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PredictionDocumentType = PredictionDocument & Document;

@Schema({ timestamps: true, collection: 'predictions' })
export class PredictionDocument {
  @Prop({ required: true, type: Types.ObjectId, ref: 'UserDocument' })
  userId: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'MatchDocument' })
  matchId: string;

  @Prop({ required: true })
  predictedHomeScore: number;

  @Prop({ required: true })
  predictedAwayScore: number;

  @Prop({ type: String, enum: ['home', 'away'], default: null })
  tiebreakWinner: 'home' | 'away' | null;

  @Prop({ type: Boolean, default: false })
  isAutoFilled: boolean;

  @Prop({ type: Date, default: null })
  lockedAt: Date | null;

  @Prop({ required: true, type: Date })
  canEditUntil: Date;

  @Prop({ type: Number, default: null })
  pointsAwarded: number | null;

  @Prop({ type: Boolean, default: false })
  exactScoreHit: boolean;

  @Prop({ type: Boolean, default: false })
  outcomeHit: boolean;
}

export const PredictionSchema = SchemaFactory.createForClass(PredictionDocument);

// Create indexes
PredictionSchema.index({ userId: 1, matchId: 1 }, { unique: true });
PredictionSchema.index({ userId: 1 });
PredictionSchema.index({ matchId: 1 });

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { MatchStatus, MatchStage, MatchWinner } from '../../../domain/entities';

export type MatchDocumentType = MatchDocument & Document;

@Schema({ timestamps: true, collection: 'matches' })
export class MatchDocument {
  @Prop({ required: true, unique: true })
  externalId: string;

  @Prop({ required: true })
  competition: string;

  @Prop({ required: true, enum: Object.values(MatchStage) })
  stage: MatchStage;

  @Prop({ required: false, type: String, enum: ['A','B','C','D','E','F','G','H','I','J','K','L'] })
  group?: string;

  @Prop({ required: false, type: Number, min: 1, max: 3 })
  round?: number;

  @Prop({ required: true })
  roundLabel: string;

  @Prop({ required: true })
  homeTeam: string;

  @Prop({ required: false, type: String })
  homeTeamLogo?: string;

  @Prop({ required: true })
  awayTeam: string;

  @Prop({ required: false, type: String })
  awayTeamLogo?: string;

  @Prop({ required: true, type: Date })
  kickoffAt: Date;

  @Prop({ required: true, enum: Object.values(MatchStatus), default: MatchStatus.SCHEDULED })
  status: MatchStatus;

  @Prop({ type: Number, default: null })
  officialHomeScore: number | null;

  @Prop({ type: Number, default: null })
  officialAwayScore: number | null;

  @Prop({ required: false, type: Number })
  manualHomeScore?: number | null;

  @Prop({ required: false, type: Number })
  manualAwayScore?: number | null;

  @Prop({ default: false })
  useManualScore: boolean;

  @Prop({ type: String, enum: Object.values(MatchWinner), default: null })
  winner: MatchWinner | null;

  @Prop({ type: Date, default: Date.now })
  syncedAt: Date;
}

export const MatchSchema = SchemaFactory.createForClass(MatchDocument);

// Create indexes
MatchSchema.index({ externalId: 1 });
MatchSchema.index({ stage: 1 });
MatchSchema.index({ status: 1 });
MatchSchema.index({ kickoffAt: 1 });

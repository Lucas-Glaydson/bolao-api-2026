import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserRole } from '../../../domain/entities';

export type UserDocumentType = UserDocument & Document;

@Schema({ timestamps: true, collection: 'users' })
export class UserDocument {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, enum: Object.values(UserRole), default: UserRole.USER })
  role: UserRole;

  @Prop({ required: true, default: true })
  isActive: boolean;

  @Prop({ required: true, default: true })
  mustChangePassword: boolean;
}

export const UserSchema = SchemaFactory.createForClass(UserDocument);

// Create indexes
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });

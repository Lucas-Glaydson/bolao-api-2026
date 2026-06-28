import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IPredictionRepository } from '../../../domain/repositories';
import { Prediction } from '../../../domain/entities';
import { PredictionDocument } from '../schemas/prediction.schema';

@Injectable()
export class PredictionRepository implements IPredictionRepository {
  constructor(
    @InjectModel(PredictionDocument.name)
    private readonly predictionModel: Model<PredictionDocument>,
  ) {}

  async create(
    data: Omit<Prediction, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Prediction> {
    const prediction = new this.predictionModel(data);
    const saved = await prediction.save();
    return this.toEntity(saved);
  }

  async findById(id: string): Promise<Prediction | null> {
    const prediction = await this.predictionModel.findById(id).exec();
    return prediction ? this.toEntity(prediction) : null;
  }

  async findByUserAndMatch(
    userId: string,
    matchId: string,
  ): Promise<Prediction | null> {
    const prediction = await this.predictionModel
      .findOne({ userId, matchId })
      .exec();
    return prediction ? this.toEntity(prediction) : null;
  }

  async findByUser(userId: string): Promise<Prediction[]> {
    const predictions = await this.predictionModel.find({ userId }).exec();
    return predictions.map((prediction) => this.toEntity(prediction));
  }

  async findByMatch(matchId: string): Promise<Prediction[]> {
    const predictions = await this.predictionModel.find({ matchId }).exec();
    return predictions.map((prediction) => this.toEntity(prediction));
  }

  async findAll(): Promise<Prediction[]> {
    const predictions = await this.predictionModel.find().exec();
    return predictions.map((prediction) => this.toEntity(prediction));
  }

  async update(
    id: string,
    data: Partial<Prediction>,
  ): Promise<Prediction | null> {
    const prediction = await this.predictionModel
      .findByIdAndUpdate(id, data, { returnDocument: 'after' })
      .exec();
    return prediction ? this.toEntity(prediction) : null;
  }

  async upsertByUserAndMatch(
    userId: string,
    matchId: string,
    data: Partial<Prediction>,
  ): Promise<Prediction> {
    const prediction = await this.predictionModel
      .findOneAndUpdate({ userId, matchId }, data, { returnDocument: 'after', upsert: true })
      .exec();
    return this.toEntity(prediction);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.predictionModel.findByIdAndDelete(id).exec();
    return !!result;
  }

  async findByMatchIds(matchIds: string[]): Promise<Prediction[]> {
    const predictions = await this.predictionModel
      .find({ matchId: { $in: matchIds } })
      .exec();
    return predictions.map((prediction) => this.toEntity(prediction));
  }

  private toEntity(doc: any): Prediction {
    return {
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      matchId: doc.matchId.toString(),
      predictedHomeScore: doc.predictedHomeScore,
      predictedAwayScore: doc.predictedAwayScore,
      tiebreakWinner: doc.tiebreakWinner ?? null,
      lockedAt: doc.lockedAt,
      canEditUntil: doc.canEditUntil,
      pointsAwarded: doc.pointsAwarded,
      exactScoreHit: doc.exactScoreHit,
      outcomeHit: doc.outcomeHit,
      createdAt: doc.createdAt || new Date(),
      updatedAt: doc.updatedAt || new Date(),
    };
  }
}

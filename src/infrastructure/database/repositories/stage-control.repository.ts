import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IStageControlRepository } from '../../../domain/repositories';
import { StageControl, MatchStage } from '../../../domain/entities';
import { StageControlDocument } from '../schemas/stage-control.schema';

@Injectable()
export class StageControlRepository implements IStageControlRepository {
  constructor(
    @InjectModel(StageControlDocument.name)
    private readonly stageControlModel: Model<StageControlDocument>,
  ) {}

  async create(
    data: Omit<StageControl, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<StageControl> {
    const stageControl = new this.stageControlModel(data);
    const saved = await stageControl.save();
    return this.toEntity(saved);
  }

  async findById(id: string): Promise<StageControl | null> {
    const stageControl = await this.stageControlModel.findById(id).exec();
    return stageControl ? this.toEntity(stageControl) : null;
  }

  async findByStage(stage: MatchStage): Promise<StageControl | null> {
    const stageControl = await this.stageControlModel
      .findOne({ stage })
      .exec();
    return stageControl ? this.toEntity(stageControl) : null;
  }

  async findAll(): Promise<StageControl[]> {
    const stageControls = await this.stageControlModel
      .find()
      .sort({ displayOrder: 1 })
      .exec();
    return stageControls.map((stageControl) => this.toEntity(stageControl));
  }

  async findOpen(): Promise<StageControl[]> {
    const stageControls = await this.stageControlModel
      .find({ isOpen: true })
      .exec();
    return stageControls.map((stageControl) => this.toEntity(stageControl));
  }

  async update(
    id: string,
    data: Partial<StageControl>,
  ): Promise<StageControl | null> {
    const stageControl = await this.stageControlModel
      .findByIdAndUpdate(id, data, { new: true })
      .exec();
    return stageControl ? this.toEntity(stageControl) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.stageControlModel.findByIdAndDelete(id).exec();
    return !!result;
  }

  private toEntity(doc: any): StageControl {
    return {
      id: doc._id.toString(),
      stage: doc.stage,
      isOpen: doc.isOpen,
      openedAt: doc.openedAt,
      closedAt: doc.closedAt,
      allowPredictions: doc.allowPredictions,
      displayOrder: doc.displayOrder,
      createdAt: doc.createdAt || new Date(),
      updatedAt: doc.updatedAt || new Date(),
    };
  }
}

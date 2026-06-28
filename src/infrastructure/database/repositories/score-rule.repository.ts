import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IScoreRuleRepository } from '../../../domain/repositories';
import { ScoreRule, MatchStage } from '../../../domain/entities';
import { ScoreRuleDocument } from '../schemas/score-rule.schema';

@Injectable()
export class ScoreRuleRepository implements IScoreRuleRepository {
  constructor(
    @InjectModel(ScoreRuleDocument.name)
    private readonly scoreRuleModel: Model<ScoreRuleDocument>,
  ) {}

  async create(
    data: Omit<ScoreRule, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ScoreRule> {
    const scoreRule = new this.scoreRuleModel(data);
    const saved = await scoreRule.save();
    return this.toEntity(saved);
  }

  async findById(id: string): Promise<ScoreRule | null> {
    const scoreRule = await this.scoreRuleModel.findById(id).exec();
    return scoreRule ? this.toEntity(scoreRule) : null;
  }

  async findByStage(stage: MatchStage): Promise<ScoreRule | null> {
    const scoreRule = await this.scoreRuleModel.findOne({ stage }).exec();
    return scoreRule ? this.toEntity(scoreRule) : null;
  }

  async findAll(): Promise<ScoreRule[]> {
    const scoreRules = await this.scoreRuleModel.find().exec();
    return scoreRules.map((scoreRule) => this.toEntity(scoreRule));
  }

  async findActive(): Promise<ScoreRule[]> {
    const scoreRules = await this.scoreRuleModel.find({ active: true }).exec();
    return scoreRules.map((scoreRule) => this.toEntity(scoreRule));
  }

  async update(
    id: string,
    data: Partial<ScoreRule>,
  ): Promise<ScoreRule | null> {
    const scoreRule = await this.scoreRuleModel
      .findByIdAndUpdate(id, data, { returnDocument: 'after' })
      .exec();
    return scoreRule ? this.toEntity(scoreRule) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.scoreRuleModel.findByIdAndDelete(id).exec();
    return !!result;
  }

  private toEntity(doc: any): ScoreRule {
    return {
      id: doc._id.toString(),
      stage: doc.stage,
      basePoints: doc.basePoints,
      exactScoreBonus: doc.exactScoreBonus,
      active: doc.active,
      createdAt: doc.createdAt || new Date(),
      updatedAt: doc.updatedAt || new Date(),
    };
  }
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMatchRepository } from '../../../domain/repositories';
import { Match, MatchStage, MatchStatus } from '../../../domain/entities';
import { MatchDocument } from '../schemas/match.schema';

@Injectable()
export class MatchRepository implements IMatchRepository {
  constructor(
    @InjectModel(MatchDocument.name)
    private readonly matchModel: Model<MatchDocument>,
  ) {}

  async create(data: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>): Promise<Match> {
    const match = new this.matchModel(data);
    const saved = await match.save();
    return this.toEntity(saved);
  }

  async findById(id: string): Promise<Match | null> {
    const match = await this.matchModel.findById(id).exec();
    return match ? this.toEntity(match) : null;
  }

  async findByExternalId(externalId: string): Promise<Match | null> {
    const match = await this.matchModel.findOne({ externalId }).exec();
    return match ? this.toEntity(match) : null;
  }

  async findAll(): Promise<Match[]> {
    const matches = await this.matchModel.find().sort({ kickoffAt: 1 }).exec();
    return matches.map((match) => this.toEntity(match));
  }

  async findByStage(stage: MatchStage): Promise<Match[]> {
    const matches = await this.matchModel
      .find({ stage })
      .sort({ kickoffAt: 1 })
      .exec();
    return matches.map((match) => this.toEntity(match));
  }

  async findByStageAndGroup(stage: MatchStage, group: string): Promise<Match[]> {
    const matches = await this.matchModel
      .find({ stage, group })
      .sort({ round: 1, kickoffAt: 1 })
      .exec();
    return matches.map((match) => this.toEntity(match));
  }

  async findByStatus(status: MatchStatus): Promise<Match[]> {
    const matches = await this.matchModel
      .find({ status })
      .sort({ kickoffAt: 1 })
      .exec();
    return matches.map((match) => this.toEntity(match));
  }

  async findUpcoming(limit: number = 10): Promise<Match[]> {
    const now = new Date();
    const matches = await this.matchModel
      .find({ kickoffAt: { $gt: now } })
      .sort({ kickoffAt: 1 })
      .limit(limit)
      .exec();
    return matches.map((match) => this.toEntity(match));
  }

  /**
   * Returns matches that need a post-match API sync.
   *
   * Criteria:
   *  1. Status is still scheduled or live.
   *  2. Kickoff happened at least `minutesAfterKickoff` minutes ago.
   *  3. Last sync was more than `recheckIntervalMinutes` ago.
   *  4. externalId is a pure numeric string (i.e. came from the external API,
   *     not a locally-generated "wc26-*" or "generated-*" id).
   *  5. (Optional) Only matches in the given stages.
   */
  async findNeedingPostMatchSync(
    minutesAfterKickoff = 130,
    recheckIntervalMinutes = 60,
    stages?: MatchStage[],
  ): Promise<Match[]> {
    const now = new Date();
    const kickoffThreshold = new Date(now.getTime() - minutesAfterKickoff * 60_000);
    const syncThreshold = new Date(now.getTime() - recheckIntervalMinutes * 60_000);

    const filter: Record<string, unknown> = {
      status: { $in: [MatchStatus.SCHEDULED, MatchStatus.LIVE] },
      kickoffAt: { $lte: kickoffThreshold },
      syncedAt: { $lte: syncThreshold },
      // Only API-provided fixtures (numeric ids)
      externalId: { $regex: /^\d+$/ },
    };

    if (stages && stages.length > 0) {
      filter.stage = { $in: stages };
    }

    const matches = await this.matchModel
      .find(filter)
      .sort({ kickoffAt: 1 })
      .exec();

    return matches.map((match) => this.toEntity(match));
  }

  async update(id: string, data: Partial<Match>): Promise<Match | null> {
    const match = await this.matchModel
      .findByIdAndUpdate(id, data, { returnDocument: 'after' })
      .exec();
    return match ? this.toEntity(match) : null;
  }

  async upsertByExternalId(
    externalId: string,
    data: Partial<Match>,
  ): Promise<Match> {
    // Strip undefined values so existing DB fields (e.g. manually-set team names)
    // are not overwritten when the API returns null for those fields.
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined),
    );
    const match = await this.matchModel
      .findOneAndUpdate({ externalId }, { $set: cleanData }, { returnDocument: 'after', upsert: true })
      .exec();
    return this.toEntity(match);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.matchModel.findByIdAndDelete(id).exec();
    return !!result;
  }

  /**
   * Deletes all locally-seeded placeholder matches (externalId starting with
   * "wc26-" or "generated-"). Called after a successful full API sync so that
   * the seeded static data is replaced by live API data, preventing
   * double-counting in standings calculations.
   */
  async deleteSeedPlaceholders(): Promise<number> {
    const result = await this.matchModel
      .deleteMany({ externalId: { $regex: /^(wc26-|generated-)/ } })
      .exec();
    return result.deletedCount ?? 0;
  }

  /**
   * Deletes all generated (non-API) knockout matches for a given stage.
   * Used when regenerating the bracket format (e.g. R16 → R32).
   */
  async deleteGeneratedByStage(stage: MatchStage): Promise<number> {
    const result = await this.matchModel
      .deleteMany({ externalId: { $regex: /^generated-/ }, stage })
      .exec();
    return result.deletedCount ?? 0;
  }

  private toEntity(doc: any): Match {
    return {
      id: doc._id.toString(),
      externalId: doc.externalId,
      competition: doc.competition,
      stage: doc.stage,
      group: doc.group,
      round: doc.round,
      roundLabel: doc.roundLabel,
      homeTeam: doc.homeTeam,
      homeTeamLogo: doc.homeTeamLogo,
      awayTeam: doc.awayTeam,
      awayTeamLogo: doc.awayTeamLogo,
      kickoffAt: doc.kickoffAt,
      status: doc.status,
      officialHomeScore: doc.officialHomeScore,
      officialAwayScore: doc.officialAwayScore,
      manualHomeScore: doc.manualHomeScore,
      manualAwayScore: doc.manualAwayScore,
      useManualScore: doc.useManualScore,
      winner: doc.winner,
      syncedAt: doc.syncedAt,
      createdAt: doc.createdAt || new Date(),
      updatedAt: doc.updatedAt || new Date(),
    };
  }
}

import { Injectable } from '@nestjs/common';
import {
  MatchRepository,
  PredictionRepository,
  UserRepository,
} from '../../../infrastructure/database/repositories';
import { MatchStatus } from '../../../domain/entities';

export interface DashboardStats {
  totalMatches: number;
  scheduledMatches: number;
  liveMatches: number;
  finishedMatches: number;
  totalPredictions: number;
  totalUsers: number;
  topScorer: {
    userId: string;
    userName: string;
    points: number;
  } | null;
}

@Injectable()
export class GetDashboardStatsUseCase {
  constructor(
    private readonly matchRepository: MatchRepository,
    private readonly predictionRepository: PredictionRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(): Promise<DashboardStats> {
    const [
      allMatches,
      scheduledMatches,
      liveMatches,
      finishedMatches,
      allPredictions,
      allUsers,
    ] = await Promise.all([
      this.matchRepository.findAll(),
      this.matchRepository.findByStatus(MatchStatus.SCHEDULED),
      this.matchRepository.findByStatus(MatchStatus.LIVE),
      this.matchRepository.findByStatus(MatchStatus.FINISHED),
      this.predictionRepository.findAll(),
      this.userRepository.findAll(),
    ]);

    // Calculate top scorer
    const userPoints = new Map<string, number>();
    for (const prediction of allPredictions) {
      if (prediction.pointsAwarded !== null) {
        const current = userPoints.get(prediction.userId) || 0;
        userPoints.set(prediction.userId, current + prediction.pointsAwarded);
      }
    }

    let topScorer: {
      userId: string;
      userName: string;
      points: number;
    } | null = null;
    if (userPoints.size > 0) {
      const topEntry = Array.from(userPoints.entries()).sort(
        (a, b) => b[1] - a[1],
      )[0];
      const user = await this.userRepository.findById(topEntry[0]);
      topScorer = {
        userId: topEntry[0],
        userName: user?.name || 'Unknown',
        points: topEntry[1],
      };
    }

    return {
      totalMatches: allMatches.length,
      scheduledMatches: scheduledMatches.length,
      liveMatches: liveMatches.length,
      finishedMatches: finishedMatches.length,
      totalPredictions: allPredictions.length,
      totalUsers: allUsers.length,
      topScorer,
    };
  }
}

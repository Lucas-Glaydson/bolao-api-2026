import { Injectable } from '@nestjs/common';
import {
  PredictionRepository,
  UserRepository,
} from '../../../infrastructure/database/repositories';

export interface RankingEntry {
  userId: string;
  userName: string;
  userEmail: string;
  totalPoints: number;
  exactScores: number;
  outcomeHits: number;
  totalPredictions: number;
}

@Injectable()
export class GetRankingUseCase {
  constructor(
    private readonly predictionRepository: PredictionRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(): Promise<RankingEntry[]> {
    // Fetch all data in parallel — single query each, no N+1
    const [allPredictions, allUsers] = await Promise.all([
      this.predictionRepository.findAll(),
      this.userRepository.findAll(),
    ]);

    const userLookup = new Map(allUsers.map((u) => [u.id, u]));

    // Group by user
    const userMap = new Map<string, RankingEntry>();

    for (const prediction of allPredictions) {
      if (!userMap.has(prediction.userId)) {
        const user = userLookup.get(prediction.userId);
        userMap.set(prediction.userId, {
          userId: prediction.userId,
          userName: user?.name || 'Unknown',
          userEmail: user?.email || 'Unknown',
          totalPoints: 0,
          exactScores: 0,
          outcomeHits: 0,
          totalPredictions: 0,
        });
      }

      const entry = userMap.get(prediction.userId);
      if (!entry) continue;
      
      entry.totalPredictions++;

      if (prediction.pointsAwarded !== null) {
        entry.totalPoints += prediction.pointsAwarded;
        if (prediction.exactScoreHit) entry.exactScores++;
        if (prediction.outcomeHit) entry.outcomeHits++;
      }
    }

    // Convert to array and sort
    const ranking = Array.from(userMap.values()).sort((a, b) => {
      // Sort by total points (descending)
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      // Tie-breaker: exact scores
      if (b.exactScores !== a.exactScores) {
        return b.exactScores - a.exactScores;
      }
      // Tie-breaker: outcome hits
      return b.outcomeHits - a.outcomeHits;
    });

    return ranking;
  }
}

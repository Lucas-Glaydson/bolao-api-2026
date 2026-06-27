export interface Prediction {
  id: string;
  userId: string;
  matchId: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  tiebreakWinner: 'home' | 'away' | null;
  lockedAt: Date | null;
  canEditUntil: Date;
  pointsAwarded: number | null;
  exactScoreHit: boolean;
  outcomeHit: boolean;
  createdAt: Date;
  updatedAt: Date;
}

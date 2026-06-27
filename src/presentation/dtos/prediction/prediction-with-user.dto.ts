export class PredictionWithUserDto {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  matchId: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  tiebreakWinner: 'home' | 'away' | null;
  pointsAwarded: number | null;
  exactScoreHit: boolean;
  outcomeHit: boolean;
  createdAt: Date;
}

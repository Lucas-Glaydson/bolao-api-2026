export class RankingEntryDto {
  userId: string;
  userName: string;
  userEmail: string;
  totalPoints: number;
  exactScores: number;
  outcomeHits: number;
  totalPredictions: number;
  position?: number;
}

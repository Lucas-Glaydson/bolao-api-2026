export class DashboardStatsDto {
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

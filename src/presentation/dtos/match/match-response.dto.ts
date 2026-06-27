export class MatchResponseDto {
  id: string;
  externalId: string;
  competition: string;
  stage: string;
  group?: string;
  round?: number;
  roundLabel: string;
  homeTeam: string;
  homeTeamLogo?: string;
  awayTeam: string;
  awayTeamLogo?: string;
  kickoffAt: Date;
  status: string;
  officialHomeScore: number | null;
  officialAwayScore: number | null;
  winner: string | null;
  canPredict: boolean;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

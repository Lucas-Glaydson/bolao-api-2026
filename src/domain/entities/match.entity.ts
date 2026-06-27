export enum MatchStatus {
  SCHEDULED = 'scheduled',
  LIVE = 'live',
  FINISHED = 'finished',
  POSTPONED = 'postponed',
  CANCELLED = 'cancelled',
}

export enum MatchStage {
  GROUP_STAGE = 'group_stage',
  ROUND_OF_32 = 'round_of_32',
  ROUND_OF_16 = 'round_of_16',
  QUARTER_FINALS = 'quarter_finals',
  SEMI_FINALS = 'semi_finals',
  FINAL = 'final',
}

export type GroupLabel = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L';

export enum MatchWinner {
  HOME = 'home',
  AWAY = 'away',
  DRAW = 'draw',
}

export interface Match {
  id: string;
  externalId: string;
  competition: string;
  stage: MatchStage;
  group?: GroupLabel;
  round?: number;
  roundLabel: string;
  homeTeam: string;
  homeTeamLogo?: string;
  awayTeam: string;
  awayTeamLogo?: string;
  kickoffAt: Date;
  status: MatchStatus;
  officialHomeScore: number | null;
  officialAwayScore: number | null;
  manualHomeScore?: number | null;
  manualAwayScore?: number | null;
  useManualScore?: boolean;
  winner: MatchWinner | null;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

import { IsOptional, IsDateString, IsString, IsInt, Min, IsEnum, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MatchStatus, MatchWinner } from '../../../domain/entities';

export class UpdateMatchDto {
  @ApiPropertyOptional({ example: '2026-07-01T21:00:00Z', description: 'Nova data/hora de início (ISO 8601 UTC)' })
  @IsOptional()
  @IsDateString()
  kickoffAt?: string;

  @ApiPropertyOptional({ example: 'scheduled', enum: MatchStatus })
  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @ApiPropertyOptional({ example: 2, description: 'Placar oficial — gols do mandante' })
  @IsOptional()
  @IsInt()
  @Min(0)
  officialHomeScore?: number;

  @ApiPropertyOptional({ example: 1, description: 'Placar oficial — gols do visitante' })
  @IsOptional()
  @IsInt()
  @Min(0)
  officialAwayScore?: number;

  @ApiPropertyOptional({
    example: 'home',
    enum: MatchWinner,
    description: 'Vencedor no tempo regulamentar. Se não informado, é calculado automaticamente a partir do placar.',
  })
  @IsOptional()
  @IsEnum(MatchWinner)
  winner?: MatchWinner;

  @ApiPropertyOptional({
    example: 'away',
    enum: ['home', 'away'],
    description: 'Vencedor nos pênaltis (apenas para jogos decididos nos pênaltis).',
  })
  @IsOptional()
  @IsIn(['home', 'away'])
  penaltyWinner?: 'home' | 'away';

  @ApiPropertyOptional({ example: 'Brasil', description: 'Nome do time mandante (corrige nomes errados vindos da API).' })
  @IsOptional()
  @IsString()
  homeTeam?: string;

  @ApiPropertyOptional({ example: 'Argentina', description: 'Nome do time visitante (corrige nomes errados vindos da API).' })
  @IsOptional()
  @IsString()
  awayTeam?: string;
}

import { IsOptional, IsDateString, IsString, IsInt, Min, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MatchStatus } from '../../../domain/entities';

export class UpdateMatchDto {
  @ApiPropertyOptional({ example: '2026-07-01T21:00:00Z', description: 'Nova data/hora de início (ISO 8601 UTC)' })
  @IsOptional()
  @IsDateString()
  kickoffAt?: string;

  @ApiPropertyOptional({ example: 'scheduled', enum: MatchStatus })
  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  officialHomeScore?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  officialAwayScore?: number;
}

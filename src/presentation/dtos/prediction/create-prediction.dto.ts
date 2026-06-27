import { IsInt, IsNotEmpty, Min, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePredictionDto {
  @ApiProperty({ example: 2, description: 'Placar previsto para o time da casa', minimum: 0 })
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  predictedHomeScore: number;

  @ApiProperty({ example: 1, description: 'Placar previsto para o time visitante', minimum: 0 })
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  predictedAwayScore: number;

  @ApiPropertyOptional({
    example: 'home',
    description: 'Quem avança em caso de empate (obrigatório para fases eliminatórias quando o palpite for empate)',
    enum: ['home', 'away'],
  })
  @IsOptional()
  @IsIn(['home', 'away'])
  tiebreakWinner?: 'home' | 'away';
}

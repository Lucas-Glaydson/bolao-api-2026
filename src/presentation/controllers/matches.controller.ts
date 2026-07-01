import {
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Body,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { UserRole, MatchStage, MatchWinner, Match } from '../../domain/entities';
import { MatchResponseDto, SyncMatchesResponseDto, UpdateMatchDto } from '../dtos/match';
import {
  SyncMatchesUseCase,
  GetAllMatchesUseCase,
  GetMatchByIdUseCase,
  GetMatchesByStageUseCase,
  GetUpcomingMatchesUseCase,
  CalculateGroupStandingsUseCase,
  GenerateKnockoutMatchesUseCase,
  AutoCalculatePointsUseCase,
} from '../../application/use-cases/match';
import { CalculatePointsUseCase } from '../../application/use-cases/ranking';
import { MatchRepository } from '../../infrastructure/database/repositories';

@ApiTags('matches')
@ApiBearerAuth('JWT-auth')
@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(
    private readonly syncMatchesUseCase: SyncMatchesUseCase,
    private readonly getAllMatchesUseCase: GetAllMatchesUseCase,
    private readonly getMatchByIdUseCase: GetMatchByIdUseCase,
    private readonly getMatchesByStageUseCase: GetMatchesByStageUseCase,
    private readonly getUpcomingMatchesUseCase: GetUpcomingMatchesUseCase,
    private readonly calculateStandingsUseCase: CalculateGroupStandingsUseCase,
    private readonly generateKnockoutUseCase: GenerateKnockoutMatchesUseCase,
    private readonly matchRepository: MatchRepository,
    private readonly calculatePointsUseCase: CalculatePointsUseCase,
    private readonly autoCalculatePointsUseCase: AutoCalculatePointsUseCase,
  ) {}

  @Post('sync')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Sync matches from external API (Admin only)' })
  async sync(): Promise<SyncMatchesResponseDto> {
    const result = await this.syncMatchesUseCase.execute();
    return {
      ...result,
      message: `Successfully synced ${result.synced} matches with ${result.errors} errors`,
    };
  }

  @Get('standings/groups')
  @ApiOperation({ summary: 'Get group stage standings with qualified teams' })
  async getGroupStandings() {
    const standings = await this.calculateStandingsUseCase.execute();
    return {
      standings,
      message: 'Group standings calculated successfully',
    };
  }

  @Post('generate-knockout')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Generate knockout matches from group standings (Admin only)' })
  async generateKnockout() {
    const result = await this.generateKnockoutUseCase.execute();
    return {
      ...result,
      message: `Generated/updated knockout matches: ${result.generated} new, ${result.updated} updated`,
    };
  }

  @Get()
  async findAll(): Promise<MatchResponseDto[]> {
    let matches = await this.getAllMatchesUseCase.execute();
    const hasUnknown = matches.some((m) => m.homeTeam === 'Unknown' || m.awayTeam === 'Unknown');
    if (hasUnknown) {
      await this.syncMatchesUseCase.syncUnknownMatches();
      matches = await this.getAllMatchesUseCase.execute();
    }
    return matches.map((match) => this.toResponseDto(match));
  }

  @Get('upcoming/deadlines')
  async getUpcoming(
    @Query('limit') limit?: number,
  ): Promise<MatchResponseDto[]> {
    const matches = await this.getUpcomingMatchesUseCase.execute(limit);
    return matches.map((match) => this.toResponseDto(match));
  }

  @Get('stage/:stage')
  async getByStage(@Param('stage') stage: MatchStage): Promise<MatchResponseDto[]> {
    let matches = await this.getMatchesByStageUseCase.execute(stage);
    const hasUnknown = matches.some((m) => m.homeTeam === 'Unknown' || m.awayTeam === 'Unknown');
    if (hasUnknown) {
      await this.syncMatchesUseCase.syncUnknownMatches();
      matches = await this.getMatchesByStageUseCase.execute(stage);
    }
    return matches.map((match) => this.toResponseDto(match));
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<MatchResponseDto> {
    const match = await this.getMatchByIdUseCase.execute(id);
    return this.toResponseDto(match);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Atualizar dados de uma partida (Admin only)',
    description:
      'Permite corrigir placar, status, horário, times e vencedor. ' +
      'Quando o placar oficial é alterado, os pontos de todos os palpites dessa partida ' +
      'são recalculados automaticamente.',
  })
  @ApiBody({ type: UpdateMatchDto })
  async updateMatch(
    @Param('id') id: string,
    @Body() dto: UpdateMatchDto,
  ): Promise<MatchResponseDto> {
    const existing = await this.matchRepository.findById(id);
    if (!existing) throw new NotFoundException('Match not found');

    // Derive winner from the scores if both are provided and winner not explicitly set
    const homeScore = dto.officialHomeScore ?? existing.officialHomeScore;
    const awayScore = dto.officialAwayScore ?? existing.officialAwayScore;

    let derivedWinner: MatchWinner | null = existing.winner;
    if (dto.winner !== undefined) {
      derivedWinner = dto.winner;
    } else if (homeScore !== null && awayScore !== null &&
               (dto.officialHomeScore !== undefined || dto.officialAwayScore !== undefined)) {
      if (homeScore > awayScore) derivedWinner = MatchWinner.HOME;
      else if (awayScore > homeScore) derivedWinner = MatchWinner.AWAY;
      else derivedWinner = MatchWinner.DRAW;
    }

    const updated = await this.matchRepository.update(id, {
      ...(dto.kickoffAt !== undefined && { kickoffAt: new Date(dto.kickoffAt) }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.officialHomeScore !== undefined && { officialHomeScore: dto.officialHomeScore }),
      ...(dto.officialAwayScore !== undefined && { officialAwayScore: dto.officialAwayScore }),
      ...(derivedWinner !== undefined && { winner: derivedWinner }),
      ...(dto.penaltyWinner !== undefined && { penaltyWinner: dto.penaltyWinner as MatchWinner }),
      ...(dto.homeTeam !== undefined && { homeTeam: dto.homeTeam }),
      ...(dto.awayTeam !== undefined && { awayTeam: dto.awayTeam }),
    });

    if (!updated) throw new NotFoundException('Match not found after update');

    // If scores or status changed, recalculate points and reset cache
    const scoresChanged =
      dto.officialHomeScore !== undefined ||
      dto.officialAwayScore !== undefined ||
      dto.winner !== undefined ||
      dto.penaltyWinner !== undefined ||
      dto.status === 'finished';

    if (scoresChanged) {
      this.autoCalculatePointsUseCase.resetCache();
      try {
        const calc = await this.calculatePointsUseCase.executeForMatch(id);
        if (calc.processed > 0) {
          // Also log so it's visible in server logs
          console.log(`Admin update: recalculated ${calc.processed} predictions for match ${id}`);
        }
      } catch {
        // Non-fatal — points can be recalculated later via /ranking/recalculate
      }
    }

    return this.toResponseDto(updated);
  }

  @Post(':id/recalculate-points')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Forçar recálculo de pontos de uma partida específica (Admin only)',
    description: 'Recalcula os pontos de todos os palpites de uma partida, ignorando valores já calculados.',
  })
  async recalculateMatchPoints(
    @Param('id') id: string,
  ): Promise<{ processed: number; errors: number; message: string }> {
    const match = await this.matchRepository.findById(id);
    if (!match) throw new NotFoundException('Match not found');

    this.autoCalculatePointsUseCase.resetCache();
    const result = await this.calculatePointsUseCase.executeForMatch(id);
    return {
      ...result,
      message: `Recalculated points for ${result.processed} predictions on match ${match.homeTeam} vs ${match.awayTeam}`,
    };
  }

  private toResponseDto(match: Match): MatchResponseDto {
    const now = new Date();
    const oneHourBefore = new Date(match.kickoffAt.getTime() - 60 * 60 * 1000);
    const teamsKnown = (t: string) => !!t && !t.startsWith('TBD') && t !== 'Unknown';
    const canPredict =
      teamsKnown(match.homeTeam) &&
      teamsKnown(match.awayTeam) &&
      now < oneHourBefore;

    return {
      id: match.id,
      externalId: match.externalId,
      competition: match.competition,
      stage: match.stage,
      group: match.group,
      round: match.round,
      roundLabel: match.roundLabel,
      homeTeam: match.homeTeam,
      homeTeamLogo: match.homeTeamLogo,
      awayTeam: match.awayTeam,
      awayTeamLogo: match.awayTeamLogo,
      kickoffAt: match.kickoffAt,
      status: match.status,
      officialHomeScore: match.officialHomeScore,
      officialAwayScore: match.officialAwayScore,
      winner: match.winner,
      penaltyWinner: match.penaltyWinner as 'home' | 'away' | null,
      canPredict,
      syncedAt: match.syncedAt,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
    };
  }
}

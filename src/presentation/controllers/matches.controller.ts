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
import { UserRole, MatchStage, Match } from '../../domain/entities';
import { MatchResponseDto, SyncMatchesResponseDto, UpdateMatchDto } from '../dtos/match';
import {
  SyncMatchesUseCase,
  GetAllMatchesUseCase,
  GetMatchByIdUseCase,
  GetMatchesByStageUseCase,
  GetUpcomingMatchesUseCase,
  CalculateGroupStandingsUseCase,
  GenerateKnockoutMatchesUseCase,
} from '../../application/use-cases/match';
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
  @ApiOperation({ summary: 'Atualizar dados de uma partida (Admin only)' })
  @ApiBody({ type: UpdateMatchDto })
  async updateMatch(
    @Param('id') id: string,
    @Body() dto: UpdateMatchDto,
  ): Promise<MatchResponseDto> {
    const existing = await this.matchRepository.findById(id);
    if (!existing) throw new NotFoundException('Match not found');

    const updated = await this.matchRepository.update(id, {
      ...(dto.kickoffAt !== undefined && { kickoffAt: new Date(dto.kickoffAt) }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.officialHomeScore !== undefined && { officialHomeScore: dto.officialHomeScore }),
      ...(dto.officialAwayScore !== undefined && { officialAwayScore: dto.officialAwayScore }),
    });

    if (!updated) throw new NotFoundException('Match not found after update');
    return this.toResponseDto(updated);
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
      canPredict,
      syncedAt: match.syncedAt,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
    };
  }
}

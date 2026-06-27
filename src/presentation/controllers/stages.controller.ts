import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { UserRole, MatchStage } from '../../domain/entities';
import { StageControlDto } from '../dtos/ranking';
import {
  OpenStageUseCase,
  CloseStageUseCase,
  GetAllStagesUseCase,
} from '../../application/use-cases/ranking';

@ApiTags('stages')
@ApiBearerAuth('JWT-auth')
@Controller('stages')
@UseGuards(JwtAuthGuard)
export class StagesController {
  constructor(
    private readonly openStageUseCase: OpenStageUseCase,
    private readonly closeStageUseCase: CloseStageUseCase,
    private readonly getAllStagesUseCase: GetAllStagesUseCase,
  ) {}

  @Get()
  async getAll(): Promise<StageControlDto[]> {
    const stages = await this.getAllStagesUseCase.execute();
    return stages.map((stage) => ({
      id: stage.id,
      stage: stage.stage,
      isOpen: stage.isOpen,
      openedAt: stage.openedAt,
      closedAt: stage.closedAt,
      allowPredictions: stage.allowPredictions,
      displayOrder: stage.displayOrder,
    }));
  }

  @Patch(':stage/open')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async openStage(@Param('stage') stage: MatchStage): Promise<StageControlDto> {
    const stageControl = await this.openStageUseCase.execute(stage);
    if (!stageControl) {
      throw new Error('Stage control not found');
    }
    return {
      id: stageControl.id,
      stage: stageControl.stage,
      isOpen: stageControl.isOpen,
      openedAt: stageControl.openedAt,
      closedAt: stageControl.closedAt,
      allowPredictions: stageControl.allowPredictions,
      displayOrder: stageControl.displayOrder,
    };
  }

  @Patch(':stage/close')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async closeStage(@Param('stage') stage: MatchStage): Promise<StageControlDto> {
    const stageControl = await this.closeStageUseCase.execute(stage);
    if (!stageControl) {
      throw new Error('Stage control not found');
    }
    return {
      id: stageControl.id,
      stage: stageControl.stage,
      isOpen: stageControl.isOpen,
      openedAt: stageControl.openedAt,
      closedAt: stageControl.closedAt,
      allowPredictions: stageControl.allowPredictions,
      displayOrder: stageControl.displayOrder,
    };
  }
}

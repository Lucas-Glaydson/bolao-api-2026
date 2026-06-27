import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { UserRole } from '../../domain/entities';
import { CreateUserDto, UserResponseDto } from '../dtos/user';
import {
  CreateUserUseCase,
  GetAllUsersUseCase,
  GetUserByIdUseCase,
} from '../../application/use-cases/user';

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly getAllUsersUseCase: GetAllUsersUseCase,
    private readonly getUserByIdUseCase: GetUserByIdUseCase,
  ) {}

  @Post()
  @Public()
  @ApiOperation({ summary: 'Criar novo usuário' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: 'Usuário criado com sucesso' })
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.createUserUseCase.execute(
      createUserDto.name,
      createUserDto.email,
      createUserDto.password,
      createUserDto.role,
    );

    return this.toResponseDto(user);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.getAllUsersUseCase.execute();
    return users.map((user) => this.toResponseDto(user));
  }

  @Get('me')
  async getProfile(@CurrentUser() user: any): Promise<UserResponseDto> {
    const userEntity = await this.getUserByIdUseCase.execute(user.id);
    return this.toResponseDto(userEntity);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    const user = await this.getUserByIdUseCase.execute(id);
    return this.toResponseDto(user);
  }

  private toResponseDto(user: any): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

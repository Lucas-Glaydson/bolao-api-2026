import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../domain/entities';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);

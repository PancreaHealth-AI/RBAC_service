import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsDateString, IsString, IsEnum } from 'class-validator';
import { ScopeType } from '@database/entities/role.entity';

export class UpdateRoleAssignmentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ enum: ScopeType, required: false })
  @IsOptional()
  @IsEnum(ScopeType)
  scopeType?: ScopeType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  scopeId?: string;
}
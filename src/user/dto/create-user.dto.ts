import { IsString, IsEnum, IsOptional } from 'class-validator';
import { PlanType } from '../user.entity.js';

export class CreateUserDto {
  @IsString()
  phone: string;

  @IsOptional()
  @IsEnum(PlanType)
  plan_type?: PlanType;
}

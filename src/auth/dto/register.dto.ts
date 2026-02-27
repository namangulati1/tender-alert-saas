import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { PlanType } from '../../user/user.entity.js';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsEnum(PlanType)
  plan_type?: PlanType;
}

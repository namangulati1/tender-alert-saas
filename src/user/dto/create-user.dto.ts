import { IsString, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';
import { PlanType } from '../user.entity.js';

export class CreateUserDto {
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

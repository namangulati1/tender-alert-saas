import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PlanType, SubscriptionStatus } from '../user.entity.js';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(PlanType)
  plan_type?: PlanType;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  subscription_status?: SubscriptionStatus;
}

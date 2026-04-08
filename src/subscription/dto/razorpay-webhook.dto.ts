import { IsString, IsOptional } from 'class-validator';

export class RazorpayWebhookDto {
  @IsString()
  event: string;

  @IsOptional()
  payload: any;

  @IsOptional()
  account_id?: string;
}

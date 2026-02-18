import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';

export class CreateTenderDto {
  @IsString()
  source: string;

  @IsString()
  title: string;

  @IsString()
  raw_text: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  budget?: number;

  @IsOptional()
  @IsDateString()
  deadline?: string;
}

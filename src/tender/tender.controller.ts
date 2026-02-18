import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { TenderService } from './tender.service.js';

@Controller('tenders')
export class TenderController {
  constructor(private readonly tenderService: TenderService) {}

  @Get()
  findAll(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.tenderService.findAll(limit, offset);
  }

  @Get('recent')
  findRecent(
    @Query('hours', new DefaultValuePipe(24), ParseIntPipe) hours: number,
  ) {
    return this.tenderService.findRecent(hours);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenderService.findById(id);
  }
}

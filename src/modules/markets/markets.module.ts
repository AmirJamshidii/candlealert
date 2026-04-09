import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '../../config/config.module';
import { MarketsController } from './markets.controller';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [MarketsController],
})
export class MarketsModule {}

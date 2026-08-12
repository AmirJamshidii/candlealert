import { Module } from '@nestjs/common';
import { ChainlinkService } from './chainlink.service';
import { ConfigModule } from '../../config/config.module';

@Module({
  imports: [ConfigModule],
  providers: [ChainlinkService],
  exports: [ChainlinkService],
})
export class ChainlinkModule {}

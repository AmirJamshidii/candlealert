import { Module } from '@nestjs/common';
import { SignalService } from './signal.service';
import { SignalStateService } from './signal-state.service';
import { ConfigModule } from '../../config/config.module';
import { ChainlinkModule } from '../chainlink/chainlink.module';

@Module({
  imports: [ConfigModule, ChainlinkModule],
  providers: [SignalService, SignalStateService],
})
export class SignalModule {}

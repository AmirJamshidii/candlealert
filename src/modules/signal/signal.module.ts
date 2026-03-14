import { Module } from '@nestjs/common';
import { SignalService } from './signal.service';
import { SignalStateService } from './signal-state.service';
import { ConfigModule } from '../../config/config.module';

@Module({
  imports: [ConfigModule],
  providers: [SignalService, SignalStateService],
})
export class SignalModule {}

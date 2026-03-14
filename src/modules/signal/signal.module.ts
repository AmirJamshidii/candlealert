import { Module } from '@nestjs/common';
import { SignalService } from './signal.service';
import { SignalStateService } from './signal-state.service';

@Module({
  providers: [SignalService, SignalStateService],
})
export class SignalModule {}

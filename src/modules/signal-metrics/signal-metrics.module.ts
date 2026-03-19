import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SignalMetricsEntity } from './signal-metrics.entity';
import { SignalMetricsRepository } from './signal-metrics.repository';
import { SignalMetricsService } from './signal-metrics.service';

@Module({
  imports: [TypeOrmModule.forFeature([SignalMetricsEntity])],
  providers: [SignalMetricsService, SignalMetricsRepository],
  exports: [SignalMetricsService, SignalMetricsRepository],
})
export class SignalMetricsModule {}

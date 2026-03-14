import { Controller, Get, Query } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppConfig } from '../../config/app.config';
import { AlertRepository } from '../alert/alert.repository';
import { PolymarketWinnerRepository } from '../polymarket/polymarket-winner.repository';

@Controller('api')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly appConfig: AppConfig,
    private readonly alertRepo: AlertRepository,
    private readonly winnerRepo: PolymarketWinnerRepository,
  ) {}

  @Get('health')
  async health() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', timestamp: new Date().toISOString() };
    } catch {
      return { status: 'error', timestamp: new Date().toISOString() };
    }
  }

  @Get('config')
  config() {
    return {
      symbol: 'BTCUSDT',
      intervals: this.appConfig.intervals,
      polymarketWinnerCount: this.appConfig.polymarketWinnerCount,
    };
  }

  @Get('alerts')
  async alerts(@Query('limit') limit?: string) {
    return this.alertRepo.getRecent(limit ? parseInt(limit, 10) : 100);
  }

  @Get('winners')
  async winners(@Query('limit') limit?: string) {
    return this.winnerRepo.getRecent(limit ? parseInt(limit, 10) : 100);
  }
}

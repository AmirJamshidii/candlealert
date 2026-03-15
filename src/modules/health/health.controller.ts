import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppConfig } from '../../config/app.config';
import { AlertRepository } from '../alert/alert.repository';
import { PolymarketWinnerRepository } from '../polymarket/polymarket-winner.repository';

@ApiTags('health')
@Controller('api')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly appConfig: AppConfig,
    private readonly alertRepo: AlertRepository,
    private readonly winnerRepo: PolymarketWinnerRepository,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Database connectivity health check' })
  @ApiResponse({ status: 200, schema: { example: { status: 'ok', timestamp: '2024-01-01T00:00:00.000Z' } } })
  async health() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', timestamp: new Date().toISOString() };
    } catch {
      return { status: 'error', timestamp: new Date().toISOString() };
    }
  }

  @Get('config')
  @ApiOperation({ summary: 'Current app configuration (symbol, intervals, winner count)' })
  @ApiResponse({ status: 200, schema: { example: { symbol: 'BTCUSDT', intervals: ['5m', '15m', '1h'], polymarketWinnerCount: 10 } } })
  config() {
    return {
      symbol: 'BTCUSDT',
      intervals: this.appConfig.intervals,
      polymarketWinnerCount: this.appConfig.polymarketWinnerCount,
    };
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Recent alerts sent via Telegram' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max rows to return (default 100)' })
  @ApiResponse({ status: 200 })
  async alerts(@Query('limit') limit?: string) {
    return this.alertRepo.getRecent(limit ? parseInt(limit, 10) : 100);
  }

  @Get('winners')
  @ApiOperation({ summary: 'Recent Polymarket down-position holders' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max rows to return (default 100)' })
  @ApiResponse({ status: 200 })
  async winners(@Query('limit') limit?: string) {
    return this.winnerRepo.getRecent(limit ? parseInt(limit, 10) : 100);
  }
}

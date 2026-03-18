import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import {
  ErrorLogDto,
  HolderLeaderboardDto,
  SignalSummaryDto,
  SignalTimelineDto,
  WinnerLeaderboardDto,
} from './dto/analytics.dto';

@ApiTags('analytics')
@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('signals/summary')
  @ApiOperation({ summary: 'Alert count grouped by interval' })
  @ApiResponse({ status: 200, type: [SignalSummaryDto] })
  getSignalSummary() {
    return this.analyticsService.getSignalSummary();
  }

  @Get('signals/count')
  @ApiOperation({ summary: 'Total signal count, optionally filtered by a since timestamp' })
  @ApiQuery({ name: 'since', required: false, type: Number, description: 'Unix ms timestamp — count signals after this time (omit for all-time)' })
  @ApiResponse({ status: 200, schema: { example: { count: 123 } } })
  getSignalCount(@Query('since') since?: string) {
    return this.analyticsService.getSignalCount(since ? parseInt(since, 10) : undefined);
  }

  @Get('signals/timeline')
  @ApiOperation({ summary: 'Daily signal counts for the last N days' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to look back (default 7)' })
  @ApiResponse({ status: 200, type: [SignalTimelineDto] })
  getSignalTimeline(@Query('days') days?: string) {
    return this.analyticsService.getSignalTimeline(days ? parseInt(days, 10) : 7);
  }

  @Get('signals/heatmap')
  @ApiOperation({ summary: 'Signal count grouped by hour of day (UTC)' })
  @ApiResponse({ status: 200, schema: { example: [{ hour: 14, count: 12 }] } })
  getSignalHeatmap() {
    return this.analyticsService.getSignalHeatmap();
  }

  @Get('signals/directions')
  @ApiOperation({ summary: 'Signal count by direction (green_to_red / red_to_green) per interval' })
  @ApiResponse({ status: 200, schema: { example: [{ interval: '5m', direction: 'green_to_red', count: 42 }] } })
  getDirectionBreakdown() {
    return this.analyticsService.getDirectionBreakdown();
  }

  @Get('signals/:signalKey/candle')
  @ApiOperation({ summary: 'OHLCV data for a specific signal, fetched on-demand from Binance' })
  @ApiParam({ name: 'signalKey', example: '5m:1710000000000' })
  @ApiResponse({ status: 200, schema: { example: { open: 65000, high: 65500, low: 64800, close: 64900, volume: 12.5, bodySize: 100, wickRatio: 0.45 } } })
  async getCandleForSignal(@Param('signalKey') signalKey: string) {
    const candle = await this.analyticsService.getCandleForSignal(signalKey);
    if (!candle) throw new NotFoundException(`No candle data found for signal ${signalKey}`);
    return candle;
  }

  @Get('winners/leaderboard')
  @ApiOperation({ summary: 'Top wallets by cumulative position size' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max results (default 20)' })
  @ApiQuery({ name: 'interval', required: false, type: String, description: 'Filter by interval (e.g. 5m)' })
  @ApiResponse({ status: 200, type: [WinnerLeaderboardDto] })
  getWinnerLeaderboard(
    @Query('limit') limit?: string,
    @Query('interval') interval?: string,
  ) {
    return this.analyticsService.getWinnerLeaderboard(limit ? parseInt(limit, 10) : 20, interval);
  }

  @Get('winners/by-signal/:signalKey')
  @ApiOperation({ summary: 'Winners for one specific signal' })
  @ApiParam({ name: 'signalKey', example: '5m:1710000000000' })
  @ApiResponse({ status: 200, type: [WinnerLeaderboardDto] })
  getWinnersBySignal(@Param('signalKey') signalKey: string) {
    return this.analyticsService.getWinnersBySignal(signalKey);
  }

  @Get('holders/count')
  @ApiOperation({ summary: 'Count of distinct holder wallets, optionally filtered by a since timestamp' })
  @ApiQuery({ name: 'since', required: false, type: Number, description: 'Unix ms timestamp — count wallets after this time (omit for all-time)' })
  @ApiResponse({ status: 200, schema: { example: { count: 42 } } })
  getHolderCount(@Query('since') since?: string) {
    return this.analyticsService.getHolderCount(since ? parseInt(since, 10) : undefined);
  }

  @Get('btc/candles')
  @ApiOperation({ summary: 'Recent BTC/USDT candlestick data with signal markers' })
  @ApiQuery({ name: 'interval', required: false, type: String, description: 'Candle interval (default 5m)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of candles (default 200)' })
  @ApiResponse({ status: 200, schema: { example: { candles: [{ time: 1710000000, open: 65000, high: 65500, low: 64800, close: 64900 }], signals: [{ time: 1710000000, direction: 'green_to_red' }] } } })
  getBtcCandles(@Query('interval') interval?: string, @Query('limit') limit?: string) {
    return this.analyticsService.getBtcCandles(interval ?? '5m', limit ? parseInt(limit, 10) : 200);
  }

  @Get('holders/leaderboard')
  @ApiOperation({ summary: 'Top holders by appearances + total position over a time window' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Lookback window in days (default 30)' })
  @ApiQuery({ name: 'interval', required: false, type: String, description: 'Filter by interval (e.g. 5m)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max results (default 20)' })
  @ApiResponse({ status: 200, type: [HolderLeaderboardDto] })
  getHolderLeaderboard(
    @Query('days') days?: string,
    @Query('interval') interval?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.getHolderLeaderboard(
      days ? parseInt(days, 10) : 30,
      limit ? parseInt(limit, 10) : 20,
      interval,
    );
  }

  @Get('wallets/leaderboard')
  @ApiOperation({ summary: 'Top wallets by avg PnL across signals (requires position PnL data)' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Lookback window in days (default 30)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max results (default 20)' })
  @ApiQuery({ name: 'minAppearances', required: false, type: Number, description: 'Min signal appearances (default 3)' })
  @ApiResponse({ status: 200, schema: { example: [{ walletAddress: '0xabc', appearances: 5, avgPnl: 120.5, totalPnl: 602.5 }] } })
  getWinRateLeaderboard(
    @Query('days') days?: string,
    @Query('limit') limit?: string,
    @Query('minAppearances') minAppearances?: string,
  ) {
    return this.analyticsService.getWinRateLeaderboard(
      days ? parseInt(days, 10) : 30,
      limit ? parseInt(limit, 10) : 20,
      minAppearances ? parseInt(minAppearances, 10) : 3,
    );
  }

  @Get('wallets/top-suspects')
  @ApiOperation({ summary: 'Top suspect wallets ranked by composite score (signals + BTC focus + PnL + position size)' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Lookback window in days (default 30)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Candidate pool size (default 50)' })
  getTopSuspects(
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.getTopSuspects(
      days ? parseInt(days, 10) : 30,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('wallets/:address/profile')
  @ApiOperation({ summary: 'Polymarket portfolio profile for a wallet address' })
  @ApiParam({ name: 'address', example: '0xabc123' })
  @ApiResponse({ status: 200, schema: { example: { walletAddress: '0xabc', totalPositions: 15, totalCurrentValue: 5200, totalRealizedPnl: 320, btcUpdownPositions: 4, favoriteCategories: [{ category: 'btc', count: 4 }] } } })
  async getWalletProfile(@Param('address') address: string) {
    const profile = await this.analyticsService.getWalletProfile(address);
    if (!profile) throw new NotFoundException(`Could not fetch profile for ${address}`);
    return profile;
  }

  @Get('holders/:walletAddress')
  @ApiOperation({ summary: 'Full win history for one wallet address' })
  @ApiParam({ name: 'walletAddress', example: '0xabc123' })
  @ApiResponse({ status: 200 })
  getHolderHistory(@Param('walletAddress') walletAddress: string) {
    return this.analyticsService.getHolderHistory(walletAddress);
  }

  @Get('errors')
  @ApiOperation({ summary: 'Error logs with optional module filter' })
  @ApiQuery({ name: 'module', required: false, type: String, description: 'Filter by module name (e.g. alert)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max results (default 50)' })
  @ApiResponse({ status: 200, type: [ErrorLogDto] })
  getErrors(
    @Query('module') module?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.getErrors(limit ? parseInt(limit, 10) : 50, module);
  }
}

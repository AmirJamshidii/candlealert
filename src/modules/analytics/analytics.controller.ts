import { Controller, Get, Param, Query } from '@nestjs/common';
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

  @Get('signals/timeline')
  @ApiOperation({ summary: 'Daily signal counts for the last N days' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to look back (default 7)' })
  @ApiResponse({ status: 200, type: [SignalTimelineDto] })
  getSignalTimeline(@Query('days') days?: string) {
    return this.analyticsService.getSignalTimeline(days ? parseInt(days, 10) : 7);
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

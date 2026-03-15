import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SignalSummaryDto {
  @ApiProperty({ example: '5m' })
  interval: string;

  @ApiProperty({ example: 42 })
  count: number;
}

export class SignalTimelineDto {
  @ApiProperty({ example: '2024-01-01' })
  date: string;

  @ApiProperty({ example: 7 })
  count: number;
}

export class WinnerLeaderboardDto {
  @ApiProperty({ example: '0xabc123' })
  walletAddress: string;

  @ApiProperty({ example: 1250.5 })
  totalPosition: number;

  @ApiProperty({ example: 3 })
  signalCount: number;
}

export class HolderLeaderboardDto {
  @ApiProperty({ example: '0xabc123' })
  walletAddress: string;

  @ApiProperty({ example: 5 })
  signalCount: number;

  @ApiProperty({ example: 3200.0 })
  totalPosition: number;
}

export class ErrorLogDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiPropertyOptional({ example: 'alert' })
  module?: string;

  @ApiProperty({ example: 'Failed to send Telegram message' })
  message: string;

  @ApiPropertyOptional()
  stack?: string;

  @ApiProperty()
  createdAt: Date;
}

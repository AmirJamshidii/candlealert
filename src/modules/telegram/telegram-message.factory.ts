import { ICandle } from '../../common/interfaces/candle.interface';
import { ReversalDirection } from '../../events/reversal-signal.event';

export interface IWinner {
  walletAddress: string;
  positionSize: number;
  marketQuestion: string;
  name?: string;
}

export interface IPosition {
  walletAddress: string;
  name?: string;
  avgPrice: number;
  totalPnl: number;
  marketQuestion: string;
}

function formatPrice(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function abbreviateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatCandle(candle: ICandle, direction: ReversalDirection): string {
  const date = new Date(candle.closeTime).toUTCString().replace(' GMT', ' UTC');
  const arrow = direction === 'green_to_red' ? '↓' : '↑';
  return [
    `Candle close: ${date}`,
    `Open:  ${formatPrice(candle.open)}`,
    `High:  ${formatPrice(candle.high)}`,
    `Low:   ${formatPrice(candle.low)}`,
    `Close: ${formatPrice(candle.close)} ${arrow}`,
  ].join('\n');
}

export function formatReversalAlert(
  candle: ICandle,
  interval: string,
  winners: IWinner[],
  snapshotPrice: number | null,
  snapshotWindowMs: number = 10000,
  positions: IPosition[] = [],
  direction: ReversalDirection = 'green_to_red',
): string {
  const snapshotWindowS = snapshotWindowMs / 1000;
  const eventSlug = `btc-updown-${interval}-${Math.floor(candle.openTime / 1000)}`;
  const eventLink = `https://polymarket.com/event/${eventSlug}`;
  const isGreenToRed = direction === 'green_to_red';

  const winnerLines = winners.length
    ? winners
        .map((w, i) => {
          const label = w.name || abbreviateAddress(w.walletAddress);
          const shares = Math.round(w.positionSize).toLocaleString('en-US');
          const link = `https://polymarket.com/profile/${w.walletAddress}`;
          return `${i + 1}. <a href="${link}">${label}</a> — ${shares} shares`;
        })
        .join('\n')
    : 'No holders data available';

  const marketQuestion = winners[0]?.marketQuestion ?? 'BTC price market';
  const side = isGreenToRed ? 'Down' : 'Up';

  const snapshotLine = isGreenToRed
    ? snapshotPrice != null
      ? `Was GREEN at T-${snapshotWindowS}s → ${formatPrice(snapshotPrice)} → Closed RED`
      : `Was GREEN at T-${snapshotWindowS}s → Closed RED`
    : snapshotPrice != null
      ? `Was RED at T-${snapshotWindowS}s → ${formatPrice(snapshotPrice)} → Closed GREEN`
      : `Was RED at T-${snapshotWindowS}s → Closed GREEN`;

  const positionLines = positions
    .map((p, i) => {
      const label = p.name || abbreviateAddress(p.walletAddress);
      const link = `https://polymarket.com/profile/${p.walletAddress}`;
      return `${i + 1}. <a href="${link}">${label}</a> — avg ${formatPrice(p.avgPrice)} | PNL ${formatPrice(p.totalPnl)}`;
    })
    .join('\n');

  return [
    `${isGreenToRed ? '🔴' : '🟢'} BTC Reversal Signal [${interval}]`,
    '',
    formatCandle(candle, direction),
    '',
    snapshotLine,
    '',
    `📊 Top ${winners.length} Polymarket ${side} Holders (${marketQuestion})`,
    `🔗 ${eventLink}`,
    '',
    winnerLines,
    ...(positions.length
      ? ['', `💰 Top ${positions.length} Polymarket ${side} Positions by PNL`, '', positionLines]
      : []),
  ].join('\n');
}

export function formatErrorAlert(module: string, message: string): string {
  return `⚠️ CandleAlert Error [${module}]\n\n${message}`;
}

import { ICandle } from '../../common/interfaces/candle.interface';

export interface IWinner {
  walletAddress: string;
  positionSize: number;
  marketQuestion: string;
}

function formatPrice(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function abbreviateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatCandle(candle: ICandle): string {
  const date = new Date(candle.closeTime).toUTCString().replace(' GMT', ' UTC');
  return [
    `Candle close: ${date}`,
    `Open:  ${formatPrice(candle.open)}`,
    `High:  ${formatPrice(candle.high)}`,
    `Low:   ${formatPrice(candle.low)}`,
    `Close: ${formatPrice(candle.close)} ↓`,
  ].join('\n');
}

export function formatReversalAlert(
  candle: ICandle,
  interval: string,
  winners: IWinner[],
): string {
  const winnerLines = winners.length
    ? winners
        .map((w, i) => {
          const addr = abbreviateAddress(w.walletAddress);
          const link = `https://polymarket.com/profile/${w.walletAddress}`;
          const amount = formatPrice(w.positionSize);
          return `${i + 1}. ${addr} — ${amount}\n   ${link}`;
        })
        .join('\n')
    : 'No winners data available';

  const marketQuestion = winners[0]?.marketQuestion ?? 'BTC price market';

  return [
    `🔴 BTC Reversal Signal [${interval}]`,
    '',
    formatCandle(candle),
    '',
    'Was GREEN at T-10s → Closed RED',
    '',
    `📊 Top ${winners.length} Polymarket Winners (${marketQuestion})`,
    winnerLines,
  ].join('\n');
}

export function formatErrorAlert(module: string, message: string): string {
  return `⚠️ CandleAlert Error [${module}]\n\n${message}`;
}

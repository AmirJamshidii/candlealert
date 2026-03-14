export interface AppConfig {
  databaseUrl: string;
  binanceBaseUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
  symbols: string[];
  interval: string;
  pollCron: string;
  healthPort: number;
}

export interface Candle {
  symbol: string;
  interval: string;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
}

export interface BinanceKline {
  0: number;   // open time
  1: string;   // open
  2: string;   // high
  3: string;   // low
  4: string;   // close
  5: string;   // volume
  6: number;   // close time
  7: string;   // quote asset volume
  8: number;   // number of trades
  9: string;   // taker buy base
  10: string;  // taker buy quote
  11: string;  // ignore
}

export interface StoredCandle extends Candle {
  id: number;
  createdAt: Date;
}

export interface Alert {
  id?: number;
  symbol: string;
  interval: string;
  signalType: string;
  signalKey: string;
  lastCandleCloseTime: number;
  telegramChatId: string;
  sentAt?: Date;
}

export interface SignalResult {
  detected: boolean;
  signalKey: string;
  candles: Candle[];
}

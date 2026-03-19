export interface ICandle {
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

export interface IBinanceKlineRaw {
  t: number; // kline start time
  T: number; // kline close time
  s: string; // symbol
  i: string; // interval
  o: string; // open
  c: string; // close
  h: string; // high
  l: string; // low
  v: string; // volume
  x: boolean; // is kline closed
}

export interface IBinanceKlineWsMessage {
  e: 'kline';
  E: number; // event time
  s: string; // symbol
  k: IBinanceKlineRaw;
}

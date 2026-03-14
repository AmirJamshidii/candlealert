import { ICandle } from './candle.interface';

export interface IReversalSnapshot {
  wasGreen: boolean;
  recorded: boolean;
  openTime: number;
  closeAtSnapshot: number;
}

export interface IReversalSignal {
  signalKey: string;
  interval: string;
  candle: ICandle;
}

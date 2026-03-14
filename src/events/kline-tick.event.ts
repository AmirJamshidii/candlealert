import { ICandle } from '../common/interfaces/candle.interface';

export class KlineTickEvent {
  constructor(
    public readonly interval: string,
    public readonly candle: ICandle,
  ) {}
}

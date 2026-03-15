import { ICandle } from '../common/interfaces/candle.interface';

export class ReversalSignalEvent {
  constructor(
    public readonly signalKey: string,
    public readonly interval: string,
    public readonly candle: ICandle,
    public readonly snapshotPrice: number | null,
  ) {}
}

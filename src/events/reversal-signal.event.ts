import { ICandle } from '../common/interfaces/candle.interface';

export type ReversalDirection = 'green_to_red' | 'red_to_green';

export class ReversalSignalEvent {
  constructor(
    public readonly signalKey: string,
    public readonly interval: string,
    public readonly candle: ICandle,
    public readonly snapshotPrice: number | null,
    public readonly direction: ReversalDirection,
  ) {}
}

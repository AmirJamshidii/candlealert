import { Injectable } from '@nestjs/common';
import { IReversalSnapshot } from '../../common/interfaces/signal.interface';

@Injectable()
export class SignalStateService {
  private readonly snapshots = new Map<string, IReversalSnapshot>();

  private key(interval: string, openTime: number): string {
    return `${interval}:${openTime}`;
  }

  snapshot(
    interval: string,
    openTime: number,
    wasGreen: boolean,
    closeAtSnapshot: number,
  ): void {
    const k = this.key(interval, openTime);
    if (!this.snapshots.has(k)) {
      this.snapshots.set(k, {
        wasGreen,
        recorded: true,
        openTime,
        closeAtSnapshot,
      });
    }
  }

  get(interval: string, openTime: number): IReversalSnapshot | undefined {
    return this.snapshots.get(this.key(interval, openTime));
  }

  clear(interval: string, openTime: number): void {
    this.snapshots.delete(this.key(interval, openTime));
  }

  hasSnapshot(interval: string, openTime: number): boolean {
    return this.snapshots.has(this.key(interval, openTime));
  }
}

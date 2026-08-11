import { Injectable } from '@nestjs/common';
import { IReversalSnapshot } from '../../common/interfaces/signal.interface';

interface PriceTick {
  ts: number;
  price: number;
}

@Injectable()
export class SignalStateService {
  private readonly snapshots = new Map<string, IReversalSnapshot>();
  private readonly tickBuffers = new Map<string, PriceTick[]>();

  private key(interval: string, openTime: number): string {
    return `${interval}:${openTime}`;
  }

  addTick(interval: string, openTime: number, price: number): void {
    const k = this.key(interval, openTime);
    const buf = this.tickBuffers.get(k) ?? [];
    buf.push({ ts: Date.now(), price });
    this.tickBuffers.set(k, buf);
  }

  getTwap(interval: string, openTime: number, windowMs: number): number | null {
    const buf = this.tickBuffers.get(this.key(interval, openTime));
    if (!buf || buf.length === 0) return null;
    const cutoff = Date.now() - windowMs;
    const window = buf.filter((t) => t.ts >= cutoff);
    const prices = window.length > 0 ? window : buf;
    return prices.reduce((sum, t) => sum + t.price, 0) / prices.length;
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
    const k = this.key(interval, openTime);
    this.snapshots.delete(k);
    this.tickBuffers.delete(k);
  }

  hasSnapshot(interval: string, openTime: number): boolean {
    return this.snapshots.has(this.key(interval, openTime));
  }
}

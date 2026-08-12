import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app.config';

// Chainlink BTC/USD aggregator on Ethereum Mainnet
const BTC_USD_FEED = '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88';
// latestRoundData() selector
const LATEST_ROUND_DATA = '0xfeaf968c';
// 8 decimals for BTC/USD feed
const DECIMALS = 1e8;
const CACHE_TTL_MS = 10_000;

@Injectable()
export class ChainlinkService {
  private readonly logger = new Logger(ChainlinkService.name);
  private cachedPrice: number | null = null;
  private cacheExpiry = 0;

  constructor(private readonly appConfig: AppConfig) {}

  async getBtcUsdPrice(): Promise<number | null> {
    const rpcUrl = this.appConfig.ethereumRpcUrl;
    if (!rpcUrl) return null;

    if (this.cachedPrice !== null && Date.now() < this.cacheExpiry) {
      return this.cachedPrice;
    }

    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{ to: BTC_USD_FEED, data: LATEST_ROUND_DATA }, 'latest'],
          id: 1,
        }),
      });

      const json = (await response.json()) as { result?: string };
      if (!json.result || json.result === '0x') return null;

      // result = 0x + 5 × 64 hex chars (each 32 bytes)
      // answer is the 2nd slot (index 1)
      const answerHex = json.result.slice(2 + 64, 2 + 128);
      const price = Number(BigInt('0x' + answerHex)) / DECIMALS;

      this.cachedPrice = price;
      this.cacheExpiry = Date.now() + CACHE_TTL_MS;
      this.logger.debug(`Chainlink BTC/USD: $${price.toFixed(2)}`);
      return price;
    } catch (err) {
      this.logger.warn(`Chainlink price fetch failed: ${(err as Error).message}`);
      return null;
    }
  }
}

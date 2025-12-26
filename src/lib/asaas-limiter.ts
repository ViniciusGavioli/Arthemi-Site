import { RateLimiter } from 'limiter';

class AsaasRateLimiter {
  private static instance: AsaasRateLimiter;
  private limiter: RateLimiter;

  private constructor() {
    this.limiter = new RateLimiter({
      tokensPerInterval: 100,
      interval: 'minute'
    });
  }

  static getInstance(): AsaasRateLimiter {
    if (!AsaasRateLimiter.instance) {
      AsaasRateLimiter.instance = new AsaasRateLimiter();
    }
    return AsaasRateLimiter.instance;
  }

  async acquireToken(): Promise<void> {
    await this.limiter.removeTokens(1);
  }
}

export default AsaasRateLimiter.getInstance();
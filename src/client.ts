import {
  EmailVerifyConfig,
  VerifyOptions,
  VerifyResponse,
  BulkVerifyOptions,
  BulkJobResponse,
  BulkResultsOptions,
  BulkResultsResponse,
  CreditsResponse,
  WebhookConfig,
  Webhook,
  ApiError,
} from './types.js';
import {
  EmailVerifyError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  InsufficientCreditsError,
  NotFoundError,
  TimeoutError,
} from './errors.js';

const DEFAULT_BASE_URL = 'https://api.emailverify.ai/v1';
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_RETRIES = 3;

export class EmailVerify {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retries: number;

  constructor(config: EmailVerifyConfig) {
    if (!config.apiKey) {
      throw new AuthenticationError('API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl?.replace(/\/$/, '') || DEFAULT_BASE_URL;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    this.retries = config.retries ?? DEFAULT_RETRIES;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    attempt: number = 1
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'EMAILVERIFY-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
          'User-Agent': '@emailverify/node/1.0.0',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleErrorResponse(response, attempt, method, path, body);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof EmailVerifyError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(`Request timed out after ${this.timeout}ms`);
      }

      throw new EmailVerifyError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NETWORK_ERROR',
        0
      );
    }
  }

  private async handleErrorResponse(
    response: Response,
    attempt: number,
    method: string,
    path: string,
    body?: unknown
  ): Promise<never> {
    let errorData: { error?: ApiError } = {};
    try {
      errorData = await response.json() as { error?: ApiError };
    } catch {
      // Response body is not JSON
    }

    const error = errorData.error;
    const message = error?.message || response.statusText;
    const code = error?.code || 'UNKNOWN_ERROR';

    switch (response.status) {
      case 401:
        throw new AuthenticationError(message);

      case 403:
        if (code === 'INSUFFICIENT_CREDITS') {
          throw new InsufficientCreditsError(message);
        }
        throw new EmailVerifyError(message, code, 403);

      case 404:
        throw new NotFoundError(message);

      case 429:
        const retryAfter = parseInt(response.headers.get('Retry-After') || '0', 10);
        if (attempt < this.retries) {
          await this.sleep((retryAfter || Math.pow(2, attempt)) * 1000);
          return this.request(method, path, body, attempt + 1);
        }
        throw new RateLimitError(message, retryAfter);

      case 400:
        throw new ValidationError(message, error?.details);

      case 500:
      case 502:
      case 503:
        if (attempt < this.retries) {
          await this.sleep(Math.pow(2, attempt) * 1000);
          return this.request(method, path, body, attempt + 1);
        }
        throw new EmailVerifyError(message, code, response.status);

      default:
        throw new EmailVerifyError(message, code, response.status);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Verify a single email address
   */
  async verify(email: string, options?: VerifyOptions): Promise<VerifyResponse> {
    return this.request<VerifyResponse>('POST', '/verify', {
      email,
      smtp_check: options?.smtpCheck ?? true,
      timeout: options?.timeout,
    });
  }

  /**
   * Submit a bulk verification job
   */
  async verifyBulk(
    emails: string[],
    options?: BulkVerifyOptions
  ): Promise<BulkJobResponse> {
    if (emails.length > 10000) {
      throw new ValidationError('Maximum 10,000 emails per bulk job');
    }

    return this.request<BulkJobResponse>('POST', '/verify/bulk', {
      emails,
      smtp_check: options?.smtpCheck ?? true,
      webhook_url: options?.webhookUrl,
    });
  }

  /**
   * Get the status of a bulk verification job
   */
  async getBulkJobStatus(jobId: string): Promise<BulkJobResponse> {
    return this.request<BulkJobResponse>('GET', `/verify/bulk/${jobId}`);
  }

  /**
   * Get the results of a completed bulk verification job
   */
  async getBulkJobResults(
    jobId: string,
    options?: BulkResultsOptions
  ): Promise<BulkResultsResponse> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset !== undefined) params.set('offset', options.offset.toString());
    if (options?.status) params.set('status', options.status);

    const query = params.toString();
    const path = `/verify/bulk/${jobId}/results${query ? `?${query}` : ''}`;

    return this.request<BulkResultsResponse>('GET', path);
  }

  /**
   * Poll for bulk job completion
   */
  async waitForBulkJobCompletion(
    jobId: string,
    pollInterval: number = 5000,
    maxWait: number = 600000
  ): Promise<BulkJobResponse> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const status = await this.getBulkJobStatus(jobId);

      if (status.status === 'completed' || status.status === 'failed') {
        return status;
      }

      await this.sleep(pollInterval);
    }

    throw new TimeoutError(`Bulk job ${jobId} did not complete within ${maxWait}ms`);
  }

  /**
   * Get current credit balance
   */
  async getCredits(): Promise<CreditsResponse> {
    return this.request<CreditsResponse>('GET', '/credits');
  }

  /**
   * Create a new webhook
   */
  async createWebhook(config: WebhookConfig): Promise<Webhook> {
    return this.request<Webhook>('POST', '/webhooks', config);
  }

  /**
   * List all webhooks
   */
  async listWebhooks(): Promise<Webhook[]> {
    return this.request<Webhook[]>('GET', '/webhooks');
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    await this.request<void>('DELETE', `/webhooks/${webhookId}`);
  }

  /**
   * Verify a webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const crypto = require('crypto');
    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')}`;
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  }
}

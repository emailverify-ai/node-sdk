import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmailVerify } from '../src/client.js';
import {
  AuthenticationError,
  RateLimitError,
  ValidationError,
  InsufficientCreditsError,
  NotFoundError,
  TimeoutError,
} from '../src/errors.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('EmailVerify Client', () => {
  let client: EmailVerify;

  beforeEach(() => {
    client = new EmailVerify({ apiKey: 'test-api-key' });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw AuthenticationError when API key is missing', () => {
      expect(() => new EmailVerify({ apiKey: '' })).toThrow(AuthenticationError);
    });

    it('should create client with default options', () => {
      const client = new EmailVerify({ apiKey: 'test-key' });
      expect(client).toBeInstanceOf(EmailVerify);
    });

    it('should create client with custom options', () => {
      const client = new EmailVerify({
        apiKey: 'test-key',
        baseUrl: 'https://custom.api.com',
        timeout: 60000,
        retries: 5,
      });
      expect(client).toBeInstanceOf(EmailVerify);
    });
  });

  describe('verify', () => {
    it('should verify a single email successfully', async () => {
      const mockResponse = {
        email: 'test@example.com',
        status: 'valid',
        result: {
          deliverable: true,
          valid_format: true,
          valid_domain: true,
          valid_mx: true,
          disposable: false,
          role: false,
          catchall: false,
          free: false,
          smtp_valid: true,
        },
        score: 0.95,
        reason: null,
        credits_used: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.verify('test@example.com');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.emailverify.ai/v1/verify',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'EMAILVERIFY-API-KEY': 'test-api-key',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            email: 'test@example.com',
            smtp_check: true,
            timeout: undefined,
          }),
        })
      );
    });

    it('should verify with custom options', async () => {
      const mockResponse = {
        email: 'test@example.com',
        status: 'valid',
        result: {},
        score: 0.95,
        reason: null,
        credits_used: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.verify('test@example.com', { smtpCheck: false, timeout: 5000 });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.emailverify.ai/v1/verify',
        expect.objectContaining({
          body: JSON.stringify({
            email: 'test@example.com',
            smtp_check: false,
            timeout: 5000,
          }),
        })
      );
    });

    it('should throw AuthenticationError on 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          error: { code: 'INVALID_API_KEY', message: 'Invalid API key' },
        }),
      });

      await expect(client.verify('test@example.com')).rejects.toThrow(AuthenticationError);
    });

    it('should throw ValidationError on 400', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: { code: 'INVALID_EMAIL', message: 'Invalid email format' },
        }),
      });

      await expect(client.verify('invalid')).rejects.toThrow(ValidationError);
    });

    it('should throw InsufficientCreditsError on 403 with INSUFFICIENT_CREDITS code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({
          error: { code: 'INSUFFICIENT_CREDITS', message: 'Not enough credits' },
        }),
      });

      await expect(client.verify('test@example.com')).rejects.toThrow(InsufficientCreditsError);
    });

    it('should throw NotFoundError on 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          error: { code: 'NOT_FOUND', message: 'Resource not found' },
        }),
      });

      await expect(client.verify('test@example.com')).rejects.toThrow(NotFoundError);
    });

    it('should throw RateLimitError on 429 after retries exhausted', async () => {
      const rateLimitResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          get: () => '1',
        },
        json: async () => ({
          error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded' },
        }),
      };

      // Mock multiple calls for retries
      mockFetch.mockResolvedValue(rateLimitResponse);

      const clientNoRetry = new EmailVerify({ apiKey: 'test-key', retries: 1 });
      await expect(clientNoRetry.verify('test@example.com')).rejects.toThrow(RateLimitError);
    });
  });

  describe('verifyBulk', () => {
    it('should submit bulk verification job successfully', async () => {
      const mockResponse = {
        job_id: 'job_123',
        status: 'processing',
        total: 3,
        processed: 0,
        valid: 0,
        invalid: 0,
        unknown: 0,
        credits_used: 3,
        created_at: '2025-01-15T10:30:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.verifyBulk([
        'user1@example.com',
        'user2@example.com',
        'user3@example.com',
      ]);

      expect(result).toEqual(mockResponse);
    });

    it('should throw ValidationError when emails exceed 10000', async () => {
      const emails = Array(10001).fill('test@example.com');
      await expect(client.verifyBulk(emails)).rejects.toThrow(ValidationError);
    });

    it('should include webhook URL when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ job_id: 'job_123' }),
      });

      await client.verifyBulk(['test@example.com'], {
        webhookUrl: 'https://example.com/webhook',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('webhook_url'),
        })
      );
    });
  });

  describe('getBulkJobStatus', () => {
    it('should get bulk job status successfully', async () => {
      const mockResponse = {
        job_id: 'job_123',
        status: 'processing',
        total: 100,
        processed: 50,
        progress_percent: 50,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getBulkJobStatus('job_123');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.emailverify.ai/v1/verify/bulk/job_123',
        expect.objectContaining({ method: 'GET' })
      );
    });
  });

  describe('getBulkJobResults', () => {
    it('should get bulk job results with pagination', async () => {
      const mockResponse = {
        job_id: 'job_123',
        total: 100,
        limit: 50,
        offset: 0,
        results: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getBulkJobResults('job_123', {
        limit: 50,
        offset: 0,
        status: 'valid',
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.emailverify.ai/v1/verify/bulk/job_123/results?limit=50&offset=0&status=valid',
        expect.any(Object)
      );
    });
  });

  describe('getCredits', () => {
    it('should get credits successfully', async () => {
      const mockResponse = {
        available: 9500,
        used: 500,
        total: 10000,
        plan: 'Professional',
        resets_at: '2025-02-01T00:00:00Z',
        rate_limit: {
          requests_per_hour: 10000,
          remaining: 9850,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getCredits();

      expect(result).toEqual(mockResponse);
    });
  });

  describe('webhooks', () => {
    it('should create webhook successfully', async () => {
      const mockResponse = {
        id: 'webhook_123',
        url: 'https://example.com/webhook',
        events: ['verification.completed'],
        created_at: '2025-01-15T10:30:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.createWebhook({
        url: 'https://example.com/webhook',
        events: ['verification.completed'],
      });

      expect(result).toEqual(mockResponse);
    });

    it('should list webhooks successfully', async () => {
      const mockResponse = [
        {
          id: 'webhook_123',
          url: 'https://example.com/webhook',
          events: ['verification.completed'],
          created_at: '2025-01-15T10:30:00Z',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.listWebhooks();

      expect(result).toEqual(mockResponse);
    });

    it('should delete webhook successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await expect(client.deleteWebhook('webhook_123')).resolves.toBeUndefined();
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid webhook signature', () => {
      const payload = '{"event":"test"}';
      const secret = 'test-secret';
      // Pre-computed signature for the payload and secret
      const signature = 'sha256=ad386d9a61a0540a089d2955a07280771439f9f8c41a4b94cd404a740061c3d9';

      const result = client.verifyWebhookSignature(payload, signature, secret);

      expect(result).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const payload = '{"event":"test"}';
      const secret = 'test-secret';
      const invalidSignature = 'sha256=invalid';

      const result = client.verifyWebhookSignature(payload, invalidSignature, secret);

      expect(result).toBe(false);
    });
  });
});

describe('Error Classes', () => {
  it('should create AuthenticationError with correct properties', () => {
    const error = new AuthenticationError();
    expect(error.name).toBe('AuthenticationError');
    expect(error.code).toBe('INVALID_API_KEY');
    expect(error.statusCode).toBe(401);
  });

  it('should create RateLimitError with retryAfter', () => {
    const error = new RateLimitError('Rate limited', 60);
    expect(error.name).toBe('RateLimitError');
    expect(error.retryAfter).toBe(60);
  });

  it('should create ValidationError with details', () => {
    const error = new ValidationError('Invalid input', 'Email format is wrong');
    expect(error.name).toBe('ValidationError');
    expect(error.details).toBe('Email format is wrong');
  });

  it('should create TimeoutError with custom message', () => {
    const error = new TimeoutError('Request timed out after 30s');
    expect(error.name).toBe('TimeoutError');
    expect(error.message).toBe('Request timed out after 30s');
  });
});

"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AuthenticationError: () => AuthenticationError,
  EmailVerify: () => EmailVerify,
  EmailVerifyError: () => EmailVerifyError,
  InsufficientCreditsError: () => InsufficientCreditsError,
  NotFoundError: () => NotFoundError,
  RateLimitError: () => RateLimitError,
  TimeoutError: () => TimeoutError,
  ValidationError: () => ValidationError
});
module.exports = __toCommonJS(index_exports);

// src/errors.ts
var EmailVerifyError = class _EmailVerifyError extends Error {
  code;
  statusCode;
  details;
  constructor(message, code, statusCode, details) {
    super(message);
    this.name = "EmailVerifyError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, _EmailVerifyError.prototype);
  }
};
var AuthenticationError = class _AuthenticationError extends EmailVerifyError {
  constructor(message = "Invalid or missing API key") {
    super(message, "INVALID_API_KEY", 401);
    this.name = "AuthenticationError";
    Object.setPrototypeOf(this, _AuthenticationError.prototype);
  }
};
var RateLimitError = class _RateLimitError extends EmailVerifyError {
  retryAfter;
  constructor(message = "Rate limit exceeded", retryAfter = 0) {
    super(message, "RATE_LIMIT_EXCEEDED", 429);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, _RateLimitError.prototype);
  }
};
var ValidationError = class _ValidationError extends EmailVerifyError {
  constructor(message, details) {
    super(message, "INVALID_REQUEST", 400, details);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, _ValidationError.prototype);
  }
};
var InsufficientCreditsError = class _InsufficientCreditsError extends EmailVerifyError {
  constructor(message = "Insufficient credits") {
    super(message, "INSUFFICIENT_CREDITS", 403);
    this.name = "InsufficientCreditsError";
    Object.setPrototypeOf(this, _InsufficientCreditsError.prototype);
  }
};
var NotFoundError = class _NotFoundError extends EmailVerifyError {
  constructor(message = "Resource not found") {
    super(message, "NOT_FOUND", 404);
    this.name = "NotFoundError";
    Object.setPrototypeOf(this, _NotFoundError.prototype);
  }
};
var TimeoutError = class _TimeoutError extends EmailVerifyError {
  constructor(message = "Request timed out") {
    super(message, "TIMEOUT", 504);
    this.name = "TimeoutError";
    Object.setPrototypeOf(this, _TimeoutError.prototype);
  }
};

// src/client.ts
var DEFAULT_BASE_URL = "https://api.emailverify.ai/v1";
var DEFAULT_TIMEOUT = 3e4;
var DEFAULT_RETRIES = 3;
var EmailVerify = class {
  apiKey;
  baseUrl;
  timeout;
  retries;
  constructor(config) {
    if (!config.apiKey) {
      throw new AuthenticationError("API key is required");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl?.replace(/\/$/, "") || DEFAULT_BASE_URL;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    this.retries = config.retries ?? DEFAULT_RETRIES;
  }
  async request(method, path, body, attempt = 1) {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await fetch(url, {
        method,
        headers: {
          "EMAILVERIFY-API-KEY": this.apiKey,
          "Content-Type": "application/json",
          "User-Agent": "@emailverify/node/1.0.0"
        },
        body: body ? JSON.stringify(body) : void 0,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        await this.handleErrorResponse(response, attempt, method, path, body);
      }
      if (response.status === 204) {
        return void 0;
      }
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof EmailVerifyError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new TimeoutError(`Request timed out after ${this.timeout}ms`);
      }
      throw new EmailVerifyError(
        `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
        "NETWORK_ERROR",
        0
      );
    }
  }
  async handleErrorResponse(response, attempt, method, path, body) {
    let errorData = {};
    try {
      errorData = await response.json();
    } catch {
    }
    const error = errorData.error;
    const message = error?.message || response.statusText;
    const code = error?.code || "UNKNOWN_ERROR";
    switch (response.status) {
      case 401:
        throw new AuthenticationError(message);
      case 403:
        if (code === "INSUFFICIENT_CREDITS") {
          throw new InsufficientCreditsError(message);
        }
        throw new EmailVerifyError(message, code, 403);
      case 404:
        throw new NotFoundError(message);
      case 429:
        const retryAfter = parseInt(response.headers.get("Retry-After") || "0", 10);
        if (attempt < this.retries) {
          await this.sleep((retryAfter || Math.pow(2, attempt)) * 1e3);
          return this.request(method, path, body, attempt + 1);
        }
        throw new RateLimitError(message, retryAfter);
      case 400:
        throw new ValidationError(message, error?.details);
      case 500:
      case 502:
      case 503:
        if (attempt < this.retries) {
          await this.sleep(Math.pow(2, attempt) * 1e3);
          return this.request(method, path, body, attempt + 1);
        }
        throw new EmailVerifyError(message, code, response.status);
      default:
        throw new EmailVerifyError(message, code, response.status);
    }
  }
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  /**
   * Verify a single email address
   */
  async verify(email, options) {
    return this.request("POST", "/verify", {
      email,
      smtp_check: options?.smtpCheck ?? true,
      timeout: options?.timeout
    });
  }
  /**
   * Submit a bulk verification job
   */
  async verifyBulk(emails, options) {
    if (emails.length > 1e4) {
      throw new ValidationError("Maximum 10,000 emails per bulk job");
    }
    return this.request("POST", "/verify/bulk", {
      emails,
      smtp_check: options?.smtpCheck ?? true,
      webhook_url: options?.webhookUrl
    });
  }
  /**
   * Get the status of a bulk verification job
   */
  async getBulkJobStatus(jobId) {
    return this.request("GET", `/verify/bulk/${jobId}`);
  }
  /**
   * Get the results of a completed bulk verification job
   */
  async getBulkJobResults(jobId, options) {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", options.limit.toString());
    if (options?.offset !== void 0) params.set("offset", options.offset.toString());
    if (options?.status) params.set("status", options.status);
    const query = params.toString();
    const path = `/verify/bulk/${jobId}/results${query ? `?${query}` : ""}`;
    return this.request("GET", path);
  }
  /**
   * Poll for bulk job completion
   */
  async waitForBulkJobCompletion(jobId, pollInterval = 5e3, maxWait = 6e5) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWait) {
      const status = await this.getBulkJobStatus(jobId);
      if (status.status === "completed" || status.status === "failed") {
        return status;
      }
      await this.sleep(pollInterval);
    }
    throw new TimeoutError(`Bulk job ${jobId} did not complete within ${maxWait}ms`);
  }
  /**
   * Get current credit balance
   */
  async getCredits() {
    return this.request("GET", "/credits");
  }
  /**
   * Create a new webhook
   */
  async createWebhook(config) {
    return this.request("POST", "/webhooks", config);
  }
  /**
   * List all webhooks
   */
  async listWebhooks() {
    return this.request("GET", "/webhooks");
  }
  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId) {
    await this.request("DELETE", `/webhooks/${webhookId}`);
  }
  /**
   * Verify a webhook signature
   */
  verifyWebhookSignature(payload, signature, secret) {
    const crypto = require("crypto");
    const expectedSignature = `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AuthenticationError,
  EmailVerify,
  EmailVerifyError,
  InsufficientCreditsError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
  ValidationError
});

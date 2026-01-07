interface EmailVerifyConfig {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
    retries?: number;
}
interface VerifyOptions {
    smtpCheck?: boolean;
    timeout?: number;
}
interface VerificationResult {
    deliverable: boolean;
    valid_format: boolean;
    valid_domain: boolean;
    valid_mx: boolean;
    disposable: boolean;
    role: boolean;
    catchall: boolean;
    free: boolean;
    smtp_valid: boolean;
}
interface VerifyResponse {
    email: string;
    status: 'valid' | 'invalid' | 'unknown' | 'accept_all';
    result: VerificationResult;
    score: number;
    reason: string | null;
    credits_used: number;
}
interface BulkVerifyOptions {
    smtpCheck?: boolean;
    webhookUrl?: string;
}
interface BulkJobResponse {
    job_id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    total: number;
    processed: number;
    valid: number;
    invalid: number;
    unknown: number;
    credits_used: number;
    created_at: string;
    completed_at?: string;
    progress_percent?: number;
}
interface BulkResultItem {
    email: string;
    status: 'valid' | 'invalid' | 'unknown' | 'accept_all';
    result: Partial<VerificationResult>;
    score: number;
}
interface BulkResultsOptions {
    limit?: number;
    offset?: number;
    status?: 'valid' | 'invalid' | 'unknown';
}
interface BulkResultsResponse {
    job_id: string;
    total: number;
    limit: number;
    offset: number;
    results: BulkResultItem[];
}
interface CreditsResponse {
    available: number;
    used: number;
    total: number;
    plan: string;
    resets_at: string;
    rate_limit: {
        requests_per_hour: number;
        remaining: number;
    };
}
interface WebhookConfig {
    url: string;
    events: WebhookEvent[];
    secret?: string;
}
type WebhookEvent = 'verification.completed' | 'bulk.completed' | 'bulk.failed' | 'credits.low';
interface Webhook {
    id: string;
    url: string;
    events: WebhookEvent[];
    created_at: string;
}
interface WebhookPayload {
    event: WebhookEvent;
    timestamp: string;
    data: Record<string, unknown>;
    signature: string;
}
interface ApiError {
    code: string;
    message: string;
    details?: string;
}

declare class EmailVerify {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly timeout;
    private readonly retries;
    constructor(config: EmailVerifyConfig);
    private request;
    private handleErrorResponse;
    private sleep;
    /**
     * Verify a single email address
     */
    verify(email: string, options?: VerifyOptions): Promise<VerifyResponse>;
    /**
     * Submit a bulk verification job
     */
    verifyBulk(emails: string[], options?: BulkVerifyOptions): Promise<BulkJobResponse>;
    /**
     * Get the status of a bulk verification job
     */
    getBulkJobStatus(jobId: string): Promise<BulkJobResponse>;
    /**
     * Get the results of a completed bulk verification job
     */
    getBulkJobResults(jobId: string, options?: BulkResultsOptions): Promise<BulkResultsResponse>;
    /**
     * Poll for bulk job completion
     */
    waitForBulkJobCompletion(jobId: string, pollInterval?: number, maxWait?: number): Promise<BulkJobResponse>;
    /**
     * Get current credit balance
     */
    getCredits(): Promise<CreditsResponse>;
    /**
     * Create a new webhook
     */
    createWebhook(config: WebhookConfig): Promise<Webhook>;
    /**
     * List all webhooks
     */
    listWebhooks(): Promise<Webhook[]>;
    /**
     * Delete a webhook
     */
    deleteWebhook(webhookId: string): Promise<void>;
    /**
     * Verify a webhook signature
     */
    verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
}

declare class EmailVerifyError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly details?: string;
    constructor(message: string, code: string, statusCode: number, details?: string);
}
declare class AuthenticationError extends EmailVerifyError {
    constructor(message?: string);
}
declare class RateLimitError extends EmailVerifyError {
    readonly retryAfter: number;
    constructor(message?: string, retryAfter?: number);
}
declare class ValidationError extends EmailVerifyError {
    constructor(message: string, details?: string);
}
declare class InsufficientCreditsError extends EmailVerifyError {
    constructor(message?: string);
}
declare class NotFoundError extends EmailVerifyError {
    constructor(message?: string);
}
declare class TimeoutError extends EmailVerifyError {
    constructor(message?: string);
}

export { type ApiError, AuthenticationError, type BulkJobResponse, type BulkResultItem, type BulkResultsOptions, type BulkResultsResponse, type BulkVerifyOptions, type CreditsResponse, EmailVerify, type EmailVerifyConfig, EmailVerifyError, InsufficientCreditsError, NotFoundError, RateLimitError, TimeoutError, ValidationError, type VerificationResult, type VerifyOptions, type VerifyResponse, type Webhook, type WebhookConfig, type WebhookEvent, type WebhookPayload };

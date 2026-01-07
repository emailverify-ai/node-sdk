export interface EmailVerifyConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
}

export interface VerifyOptions {
  smtpCheck?: boolean;
  timeout?: number;
}

export interface VerificationResult {
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

export interface VerifyResponse {
  email: string;
  status: 'valid' | 'invalid' | 'unknown' | 'accept_all';
  result: VerificationResult;
  score: number;
  reason: string | null;
  credits_used: number;
}

export interface BulkVerifyOptions {
  smtpCheck?: boolean;
  webhookUrl?: string;
}

export interface BulkJobResponse {
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

export interface BulkResultItem {
  email: string;
  status: 'valid' | 'invalid' | 'unknown' | 'accept_all';
  result: Partial<VerificationResult>;
  score: number;
}

export interface BulkResultsOptions {
  limit?: number;
  offset?: number;
  status?: 'valid' | 'invalid' | 'unknown';
}

export interface BulkResultsResponse {
  job_id: string;
  total: number;
  limit: number;
  offset: number;
  results: BulkResultItem[];
}

export interface CreditsResponse {
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

export interface WebhookConfig {
  url: string;
  events: WebhookEvent[];
  secret?: string;
}

export type WebhookEvent =
  | 'verification.completed'
  | 'bulk.completed'
  | 'bulk.failed'
  | 'credits.low';

export interface Webhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  created_at: string;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
  signature: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: string;
}

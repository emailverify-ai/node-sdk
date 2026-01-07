export class EmailVerifyError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: string;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: string
  ) {
    super(message);
    this.name = 'EmailVerifyError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, EmailVerifyError.prototype);
  }
}

export class AuthenticationError extends EmailVerifyError {
  constructor(message: string = 'Invalid or missing API key') {
    super(message, 'INVALID_API_KEY', 401);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class RateLimitError extends EmailVerifyError {
  public readonly retryAfter: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter: number = 0) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class ValidationError extends EmailVerifyError {
  constructor(message: string, details?: string) {
    super(message, 'INVALID_REQUEST', 400, details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class InsufficientCreditsError extends EmailVerifyError {
  constructor(message: string = 'Insufficient credits') {
    super(message, 'INSUFFICIENT_CREDITS', 403);
    this.name = 'InsufficientCreditsError';
    Object.setPrototypeOf(this, InsufficientCreditsError.prototype);
  }
}

export class NotFoundError extends EmailVerifyError {
  constructor(message: string = 'Resource not found') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class TimeoutError extends EmailVerifyError {
  constructor(message: string = 'Request timed out') {
    super(message, 'TIMEOUT', 504);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

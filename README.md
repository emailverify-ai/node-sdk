# @emailverify/node

Official EmailVerify Node.js SDK for email verification.

**Documentation:** https://emailverify.ai/docs

## Installation

```bash
npm install @emailverify/node
```

## Quick Start

```typescript
import { EmailVerify } from '@emailverify/node';

const client = new EmailVerify({
  apiKey: process.env.EMAILVERIFY_API_KEY!,
});

// Verify a single email
const result = await client.verify('user@example.com');
console.log(result.status); // 'valid', 'invalid', 'unknown', or 'accept_all'
```

## Configuration

```typescript
const client = new EmailVerify({
  apiKey: 'your-api-key',    // Required
  baseUrl: 'https://api.emailverify.ai/v1', // Optional
  timeout: 30000,            // Optional: Request timeout in ms (default: 30000)
  retries: 3,                // Optional: Number of retries (default: 3)
});
```

## Single Email Verification

```typescript
const result = await client.verify('user@example.com', {
  smtpCheck: true,  // Optional: Perform SMTP verification (default: true)
  timeout: 5000,    // Optional: Verification timeout in ms
});

console.log(result);
// {
//   email: 'user@example.com',
//   status: 'valid',
//   result: {
//     deliverable: true,
//     valid_format: true,
//     valid_domain: true,
//     valid_mx: true,
//     disposable: false,
//     role: false,
//     catchall: false,
//     free: false,
//     smtp_valid: true
//   },
//   score: 0.95,
//   reason: null,
//   credits_used: 1
// }
```

## Bulk Email Verification

```typescript
// Submit a bulk verification job
const job = await client.verifyBulk(
  ['user1@example.com', 'user2@example.com', 'user3@example.com'],
  {
    smtpCheck: true,
    webhookUrl: 'https://your-app.com/webhooks/emailverify', // Optional
  }
);

console.log(job.job_id); // 'job_abc123xyz'

// Check job status
const status = await client.getBulkJobStatus(job.job_id);
console.log(status.progress_percent); // 45

// Wait for completion (polling)
const completed = await client.waitForBulkJobCompletion(job.job_id, 5000, 600000);

// Get results
const results = await client.getBulkJobResults(job.job_id, {
  limit: 100,
  offset: 0,
  status: 'valid', // Optional: filter by status
});
```

## Credits

```typescript
const credits = await client.getCredits();
console.log(credits);
// {
//   available: 9500,
//   used: 500,
//   total: 10000,
//   plan: 'Professional',
//   resets_at: '2025-02-01T00:00:00Z',
//   rate_limit: {
//     requests_per_hour: 10000,
//     remaining: 9850
//   }
// }
```

## Webhooks

```typescript
// Create a webhook
const webhook = await client.createWebhook({
  url: 'https://your-app.com/webhooks/emailverify',
  events: ['verification.completed', 'bulk.completed'],
  secret: 'your-webhook-secret',
});

// List webhooks
const webhooks = await client.listWebhooks();

// Delete a webhook
await client.deleteWebhook(webhook.id);

// Verify webhook signature
const isValid = client.verifyWebhookSignature(
  rawBody,
  signature,
  'your-webhook-secret'
);
```

## Error Handling

```typescript
import {
  EmailVerify,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  InsufficientCreditsError,
  NotFoundError,
  TimeoutError,
} from '@emailverify/node';

try {
  const result = await client.verify('user@example.com');
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else if (error instanceof RateLimitError) {
    console.error(`Rate limited. Retry after ${error.retryAfter} seconds`);
  } else if (error instanceof ValidationError) {
    console.error(`Invalid input: ${error.message}`);
  } else if (error instanceof InsufficientCreditsError) {
    console.error('Not enough credits');
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out');
  }
}
```

## TypeScript Support

This SDK is written in TypeScript and includes full type definitions.

```typescript
import type {
  VerifyResponse,
  BulkJobResponse,
  CreditsResponse,
} from '@emailverify/node';
```

## License

MIT

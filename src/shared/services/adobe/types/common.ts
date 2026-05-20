/**
 * Common types shared across Adobe services
 *
 * @see docs/ADOBE_INTEGRATION_IMPLEMENTATION_PLAN.md for full implementation
 */

// Operation status
export type AdobeOperationStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

// File formats
export type SupportedInputFormat =
  | 'pdf'
  | 'docx'
  | 'doc'
  | 'xlsx'
  | 'xls'
  | 'pptx'
  | 'ppt'
  | 'html'
  | 'jpg'
  | 'jpeg'
  | 'png'
  | 'gif'
  | 'bmp'
  | 'tiff';

export type SupportedOutputFormat =
  | 'pdf'
  | 'docx'
  | 'xlsx'
  | 'pptx'
  | 'jpg'
  | 'png'
  | 'rtf';

// Base operation result
export interface AdobeOperationResult<T = unknown> {
  success: boolean;
  status: AdobeOperationStatus;
  data?: T;
  error?: AdobeError;
  metadata?: {
    operationId: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
  };
}

// Error structure
export interface AdobeError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
}

// File reference
export interface AdobeFileRef {
  type: 'url' | 'base64' | 'buffer' | 'stream' | 'storage';
  value: string | Buffer | ReadableStream;
  mimeType?: string;
  fileName?: string;
  size?: number;
}

// Progress callback
export type ProgressCallback = (progress: {
  percent: number;
  status: string;
  details?: string;
}) => void;

// Webhook event
export interface AdobeWebhookEvent<T = unknown> {
  eventType: string;
  eventId: string;
  timestamp: Date;
  payload: T;
  signature?: string;
}

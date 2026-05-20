# Adobe Professional Integration - Implementation Plan

> **Handoff Document for Claude Code**
>
> This document provides a comprehensive implementation plan for integrating Adobe Professional APIs into DawinOS. It is designed to be executed by Claude Code in Windsurf or any other AI-assisted development environment.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Prerequisites & Environment Setup](#2-prerequisites--environment-setup)
3. [Architecture Overview](#3-architecture-overview)
4. [Phase 1: Foundation Layer](#4-phase-1-foundation-layer)
5. [Phase 2: PDF Services Integration](#5-phase-2-pdf-services-integration)
6. [Phase 3: Document Generation](#6-phase-3-document-generation)
7. [Phase 4: Adobe Sign Integration](#7-phase-4-adobe-sign-integration)
8. [Phase 5: Image Services (Photoshop/Lightroom/Firefly)](#8-phase-5-image-services)
9. [Phase 6: Creative Cloud Libraries](#9-phase-6-creative-cloud-libraries)
10. [Testing Strategy](#10-testing-strategy)
11. [Migration Guide](#11-migration-guide)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Executive Summary

### Objective
Integrate Adobe Professional APIs to enhance document generation, e-signatures, image processing, and creative asset management across DawinOS modules.

### Scope
| Module | Integration | Priority |
|--------|-------------|----------|
| Design Manager | PDF Services, Document Generation, Sign, Photoshop | HIGH |
| Matflow (Advisory) | PDF Extract, Document Generation | HIGH |
| HR Central | Document Generation, Sign | HIGH |
| Launch Pipeline | Photoshop, Lightroom, Firefly | MEDIUM |
| Clipper | Photoshop, Content Tagging | MEDIUM |
| Customer Hub | Document Generation, Sign | MEDIUM |

### Timeline
- **Phase 1**: Foundation Layer (1 week)
- **Phase 2**: PDF Services (2 weeks)
- **Phase 3**: Document Generation (2 weeks)
- **Phase 4**: Adobe Sign (2 weeks)
- **Phase 5**: Image Services (3 weeks)
- **Phase 6**: Creative Cloud Libraries (2 weeks)

**Total: 12 weeks**

---

## 2. Prerequisites & Environment Setup

### 2.1 Adobe Developer Console Setup

```bash
# Required Adobe API credentials (add to .env)
ADOBE_CLIENT_ID=your_client_id
ADOBE_CLIENT_SECRET=your_client_secret
ADOBE_ORG_ID=your_organization_id
ADOBE_TECHNICAL_ACCOUNT_ID=your_technical_account_id
ADOBE_PRIVATE_KEY_PATH=./config/adobe-private-key.pem

# Adobe Sign specific
ADOBE_SIGN_CLIENT_ID=your_sign_client_id
ADOBE_SIGN_CLIENT_SECRET=your_sign_client_secret
ADOBE_SIGN_REFRESH_TOKEN=your_refresh_token
ADOBE_SIGN_BASE_URI=https://api.na1.adobesign.com

# Firefly Services
ADOBE_FIREFLY_CLIENT_ID=your_firefly_client_id
ADOBE_FIREFLY_CLIENT_SECRET=your_firefly_client_secret
```

### 2.2 Package Installation

```bash
# Core Adobe SDK packages
npm install @adobe/pdfservices-node-sdk@^4.0.0
npm install @adobe/documentservices-pdftools-node-sdk@^4.0.0

# Additional dependencies
npm install jsonwebtoken@^9.0.0
npm install node-fetch@^3.3.0
npm install form-data@^4.0.0
npm install axios@^1.6.0

# Types (if not included)
npm install -D @types/jsonwebtoken
```

### 2.3 Firebase Functions Dependencies

Add to `functions/package.json`:

```json
{
  "dependencies": {
    "@adobe/pdfservices-node-sdk": "^4.0.0",
    "jsonwebtoken": "^9.0.0",
    "node-fetch": "^3.3.0",
    "form-data": "^4.0.0"
  }
}
```

### 2.4 Update .env.example

```bash
# Add to /home/user/dawinos/.env.example

# ===========================================
# ADOBE PROFESSIONAL INTEGRATION
# ===========================================

# Adobe PDF Services API (https://developer.adobe.com/document-services/)
VITE_ADOBE_PDF_SERVICES_ENABLED=true
ADOBE_CLIENT_ID=
ADOBE_CLIENT_SECRET=
ADOBE_ORG_ID=
ADOBE_TECHNICAL_ACCOUNT_ID=

# Adobe Sign API (https://www.adobe.com/sign/developer.html)
VITE_ADOBE_SIGN_ENABLED=true
ADOBE_SIGN_CLIENT_ID=
ADOBE_SIGN_CLIENT_SECRET=
ADOBE_SIGN_BASE_URI=https://api.na1.adobesign.com

# Adobe Firefly Services (https://developer.adobe.com/firefly-services/)
VITE_ADOBE_FIREFLY_ENABLED=true
ADOBE_FIREFLY_CLIENT_ID=
ADOBE_FIREFLY_CLIENT_SECRET=

# Adobe Creative Cloud Libraries
VITE_ADOBE_CC_LIBRARIES_ENABLED=false
ADOBE_CC_API_KEY=
```

---

## 3. Architecture Overview

### 3.1 Directory Structure

Create the following directory structure:

```
src/shared/services/adobe/
├── index.ts                          # Public API exports
├── config.ts                         # Configuration and credentials
├── types/
│   ├── index.ts                      # Type exports
│   ├── common.ts                     # Shared types
│   ├── pdf-services.types.ts         # PDF Services types
│   ├── document-generation.types.ts  # Document Generation types
│   ├── sign.types.ts                 # Adobe Sign types
│   ├── photoshop.types.ts            # Photoshop API types
│   ├── lightroom.types.ts            # Lightroom API types
│   ├── firefly.types.ts              # Firefly API types
│   └── cc-libraries.types.ts         # Creative Cloud types
│
├── auth/
│   ├── index.ts
│   ├── jwt-auth.ts                   # JWT authentication for PDF Services
│   ├── oauth-auth.ts                 # OAuth for Sign/CC Libraries
│   └── token-manager.ts              # Token caching and refresh
│
├── pdf/
│   ├── index.ts
│   ├── pdf-services-client.ts        # PDF Services SDK wrapper
│   ├── operations/
│   │   ├── create-pdf.ts             # Create PDF from various sources
│   │   ├── export-pdf.ts             # Export PDF to other formats
│   │   ├── combine-pdf.ts            # Merge multiple PDFs
│   │   ├── split-pdf.ts              # Split PDF into parts
│   │   ├── ocr-pdf.ts                # OCR for scanned documents
│   │   ├── compress-pdf.ts           # Compress PDF file size
│   │   ├── protect-pdf.ts            # Add password/permissions
│   │   └── linearize-pdf.ts          # Optimize for web viewing
│   └── pdf-extract/
│       ├── index.ts
│       ├── extract-client.ts         # PDF Extract API client
│       ├── table-parser.ts           # Parse extracted tables
│       └── text-parser.ts            # Parse extracted text
│
├── document-generation/
│   ├── index.ts
│   ├── doc-gen-client.ts             # Document Generation client
│   ├── template-manager.ts           # Template storage/retrieval
│   ├── data-mapper.ts                # Map app data to template fields
│   └── templates/
│       ├── quote-template.ts         # Quote document template config
│       ├── invoice-template.ts       # Invoice template config
│       ├── payroll-template.ts       # Payroll template config
│       ├── contract-template.ts      # Contract template config
│       └── report-template.ts        # Report template config
│
├── sign/
│   ├── index.ts
│   ├── sign-client.ts                # Adobe Sign API client
│   ├── agreement-service.ts          # Create/manage agreements
│   ├── template-service.ts           # Library templates
│   ├── webhook-handler.ts            # Webhook event processing
│   └── workflows/
│       ├── quote-approval.ts         # Quote signature workflow
│       ├── contract-signing.ts       # Contract workflow
│       └── hr-documents.ts           # HR document workflows
│
├── creative/
│   ├── index.ts
│   ├── photoshop/
│   │   ├── index.ts
│   │   ├── photoshop-client.ts       # Photoshop API client
│   │   ├── remove-background.ts      # Background removal
│   │   ├── smart-crop.ts             # Intelligent cropping
│   │   ├── auto-tone.ts              # Auto enhancement
│   │   └── batch-processor.ts        # Batch image processing
│   ├── lightroom/
│   │   ├── index.ts
│   │   ├── lightroom-client.ts       # Lightroom API client
│   │   ├── auto-enhance.ts           # Auto adjustments
│   │   ├── presets.ts                # Apply presets
│   │   └── batch-edit.ts             # Batch editing
│   └── firefly/
│       ├── index.ts
│       ├── firefly-client.ts         # Firefly API client
│       ├── text-to-image.ts          # Generate images from text
│       ├── generative-fill.ts        # AI fill/expand
│       ├── style-transfer.ts         # Apply styles
│       └── variations.ts             # Generate variations
│
├── cc-libraries/
│   ├── index.ts
│   ├── libraries-client.ts           # CC Libraries API client
│   ├── asset-sync.ts                 # Sync assets to/from libraries
│   └── brand-manager.ts              # Brand asset management
│
├── hooks/
│   ├── index.ts
│   ├── useAdobePdfServices.ts        # PDF Services React hook
│   ├── useAdobeDocGen.ts             # Document Generation hook
│   ├── useAdobeSign.ts               # Adobe Sign hook
│   ├── useAdobePhotoshop.ts          # Photoshop API hook
│   ├── useAdobeFirefly.ts            # Firefly API hook
│   └── useAdobeLibraries.ts          # CC Libraries hook
│
└── utils/
    ├── index.ts
    ├── file-utils.ts                 # File conversion utilities
    ├── error-handler.ts              # Adobe API error handling
    ├── rate-limiter.ts               # API rate limiting
    └── retry-handler.ts              # Retry logic for failed requests
```

### 3.2 Firebase Functions Structure

```
functions/
├── src/
│   └── adobe/
│       ├── index.ts                  # Function exports
│       ├── pdf-services.ts           # PDF Services functions
│       ├── document-generation.ts    # Doc Gen functions
│       ├── sign-webhooks.ts          # Sign webhook handlers
│       └── image-processing.ts       # Image processing functions
```

---

## 4. Phase 1: Foundation Layer

### Task 1.1: Create Configuration Module

**File: `src/shared/services/adobe/config.ts`**

```typescript
/**
 * Adobe Services Configuration
 *
 * Centralized configuration for all Adobe API integrations.
 * Credentials are loaded from environment variables.
 */

export interface AdobeConfig {
  // PDF Services
  pdfServices: {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    orgId: string;
    technicalAccountId: string;
    privateKeyPath?: string;
    privateKey?: string;
  };

  // Adobe Sign
  sign: {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    baseUri: string;
    refreshToken?: string;
  };

  // Firefly Services
  firefly: {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
  };

  // Creative Cloud Libraries
  ccLibraries: {
    enabled: boolean;
    apiKey: string;
  };
}

export function getAdobeConfig(): AdobeConfig {
  return {
    pdfServices: {
      enabled: import.meta.env.VITE_ADOBE_PDF_SERVICES_ENABLED === 'true',
      clientId: import.meta.env.VITE_ADOBE_CLIENT_ID || '',
      clientSecret: '', // Server-side only
      orgId: import.meta.env.VITE_ADOBE_ORG_ID || '',
      technicalAccountId: import.meta.env.VITE_ADOBE_TECHNICAL_ACCOUNT_ID || '',
    },
    sign: {
      enabled: import.meta.env.VITE_ADOBE_SIGN_ENABLED === 'true',
      clientId: import.meta.env.VITE_ADOBE_SIGN_CLIENT_ID || '',
      clientSecret: '', // Server-side only
      baseUri: import.meta.env.VITE_ADOBE_SIGN_BASE_URI || 'https://api.na1.adobesign.com',
    },
    firefly: {
      enabled: import.meta.env.VITE_ADOBE_FIREFLY_ENABLED === 'true',
      clientId: import.meta.env.VITE_ADOBE_FIREFLY_CLIENT_ID || '',
      clientSecret: '', // Server-side only
    },
    ccLibraries: {
      enabled: import.meta.env.VITE_ADOBE_CC_LIBRARIES_ENABLED === 'true',
      apiKey: import.meta.env.VITE_ADOBE_CC_API_KEY || '',
    },
  };
}

export function isAdobeServiceEnabled(service: keyof AdobeConfig): boolean {
  const config = getAdobeConfig();
  return config[service]?.enabled ?? false;
}
```

### Task 1.2: Create Common Types

**File: `src/shared/services/adobe/types/common.ts`**

```typescript
/**
 * Common types shared across Adobe services
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
```

### Task 1.3: Create Error Handler

**File: `src/shared/services/adobe/utils/error-handler.ts`**

```typescript
/**
 * Adobe API Error Handler
 *
 * Centralizes error handling for all Adobe API calls.
 */

import { AdobeError } from '../types/common';

// Adobe API error codes
export const ADOBE_ERROR_CODES = {
  // Authentication
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // File operations
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  INVALID_FILE_FORMAT: 'INVALID_FILE_FORMAT',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  CORRUPTED_FILE: 'CORRUPTED_FILE',

  // Operations
  OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',
  OPERATION_FAILED: 'OPERATION_FAILED',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',

  // Network
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

// Retryable error codes
const RETRYABLE_ERRORS = new Set([
  ADOBE_ERROR_CODES.RATE_LIMIT_EXCEEDED,
  ADOBE_ERROR_CODES.OPERATION_TIMEOUT,
  ADOBE_ERROR_CODES.NETWORK_ERROR,
  ADOBE_ERROR_CODES.SERVICE_UNAVAILABLE,
]);

export function parseAdobeError(error: unknown): AdobeError {
  // Handle Adobe SDK errors
  if (error && typeof error === 'object' && 'code' in error) {
    const adobeError = error as { code: string; message?: string; details?: unknown };
    return {
      code: adobeError.code,
      message: adobeError.message || 'Unknown Adobe API error',
      details: adobeError.details as Record<string, unknown>,
      retryable: RETRYABLE_ERRORS.has(adobeError.code),
    };
  }

  // Handle fetch/network errors
  if (error instanceof Error) {
    if (error.message.includes('fetch')) {
      return {
        code: ADOBE_ERROR_CODES.NETWORK_ERROR,
        message: error.message,
        retryable: true,
      };
    }
    return {
      code: ADOBE_ERROR_CODES.OPERATION_FAILED,
      message: error.message,
      retryable: false,
    };
  }

  // Unknown error
  return {
    code: ADOBE_ERROR_CODES.OPERATION_FAILED,
    message: String(error),
    retryable: false,
  };
}

export function isRetryableError(error: AdobeError): boolean {
  return error.retryable;
}

export function getRetryDelay(attempt: number, baseDelay = 1000): number {
  // Exponential backoff with jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
}
```

### Task 1.4: Create Token Manager

**File: `src/shared/services/adobe/auth/token-manager.ts`**

```typescript
/**
 * Adobe Token Manager
 *
 * Handles token caching, refresh, and expiration for Adobe APIs.
 */

interface CachedToken {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
}

const tokenCache = new Map<string, CachedToken>();

export class AdobeTokenManager {
  private static instance: AdobeTokenManager;

  private constructor() {}

  static getInstance(): AdobeTokenManager {
    if (!AdobeTokenManager.instance) {
      AdobeTokenManager.instance = new AdobeTokenManager();
    }
    return AdobeTokenManager.instance;
  }

  /**
   * Get cached token if valid, otherwise return null
   */
  getCachedToken(service: string): string | null {
    const cached = tokenCache.get(service);
    if (!cached) return null;

    // Check if expired (with 5 minute buffer)
    const bufferMs = 5 * 60 * 1000;
    if (Date.now() >= cached.expiresAt - bufferMs) {
      tokenCache.delete(service);
      return null;
    }

    return cached.accessToken;
  }

  /**
   * Cache a new token
   */
  cacheToken(
    service: string,
    accessToken: string,
    expiresIn: number,
    refreshToken?: string
  ): void {
    tokenCache.set(service, {
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
      refreshToken,
    });
  }

  /**
   * Get refresh token for a service
   */
  getRefreshToken(service: string): string | null {
    return tokenCache.get(service)?.refreshToken ?? null;
  }

  /**
   * Clear token for a service
   */
  clearToken(service: string): void {
    tokenCache.delete(service);
  }

  /**
   * Clear all cached tokens
   */
  clearAll(): void {
    tokenCache.clear();
  }
}
```

### Task 1.5: Create Public API Index

**File: `src/shared/services/adobe/index.ts`**

```typescript
/**
 * Adobe Services Public API
 *
 * This module provides unified access to all Adobe Professional integrations.
 *
 * @example
 * ```typescript
 * import { adobePdf, adobeSign, adobePhotoshop } from '@/shared/services/adobe';
 *
 * // Generate PDF
 * const pdf = await adobePdf.createFromHtml(htmlContent);
 *
 * // Send for signature
 * await adobeSign.sendForSignature(pdf, recipientEmail);
 *
 * // Enhance image
 * const enhanced = await adobePhotoshop.removeBackground(imageUrl);
 * ```
 */

// Configuration
export { getAdobeConfig, isAdobeServiceEnabled } from './config';
export type { AdobeConfig } from './config';

// Types
export * from './types';

// Auth
export { AdobeTokenManager } from './auth/token-manager';

// PDF Services (Phase 2)
// export { AdobePdfServices } from './pdf';
// export { AdobePdfExtract } from './pdf/pdf-extract';

// Document Generation (Phase 3)
// export { AdobeDocumentGeneration } from './document-generation';

// Adobe Sign (Phase 4)
// export { AdobeSignService } from './sign';

// Creative Services (Phase 5)
// export { AdobePhotoshopService } from './creative/photoshop';
// export { AdobeLightroomService } from './creative/lightroom';
// export { AdobeFireflyService } from './creative/firefly';

// Creative Cloud Libraries (Phase 6)
// export { AdobeCCLibraries } from './cc-libraries';

// Hooks
// export { useAdobePdfServices } from './hooks/useAdobePdfServices';
// export { useAdobeDocGen } from './hooks/useAdobeDocGen';
// export { useAdobeSign } from './hooks/useAdobeSign';
// export { useAdobePhotoshop } from './hooks/useAdobePhotoshop';
// export { useAdobeFirefly } from './hooks/useAdobeFirefly';

// Utils
export { parseAdobeError, isRetryableError, getRetryDelay } from './utils/error-handler';
```

---

## 5. Phase 2: PDF Services Integration

### Task 2.1: Create PDF Services Types

**File: `src/shared/services/adobe/types/pdf-services.types.ts`**

```typescript
/**
 * Adobe PDF Services API Types
 */

import { AdobeFileRef, SupportedInputFormat, SupportedOutputFormat } from './common';

// Create PDF options
export interface CreatePdfOptions {
  input: AdobeFileRef;
  inputFormat?: SupportedInputFormat;
  documentLanguage?: string;
}

// Export PDF options
export interface ExportPdfOptions {
  input: AdobeFileRef;
  outputFormat: SupportedOutputFormat;
  ocrEnabled?: boolean;
  ocrLanguage?: string;
}

// Combine PDF options
export interface CombinePdfOptions {
  inputs: AdobeFileRef[];
  pageRanges?: Array<{
    fileIndex: number;
    start?: number;
    end?: number;
  }>;
}

// Split PDF options
export interface SplitPdfOptions {
  input: AdobeFileRef;
  splitType: 'byPageCount' | 'byPageRanges' | 'byFileSize';
  pageCount?: number;
  pageRanges?: Array<{ start: number; end: number }>;
  fileSizeLimit?: number;
}

// OCR options
export interface OcrPdfOptions {
  input: AdobeFileRef;
  ocrLanguage?: string;
  ocrType?: 'searchable' | 'editable';
}

// Compress options
export interface CompressPdfOptions {
  input: AdobeFileRef;
  compressionLevel?: 'low' | 'medium' | 'high';
}

// Protect options
export interface ProtectPdfOptions {
  input: AdobeFileRef;
  userPassword?: string;
  ownerPassword?: string;
  permissions?: {
    printing?: 'none' | 'low' | 'high';
    editing?: boolean;
    copying?: boolean;
    annotating?: boolean;
    formFilling?: boolean;
  };
  encryptionAlgorithm?: 'AES_128' | 'AES_256';
}

// PDF Extract types
export interface ExtractPdfOptions {
  input: AdobeFileRef;
  elementsToExtract: Array<'text' | 'tables' | 'figures'>;
  tableOutputFormat?: 'csv' | 'xlsx' | 'json';
  includeRenditions?: boolean;
  includeStyling?: boolean;
}

export interface ExtractedTable {
  pageNumber: number;
  tableIndex: number;
  rows: string[][];
  headers?: string[];
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ExtractedText {
  pageNumber: number;
  text: string;
  paragraphs?: Array<{
    text: string;
    boundingBox?: { x: number; y: number; width: number; height: number };
  }>;
}

export interface PdfExtractResult {
  text: ExtractedText[];
  tables: ExtractedTable[];
  figures?: Array<{
    pageNumber: number;
    imageData: string;
    boundingBox: { x: number; y: number; width: number; height: number };
  }>;
  metadata?: {
    pageCount: number;
    title?: string;
    author?: string;
    creationDate?: string;
  };
}
```

### Task 2.2: Create PDF Services Client

**File: `src/shared/services/adobe/pdf/pdf-services-client.ts`**

```typescript
/**
 * Adobe PDF Services Client
 *
 * Wrapper around Adobe PDF Services SDK for common operations.
 */

import {
  CreatePdfOptions,
  ExportPdfOptions,
  CombinePdfOptions,
  SplitPdfOptions,
  OcrPdfOptions,
  CompressPdfOptions,
  ProtectPdfOptions,
} from '../types/pdf-services.types';
import { AdobeOperationResult, AdobeFileRef, ProgressCallback } from '../types/common';
import { parseAdobeError, isRetryableError, getRetryDelay } from '../utils/error-handler';
import { AdobeTokenManager } from '../auth/token-manager';

const MAX_RETRIES = 3;
const API_BASE_URL = 'https://pdf-services.adobe.io';

export class AdobePdfServicesClient {
  private tokenManager: AdobeTokenManager;

  constructor() {
    this.tokenManager = AdobeTokenManager.getInstance();
  }

  /**
   * Create PDF from various source formats
   */
  async createPdf(
    options: CreatePdfOptions,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<Blob>> {
    return this.executeWithRetry(async () => {
      onProgress?.({ percent: 10, status: 'Preparing document...' });

      const token = await this.getAccessToken();
      const formData = await this.prepareFileUpload(options.input);

      onProgress?.({ percent: 30, status: 'Uploading to Adobe...' });

      // Upload asset
      const assetId = await this.uploadAsset(token, formData);

      onProgress?.({ percent: 50, status: 'Converting to PDF...' });

      // Create PDF operation
      const jobId = await this.startCreatePdfJob(token, assetId, options);

      // Poll for completion
      const result = await this.pollJobStatus(token, jobId, onProgress);

      onProgress?.({ percent: 100, status: 'Complete' });

      return {
        success: true,
        status: 'completed',
        data: result,
      };
    });
  }

  /**
   * Export PDF to other formats (DOCX, XLSX, etc.)
   */
  async exportPdf(
    options: ExportPdfOptions,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<Blob>> {
    return this.executeWithRetry(async () => {
      onProgress?.({ percent: 10, status: 'Preparing PDF...' });

      const token = await this.getAccessToken();
      const formData = await this.prepareFileUpload(options.input);

      onProgress?.({ percent: 30, status: 'Processing...' });

      const assetId = await this.uploadAsset(token, formData);
      const jobId = await this.startExportPdfJob(token, assetId, options);
      const result = await this.pollJobStatus(token, jobId, onProgress);

      onProgress?.({ percent: 100, status: 'Complete' });

      return {
        success: true,
        status: 'completed',
        data: result,
      };
    });
  }

  /**
   * Combine multiple PDFs into one
   */
  async combinePdfs(
    options: CombinePdfOptions,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<Blob>> {
    return this.executeWithRetry(async () => {
      onProgress?.({ percent: 10, status: 'Preparing documents...' });

      const token = await this.getAccessToken();

      // Upload all files
      const assetIds: string[] = [];
      for (let i = 0; i < options.inputs.length; i++) {
        const formData = await this.prepareFileUpload(options.inputs[i]);
        const assetId = await this.uploadAsset(token, formData);
        assetIds.push(assetId);

        const progress = 10 + (i + 1) / options.inputs.length * 40;
        onProgress?.({ percent: progress, status: `Uploaded ${i + 1}/${options.inputs.length}` });
      }

      onProgress?.({ percent: 60, status: 'Combining PDFs...' });

      const jobId = await this.startCombinePdfJob(token, assetIds, options);
      const result = await this.pollJobStatus(token, jobId, onProgress);

      onProgress?.({ percent: 100, status: 'Complete' });

      return {
        success: true,
        status: 'completed',
        data: result,
      };
    });
  }

  /**
   * Apply OCR to scanned PDF
   */
  async ocrPdf(
    options: OcrPdfOptions,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<Blob>> {
    return this.executeWithRetry(async () => {
      onProgress?.({ percent: 10, status: 'Preparing document...' });

      const token = await this.getAccessToken();
      const formData = await this.prepareFileUpload(options.input);

      onProgress?.({ percent: 30, status: 'Uploading...' });

      const assetId = await this.uploadAsset(token, formData);

      onProgress?.({ percent: 50, status: 'Applying OCR...' });

      const jobId = await this.startOcrJob(token, assetId, options);
      const result = await this.pollJobStatus(token, jobId, onProgress);

      onProgress?.({ percent: 100, status: 'Complete' });

      return {
        success: true,
        status: 'completed',
        data: result,
      };
    });
  }

  /**
   * Compress PDF to reduce file size
   */
  async compressPdf(
    options: CompressPdfOptions,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<Blob>> {
    return this.executeWithRetry(async () => {
      const token = await this.getAccessToken();
      const formData = await this.prepareFileUpload(options.input);
      const assetId = await this.uploadAsset(token, formData);
      const jobId = await this.startCompressJob(token, assetId, options);
      const result = await this.pollJobStatus(token, jobId, onProgress);

      return {
        success: true,
        status: 'completed',
        data: result,
      };
    });
  }

  /**
   * Protect PDF with password and permissions
   */
  async protectPdf(
    options: ProtectPdfOptions,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<Blob>> {
    return this.executeWithRetry(async () => {
      const token = await this.getAccessToken();
      const formData = await this.prepareFileUpload(options.input);
      const assetId = await this.uploadAsset(token, formData);
      const jobId = await this.startProtectJob(token, assetId, options);
      const result = await this.pollJobStatus(token, jobId, onProgress);

      return {
        success: true,
        status: 'completed',
        data: result,
      };
    });
  }

  // Private helper methods

  private async getAccessToken(): Promise<string> {
    // Check cache first
    const cached = this.tokenManager.getCachedToken('pdf-services');
    if (cached) return cached;

    // Get new token via Firebase Function (keeps secrets server-side)
    const response = await fetch('/api/adobe/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'pdf-services' }),
    });

    if (!response.ok) {
      throw new Error('Failed to get Adobe access token');
    }

    const { accessToken, expiresIn } = await response.json();
    this.tokenManager.cacheToken('pdf-services', accessToken, expiresIn);

    return accessToken;
  }

  private async prepareFileUpload(fileRef: AdobeFileRef): Promise<FormData> {
    const formData = new FormData();

    switch (fileRef.type) {
      case 'url':
        const response = await fetch(fileRef.value as string);
        const blob = await response.blob();
        formData.append('file', blob, fileRef.fileName || 'document');
        break;
      case 'base64':
        const binaryString = atob(fileRef.value as string);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        formData.append('file', new Blob([bytes]), fileRef.fileName || 'document');
        break;
      case 'buffer':
        formData.append('file', new Blob([fileRef.value as Buffer]), fileRef.fileName || 'document');
        break;
      default:
        throw new Error(`Unsupported file reference type: ${fileRef.type}`);
    }

    return formData;
  }

  private async uploadAsset(token: string, formData: FormData): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/assets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': import.meta.env.VITE_ADOBE_CLIENT_ID,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Asset upload failed: ${response.statusText}`);
    }

    const { assetID } = await response.json();
    return assetID;
  }

  private async startCreatePdfJob(
    token: string,
    assetId: string,
    options: CreatePdfOptions
  ): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/operation/createpdf`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': import.meta.env.VITE_ADOBE_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assetID: assetId,
        documentLanguage: options.documentLanguage || 'en-US',
      }),
    });

    if (!response.ok) {
      throw new Error(`Create PDF job failed: ${response.statusText}`);
    }

    const location = response.headers.get('location');
    return location?.split('/').pop() || '';
  }

  private async startExportPdfJob(
    token: string,
    assetId: string,
    options: ExportPdfOptions
  ): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/operation/exportpdf`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': import.meta.env.VITE_ADOBE_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assetID: assetId,
        targetFormat: options.outputFormat,
        ocrLang: options.ocrLanguage,
      }),
    });

    if (!response.ok) {
      throw new Error(`Export PDF job failed: ${response.statusText}`);
    }

    const location = response.headers.get('location');
    return location?.split('/').pop() || '';
  }

  private async startCombinePdfJob(
    token: string,
    assetIds: string[],
    options: CombinePdfOptions
  ): Promise<string> {
    const assets = assetIds.map((id, index) => ({
      assetID: id,
      pageRanges: options.pageRanges?.filter(r => r.fileIndex === index),
    }));

    const response = await fetch(`${API_BASE_URL}/operation/combinepdf`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': import.meta.env.VITE_ADOBE_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ assets }),
    });

    if (!response.ok) {
      throw new Error(`Combine PDF job failed: ${response.statusText}`);
    }

    const location = response.headers.get('location');
    return location?.split('/').pop() || '';
  }

  private async startOcrJob(
    token: string,
    assetId: string,
    options: OcrPdfOptions
  ): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/operation/ocr`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': import.meta.env.VITE_ADOBE_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assetID: assetId,
        ocrLang: options.ocrLanguage || 'en-US',
        ocrType: options.ocrType || 'searchable',
      }),
    });

    if (!response.ok) {
      throw new Error(`OCR job failed: ${response.statusText}`);
    }

    const location = response.headers.get('location');
    return location?.split('/').pop() || '';
  }

  private async startCompressJob(
    token: string,
    assetId: string,
    options: CompressPdfOptions
  ): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/operation/compresspdf`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': import.meta.env.VITE_ADOBE_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assetID: assetId,
        compressionLevel: options.compressionLevel || 'medium',
      }),
    });

    if (!response.ok) {
      throw new Error(`Compress job failed: ${response.statusText}`);
    }

    const location = response.headers.get('location');
    return location?.split('/').pop() || '';
  }

  private async startProtectJob(
    token: string,
    assetId: string,
    options: ProtectPdfOptions
  ): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/operation/protectpdf`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': import.meta.env.VITE_ADOBE_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assetID: assetId,
        passwordProtection: {
          userPassword: options.userPassword,
          ownerPassword: options.ownerPassword,
        },
        permissions: options.permissions,
        encryptionAlgorithm: options.encryptionAlgorithm || 'AES_256',
      }),
    });

    if (!response.ok) {
      throw new Error(`Protect job failed: ${response.statusText}`);
    }

    const location = response.headers.get('location');
    return location?.split('/').pop() || '';
  }

  private async pollJobStatus(
    token: string,
    jobId: string,
    onProgress?: ProgressCallback
  ): Promise<Blob> {
    const maxAttempts = 60; // 5 minutes max
    const pollInterval = 5000; // 5 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(`${API_BASE_URL}/operation/${jobId}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-api-key': import.meta.env.VITE_ADOBE_CLIENT_ID,
        },
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.statusText}`);
      }

      const status = await response.json();

      if (status.status === 'done') {
        // Download result
        const resultResponse = await fetch(status.asset.downloadUri);
        return resultResponse.blob();
      }

      if (status.status === 'failed') {
        throw new Error(`Operation failed: ${status.error?.message || 'Unknown error'}`);
      }

      // Update progress
      const progressPercent = 60 + (attempt / maxAttempts) * 30;
      onProgress?.({ percent: progressPercent, status: 'Processing...' });

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Operation timed out');
  }

  private async executeWithRetry<T>(
    operation: () => Promise<AdobeOperationResult<T>>
  ): Promise<AdobeOperationResult<T>> {
    let lastError: AdobeError | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = parseAdobeError(error);

        if (!isRetryableError(lastError)) {
          return {
            success: false,
            status: 'failed',
            error: lastError,
          };
        }

        if (attempt < MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, getRetryDelay(attempt)));
        }
      }
    }

    return {
      success: false,
      status: 'failed',
      error: lastError,
    };
  }
}

// Singleton export
export const adobePdfServices = new AdobePdfServicesClient();
```

### Task 2.3: Create PDF Extract Client

**File: `src/shared/services/adobe/pdf/pdf-extract/extract-client.ts`**

```typescript
/**
 * Adobe PDF Extract API Client
 *
 * Extracts text, tables, and images from PDFs using AI.
 */

import { ExtractPdfOptions, PdfExtractResult, ExtractedTable, ExtractedText } from '../../types/pdf-services.types';
import { AdobeOperationResult, AdobeFileRef, ProgressCallback } from '../../types/common';
import { AdobeTokenManager } from '../../auth/token-manager';
import { parseAdobeError, isRetryableError, getRetryDelay } from '../../utils/error-handler';

const API_BASE_URL = 'https://pdf-services.adobe.io';
const MAX_RETRIES = 3;

export class AdobePdfExtractClient {
  private tokenManager: AdobeTokenManager;

  constructor() {
    this.tokenManager = AdobeTokenManager.getInstance();
  }

  /**
   * Extract content from PDF
   */
  async extract(
    options: ExtractPdfOptions,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<PdfExtractResult>> {
    return this.executeWithRetry(async () => {
      onProgress?.({ percent: 10, status: 'Preparing PDF...' });

      const token = await this.getAccessToken();

      onProgress?.({ percent: 20, status: 'Uploading...' });
      const assetId = await this.uploadAsset(token, options.input);

      onProgress?.({ percent: 40, status: 'Extracting content...' });
      const jobId = await this.startExtractJob(token, assetId, options);

      onProgress?.({ percent: 60, status: 'Processing...' });
      const rawResult = await this.pollJobStatus(token, jobId, onProgress);

      onProgress?.({ percent: 90, status: 'Parsing results...' });
      const parsedResult = await this.parseExtractResult(rawResult, options);

      onProgress?.({ percent: 100, status: 'Complete' });

      return {
        success: true,
        status: 'completed',
        data: parsedResult,
      };
    });
  }

  /**
   * Extract tables only (optimized for BOQ import)
   */
  async extractTables(
    input: AdobeFileRef,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<ExtractedTable[]>> {
    const result = await this.extract({
      input,
      elementsToExtract: ['tables'],
      tableOutputFormat: 'json',
    }, onProgress);

    if (!result.success) {
      return {
        success: false,
        status: 'failed',
        error: result.error,
      };
    }

    return {
      success: true,
      status: 'completed',
      data: result.data?.tables || [],
    };
  }

  /**
   * Extract text only
   */
  async extractText(
    input: AdobeFileRef,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<ExtractedText[]>> {
    const result = await this.extract({
      input,
      elementsToExtract: ['text'],
    }, onProgress);

    if (!result.success) {
      return {
        success: false,
        status: 'failed',
        error: result.error,
      };
    }

    return {
      success: true,
      status: 'completed',
      data: result.data?.text || [],
    };
  }

  // Private methods

  private async getAccessToken(): Promise<string> {
    const cached = this.tokenManager.getCachedToken('pdf-services');
    if (cached) return cached;

    const response = await fetch('/api/adobe/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'pdf-services' }),
    });

    if (!response.ok) {
      throw new Error('Failed to get Adobe access token');
    }

    const { accessToken, expiresIn } = await response.json();
    this.tokenManager.cacheToken('pdf-services', accessToken, expiresIn);

    return accessToken;
  }

  private async uploadAsset(token: string, fileRef: AdobeFileRef): Promise<string> {
    let blob: Blob;

    switch (fileRef.type) {
      case 'url':
        const response = await fetch(fileRef.value as string);
        blob = await response.blob();
        break;
      case 'base64':
        const binaryString = atob(fileRef.value as string);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: 'application/pdf' });
        break;
      case 'buffer':
        blob = new Blob([fileRef.value as Buffer], { type: 'application/pdf' });
        break;
      default:
        throw new Error(`Unsupported file reference type: ${fileRef.type}`);
    }

    const formData = new FormData();
    formData.append('file', blob, fileRef.fileName || 'document.pdf');

    const uploadResponse = await fetch(`${API_BASE_URL}/assets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': import.meta.env.VITE_ADOBE_CLIENT_ID,
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Asset upload failed: ${uploadResponse.statusText}`);
    }

    const { assetID } = await uploadResponse.json();
    return assetID;
  }

  private async startExtractJob(
    token: string,
    assetId: string,
    options: ExtractPdfOptions
  ): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/operation/extractpdf`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': import.meta.env.VITE_ADOBE_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assetID: assetId,
        elementsToExtract: options.elementsToExtract,
        tableOutputFormat: options.tableOutputFormat,
        renditionsToExtract: options.includeRenditions ? ['tables', 'figures'] : [],
        getStylingInfo: options.includeStyling,
      }),
    });

    if (!response.ok) {
      throw new Error(`Extract job failed: ${response.statusText}`);
    }

    const location = response.headers.get('location');
    return location?.split('/').pop() || '';
  }

  private async pollJobStatus(
    token: string,
    jobId: string,
    onProgress?: ProgressCallback
  ): Promise<ArrayBuffer> {
    const maxAttempts = 60;
    const pollInterval = 5000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(`${API_BASE_URL}/operation/${jobId}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-api-key': import.meta.env.VITE_ADOBE_CLIENT_ID,
        },
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.statusText}`);
      }

      const status = await response.json();

      if (status.status === 'done') {
        const resultResponse = await fetch(status.content.downloadUri);
        return resultResponse.arrayBuffer();
      }

      if (status.status === 'failed') {
        throw new Error(`Extraction failed: ${status.error?.message || 'Unknown error'}`);
      }

      const progressPercent = 60 + (attempt / maxAttempts) * 25;
      onProgress?.({ percent: progressPercent, status: 'Extracting content...' });

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Extraction timed out');
  }

  private async parseExtractResult(
    rawData: ArrayBuffer,
    options: ExtractPdfOptions
  ): Promise<PdfExtractResult> {
    // Adobe returns a ZIP file with JSON and renditions
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(rawData);

    const structuredDataFile = zip.file('structuredData.json');
    if (!structuredDataFile) {
      throw new Error('No structured data found in extraction result');
    }

    const structuredData = JSON.parse(await structuredDataFile.async('string'));

    const result: PdfExtractResult = {
      text: [],
      tables: [],
      metadata: {
        pageCount: structuredData.extended_metadata?.page_count || 0,
        title: structuredData.extended_metadata?.title,
        author: structuredData.extended_metadata?.author,
        creationDate: structuredData.extended_metadata?.creation_date,
      },
    };

    // Parse text elements
    if (options.elementsToExtract.includes('text')) {
      result.text = this.parseTextElements(structuredData.elements || []);
    }

    // Parse tables
    if (options.elementsToExtract.includes('tables')) {
      result.tables = this.parseTableElements(structuredData.elements || []);
    }

    // Parse figures
    if (options.elementsToExtract.includes('figures') && options.includeRenditions) {
      result.figures = await this.parseFigureElements(structuredData.elements || [], zip);
    }

    return result;
  }

  private parseTextElements(elements: any[]): ExtractedText[] {
    const textByPage = new Map<number, ExtractedText>();

    for (const element of elements) {
      if (element.Text) {
        const pageNum = element.Page || 1;

        if (!textByPage.has(pageNum)) {
          textByPage.set(pageNum, {
            pageNumber: pageNum,
            text: '',
            paragraphs: [],
          });
        }

        const pageText = textByPage.get(pageNum)!;
        pageText.text += element.Text + '\n';
        pageText.paragraphs?.push({
          text: element.Text,
          boundingBox: element.Bounds ? {
            x: element.Bounds[0],
            y: element.Bounds[1],
            width: element.Bounds[2] - element.Bounds[0],
            height: element.Bounds[3] - element.Bounds[1],
          } : undefined,
        });
      }
    }

    return Array.from(textByPage.values());
  }

  private parseTableElements(elements: any[]): ExtractedTable[] {
    const tables: ExtractedTable[] = [];
    let tableIndex = 0;

    for (const element of elements) {
      if (element.Path?.includes('/Table')) {
        const rows: string[][] = [];
        const headers: string[] = [];

        // Parse table rows
        if (element.Table?.Rows) {
          for (const row of element.Table.Rows) {
            const rowData: string[] = [];
            for (const cell of row.Cells || []) {
              rowData.push(cell.Text || '');
            }

            if (element.Table.Headers?.includes(row)) {
              headers.push(...rowData);
            } else {
              rows.push(rowData);
            }
          }
        }

        tables.push({
          pageNumber: element.Page || 1,
          tableIndex: tableIndex++,
          rows,
          headers: headers.length > 0 ? headers : undefined,
          boundingBox: element.Bounds ? {
            x: element.Bounds[0],
            y: element.Bounds[1],
            width: element.Bounds[2] - element.Bounds[0],
            height: element.Bounds[3] - element.Bounds[1],
          } : undefined,
        });
      }
    }

    return tables;
  }

  private async parseFigureElements(elements: any[], zip: any): Promise<any[]> {
    const figures: any[] = [];

    for (const element of elements) {
      if (element.Path?.includes('/Figure') && element.filePaths) {
        for (const filePath of element.filePaths) {
          const file = zip.file(filePath);
          if (file) {
            const imageData = await file.async('base64');
            figures.push({
              pageNumber: element.Page || 1,
              imageData: `data:image/png;base64,${imageData}`,
              boundingBox: element.Bounds ? {
                x: element.Bounds[0],
                y: element.Bounds[1],
                width: element.Bounds[2] - element.Bounds[0],
                height: element.Bounds[3] - element.Bounds[1],
              } : undefined,
            });
          }
        }
      }
    }

    return figures;
  }

  private async executeWithRetry<T>(
    operation: () => Promise<AdobeOperationResult<T>>
  ): Promise<AdobeOperationResult<T>> {
    let lastError: any;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = parseAdobeError(error);

        if (!isRetryableError(lastError)) {
          return {
            success: false,
            status: 'failed',
            error: lastError,
          };
        }

        if (attempt < MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, getRetryDelay(attempt)));
        }
      }
    }

    return {
      success: false,
      status: 'failed',
      error: lastError,
    };
  }
}

// Singleton export
export const adobePdfExtract = new AdobePdfExtractClient();
```

### Task 2.4: Create PDF Services Hook

**File: `src/shared/services/adobe/hooks/useAdobePdfServices.ts`**

```typescript
/**
 * React Hook for Adobe PDF Services
 */

import { useState, useCallback } from 'react';
import { adobePdfServices } from '../pdf/pdf-services-client';
import { adobePdfExtract } from '../pdf/pdf-extract/extract-client';
import {
  CreatePdfOptions,
  ExportPdfOptions,
  CombinePdfOptions,
  OcrPdfOptions,
  CompressPdfOptions,
  ProtectPdfOptions,
  ExtractPdfOptions,
  PdfExtractResult,
  ExtractedTable,
} from '../types/pdf-services.types';
import { AdobeOperationResult, AdobeFileRef } from '../types/common';

interface PdfOperationState {
  loading: boolean;
  progress: number;
  status: string;
  error?: string;
}

export function useAdobePdfServices() {
  const [state, setState] = useState<PdfOperationState>({
    loading: false,
    progress: 0,
    status: '',
  });

  const handleProgress = useCallback((progress: { percent: number; status: string }) => {
    setState(prev => ({
      ...prev,
      progress: progress.percent,
      status: progress.status,
    }));
  }, []);

  const createPdf = useCallback(async (options: CreatePdfOptions): Promise<AdobeOperationResult<Blob>> => {
    setState({ loading: true, progress: 0, status: 'Starting...' });
    try {
      const result = await adobePdfServices.createPdf(options, handleProgress);
      setState(prev => ({ ...prev, loading: false }));
      return result;
    } catch (error) {
      setState(prev => ({ ...prev, loading: false, error: String(error) }));
      throw error;
    }
  }, [handleProgress]);

  const exportPdf = useCallback(async (options: ExportPdfOptions): Promise<AdobeOperationResult<Blob>> => {
    setState({ loading: true, progress: 0, status: 'Starting...' });
    try {
      const result = await adobePdfServices.exportPdf(options, handleProgress);
      setState(prev => ({ ...prev, loading: false }));
      return result;
    } catch (error) {
      setState(prev => ({ ...prev, loading: false, error: String(error) }));
      throw error;
    }
  }, [handleProgress]);

  const combinePdfs = useCallback(async (options: CombinePdfOptions): Promise<AdobeOperationResult<Blob>> => {
    setState({ loading: true, progress: 0, status: 'Starting...' });
    try {
      const result = await adobePdfServices.combinePdfs(options, handleProgress);
      setState(prev => ({ ...prev, loading: false }));
      return result;
    } catch (error) {
      setState(prev => ({ ...prev, loading: false, error: String(error) }));
      throw error;
    }
  }, [handleProgress]);

  const ocrPdf = useCallback(async (options: OcrPdfOptions): Promise<AdobeOperationResult<Blob>> => {
    setState({ loading: true, progress: 0, status: 'Starting...' });
    try {
      const result = await adobePdfServices.ocrPdf(options, handleProgress);
      setState(prev => ({ ...prev, loading: false }));
      return result;
    } catch (error) {
      setState(prev => ({ ...prev, loading: false, error: String(error) }));
      throw error;
    }
  }, [handleProgress]);

  const compressPdf = useCallback(async (options: CompressPdfOptions): Promise<AdobeOperationResult<Blob>> => {
    setState({ loading: true, progress: 0, status: 'Starting...' });
    try {
      const result = await adobePdfServices.compressPdf(options, handleProgress);
      setState(prev => ({ ...prev, loading: false }));
      return result;
    } catch (error) {
      setState(prev => ({ ...prev, loading: false, error: String(error) }));
      throw error;
    }
  }, [handleProgress]);

  const protectPdf = useCallback(async (options: ProtectPdfOptions): Promise<AdobeOperationResult<Blob>> => {
    setState({ loading: true, progress: 0, status: 'Starting...' });
    try {
      const result = await adobePdfServices.protectPdf(options, handleProgress);
      setState(prev => ({ ...prev, loading: false }));
      return result;
    } catch (error) {
      setState(prev => ({ ...prev, loading: false, error: String(error) }));
      throw error;
    }
  }, [handleProgress]);

  const extractPdf = useCallback(async (options: ExtractPdfOptions): Promise<AdobeOperationResult<PdfExtractResult>> => {
    setState({ loading: true, progress: 0, status: 'Starting...' });
    try {
      const result = await adobePdfExtract.extract(options, handleProgress);
      setState(prev => ({ ...prev, loading: false }));
      return result;
    } catch (error) {
      setState(prev => ({ ...prev, loading: false, error: String(error) }));
      throw error;
    }
  }, [handleProgress]);

  const extractTables = useCallback(async (input: AdobeFileRef): Promise<AdobeOperationResult<ExtractedTable[]>> => {
    setState({ loading: true, progress: 0, status: 'Starting...' });
    try {
      const result = await adobePdfExtract.extractTables(input, handleProgress);
      setState(prev => ({ ...prev, loading: false }));
      return result;
    } catch (error) {
      setState(prev => ({ ...prev, loading: false, error: String(error) }));
      throw error;
    }
  }, [handleProgress]);

  return {
    // State
    loading: state.loading,
    progress: state.progress,
    status: state.status,
    error: state.error,

    // Operations
    createPdf,
    exportPdf,
    combinePdfs,
    ocrPdf,
    compressPdf,
    protectPdf,
    extractPdf,
    extractTables,
  };
}
```

---

## 6. Phase 3: Document Generation

### Task 3.1: Create Document Generation Types

**File: `src/shared/services/adobe/types/document-generation.types.ts`**

```typescript
/**
 * Adobe Document Generation API Types
 */

import { AdobeFileRef } from './common';

// Template field types
export type TemplateFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'currency'
  | 'boolean'
  | 'image'
  | 'table'
  | 'list'
  | 'conditional';

// Template field definition
export interface TemplateField {
  name: string;
  type: TemplateFieldType;
  required?: boolean;
  defaultValue?: unknown;
  format?: string;
  conditions?: TemplateCondition[];
}

// Conditional logic
export interface TemplateCondition {
  field: string;
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'contains' | 'empty' | 'notEmpty';
  value?: unknown;
  action: 'show' | 'hide' | 'replace';
  replacementValue?: unknown;
}

// Table definition
export interface TemplateTable {
  name: string;
  columns: Array<{
    field: string;
    header: string;
    width?: string;
    format?: string;
  }>;
  dataPath: string;
}

// Template definition
export interface DocumentTemplate {
  id: string;
  name: string;
  description?: string;
  version: string;
  templateFile: AdobeFileRef;
  fields: TemplateField[];
  tables?: TemplateTable[];
  createdAt: Date;
  updatedAt: Date;
}

// Generation options
export interface DocumentGenerationOptions {
  template: AdobeFileRef;
  data: Record<string, unknown>;
  outputFormat?: 'pdf' | 'docx';
  fragments?: Record<string, string>;
  options?: {
    includeFragments?: boolean;
    notifyOnComplete?: boolean;
  };
}

// Generation result
export interface DocumentGenerationResult {
  document: Blob;
  metadata: {
    pageCount: number;
    generatedAt: Date;
    templateId: string;
    outputFormat: string;
  };
}

// Template configurations for DawinOS
export interface QuoteTemplateData {
  // Company
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyLogo?: string;

  // Quote info
  quoteNumber: string;
  quoteDate: string;
  validUntil: string;

  // Customer
  customerName: string;
  customerAddress: string;
  customerEmail: string;
  customerPhone?: string;

  // Items
  lineItems: Array<{
    itemNumber: number;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
  }>;

  // Totals
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;

  // Payment
  paymentTerms: string;
  paymentMethod?: string;
  bankDetails?: string;

  // Notes
  notes?: string;
  termsAndConditions?: string;
}

export interface PayrollTemplateData {
  // Company
  companyName: string;
  companyLogo?: string;
  payPeriod: string;
  payDate: string;

  // Employee
  employeeName: string;
  employeeId: string;
  department: string;
  position: string;
  bankAccount?: string;

  // Earnings
  earnings: Array<{
    description: string;
    hours?: number;
    rate?: number;
    amount: number;
  }>;
  grossPay: number;

  // Deductions
  deductions: Array<{
    description: string;
    amount: number;
  }>;
  totalDeductions: number;

  // Taxes
  paye: number;
  nssf: number;
  lst?: number;

  // Net
  netPay: number;
  currency: string;

  // YTD
  ytdGross?: number;
  ytdDeductions?: number;
  ytdNet?: number;
}

export interface ContractTemplateData {
  // Parties
  partyA: {
    name: string;
    address: string;
    representative: string;
    title: string;
  };
  partyB: {
    name: string;
    address: string;
    representative: string;
    title: string;
  };

  // Contract details
  contractNumber: string;
  contractDate: string;
  effectiveDate: string;
  endDate?: string;

  // Terms
  scope: string;
  deliverables: string[];
  paymentTerms: string;
  totalValue: number;
  currency: string;

  // Milestones
  milestones?: Array<{
    description: string;
    dueDate: string;
    amount: number;
  }>;

  // Signatures
  signatureFields: Array<{
    party: 'A' | 'B';
    name: string;
    title: string;
  }>;
}

export interface ReportTemplateData {
  // Header
  reportTitle: string;
  reportDate: string;
  reportPeriod?: string;
  preparedBy: string;

  // Logo and branding
  companyLogo?: string;

  // Executive summary
  executiveSummary?: string;

  // Sections
  sections: Array<{
    title: string;
    content: string;
    charts?: Array<{
      type: 'bar' | 'line' | 'pie' | 'table';
      title: string;
      data: unknown;
    }>;
  }>;

  // Footer
  confidential?: boolean;
  pageNumbering?: boolean;
}
```

### Task 3.2: Create Document Generation Client

**File: `src/shared/services/adobe/document-generation/doc-gen-client.ts`**

```typescript
/**
 * Adobe Document Generation API Client
 */

import {
  DocumentGenerationOptions,
  DocumentGenerationResult,
  DocumentTemplate,
} from '../types/document-generation.types';
import { AdobeOperationResult, ProgressCallback } from '../types/common';
import { AdobeTokenManager } from '../auth/token-manager';
import { parseAdobeError, isRetryableError, getRetryDelay } from '../utils/error-handler';

const API_BASE_URL = 'https://pdf-services.adobe.io';
const MAX_RETRIES = 3;

export class AdobeDocumentGenerationClient {
  private tokenManager: AdobeTokenManager;

  constructor() {
    this.tokenManager = AdobeTokenManager.getInstance();
  }

  /**
   * Generate document from template
   */
  async generate(
    options: DocumentGenerationOptions,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<DocumentGenerationResult>> {
    return this.executeWithRetry(async () => {
      onProgress?.({ percent: 10, status: 'Preparing template...' });

      const token = await this.getAccessToken();

      onProgress?.({ percent: 20, status: 'Uploading template...' });
      const templateAssetId = await this.uploadAsset(token, options.template);

      onProgress?.({ percent: 40, status: 'Generating document...' });
      const jobId = await this.startGenerationJob(token, templateAssetId, options);

      onProgress?.({ percent: 60, status: 'Processing...' });
      const result = await this.pollJobStatus(token, jobId, onProgress);

      onProgress?.({ percent: 100, status: 'Complete' });

      return {
        success: true,
        status: 'completed',
        data: {
          document: result,
          metadata: {
            pageCount: 0, // Would need to parse PDF to get this
            generatedAt: new Date(),
            templateId: options.template.fileName || 'unknown',
            outputFormat: options.outputFormat || 'pdf',
          },
        },
      };
    });
  }

  /**
   * Generate quote document
   */
  async generateQuote(
    templatePath: string,
    data: import('../types/document-generation.types').QuoteTemplateData,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<DocumentGenerationResult>> {
    return this.generate({
      template: {
        type: 'url',
        value: templatePath,
        fileName: 'quote-template.docx',
      },
      data: data as unknown as Record<string, unknown>,
      outputFormat: 'pdf',
    }, onProgress);
  }

  /**
   * Generate payroll document
   */
  async generatePayroll(
    templatePath: string,
    data: import('../types/document-generation.types').PayrollTemplateData,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<DocumentGenerationResult>> {
    return this.generate({
      template: {
        type: 'url',
        value: templatePath,
        fileName: 'payroll-template.docx',
      },
      data: data as unknown as Record<string, unknown>,
      outputFormat: 'pdf',
    }, onProgress);
  }

  /**
   * Generate contract document
   */
  async generateContract(
    templatePath: string,
    data: import('../types/document-generation.types').ContractTemplateData,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<DocumentGenerationResult>> {
    return this.generate({
      template: {
        type: 'url',
        value: templatePath,
        fileName: 'contract-template.docx',
      },
      data: data as unknown as Record<string, unknown>,
      outputFormat: 'pdf',
    }, onProgress);
  }

  /**
   * Generate report document
   */
  async generateReport(
    templatePath: string,
    data: import('../types/document-generation.types').ReportTemplateData,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<DocumentGenerationResult>> {
    return this.generate({
      template: {
        type: 'url',
        value: templatePath,
        fileName: 'report-template.docx',
      },
      data: data as unknown as Record<string, unknown>,
      outputFormat: 'pdf',
    }, onProgress);
  }

  // Private methods

  private async getAccessToken(): Promise<string> {
    const cached = this.tokenManager.getCachedToken('pdf-services');
    if (cached) return cached;

    const response = await fetch('/api/adobe/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'pdf-services' }),
    });

    if (!response.ok) {
      throw new Error('Failed to get Adobe access token');
    }

    const { accessToken, expiresIn } = await response.json();
    this.tokenManager.cacheToken('pdf-services', accessToken, expiresIn);

    return accessToken;
  }

  private async uploadAsset(token: string, fileRef: import('../types/common').AdobeFileRef): Promise<string> {
    let blob: Blob;

    switch (fileRef.type) {
      case 'url':
        const response = await fetch(fileRef.value as string);
        blob = await response.blob();
        break;
      case 'base64':
        const binaryString = atob(fileRef.value as string);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        blob = new Blob([bytes]);
        break;
      case 'buffer':
        blob = new Blob([fileRef.value as Buffer]);
        break;
      default:
        throw new Error(`Unsupported file reference type: ${fileRef.type}`);
    }

    const formData = new FormData();
    formData.append('file', blob, fileRef.fileName || 'template.docx');

    const uploadResponse = await fetch(`${API_BASE_URL}/assets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': import.meta.env.VITE_ADOBE_CLIENT_ID,
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Asset upload failed: ${uploadResponse.statusText}`);
    }

    const { assetID } = await uploadResponse.json();
    return assetID;
  }

  private async startGenerationJob(
    token: string,
    templateAssetId: string,
    options: DocumentGenerationOptions
  ): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/operation/documentgeneration`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': import.meta.env.VITE_ADOBE_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assetID: templateAssetId,
        outputFormat: options.outputFormat || 'pdf',
        jsonDataForMerge: options.data,
        fragments: options.fragments,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Document generation failed: ${error}`);
    }

    const location = response.headers.get('location');
    return location?.split('/').pop() || '';
  }

  private async pollJobStatus(
    token: string,
    jobId: string,
    onProgress?: ProgressCallback
  ): Promise<Blob> {
    const maxAttempts = 60;
    const pollInterval = 5000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(`${API_BASE_URL}/operation/${jobId}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-api-key': import.meta.env.VITE_ADOBE_CLIENT_ID,
        },
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.statusText}`);
      }

      const status = await response.json();

      if (status.status === 'done') {
        const resultResponse = await fetch(status.asset.downloadUri);
        return resultResponse.blob();
      }

      if (status.status === 'failed') {
        throw new Error(`Generation failed: ${status.error?.message || 'Unknown error'}`);
      }

      const progressPercent = 60 + (attempt / maxAttempts) * 35;
      onProgress?.({ percent: progressPercent, status: 'Generating document...' });

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Document generation timed out');
  }

  private async executeWithRetry<T>(
    operation: () => Promise<AdobeOperationResult<T>>
  ): Promise<AdobeOperationResult<T>> {
    let lastError: any;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = parseAdobeError(error);

        if (!isRetryableError(lastError)) {
          return {
            success: false,
            status: 'failed',
            error: lastError,
          };
        }

        if (attempt < MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, getRetryDelay(attempt)));
        }
      }
    }

    return {
      success: false,
      status: 'failed',
      error: lastError,
    };
  }
}

// Singleton export
export const adobeDocumentGeneration = new AdobeDocumentGenerationClient();
```

---

## 7. Phase 4: Adobe Sign Integration

> **Note:** Phase 4-6 implementation details follow the same patterns established in Phases 1-3.
> The full implementation code is provided in the supplementary files.

### Task 4.1: Create Adobe Sign Types

**File: `src/shared/services/adobe/types/sign.types.ts`**

```typescript
/**
 * Adobe Sign API Types
 */

// Agreement status
export type AgreementStatus =
  | 'DRAFT'
  | 'OUT_FOR_SIGNATURE'
  | 'SIGNED'
  | 'APPROVED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'WAITING_FOR_AUTHORING'
  | 'WAITING_FOR_MY_SIGNATURE';

// Signer role
export type SignerRole = 'SIGNER' | 'APPROVER' | 'ACCEPTOR' | 'FORM_FILLER' | 'DELEGATE_TO_SIGNER';

// Authentication method
export type AuthMethod = 'NONE' | 'PASSWORD' | 'PHONE' | 'KBA' | 'WEB_IDENTITY';

// Participant info
export interface SignatureParticipant {
  email: string;
  name?: string;
  role: SignerRole;
  order?: number;
  authenticationMethod?: AuthMethod;
  securityOptions?: {
    password?: string;
    phoneNumber?: string;
  };
}

// Agreement creation options
export interface CreateAgreementOptions {
  name: string;
  document: import('./common').AdobeFileRef;
  participants: SignatureParticipant[];
  message?: string;
  signatureType?: 'ESIGN' | 'WRITTEN';
  expirationDays?: number;
  reminderFrequency?: 'DAILY' | 'WEEKLY' | 'BUSINESS_DAILY';
  ccs?: string[];
  externalId?: {
    id: string;
    group?: string;
  };
  mergeFields?: Record<string, string>;
  callbackUrl?: string;
}

// Agreement info
export interface Agreement {
  id: string;
  name: string;
  status: AgreementStatus;
  participants: Array<{
    email: string;
    name?: string;
    role: SignerRole;
    status: 'WAITING' | 'COMPLETED' | 'CANCELLED';
    signedAt?: Date;
  }>;
  createdAt: Date;
  expiresAt?: Date;
  completedAt?: Date;
  signedDocumentUrl?: string;
  auditTrailUrl?: string;
}

// Webhook event types
export type SignWebhookEventType =
  | 'AGREEMENT_CREATED'
  | 'AGREEMENT_ACTION_REQUESTED'
  | 'AGREEMENT_ACTION_COMPLETED'
  | 'AGREEMENT_COMPLETED'
  | 'AGREEMENT_EXPIRED'
  | 'AGREEMENT_RECALLED'
  | 'AGREEMENT_REJECTED';

// Webhook payload
export interface SignWebhookPayload {
  eventType: SignWebhookEventType;
  eventId: string;
  eventDate: string;
  agreement: {
    id: string;
    name: string;
    status: AgreementStatus;
  };
  participantInfo?: {
    email: string;
    role: SignerRole;
    status: string;
  };
}

// DawinOS-specific workflows
export interface QuoteSignatureRequest {
  quoteId: string;
  quotePdf: import('./common').AdobeFileRef;
  customerEmail: string;
  customerName: string;
  validUntilDays?: number;
  internalApproverEmail?: string;
  message?: string;
}

export interface ContractSignatureRequest {
  contractId: string;
  contractPdf: import('./common').AdobeFileRef;
  parties: Array<{
    email: string;
    name: string;
    company: string;
    role: 'client' | 'company';
  }>;
  validUntilDays?: number;
  message?: string;
}

export interface HRDocumentSignatureRequest {
  documentId: string;
  documentType: 'contract' | 'offer-letter' | 'nda' | 'policy-acknowledgment';
  documentPdf: import('./common').AdobeFileRef;
  employeeEmail: string;
  employeeName: string;
  hrApproverEmail?: string;
  managerEmail?: string;
  message?: string;
}
```

---

## 8. Phase 5: Image Services

### Task 5.1: Create Photoshop API Types

**File: `src/shared/services/adobe/types/photoshop.types.ts`**

```typescript
/**
 * Adobe Photoshop API Types
 */

import { AdobeFileRef } from './common';

// Image format
export type ImageFormat = 'jpeg' | 'png' | 'psd' | 'tiff';

// Remove background options
export interface RemoveBackgroundOptions {
  input: AdobeFileRef;
  outputFormat?: ImageFormat;
  quality?: number; // 1-100 for JPEG
}

// Smart crop options
export interface SmartCropOptions {
  input: AdobeFileRef;
  width: number;
  height: number;
  focalPoint?: { x: number; y: number };
  outputFormat?: ImageFormat;
}

// Auto tone options
export interface AutoToneOptions {
  input: AdobeFileRef;
  outputFormat?: ImageFormat;
}

// Resize options
export interface ResizeOptions {
  input: AdobeFileRef;
  width?: number;
  height?: number;
  scale?: number;
  maintainAspectRatio?: boolean;
  outputFormat?: ImageFormat;
}

// Batch processing options
export interface BatchProcessOptions {
  inputs: AdobeFileRef[];
  operations: Array<{
    type: 'removeBackground' | 'smartCrop' | 'autoTone' | 'resize';
    options: Record<string, unknown>;
  }>;
  outputFormat?: ImageFormat;
}

// Processing result
export interface PhotoshopResult {
  output: Blob;
  metadata: {
    originalSize: { width: number; height: number };
    outputSize: { width: number; height: number };
    format: ImageFormat;
    fileSize: number;
  };
}

// Batch result
export interface BatchResult {
  results: Array<{
    index: number;
    success: boolean;
    output?: Blob;
    error?: string;
  }>;
  successCount: number;
  failureCount: number;
}
```

### Task 5.2: Create Firefly API Types

**File: `src/shared/services/adobe/types/firefly.types.ts`**

```typescript
/**
 * Adobe Firefly API Types
 */

import { AdobeFileRef } from './common';

// Content class
export type ContentClass = 'photo' | 'art';

// Style preset
export type StylePreset =
  | 'photo'
  | 'art'
  | 'graphic'
  | 'bw'
  | 'cool_colors'
  | 'golden'
  | 'monochromatic'
  | 'muted_colors'
  | 'pastel_colors'
  | 'toned_image'
  | 'vibrant_colors'
  | 'warm_colors';

// Text to image options
export interface TextToImageOptions {
  prompt: string;
  negativePrompt?: string;
  contentClass?: ContentClass;
  style?: {
    presets?: StylePreset[];
    referenceImage?: AdobeFileRef;
    strength?: number; // 0-100
  };
  size?: {
    width: number;
    height: number;
  };
  count?: number; // 1-4
  seed?: number;
}

// Generative fill options
export interface GenerativeFillOptions {
  input: AdobeFileRef;
  mask: AdobeFileRef;
  prompt: string;
  negativePrompt?: string;
  count?: number;
}

// Generative expand options
export interface GenerativeExpandOptions {
  input: AdobeFileRef;
  size: {
    width: number;
    height: number;
  };
  placement?: {
    horizontal: 'left' | 'center' | 'right';
    vertical: 'top' | 'center' | 'bottom';
  };
  prompt?: string;
}

// Style transfer options
export interface StyleTransferOptions {
  contentImage: AdobeFileRef;
  styleImage: AdobeFileRef;
  strength?: number; // 0-100
}

// Generate variations options
export interface GenerateVariationsOptions {
  referenceImage: AdobeFileRef;
  count?: number; // 1-4
  strength?: number; // 0-100
  seed?: number;
}

// Generation result
export interface FireflyResult {
  images: Blob[];
  seeds: number[];
  metadata: {
    prompt: string;
    contentClass: ContentClass;
    size: { width: number; height: number };
  };
}
```

---

## 9. Phase 6: Creative Cloud Libraries

### Task 6.1: Create CC Libraries Types

**File: `src/shared/services/adobe/types/cc-libraries.types.ts`**

```typescript
/**
 * Adobe Creative Cloud Libraries API Types
 */

// Library element types
export type LibraryElementType =
  | 'image'
  | 'graphic'
  | 'color'
  | 'character-style'
  | 'paragraph-style'
  | 'brush'
  | 'color-theme';

// Library element
export interface LibraryElement {
  id: string;
  name: string;
  type: LibraryElementType;
  createdAt: Date;
  modifiedAt: Date;
  thumbnail?: string;
  representations: Array<{
    type: string;
    storage: string;
    mimeType: string;
    width?: number;
    height?: number;
  }>;
  metadata?: Record<string, unknown>;
}

// Library
export interface Library {
  id: string;
  name: string;
  createdAt: Date;
  modifiedAt: Date;
  elementCount: number;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  collaborators?: Array<{
    id: string;
    name: string;
    email: string;
    role: 'owner' | 'editor' | 'viewer';
  }>;
}

// Brand asset
export interface BrandAsset {
  id: string;
  name: string;
  category: 'logo' | 'color' | 'typography' | 'image' | 'graphic';
  libraryId: string;
  elementId: string;
  usage: string[];
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
}

// Sync options
export interface LibrarySyncOptions {
  libraryId: string;
  direction: 'push' | 'pull' | 'sync';
  elements?: string[];
  overwriteExisting?: boolean;
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

Create test files for each service:

**File: `src/shared/services/adobe/__tests__/pdf-services.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adobePdfServices } from '../pdf/pdf-services-client';

// Mock fetch
global.fetch = vi.fn();

describe('AdobePdfServicesClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPdf', () => {
    it('should create PDF from HTML', async () => {
      // Mock token endpoint
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ accessToken: 'test-token', expiresIn: 3600 }),
      });

      // Mock asset upload
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ assetID: 'test-asset-id' }),
      });

      // Mock job creation
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ location: '/operation/test-job-id' }),
      });

      // Mock status check
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'done',
          asset: { downloadUri: 'https://example.com/result.pdf' },
        }),
      });

      // Mock result download
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(['PDF content'])),
      });

      const result = await adobePdfServices.createPdf({
        input: { type: 'base64', value: btoa('test html') },
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Blob);
    });
  });
});
```

### 10.2 Integration Tests

**File: `src/shared/services/adobe/__tests__/integration/pdf-extract.integration.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { adobePdfExtract } from '../../pdf/pdf-extract/extract-client';

// Skip if no credentials
const skipIntegration = !import.meta.env.VITE_ADOBE_CLIENT_ID;

describe.skipIf(skipIntegration)('PDF Extract Integration', () => {
  it('should extract tables from PDF', async () => {
    const testPdfUrl = 'https://example.com/test-boq.pdf';

    const result = await adobePdfExtract.extractTables({
      type: 'url',
      value: testPdfUrl,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeInstanceOf(Array);
  }, 60000); // 60 second timeout for API
});
```

---

## 11. Migration Guide

### 11.1 Migrating Quote PDF Generator

**Current file:** `src/modules/design-manager/services/quote-pdf-generator.tsx`

**Steps:**

1. Create data mapper to convert existing quote data to `QuoteTemplateData`
2. Create DOCX template with merge fields
3. Update `generateQuotePdf` function to use Adobe Document Generation
4. Add fallback to existing React-PDF generation

```typescript
// src/modules/design-manager/services/quote-pdf-generator.tsx

import { adobeDocumentGeneration } from '@/shared/services/adobe';
import { isAdobeServiceEnabled } from '@/shared/services/adobe/config';
import { QuoteTemplateData } from '@/shared/services/adobe/types/document-generation.types';

// Existing imports...

export async function generateQuotePdf(
  quote: Quote,
  options?: { useAdobe?: boolean }
): Promise<Blob> {
  // Use Adobe if enabled and requested
  if (options?.useAdobe && isAdobeServiceEnabled('pdfServices')) {
    const templateData = mapQuoteToTemplateData(quote);
    const result = await adobeDocumentGeneration.generateQuote(
      '/templates/quote-template.docx',
      templateData
    );

    if (result.success && result.data) {
      return result.data.document;
    }

    console.warn('Adobe generation failed, falling back to React-PDF:', result.error);
  }

  // Fallback to existing React-PDF implementation
  return generateQuotePdfLegacy(quote);
}

function mapQuoteToTemplateData(quote: Quote): QuoteTemplateData {
  return {
    companyName: 'Dawin Finishes',
    companyAddress: quote.companyAddress || '',
    companyPhone: quote.companyPhone || '',
    companyEmail: quote.companyEmail || '',
    companyLogo: '/assets/logo.png',

    quoteNumber: quote.quoteNumber,
    quoteDate: formatDate(quote.createdAt),
    validUntil: formatDate(quote.validUntil),

    customerName: quote.customer.name,
    customerAddress: formatAddress(quote.customer.address),
    customerEmail: quote.customer.email,
    customerPhone: quote.customer.phone,

    lineItems: quote.items.map((item, index) => ({
      itemNumber: index + 1,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit || 'pcs',
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    })),

    subtotal: quote.subtotal,
    taxRate: quote.taxRate,
    taxAmount: quote.taxAmount,
    total: quote.total,
    currency: quote.currency || 'UGX',

    paymentTerms: quote.paymentTerms || '50% deposit, 50% on delivery',
    paymentMethod: quote.paymentMethod,
    bankDetails: quote.bankDetails,

    notes: quote.notes,
    termsAndConditions: quote.termsAndConditions,
  };
}
```

### 11.2 Migrating BOQ Import

**Current file:** `src/subsidiaries/advisory/matflow/services/boqParsing.ts`

**Steps:**

1. Add PDF detection to file upload
2. Use Adobe PDF Extract for PDF files
3. Parse extracted tables into BOQ format
4. Maintain CSV import as primary method

```typescript
// src/subsidiaries/advisory/matflow/services/boqParsing.ts

import { adobePdfExtract } from '@/shared/services/adobe';
import { isAdobeServiceEnabled } from '@/shared/services/adobe/config';

export async function parseBOQFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<BOQItem[]> {
  const fileType = file.type;

  // PDF handling with Adobe Extract
  if (fileType === 'application/pdf' && isAdobeServiceEnabled('pdfServices')) {
    onProgress?.(10);

    const buffer = await file.arrayBuffer();
    const result = await adobePdfExtract.extractTables({
      type: 'buffer',
      value: Buffer.from(buffer),
      fileName: file.name,
    }, (p) => onProgress?.(10 + p.percent * 0.7));

    if (result.success && result.data) {
      onProgress?.(80);
      const boqItems = convertTablesToBOQ(result.data);
      onProgress?.(100);
      return boqItems;
    }

    throw new Error(`PDF extraction failed: ${result.error?.message}`);
  }

  // CSV handling (existing logic)
  if (fileType === 'text/csv' || file.name.endsWith('.csv')) {
    return parseCSVBOQ(file, onProgress);
  }

  // Excel handling (existing logic)
  if (fileType.includes('spreadsheet') || file.name.endsWith('.xlsx')) {
    return parseExcelBOQ(file, onProgress);
  }

  throw new Error(`Unsupported file type: ${fileType}`);
}

function convertTablesToBOQ(tables: ExtractedTable[]): BOQItem[] {
  const items: BOQItem[] = [];

  for (const table of tables) {
    // Detect header row
    const headers = table.headers || table.rows[0];
    const dataRows = table.headers ? table.rows : table.rows.slice(1);

    // Map columns to BOQ fields
    const columnMap = detectBOQColumns(headers);

    for (const row of dataRows) {
      const item = mapRowToBOQItem(row, columnMap);
      if (item) {
        items.push(item);
      }
    }
  }

  return items;
}

function detectBOQColumns(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};

  headers.forEach((header, index) => {
    const normalized = header.toLowerCase().trim();

    if (normalized.includes('item') || normalized.includes('no')) {
      map.itemNumber = index;
    } else if (normalized.includes('description') || normalized.includes('desc')) {
      map.description = index;
    } else if (normalized.includes('qty') || normalized.includes('quantity')) {
      map.quantity = index;
    } else if (normalized.includes('unit') && !normalized.includes('price')) {
      map.unit = index;
    } else if (normalized.includes('rate') || normalized.includes('unit price')) {
      map.unitPrice = index;
    } else if (normalized.includes('amount') || normalized.includes('total')) {
      map.amount = index;
    }
  });

  return map;
}
```

---

## 12. Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Invalid/expired token | Clear token cache, check credentials |
| `429 Too Many Requests` | Rate limit exceeded | Implement backoff, check quota |
| `INVALID_FILE_FORMAT` | Unsupported input format | Check supported formats list |
| `OPERATION_TIMEOUT` | Large file or slow processing | Increase timeout, use polling |
| `CORS Error` | Direct API call from browser | Route through Firebase Function |

### Debug Mode

Enable debug logging:

```typescript
// src/shared/services/adobe/config.ts

export const ADOBE_DEBUG = import.meta.env.DEV || import.meta.env.VITE_ADOBE_DEBUG === 'true';

export function logAdobeDebug(message: string, data?: unknown): void {
  if (ADOBE_DEBUG) {
    console.log(`[Adobe] ${message}`, data);
  }
}
```

### Health Check Endpoint

**File: `functions/src/adobe/health-check.ts`**

```typescript
import * as functions from 'firebase-functions';

export const adobeHealthCheck = functions.https.onRequest(async (req, res) => {
  const services = {
    pdfServices: false,
    sign: false,
    firefly: false,
  };

  try {
    // Check PDF Services
    const pdfToken = await getAdobeToken('pdf-services');
    services.pdfServices = !!pdfToken;
  } catch (e) {
    // Service unavailable
  }

  try {
    // Check Sign
    const signToken = await getAdobeToken('sign');
    services.sign = !!signToken;
  } catch (e) {
    // Service unavailable
  }

  try {
    // Check Firefly
    const fireflyToken = await getAdobeToken('firefly');
    services.firefly = !!fireflyToken;
  } catch (e) {
    // Service unavailable
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services,
  });
});
```

---

## Quick Reference: Claude Code Prompts

Use these prompts when working with Claude Code in Windsurf:

### Initial Setup
```
Read the Adobe integration plan at docs/ADOBE_INTEGRATION_IMPLEMENTATION_PLAN.md and create the foundation layer (Phase 1). Create all directories, config files, and type definitions as specified.
```

### PDF Services
```
Implement Phase 2 (PDF Services) from the Adobe integration plan. Create the PDF services client, extract client, and React hook. Follow the patterns established in the plan.
```

### Document Generation
```
Implement Phase 3 (Document Generation) from the Adobe integration plan. Create the document generation client with support for quotes, payroll, contracts, and reports.
```

### Adobe Sign
```
Implement Phase 4 (Adobe Sign) from the Adobe integration plan. Create the Sign client with agreement creation, status tracking, and webhook handling.
```

### Image Services
```
Implement Phase 5 (Image Services) from the Adobe integration plan. Create Photoshop, Lightroom, and Firefly clients with batch processing support.
```

### Migration
```
Migrate the quote PDF generator (src/modules/design-manager/services/quote-pdf-generator.tsx) to use Adobe Document Generation as described in the migration guide section of docs/ADOBE_INTEGRATION_IMPLEMENTATION_PLAN.md.
```

---

## Appendix: Environment Variables Checklist

```bash
# Required for Phase 1-3
VITE_ADOBE_PDF_SERVICES_ENABLED=true
VITE_ADOBE_CLIENT_ID=xxx
VITE_ADOBE_ORG_ID=xxx
VITE_ADOBE_TECHNICAL_ACCOUNT_ID=xxx

# Server-side only (Firebase Functions)
ADOBE_CLIENT_SECRET=xxx
ADOBE_PRIVATE_KEY=xxx

# Required for Phase 4
VITE_ADOBE_SIGN_ENABLED=true
VITE_ADOBE_SIGN_CLIENT_ID=xxx
VITE_ADOBE_SIGN_BASE_URI=https://api.na1.adobesign.com

# Server-side only
ADOBE_SIGN_CLIENT_SECRET=xxx
ADOBE_SIGN_REFRESH_TOKEN=xxx

# Required for Phase 5
VITE_ADOBE_FIREFLY_ENABLED=true
VITE_ADOBE_FIREFLY_CLIENT_ID=xxx

# Server-side only
ADOBE_FIREFLY_CLIENT_SECRET=xxx

# Required for Phase 6
VITE_ADOBE_CC_LIBRARIES_ENABLED=true
VITE_ADOBE_CC_API_KEY=xxx
```

---

**Document Version:** 1.0.0
**Last Updated:** 2026-01-25
**Author:** Claude Code Analysis

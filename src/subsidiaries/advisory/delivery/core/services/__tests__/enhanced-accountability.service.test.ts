/**
 * ENHANCED ACCOUNTABILITY SERVICE TESTS
 *
 * Unit tests for EnhancedAccountabilityService with ADD-FIN-001 functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Timestamp, getDocs } from 'firebase/firestore';
import type { ProofOfSpendDocument } from '../../../types/accountability';
import { EnhancedAccountabilityService } from '../enhanced-accountability.service';

describe('EnhancedAccountabilityService', () => {
  let service: EnhancedAccountabilityService;
  const mockFirestore = {} as any;
  const userId = 'user-456';

  beforeEach(() => {
    service = new EnhancedAccountabilityService(mockFirestore);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ───────────────────────────────────────────────────────────────
  // PROOF OF SPEND TESTS
  // ───────────────────────────────────────────────────────────────

  describe('validateDocumentQuality', () => {
    it('should validate document with sufficient DPI', () => {
      const document: ProofOfSpendDocument = {
        id: 'doc-1',
        type: 'invoice',
        documentUrl: 'https://storage.example.com/invoice.pdf',
        documentName: 'invoice.pdf',
        uploadedAt: Timestamp.now(),
        uploadedBy: userId,
        fileSize: 50000,
        mimeType: 'application/pdf',
        dpi: 300,
        isQualityValid: true,
      };

      const result = service.validateDocumentQuality(
        document,
        'construction_materials'
      );

      expect(result.valid).toBe(true);
    });

    it('should reject document with insufficient DPI', () => {
      const document: ProofOfSpendDocument = {
        id: 'doc-1',
        type: 'invoice',
        documentUrl: 'https://storage.example.com/invoice.pdf',
        documentName: 'invoice.pdf',
        uploadedAt: Timestamp.now(),
        uploadedBy: userId,
        fileSize: 50000,
        mimeType: 'application/pdf',
        dpi: 150,
        isQualityValid: false,
      };

      const result = service.validateDocumentQuality(
        document,
        'construction_materials'
      );

      expect(result.valid).toBe(false);
    });

    it('should warn when DPI information unavailable', () => {
      const document: ProofOfSpendDocument = {
        id: 'doc-1',
        type: 'invoice',
        documentUrl: 'https://storage.example.com/invoice.pdf',
        documentName: 'invoice.pdf',
        uploadedAt: Timestamp.now(),
        uploadedBy: userId,
        fileSize: 50000,
        mimeType: 'application/pdf',
        isQualityValid: false,
      };

      const result = service.validateDocumentQuality(
        document,
        'construction_materials'
      );

      expect(result.valid).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // REPORTING TESTS
  // ───────────────────────────────────────────────────────────────

  describe('getVarianceSummary', () => {
    it('should calculate variance summary for project', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [
          {
            id: 'acc-1',
            data: () => ({
              variance: {
                varianceAmount: 0,
                varianceStatus: 'compliant',
                isZeroDiscrepancy: true,
                requiresInvestigation: false,
              },
            }),
          },
          {
            id: 'acc-2',
            data: () => ({
              variance: {
                varianceAmount: 150,
                varianceStatus: 'minor',
                isZeroDiscrepancy: false,
                requiresInvestigation: false,
              },
            }),
          },
        ],
      } as any);

      const summary = await service.getVarianceSummary('project-1');

      expect(summary.totalAccountabilities).toBe(2);
      expect(summary.zeroDiscrepancyCount).toBe(1);
    });
  });
});

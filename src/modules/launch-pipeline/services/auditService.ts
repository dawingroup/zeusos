/**
 * Audit Service
 * Client-side service for product catalog auditing
 * Uses REST API pattern for Cloud Function calls
 */

import { collection, addDoc, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { AuditResult, AuditConfig, AuditIssue } from '../types/audit.types';

const API_BASE = 'https://api-okekivpl2a-uc.a.run.app';
const AUDIT_COLLECTION = 'productAudits';

/**
 * Default audit configuration
 */
export function getDefaultAuditConfig(): AuditConfig {
  return {
    enabledCategories: [
      'content_completeness',
      'seo_quality',
      'image_optimization',
      'schema_data',
      'brand_consistency',
    ],
    severityThresholds: {
      critical: 0,
      high: 25,
      medium: 50,
      low: 75,
    },
    minDescriptionLength: 100,
    maxDescriptionLength: 5000,
    minImageCount: 3,
    brandTerms: {
      required: ['Dawin', 'custom', 'crafted', 'millwork'],
      prohibited: ['cheap', 'discount', 'knockoff', 'fake'],
    },
  };
}

export const auditService = {
  /**
   * Audit a single product
   */
  async auditProduct(
    productId: string, 
    shopifyProduct: any, 
    config: AuditConfig = getDefaultAuditConfig()
  ): Promise<AuditResult> {
    // Run audit via API
    const response = await fetch(`${API_BASE}/api/ai/audit-product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopifyProduct, auditConfig: config }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to audit product');
    }

    const auditData = await response.json();

    // Build result with metadata
    const result: Omit<AuditResult, 'id'> = {
      productId,
      shopifyProductId: shopifyProduct.id?.toString() || '',
      auditedAt: Timestamp.now(),
      auditType: 'manual',
      productStatus: shopifyProduct.status || 'unknown',
      overallScore: auditData.overallScore,
      categoryScores: auditData.categoryScores,
      issues: auditData.issues || [],
      recommendations: auditData.recommendations || [],
    };

    // Save result to Firestore
    const docRef = await addDoc(collection(db, AUDIT_COLLECTION), result);
    return { ...result, id: docRef.id } as AuditResult;
  },

  /**
   * Get the latest audit for a product
   */
  async getLatestAudit(productId: string): Promise<AuditResult | null> {
    const q = query(
      collection(db, AUDIT_COLLECTION),
      where('productId', '==', productId),
      orderBy('auditedAt', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as AuditResult;
  },

  /**
   * Get audit history for a product
   */
  async getAuditHistory(productId: string, limitCount = 10): Promise<AuditResult[]> {
    const q = query(
      collection(db, AUDIT_COLLECTION),
      where('productId', '==', productId),
      orderBy('auditedAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditResult));
  },

  /**
   * Get overall catalog health metrics
   */
  async getCatalogHealth(): Promise<{ 
    totalProducts: number; 
    avgScore: number; 
    criticalIssues: number;
    highIssues: number;
    scoreDistribution: { excellent: number; good: number; fair: number; poor: number };
  }> {
    // Get all audits, ordered by date
    const q = query(collection(db, AUDIT_COLLECTION), orderBy('auditedAt', 'desc'));
    const snapshot = await getDocs(q);
    
    // Keep only the latest audit per product
    const latestByProduct = new Map<string, AuditResult>();
    snapshot.docs.forEach(doc => {
      const data = { id: doc.id, ...doc.data() } as AuditResult;
      if (!latestByProduct.has(data.productId)) {
        latestByProduct.set(data.productId, data);
      }
    });

    const audits = Array.from(latestByProduct.values());
    
    // Calculate metrics
    const totalScore = audits.reduce((sum, a) => sum + (a.overallScore || 0), 0);
    const criticalIssues = audits.reduce(
      (sum, a) => sum + (a.issues?.filter((i: AuditIssue) => i.severity === 'critical').length || 0),
      0
    );
    const highIssues = audits.reduce(
      (sum, a) => sum + (a.issues?.filter((i: AuditIssue) => i.severity === 'high').length || 0),
      0
    );

    // Score distribution
    const scoreDistribution = {
      excellent: audits.filter(a => a.overallScore >= 90).length,
      good: audits.filter(a => a.overallScore >= 70 && a.overallScore < 90).length,
      fair: audits.filter(a => a.overallScore >= 50 && a.overallScore < 70).length,
      poor: audits.filter(a => a.overallScore < 50).length,
    };

    return {
      totalProducts: audits.length,
      avgScore: audits.length > 0 ? Math.round(totalScore / audits.length) : 0,
      criticalIssues,
      highIssues,
      scoreDistribution,
    };
  },

  /**
   * Get products with critical issues
   */
  async getProductsWithCriticalIssues(): Promise<AuditResult[]> {
    const q = query(collection(db, AUDIT_COLLECTION), orderBy('auditedAt', 'desc'));
    const snapshot = await getDocs(q);
    
    const latestByProduct = new Map<string, AuditResult>();
    snapshot.docs.forEach(doc => {
      const data = { id: doc.id, ...doc.data() } as AuditResult;
      if (!latestByProduct.has(data.productId)) {
        latestByProduct.set(data.productId, data);
      }
    });

    return Array.from(latestByProduct.values()).filter(
      audit => audit.issues?.some((i: AuditIssue) => i.severity === 'critical')
    );
  },

  /**
   * Batch audit multiple products
   */
  async batchAudit(
    products: Array<{ productId: string; shopifyProduct: any }>,
    config: AuditConfig = getDefaultAuditConfig()
  ): Promise<AuditResult[]> {
    const results: AuditResult[] = [];
    
    for (const { productId, shopifyProduct } of products) {
      try {
        const result = await this.auditProduct(productId, shopifyProduct, config);
        results.push(result);
      } catch (error) {
        console.error(`Failed to audit product ${productId}:`, error);
      }
    }
    
    return results;
  },
};

export default auditService;

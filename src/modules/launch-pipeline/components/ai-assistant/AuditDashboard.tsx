/**
 * AuditDashboard Component
 * Catalog audit overview with health scores and issue tracking
 */

import { useState } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle, 
  RefreshCw, 
  Loader2,
  Wrench,
  ExternalLink,
} from 'lucide-react';
import type { LaunchProduct } from '../../types/product.types';
import { auditProduct, type ShopifyAuditResult, type ShopifyAuditIssue } from '../../services/shopifyService';
import { KPICard } from '@/shared/components/data-display';

interface AuditDashboardProps {
  products: LaunchProduct[];
  onFixIssue?: (productId: string, issueId: string, fixAction: string) => void;
}

interface ProductAuditCard {
  product: LaunchProduct;
  audit: ShopifyAuditResult;
}

const SEVERITY_CONFIG = {
  error: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Critical' },
  warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Warning' },
  info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Info' },
};

function ScoreGauge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const getColor = (s: number) => {
    if (s >= 80) return 'text-green-500';
    if (s >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const sizeClasses = {
    sm: 'w-16 h-16 text-lg',
    md: 'w-24 h-24 text-2xl',
    lg: 'w-32 h-32 text-3xl',
  };

  return (
    <div className={`relative ${sizeClasses[size]} flex items-center justify-center`}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <path
          d="M18 2.0845
            a 15.9155 15.9155 0 0 1 0 31.831
            a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="3"
        />
        <path
          d="M18 2.0845
            a 15.9155 15.9155 0 0 1 0 31.831
            a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          className={`stroke-current ${getColor(score)}`}
          strokeWidth="3"
          strokeDasharray={`${score}, 100`}
          strokeLinecap="round"
        />
      </svg>
      <span className={`absolute font-bold ${getColor(score)}`}>{score}</span>
    </div>
  );
}

function IssueCard({ issue, onFix }: { issue: ShopifyAuditIssue; onFix?: () => void }) {
  const config = SEVERITY_CONFIG[issue.severity];
  const Icon = config.icon;

  return (
    <div className={`p-3 rounded-lg border ${config.bg} border-opacity-50 flex items-start gap-3`}>
      <Icon className={`w-5 h-5 ${config.color} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{issue.message}</p>
        {issue.field && (
          <p className="text-xs text-gray-500 mt-0.5">Field: {issue.field}</p>
        )}
      </div>
      {onFix && (
        <button
          onClick={onFix}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-white rounded border border-gray-200 hover:bg-gray-50"
        >
          <Wrench className="w-3 h-3" />
          Fix
        </button>
      )}
    </div>
  );
}

export function AuditDashboard({ products, onFixIssue }: AuditDashboardProps) {
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResults, setAuditResults] = useState<ProductAuditCard[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  const runAudit = async () => {
    setIsAuditing(true);
    
    // Audit all products
    const results: ProductAuditCard[] = products.map(product => ({
      product,
      audit: auditProduct(product),
    }));
    
    setAuditResults(results);
    setIsAuditing(false);
  };

  // Calculate aggregate stats
  const totalProducts = auditResults.length;
  const avgScore = totalProducts > 0 
    ? Math.round(auditResults.reduce((sum, r) => sum + r.audit.score, 0) / totalProducts)
    : 0;
  
  const allIssues = auditResults.flatMap(r => 
    r.audit.issues.map(issue => ({ ...issue, productId: r.product.id, productName: r.product.name }))
  );
  
  const issuesBySeverity = {
    error: allIssues.filter(i => i.severity === 'error'),
    warning: allIssues.filter(i => i.severity === 'warning'),
    info: allIssues.filter(i => i.severity === 'info'),
  };

  const selectedResult = selectedProduct 
    ? auditResults.find(r => r.product.id === selectedProduct)
    : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Shield className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Catalog Audit</h3>
              <p className="text-sm text-gray-500">Check product readiness for Shopify</p>
            </div>
          </div>
          <button
            onClick={runAudit}
            disabled={isAuditing || products.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {isAuditing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Run Audit
          </button>
        </div>
      </div>

      {/* No Results */}
      {auditResults.length === 0 && (
        <div className="p-12 text-center">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Audit Results</h4>
          <p className="text-gray-500 mb-4">
            Click "Run Audit" to check {products.length} products for Shopify readiness
          </p>
        </div>
      )}

      {/* Results Overview */}
      {auditResults.length > 0 && (
        <div className="p-6">
          {/* Score Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Overall Score */}
            <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4">
              <ScoreGauge score={avgScore} size="md" />
              <div>
                <p className="text-sm text-gray-500">Overall Score</p>
                <p className="text-lg font-semibold text-gray-900">{totalProducts} Products</p>
              </div>
            </div>

            {/* Critical Issues */}
            <KPICard
              label="Critical"
              value={issuesBySeverity.error.length}
              delta="issues to fix"
              trend={issuesBySeverity.error.length > 0 ? 'down' : undefined}
            />

            {/* Warnings */}
            <KPICard
              label="Warnings"
              value={issuesBySeverity.warning.length}
              delta="recommendations"
            />

            {/* Passed */}
            <KPICard
              label="Ready"
              value={auditResults.filter(r => r.audit.score >= 80).length}
              delta="products ready"
              trend="up"
            />
          </div>

          {/* Product List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Products */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Products</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditResults
                  .sort((a, b) => a.audit.score - b.audit.score)
                  .map(({ product, audit }) => (
                    <button
                      key={product.id}
                      onClick={() => setSelectedProduct(product.id)}
                      className={`w-full p-3 rounded-lg border text-left transition-colors ${
                        selectedProduct === product.id
                          ? 'border-[#872E5C] bg-[#872E5C]/5'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <ScoreGauge score={audit.score} size="sm" />
                          <div>
                            <p className="font-medium text-gray-900">{product.name}</p>
                            <p className="text-sm text-gray-500">
                              {audit.issues.length} issue{audit.issues.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </div>
                    </button>
                  ))}
              </div>
            </div>

            {/* Issue Details */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">
                {selectedResult ? `Issues for "${selectedResult.product.name}"` : 'Select a product'}
              </h4>
              {selectedResult ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {selectedResult.audit.issues.length === 0 ? (
                    <div className="p-4 bg-green-50 rounded-lg text-center">
                      <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <p className="text-green-700 font-medium">All checks passed!</p>
                    </div>
                  ) : (
                    selectedResult.audit.issues.map((issue, index) => (
                      <IssueCard 
                        key={index} 
                        issue={issue}
                        onFix={onFixIssue ? () => onFixIssue(selectedResult.product.id, `${index}`, issue.type) : undefined}
                      />
                    ))
                  )}
                </div>
              ) : (
                <div className="p-8 bg-gray-50 rounded-lg text-center text-gray-500">
                  Click on a product to view its issues
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditDashboard;

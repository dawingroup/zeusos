/**
 * Feature Library Cache Status Component
 * Admin UI for managing the AI context cache
 */

import { useState, useEffect } from 'react';
import { RefreshCw, Database, Clock, Zap, AlertCircle, CheckCircle } from 'lucide-react';

interface CacheStatus {
  status: 'active' | 'expired' | 'not-initialized';
  featureCount?: number;
  tokenCount?: number;
  createdAt?: string;
  expiresAt?: string;
  hoursRemaining?: number;
  estimatedSavings?: string;
  message?: string;
  isExpired?: boolean;
}

const API_BASE = 'https://api-okekivpl2a-uc.a.run.app';

export function FeatureCacheStatus() {
  const [status, setStatus] = useState<CacheStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/ai/feature-cache`);
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError('Failed to load cache status');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshCache = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`${API_BASE}/ai/feature-cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' }),
      });
      const data = await response.json();
      if (data.success) {
        await loadStatus();
      } else {
        setError(data.error || 'Refresh failed');
      }
    } catch (err) {
      setError('Failed to refresh cache');
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="animate-pulse flex items-center gap-4">
          <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  const statusColors = {
    active: 'bg-green-100 text-green-700',
    expired: 'bg-yellow-100 text-yellow-700',
    'not-initialized': 'bg-gray-100 text-gray-700',
  };

  const StatusIcon = status?.status === 'active' ? CheckCircle : 
                     status?.status === 'expired' ? AlertCircle : Database;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${
            status?.status === 'active' ? 'bg-green-100' : 
            status?.status === 'expired' ? 'bg-yellow-100' : 'bg-gray-100'
          }`}>
            <StatusIcon className={`w-5 h-5 ${
              status?.status === 'active' ? 'text-green-600' : 
              status?.status === 'expired' ? 'text-yellow-600' : 'text-gray-600'
            }`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">AI Context Cache</h3>
            <p className="text-sm text-gray-500">Feature Library for Gemini</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[status?.status || 'not-initialized']}`}>
          {status?.status === 'active' ? 'Active' : 
           status?.status === 'expired' ? 'Expired' : 'Not Initialized'}
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {status?.status !== 'not-initialized' && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
              <Database className="w-3.5 h-3.5" />
              Features Cached
            </div>
            <p className="font-semibold text-gray-900">{status?.featureCount || 0}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
              <Zap className="w-3.5 h-3.5" />
              Token Count
            </div>
            <p className="font-semibold text-gray-900">~{status?.tokenCount?.toLocaleString() || 0}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
              <Clock className="w-3.5 h-3.5" />
              Expires In
            </div>
            <p className="font-semibold text-gray-900">
              {status?.isExpired ? 'Expired' : `${status?.hoursRemaining || 0}h`}
            </p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-1.5 text-green-600 text-xs mb-1">
              <Zap className="w-3.5 h-3.5" />
              Est. Savings
            </div>
            <p className="font-semibold text-green-700">{status?.estimatedSavings || '0K'}</p>
          </div>
        </div>
      )}

      {status?.status === 'not-initialized' && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            Initialize the cache to enable AI-powered feature recommendations with 75% cost savings.
          </p>
        </div>
      )}

      <button
        onClick={refreshCache}
        disabled={isRefreshing}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        {isRefreshing ? 'Refreshing...' : status?.status === 'not-initialized' ? 'Initialize Cache' : 'Refresh Cache'}
      </button>

      {status?.createdAt && (
        <p className="text-xs text-gray-400 text-center mt-3">
          Last updated: {new Date(status.createdAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

/**
 * Asset Registry Page
 * Main page for managing workshop assets with AI enrichment
 */

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { useAuth } from '@/shared/hooks';
import { assetService } from '../services/AssetService';
import { AssetForm } from '../components/AssetForm';
import { AssetList } from '../components/AssetList';
import { MaintenanceLogModal } from '../components/MaintenanceLogModal';
import type { Asset, AssetStatus, AssetFilters } from '@/shared/types';
import type { MaintenanceLog } from '../types';

type ViewMode = 'list' | 'form';

export function AssetRegistry() {
  // Auth
  const { user } = useAuth();

  // State
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [filters, setFilters] = useState<AssetFilters>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Maintenance modal state
  const [maintenanceModalAsset, setMaintenanceModalAsset] = useState<Asset | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<AssetStatus | null>(null);

  // Subscribe to assets collection
  useEffect(() => {
    const q = query(
      collection(db, 'assets'),
      orderBy('brand', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const assetData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Asset[];
      
      setAssets(assetData);
      setIsLoading(false);
    }, (error) => {
      console.error('Error fetching assets:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter assets
  const filteredAssets = assets.filter(asset => {
    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        asset.brand.toLowerCase().includes(searchLower) ||
        asset.model.toLowerCase().includes(searchLower) ||
        asset.nickname?.toLowerCase().includes(searchLower) ||
        asset.serialNumber?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Category filter
    if (filters.category) {
      const categories = Array.isArray(filters.category) ? filters.category : [filters.category];
      if (!categories.includes(asset.category)) return false;
    }

    // Status filter
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      if (!statuses.includes(asset.status)) return false;
    }

    return true;
  });

  // Handle adding new asset
  const handleAddAsset = () => {
    setSelectedAsset(null);
    setViewMode('form');
  };

  // Handle editing asset
  const handleEditAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setViewMode('form');
  };

  // Handle form submission
  const handleSubmitAsset = async (assetData: Partial<Asset>) => {
    const userId = user?.uid || '';

    if (selectedAsset?.id) {
      // Update existing asset
      await assetService.updateAsset(selectedAsset.id, assetData, userId);
    } else {
      // Create new asset
      await assetService.createAsset(assetData as Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>, userId);
    }

    setViewMode('list');
    setSelectedAsset(null);
  };

  // Handle status change
  const handleStatusChange = (asset: Asset, newStatus: AssetStatus) => {
    if (newStatus === 'MAINTENANCE') {
      // Prompt for maintenance log
      setMaintenanceModalAsset(asset);
      setPendingStatusChange(newStatus);
    } else {
      // Direct status change
      confirmStatusChange(asset, newStatus);
    }
  };

  // Confirm status change without maintenance log
  const confirmStatusChange = async (asset: Asset, newStatus: AssetStatus) => {
    const userId = user?.uid || '';
    await assetService.updateStatus(asset.id, newStatus, userId);
  };

  // Handle maintenance log submission
  const handleMaintenanceLog = async (logEntry: Omit<MaintenanceLog, 'id' | 'performedAt' | 'assetId'>) => {
    if (!maintenanceModalAsset || !pendingStatusChange) return;

    const userId = user?.uid || '';

    // Log maintenance
    await assetService.logMaintenance(
      maintenanceModalAsset.id,
      {
        type: logEntry.type,
        description: logEntry.description,
        tasksCompleted: logEntry.tasksCompleted,
        hoursAtService: logEntry.hoursAtService,
        notes: logEntry.notes,
      },
      userId
    );

    // Update status
    await assetService.updateStatus(maintenanceModalAsset.id, pendingStatusChange, userId);

    // Close modal
    setMaintenanceModalAsset(null);
    setPendingStatusChange(null);
  };

  // Stats
  const stats = {
    total: assets.length,
    active: assets.filter(a => a.status === 'ACTIVE').length,
    maintenance: assets.filter(a => a.status === 'MAINTENANCE').length,
    broken: assets.filter(a => a.status === 'BROKEN').length,
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Asset Registry</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage workshop tools and equipment
              </p>
            </div>
            
            {viewMode === 'list' && (
              <button
                onClick={handleAddAsset}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Asset
              </button>
            )}
          </div>

          {/* Stats */}
          {viewMode === 'list' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Total Assets</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600">Active</p>
                <p className="text-2xl font-semibold text-green-700">{stats.active}</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <p className="text-sm text-yellow-600">In Maintenance</p>
                <p className="text-2xl font-semibold text-yellow-700">{stats.maintenance}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm text-red-600">Broken</p>
                <p className="text-2xl font-semibold text-red-700">{stats.broken}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="pt-4">
        {viewMode === 'list' ? (
          <>
            {/* Filters */}
            <div className="mb-6 flex flex-wrap gap-4">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <svg 
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search assets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Category Filter */}
              <select
                value={filters.category as string || ''}
                onChange={(e) => setFilters({
                  ...filters,
                  category: e.target.value as AssetFilters['category'] || undefined
                })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Categories</option>
                <option value="STATIONARY_MACHINE">Stationary Machines</option>
                <option value="POWER_TOOL">Power Tools</option>
                <option value="HAND_TOOL">Hand Tools</option>
                <option value="JIG">Jigs & Fixtures</option>
              </select>

              {/* Status Filter */}
              <select
                value={filters.status as string || ''}
                onChange={(e) => setFilters({
                  ...filters,
                  status: e.target.value as AssetFilters['status'] || undefined
                })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="BROKEN">Broken</option>
                <option value="CHECKED_OUT">Checked Out</option>
                <option value="RETIRED">Retired</option>
              </select>
            </div>

            {/* Asset List */}
            <AssetList
              assets={filteredAssets}
              onAssetClick={handleEditAsset}
              onStatusChange={handleStatusChange}
              isLoading={isLoading}
            />
          </>
        ) : (
          <>
            {/* Back Button */}
            <button
              onClick={() => {
                setViewMode('list');
                setSelectedAsset(null);
              }}
              className="mb-4 inline-flex items-center text-gray-600 hover:text-gray-900"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to List
            </button>

            {/* Asset Form */}
            <AssetForm
              asset={selectedAsset || undefined}
              onSubmit={handleSubmitAsset}
              onCancel={() => {
                setViewMode('list');
                setSelectedAsset(null);
              }}
            />
          </>
        )}
      </div>

      {/* Maintenance Log Modal */}
      <MaintenanceLogModal
        asset={maintenanceModalAsset!}
        isOpen={!!maintenanceModalAsset}
        onClose={() => {
          setMaintenanceModalAsset(null);
          setPendingStatusChange(null);
        }}
        onSubmit={handleMaintenanceLog}
      />
    </div>
  );
}

export default AssetRegistry;

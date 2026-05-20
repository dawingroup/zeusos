/**
 * Asset Registry Page
 * Smart Asset Registry for managing workshop tools and machines
 */

import { useState, useEffect } from 'react';
import { 
  Wrench, Search, Plus, RefreshCw, AlertTriangle,
  CheckCircle, Clock, XCircle, Package, Download, X, Sparkles,
  LayoutGrid, List, Zap, Upload, FileSpreadsheet, Pencil, Trash2
} from 'lucide-react';
import { AssetCapabilitiesModal } from '../components/AssetCapabilitiesModal';
import { cn } from '@/shared/lib/utils';
import { AssetService } from '../services/AssetService';
import type { Asset, AssetStatus, AssetCategory, AssetFilters } from '@/shared/types';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

const assetService = new AssetService();

const STATUS_CONFIG: Record<AssetStatus, { label: string; color: string; icon: React.ReactNode }> = {
  'ACTIVE': { label: 'Active', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-4 h-4" /> },
  'MAINTENANCE': { label: 'Maintenance', color: 'bg-amber-100 text-amber-800', icon: <Wrench className="w-4 h-4" /> },
  'BROKEN': { label: 'Broken', color: 'bg-red-100 text-red-800', icon: <XCircle className="w-4 h-4" /> },
  'CHECKED_OUT': { label: 'Checked Out', color: 'bg-blue-100 text-blue-800', icon: <Clock className="w-4 h-4" /> },
  'RETIRED': { label: 'Retired', color: 'bg-gray-100 text-gray-800', icon: <Package className="w-4 h-4" /> },
};

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  'STATIONARY_MACHINE': 'Stationary Machines',
  'POWER_TOOL': 'Power Tools',
  'HAND_TOOL': 'Hand Tools',
  'JIG': 'Jigs & Fixtures',
  'CNC': 'CNC Machines',
  'DUST_COLLECTION': 'Dust Collection',
  'SPRAY_EQUIPMENT': 'Spray Equipment',
  'SEWING_MACHINE': 'Sewing Machines',
};

// Common tool brands
const BRAND_OPTIONS = [
  'Festool',
  'Makita',
  'Bosch',
  'DeWalt',
  'Milwaukee',
  'Jessem',
  'Incra',
  'Incco',
  'Yu Tools',
  'Gazzelle',
  'Rubi',
  'Kreg',
  'Mirka',
  'Graco',
  'Biesse',
  'SCM',
  'Homag',
  'Altendorf',
  'Juki',
  'Brother',
  'Meite',
  'Dongcheng',
  'Ingco',
  'Total',
  'Stanley',
  'Other',
];

// Production zones for furniture/cabinetry/millwork/upholstery
const ZONE_OPTIONS = [
  { group: 'Primary Processing', zones: [
    'Sheet Goods Storage',
    'Panel Saw Area',
    'CNC Nesting Center',
    'Lumber Storage',
    'Rough Milling',
    'Planer/Jointer Station',
  ]},
  { group: 'Secondary Processing', zones: [
    'Edge Banding Station',
    'Boring/Drilling Center',
    'Router Table Station',
    'Shaper Station',
    'Mortise/Tenon Area',
  ]},
  { group: 'Assembly', zones: [
    'Case Assembly',
    'Face Frame Assembly',
    'Door Assembly',
    'Drawer Assembly',
    'Final Assembly',
    'Hardware Installation',
  ]},
  { group: 'Finishing', zones: [
    'Sanding Station',
    'Prep/Cleaning Area',
    'Spray Booth',
    'Drying/Curing Area',
    'Hand Finishing',
    'Touch-Up Station',
  ]},
  { group: 'Upholstery', zones: [
    'Cutting Table',
    'Sewing Station',
    'Foam Fabrication',
    'Upholstery Assembly',
    'Fabric Storage',
  ]},
  { group: 'Support Areas', zones: [
    'Tool Crib',
    'Maintenance Shop',
    'Quality Control',
    'Packaging/Shipping',
  ]},
  { group: 'Special Areas', zones: [
    'Prototyping Lab',
    'Sample Room',
    'Site Installation Kit',
    'Mobile/Field Equipment',
  ]},
];

// Asset form data type
interface AssetFormData {
  brand: string;
  model: string;
  nickname: string;
  serialNumber: string;
  category: AssetCategory;
  status: AssetStatus;
  zone: string;
  purchaseDate: string;
  purchasePrice: string;
  notes: string;
  // AI-enriched fields
  specs: Record<string, string>;
  manualUrl: string;
  productPageUrl: string;
  maintenanceTasks: string[];
  maintenanceIntervalHours: number;
}

const emptyFormData: AssetFormData = {
  brand: '',
  model: '',
  nickname: '',
  serialNumber: '',
  category: 'POWER_TOOL',
  status: 'ACTIVE',
  zone: '',
  purchaseDate: '',
  purchasePrice: '',
  notes: '',
  specs: {},
  manualUrl: '',
  productPageUrl: '',
  maintenanceTasks: [],
  maintenanceIntervalHours: 200,
};

export default function AssetRegistryPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<AssetCategory | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [analyzeAsset, setAnalyzeAsset] = useState<Asset | null>(null);
  const [formData, setFormData] = useState<AssetFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [statusChangeAsset, setStatusChangeAsset] = useState<Asset | null>(null);
  const [maintenanceReason, setMaintenanceReason] = useState('');
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [autoFillError, setAutoFillError] = useState<string | null>(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState<{ total: number; completed: number; errors: string[] } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [bulkPreviewData, setBulkPreviewData] = useState<Array<{
    brand: string;
    model: string;
    nickname: string;
    serialNumber: string;
    category: AssetCategory;
    zone: string;
  }>>([]);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [deleteConfirmAsset, setDeleteConfirmAsset] = useState<Asset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadAssets();
  }, [statusFilter, categoryFilter]);

  const loadAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: AssetFilters = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (categoryFilter !== 'all') filters.category = categoryFilter;
      
      const result = await assetService.getAssets(filters);
      setAssets(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  const filteredAssets = assets.filter(asset => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      asset.brand.toLowerCase().includes(query) ||
      asset.model.toLowerCase().includes(query) ||
      asset.nickname?.toLowerCase().includes(query) ||
      asset.serialNumber?.toLowerCase().includes(query)
    );
  });

  // Handle form field changes
  const handleFormChange = (field: keyof AssetFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Auto-fill with AI
  const handleAutoFill = async () => {
    if (!formData.brand || !formData.model) {
      setAutoFillError('Enter Brand and Model first');
      return;
    }
    setIsAutoFilling(true);
    setAutoFillError(null);
    try {
      const response = await fetch('/api/ai/enrich-asset-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: formData.brand, model: formData.model }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Auto-fill failed');
      }

      const result = await response.json();
      const enrichedData = result.data;
      console.log('Auto-fill result:', enrichedData);
      
      // Populate form with enriched data
      setFormData(prev => ({
        ...prev,
        specs: enrichedData.specs || {},
        manualUrl: enrichedData.manualUrl || '',
        productPageUrl: enrichedData.productPageUrl || '',
        maintenanceTasks: enrichedData.maintenanceTasks || [],
        maintenanceIntervalHours: enrichedData.maintenanceIntervalHours || 200,
        // Add specs summary to notes
        notes: prev.notes || Object.entries(enrichedData.specs || {})
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n'),
      }));
      setAutoFillError(null);
    } catch (err) {
      setAutoFillError(err instanceof Error ? err.message : 'Auto-fill failed');
    } finally {
      setIsAutoFilling(false);
    }
  };

  // Handle status change
  const handleStatusChange = async (asset: Asset, newStatus: AssetStatus) => {
    if (newStatus === 'MAINTENANCE') {
      setStatusChangeAsset(asset);
      return;
    }
    try {
      await assetService.updateStatus(asset.id, newStatus, 'system');
      loadAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  // Confirm maintenance status
  const handleConfirmMaintenance = async () => {
    if (!statusChangeAsset) return;
    try {
      await assetService.updateStatus(statusChangeAsset.id, 'MAINTENANCE', 'system', maintenanceReason);
      setStatusChangeAsset(null);
      setMaintenanceReason('');
      loadAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  // Save new asset
  const handleSaveAsset = async () => {
    if (!formData.brand || !formData.model) {
      setError('Brand and Model are required');
      return;
    }

    setSaving(true);
    try {
      const nextServiceDate = new Date();
      nextServiceDate.setMonth(nextServiceDate.getMonth() + 6); // Default 6 month service interval
      
      // Build asset data - exclude undefined fields (Firestore doesn't accept undefined)
      const assetData: Record<string, unknown> = {
        brand: formData.brand,
        model: formData.model,
        category: formData.category,
        status: formData.status,
        location: { zone: formData.zone || 'Workshop' },
        specs: formData.specs || {},
        maintenance: {
          intervalHours: formData.maintenanceIntervalHours || 500,
          tasks: formData.maintenanceTasks.length > 0 
            ? formData.maintenanceTasks 
            : ['General inspection', 'Clean and lubricate'],
          nextServiceDue: nextServiceDate,
          history: [],
        },
        createdBy: 'system',
        updatedBy: 'system',
      };
      
      // Only add optional fields if they have values
      if (formData.nickname) assetData.nickname = formData.nickname;
      if (formData.serialNumber) assetData.serialNumber = formData.serialNumber;
      if (formData.manualUrl) assetData.manualUrl = formData.manualUrl;
      if (formData.productPageUrl) assetData.productPageUrl = formData.productPageUrl;

      await assetService.createAsset(assetData as Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>, 'system');
      
      setShowAddModal(false);
      setFormData(emptyFormData);
      loadAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save asset');
    } finally {
      setSaving(false);
    }
  };

  // Handle edit asset
  const handleEditAsset = (asset: Asset) => {
    setFormData({
      brand: asset.brand,
      model: asset.model,
      nickname: asset.nickname || '',
      serialNumber: asset.serialNumber || '',
      category: asset.category,
      status: asset.status,
      zone: asset.location?.zone || '',
      purchaseDate: '',
      purchasePrice: '',
      notes: '',
      specs: asset.specs || {},
      manualUrl: asset.manualUrl || '',
      productPageUrl: asset.productPageUrl || '',
      maintenanceTasks: asset.maintenance?.tasks || [],
      maintenanceIntervalHours: asset.maintenance?.intervalHours || 500,
    });
    setEditingAsset(asset);
  };

  // Handle update asset
  const handleUpdateAsset = async () => {
    if (!editingAsset || !formData.brand || !formData.model) {
      setError('Brand and Model are required');
      return;
    }

    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        brand: formData.brand,
        model: formData.model,
        category: formData.category,
        status: formData.status,
        location: { zone: formData.zone || 'Workshop' },
        specs: formData.specs || {},
        maintenance: {
          ...editingAsset.maintenance,
          intervalHours: formData.maintenanceIntervalHours || 500,
          tasks: formData.maintenanceTasks.length > 0 
            ? formData.maintenanceTasks 
            : editingAsset.maintenance?.tasks || ['General inspection'],
        },
      };
      
      if (formData.nickname) updates.nickname = formData.nickname;
      if (formData.serialNumber) updates.serialNumber = formData.serialNumber;
      if (formData.manualUrl) updates.manualUrl = formData.manualUrl;
      if (formData.productPageUrl) updates.productPageUrl = formData.productPageUrl;

      await assetService.updateAsset(editingAsset.id, updates, 'system');
      
      setEditingAsset(null);
      setFormData(emptyFormData);
      loadAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update asset');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete asset
  const handleDeleteAsset = async () => {
    if (!deleteConfirmAsset) return;
    
    setIsDeleting(true);
    try {
      await assetService.deleteAsset(deleteConfirmAsset.id);
      setDeleteConfirmAsset(null);
      loadAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete asset');
    } finally {
      setIsDeleting(false);
    }
  };

  // Parse CSV for preview
  const handleParseCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('CSV file must have a header row and at least one data row');
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const dataRows = lines.slice(1);
      
      const validCategories = ['STATIONARY_MACHINE', 'POWER_TOOL', 'HAND_TOOL', 'JIG', 'CNC', 'DUST_COLLECTION', 'SPRAY_EQUIPMENT', 'SEWING_MACHINE'];
      
      const previewData = dataRows.map(row => {
        const values = row.split(',').map(v => v.trim().replace(/"/g, ''));
        const rowData: Record<string, string> = {};
        headers.forEach((header, idx) => {
          rowData[header] = values[idx] || '';
        });

        const category = (rowData['category'] || 'POWER_TOOL').toUpperCase().replace(/ /g, '_') as AssetCategory;

        return {
          brand: rowData['brand'] || rowData['manufacturer'] || '',
          model: rowData['model'] || rowData['model number'] || '',
          nickname: rowData['nickname'] || rowData['name'] || '',
          serialNumber: rowData['serial'] || rowData['serial number'] || rowData['serialnumber'] || '',
          category: validCategories.includes(category) ? category : 'POWER_TOOL' as AssetCategory,
          zone: rowData['zone'] || rowData['location'] || 'Workshop',
        };
      }).filter(item => item.brand && item.model);

      setBulkPreviewData(previewData);
      setBulkUploadProgress(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file');
    }
    // Reset file input
    event.target.value = '';
  };

  // Import previewed assets
  const handleImportPreview = async () => {
    if (bulkPreviewData.length === 0) return;

    setIsUploading(true);
    setBulkUploadProgress({ total: bulkPreviewData.length, completed: 0, errors: [] });

    const errors: string[] = [];
    let completed = 0;

    for (let i = 0; i < bulkPreviewData.length; i++) {
      const item = bulkPreviewData[i];
      
      try {
        const nextServiceDate = new Date();
        nextServiceDate.setMonth(nextServiceDate.getMonth() + 6);

        const assetData: Record<string, unknown> = {
          brand: item.brand,
          model: item.model,
          category: item.category,
          status: 'ACTIVE',
          location: { zone: item.zone || 'Workshop' },
          specs: {},
          maintenance: {
            intervalHours: 500,
            tasks: ['General inspection', 'Clean and lubricate'],
            nextServiceDue: nextServiceDate,
            history: [],
          },
          createdBy: 'bulk-import',
          updatedBy: 'bulk-import',
        };
        
        if (item.nickname) assetData.nickname = item.nickname;
        if (item.serialNumber) assetData.serialNumber = item.serialNumber;

        await assetService.createAsset(assetData as Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>, 'bulk-import');

        completed++;
        setBulkUploadProgress({ total: bulkPreviewData.length, completed, errors: [...errors] });
      } catch (rowError) {
        errors.push(`Row ${i + 1}: ${rowError instanceof Error ? rowError.message : 'Unknown error'}`);
      }
    }

    setBulkUploadProgress({ total: bulkPreviewData.length, completed, errors });
    setBulkPreviewData([]);
    loadAssets();
    setIsUploading(false);
  };

  // Update bulk preview item
  const handleUpdateBulkItem = (index: number, field: string, value: string) => {
    setBulkPreviewData(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  // Remove item from bulk preview
  const handleRemoveBulkItem = (index: number) => {
    setBulkPreviewData(prev => prev.filter((_, i) => i !== index));
  };

  // Download CSV template
  const handleDownloadTemplate = () => {
    const template = `Brand,Model,Nickname,Serial Number,Category,Zone
Festool,TS 55 REQ,Track Saw,12345,POWER_TOOL,Cutting Area
Makita,RT0701C,Compact Router,67890,POWER_TOOL,Assembly Area
Kreg,K5,Pocket Hole Jig,,JIG,Joinery Station`;
    
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'asset-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export assets to CSV
  const handleExportCSV = () => {
    const headers = ['Name', 'Brand', 'Model', 'Serial Number', 'Category', 'Status', 'Location', 'Next Service'];
    const rows = filteredAssets.map(asset => [
      asset.nickname || `${asset.brand} ${asset.model}`,
      asset.brand,
      asset.model,
      asset.serialNumber || '',
      CATEGORY_LABELS[asset.category],
      STATUS_CONFIG[asset.status].label,
      asset.location?.zone || '',
      asset.maintenance?.nextServiceDue ? new Date(asset.maintenance.nextServiceDue).toLocaleDateString() : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `asset-registry-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Calculate stats
  const stats = {
    total: assets.length,
    active: assets.filter(a => a.status === 'ACTIVE').length,
    maintenance: assets.filter(a => a.status === 'MAINTENANCE').length,
    broken: assets.filter(a => a.status === 'BROKEN').length,
    needsService: assets.filter(a => {
      const nextService = a.maintenance?.nextServiceDue;
      if (!nextService) return false;
      const dueDate = nextService instanceof Date ? nextService : new Date(nextService);
      return dueDate <= new Date();
    }).length,
  };

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Wrench className="w-7 h-7 text-[#0A7C8E]" />
            Smart Asset Registry
          </h1>
          <p className="text-gray-600 mt-1">Manage workshop tools, machines, and equipment</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBulkUpload(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Bulk Import
          </button>
          <button
            onClick={handleExportCSV}
            disabled={filteredAssets.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#0A7C8E] text-white rounded-lg hover:bg-[#086a7a] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Asset
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <KPIGrid cols={5}>
        <KPICard label="Total Assets" value={stats.total} />
        <KPICard label="Active" value={stats.active} trend="up" />
        <KPICard label="In Maintenance" value={stats.maintenance} />
        <KPICard
          label="Broken"
          value={stats.broken}
          trend={stats.broken > 0 ? 'down' : undefined}
        />
        <KPICard label="Service Due" value={stats.needsService} />
      </KPIGrid>

      {/* Filters & Search */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AssetStatus | 'all')}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
          >
            <option value="all">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as AssetCategory | 'all')}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
          >
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2 transition-colors",
                viewMode === 'grid' ? 'bg-[#0A7C8E] text-white' : 'text-gray-500 hover:bg-gray-100'
              )}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "p-2 transition-colors",
                viewMode === 'table' ? 'bg-[#0A7C8E] text-white' : 'text-gray-500 hover:bg-gray-100'
              )}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          
          <button
            onClick={loadAssets}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Asset List */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <AlertTriangle className="w-5 h-5 inline mr-2" />
          {error}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A7C8E]"></div>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No assets found</h3>
          <p className="text-gray-500 mt-1">
            {assets.length === 0 
              ? 'Add your first asset to get started.'
              : 'Try adjusting your search or filters.'}
          </p>
          {assets.length === 0 && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-[#0A7C8E] hover:underline"
            >
              Add Asset
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAssets.map((asset) => {
            const statusConfig = STATUS_CONFIG[asset.status];
            const nextService = asset.maintenance?.nextServiceDue;
            const serviceDue = nextService ? new Date(nextService) : null;
            const isOverdue = serviceDue && serviceDue <= new Date();

            return (
              <div key={asset.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                {/* Card Header with Status */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {asset.nickname || `${asset.brand} ${asset.model}`}
                      </h3>
                      <p className="text-sm text-gray-500 truncate">
                        {asset.brand} {asset.model}
                      </p>
                    </div>
                    {/* Clickable Status Badge */}
                    <button
                      onClick={() => handleStatusChange(asset, asset.status === 'ACTIVE' ? 'MAINTENANCE' : 'ACTIVE')}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity',
                        statusConfig.color
                      )}
                      title="Click to toggle status"
                    >
                      {statusConfig.icon}
                      {statusConfig.label}
                    </button>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{CATEGORY_LABELS[asset.category]}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Wrench className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{asset.location?.zone || 'Unassigned'}</span>
                  </div>
                  {serviceDue && (
                    <div className={cn("flex items-center gap-2 text-sm", isOverdue && "text-red-600")}>
                      <Clock className="w-4 h-4" />
                      <span>{isOverdue ? 'Overdue: ' : 'Service: '}{serviceDue.toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <button
                    onClick={() => setAnalyzeAsset(asset)}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                  >
                    <Sparkles className="w-4 h-4" />
                    Analyze
                  </button>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleEditAsset(asset)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Edit asset"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setDeleteConfirmAsset(asset)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete asset"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Next Service</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAssets.map((asset) => {
                const statusConfig = STATUS_CONFIG[asset.status];
                const nextService = asset.maintenance?.nextServiceDue;
                const serviceDue = nextService ? new Date(nextService) : null;
                const isOverdue = serviceDue && serviceDue <= new Date();

                return (
                  <tr key={asset.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {asset.nickname || `${asset.brand} ${asset.model}`}
                        </p>
                        <p className="text-sm text-gray-500">
                          {asset.brand} {asset.model}
                          {asset.serialNumber && ` • S/N: ${asset.serialNumber}`}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600">
                        {CATEGORY_LABELS[asset.category]}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleStatusChange(asset, asset.status === 'ACTIVE' ? 'MAINTENANCE' : 'ACTIVE')}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80',
                          statusConfig.color
                        )}
                        title="Click to toggle status"
                      >
                        {statusConfig.icon}
                        {statusConfig.label}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600">
                        {asset.location?.zone || 'Unassigned'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {serviceDue ? (
                        <span className={cn(
                          'text-sm',
                          isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'
                        )}>
                          {isOverdue && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                          {serviceDue.toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setAnalyzeAsset(asset)}
                          className="p-1.5 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded"
                          title="Analyze Capabilities"
                        >
                          <Sparkles className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleEditAsset(asset)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit asset"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirmAsset(asset)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete asset"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Add New Asset</h3>
              <button onClick={() => { setShowAddModal(false); setFormData(emptyFormData); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Auto-Fill Button */}
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100">
                <div>
                  <p className="text-sm font-medium text-purple-900">AI Auto-Fill</p>
                  <p className="text-xs text-purple-600">Enter brand & model, then click to auto-fill specs</p>
                </div>
                <button
                  type="button"
                  onClick={handleAutoFill}
                  disabled={isAutoFilling || !formData.brand || !formData.model}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAutoFilling ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Auto-Fill Specs
                    </>
                  )}
                </button>
              </div>
              {autoFillError && (
                <p className="text-sm text-red-600">{autoFillError}</p>
              )}
              
              {/* Show loaded specs */}
              {Object.keys(formData.specs).length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-green-800 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Specs loaded from AI
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm text-green-700">
                    {Object.entries(formData.specs).slice(0, 6).map(([key, value]) => (
                      <div key={key}>
                        <span className="font-medium">{key}:</span> {value}
                      </div>
                    ))}
                  </div>
                  {formData.maintenanceTasks.length > 0 && (
                    <p className="text-xs text-green-600 mt-2">
                      + {formData.maintenanceTasks.length} maintenance tasks loaded
                    </p>
                  )}
                </div>
              )}

              {/* Brand & Model */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand *</label>
                  <select
                    value={BRAND_OPTIONS.includes(formData.brand) ? formData.brand : (formData.brand ? 'Other' : '')}
                    onChange={(e) => {
                      if (e.target.value === 'Other') {
                        handleFormChange('brand', '');
                      } else {
                        handleFormChange('brand', e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
                  >
                    <option value="">Select brand...</option>
                    {BRAND_OPTIONS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  {formData.brand && !BRAND_OPTIONS.includes(formData.brand) && (
                    <input
                      type="text"
                      value={formData.brand}
                      onChange={(e) => handleFormChange('brand', e.target.value)}
                      placeholder="Enter custom brand"
                      className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => handleFormChange('model', e.target.value)}
                    placeholder="e.g., TS 55 REQ"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
                  />
                </div>
              </div>

              {/* Nickname & Serial */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nickname</label>
                  <input
                    type="text"
                    value={formData.nickname}
                    onChange={(e) => handleFormChange('nickname', e.target.value)}
                    placeholder="e.g., Big Blue"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={formData.serialNumber}
                    onChange={(e) => handleFormChange('serialNumber', e.target.value)}
                    placeholder="Manufacturer S/N"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
                  />
                </div>
              </div>

              {/* Category & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleFormChange('category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleFormChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
                  >
                    {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location / Zone</label>
                <select
                  value={formData.zone}
                  onChange={(e) => handleFormChange('zone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
                >
                  <option value="">Select zone...</option>
                  {ZONE_OPTIONS.map((group) => (
                    <optgroup key={group.group} label={group.group}>
                      {group.zones.map((z) => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                  placeholder="Additional notes about this asset..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => { setShowAddModal(false); setFormData(emptyFormData); }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAsset}
                disabled={saving || !formData.brand || !formData.model}
                className="px-4 py-2 bg-[#0A7C8E] text-white rounded-lg hover:bg-[#086a7a] disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Asset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analyze Capabilities Modal */}
      {analyzeAsset && (
        <AssetCapabilitiesModal
          asset={analyzeAsset}
          onClose={() => setAnalyzeAsset(null)}
          onFeaturesCreated={(count) => {
            console.log(`Created ${count} features for asset`);
          }}
        />
      )}

      {/* Maintenance Reason Dialog */}
      {statusChangeAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Set to Maintenance</h3>
              <button 
                onClick={() => { setStatusChangeAsset(null); setMaintenanceReason(''); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Setting <strong>{statusChangeAsset.nickname || `${statusChangeAsset.brand} ${statusChangeAsset.model}`}</strong> to maintenance mode.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Maintenance
                </label>
                <textarea
                  value={maintenanceReason}
                  onChange={(e) => setMaintenanceReason(e.target.value)}
                  placeholder="e.g., Scheduled service, blade replacement, calibration..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  Features requiring this asset will become unavailable.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => { setStatusChangeAsset(null); setMaintenanceReason(''); }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMaintenance}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
              >
                Confirm Maintenance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#0A7C8E]" />
                Bulk Import Assets
              </h2>
              <button
                onClick={() => { setShowBulkUpload(false); setBulkUploadProgress(null); }}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  Upload a CSV file with columns: <strong>Brand, Model, Nickname, Serial Number, Category, Zone</strong>
                </p>
              </div>
              
              <button
                onClick={handleDownloadTemplate}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download CSV Template
              </button>

              {bulkPreviewData.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#0A7C8E] transition-colors">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleParseCSV}
                    disabled={isUploading}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      Click to select CSV file
                    </p>
                  </label>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">
                      {bulkPreviewData.length} assets ready to import
                    </p>
                    <button
                      onClick={() => setBulkPreviewData([])}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Brand</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Model</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Category</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {bulkPreviewData.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={item.brand}
                                onChange={(e) => handleUpdateBulkItem(idx, 'brand', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={item.model}
                                onChange={(e) => handleUpdateBulkItem(idx, 'model', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={item.category}
                                onChange={(e) => handleUpdateBulkItem(idx, 'category', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                              >
                                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                  <option key={key} value={key}>{label}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => handleRemoveBulkItem(idx)}
                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {bulkUploadProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{bulkUploadProgress.completed} / {bulkUploadProgress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-[#0A7C8E] h-2 rounded-full transition-all"
                      style={{ width: `${(bulkUploadProgress.completed / bulkUploadProgress.total) * 100}%` }}
                    />
                  </div>
                  {bulkUploadProgress.errors.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto">
                      {bulkUploadProgress.errors.map((err, i) => (
                        <p key={i} className="text-xs text-red-600">{err}</p>
                      ))}
                    </div>
                  )}
                  {!isUploading && bulkUploadProgress.completed > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                      <p className="text-sm text-green-800 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Successfully imported {bulkUploadProgress.completed} assets
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => { setShowBulkUpload(false); setBulkUploadProgress(null); setBulkPreviewData([]); }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              {bulkPreviewData.length > 0 && (
                <button
                  onClick={handleImportPreview}
                  disabled={isUploading}
                  className="px-4 py-2 bg-[#0A7C8E] text-white rounded-lg hover:bg-[#086a7a] disabled:opacity-50"
                >
                  {isUploading ? 'Importing...' : `Import ${bulkPreviewData.length} Assets`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Asset Modal */}
      {editingAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Edit Asset</h3>
              <button onClick={() => { setEditingAsset(null); setFormData(emptyFormData); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Brand & Model */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand *</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => handleFormChange('brand', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => handleFormChange('model', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
                  />
                </div>
              </div>

              {/* Nickname & Serial */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nickname</label>
                  <input
                    type="text"
                    value={formData.nickname}
                    onChange={(e) => handleFormChange('nickname', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={formData.serialNumber}
                    onChange={(e) => handleFormChange('serialNumber', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
                  />
                </div>
              </div>

              {/* Category & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleFormChange('category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleFormChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
                  >
                    {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location / Zone</label>
                <select
                  value={formData.zone}
                  onChange={(e) => handleFormChange('zone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
                >
                  <option value="">Select zone...</option>
                  {ZONE_OPTIONS.map((group) => (
                    <optgroup key={group.group} label={group.group}>
                      {group.zones.map((z) => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Specs Display */}
              {Object.keys(formData.specs).length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">Specifications</p>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    {Object.entries(formData.specs).slice(0, 6).map(([key, value]) => (
                      <div key={key}>
                        <span className="font-medium">{key}:</span> {value}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => { setEditingAsset(null); setFormData(emptyFormData); }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateAsset}
                disabled={saving}
                className="px-4 py-2 bg-[#0A7C8E] text-white rounded-lg hover:bg-[#086a7a] disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-500" />
                Delete Asset
              </h3>
              <button onClick={() => setDeleteConfirmAsset(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-gray-600">
                Are you sure you want to delete <strong>{deleteConfirmAsset.nickname || `${deleteConfirmAsset.brand} ${deleteConfirmAsset.model}`}</strong>?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  This action cannot be undone. All data associated with this asset will be permanently deleted.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setDeleteConfirmAsset(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAsset}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Asset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

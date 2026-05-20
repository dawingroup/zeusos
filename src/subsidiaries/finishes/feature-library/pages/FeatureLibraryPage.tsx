/**
 * Feature Library Page (Enhanced)
 * Manufacturing features with grid view, search, and export functionality
 */

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { Search, Download, Database } from 'lucide-react';
import { FeatureScanner } from '../components';
import type { Feature, FeatureCategory } from '@/shared/types';

// ============================================
// Constants
// ============================================

type ViewMode = 'grid' | 'scanner';

const CATEGORY_OPTIONS: { value: FeatureCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'JOINERY', label: 'Joinery' },
  { value: 'EDGE_TREATMENT', label: 'Edge Treatment' },
  { value: 'DRILLING', label: 'Drilling' },
  { value: 'SHAPING', label: 'Shaping' },
  { value: 'ASSEMBLY', label: 'Assembly' },
  { value: 'FINISHING', label: 'Finishing' },
  { value: 'CUTTING', label: 'Cutting' },
  { value: 'SPECIALTY', label: 'Specialty' },
];

const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  JOINERY: 'Joinery',
  EDGE_TREATMENT: 'Edge Treatment',
  DRILLING: 'Drilling',
  SHAPING: 'Shaping',
  ASSEMBLY: 'Assembly',
  FINISHING: 'Finishing',
  CUTTING: 'Cutting',
  SPECIALTY: 'Specialty',
};

const CATEGORY_COLORS: Record<FeatureCategory, string> = {
  JOINERY: 'bg-blue-100 text-blue-800',
  EDGE_TREATMENT: 'bg-green-100 text-green-800',
  DRILLING: 'bg-yellow-100 text-yellow-800',
  SHAPING: 'bg-purple-100 text-purple-800',
  ASSEMBLY: 'bg-orange-100 text-orange-800',
  FINISHING: 'bg-pink-100 text-pink-800',
  CUTTING: 'bg-red-100 text-red-800',
  SPECIALTY: 'bg-gray-100 text-gray-800',
};

// ============================================
// Component
// ============================================

export function FeatureLibraryPage() {
  // State
  const [features, setFeatures] = useState<Feature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<FeatureCategory | 'all'>('all');
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Subscribe to features collection
  useEffect(() => {
    let q = query(
      collection(db, 'features'),
      orderBy('name', 'asc')
    );

    // Apply server-side category filter
    if (categoryFilter !== 'all') {
      q = query(
        collection(db, 'features'),
        where('category', '==', categoryFilter),
        orderBy('name', 'asc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const featureData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Feature[];
      
      setFeatures(featureData);
      setIsLoading(false);
    }, (error) => {
      console.error('Error fetching features:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [categoryFilter]);

  // Client-side search filtering
  const filteredFeatures = features.filter(feature => {
    if (!searchQuery) return true;
    
    const search = searchQuery.toLowerCase();
    const matchesName = feature.name.toLowerCase().includes(search);
    const matchesDesc = feature.description?.toLowerCase().includes(search) || false;
    const matchesTags = feature.tags?.some(tag => tag.toLowerCase().includes(search)) || false;
    
    return matchesName || matchesDesc || matchesTags;
  });

  // Export features as AI context JSON
  const handleExportAIContext = async () => {
    setIsExporting(true);
    try {
      const aiContext = {
        featureCount: features.length,
        categories: [...new Set(features.map(f => f.category))],
        features: features.map(f => ({
          id: f.id,
          name: f.name,
          category: f.category,
          description: f.description,
          tags: f.tags,
          requiredAssets: f.requiredAssetIds?.length || 0,
          estimatedMinutes: f.estimatedMinutes,
          isAvailable: f.isAvailable,
        })),
      };

      const jsonString = JSON.stringify(aiContext, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'feature-library-ai-context.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting AI context:', error);
      alert('Failed to export AI context');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle feature creation from scanner
  const handleScannerCreate = async (featureData: {
    name: string;
    description: string;
    category: FeatureCategory;
    tags: string[];
    requiredAssetIds: string[];
    estimatedMinutes: number;
  }) => {
    await addDoc(collection(db, 'features'), {
      ...featureData,
      isAvailable: true,
      availabilityReason: 'All required assets operational',
      createdAt: serverTimestamp(),
      createdBy: 'user',
      updatedAt: serverTimestamp(),
    });
    setViewMode('grid');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feature Library</h1>
          <p className="text-gray-600 mt-1">
            Manufacturing capabilities linked to workshop assets
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportAIContext}
            disabled={isExporting || features.length === 0}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            title={features.length === 0 ? 'Add features first to export' : 'Export for AI Context'}
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Exporting...' : 'Export AI Context'}
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'scanner' : 'grid')}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            {viewMode === 'grid' ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Scan New Feature
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                View Features
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scanner View */}
      {viewMode === 'scanner' ? (
        <FeatureScanner
          onFeatureCreated={handleScannerCreate}
          onCancel={() => setViewMode('grid')}
        />
      ) : (
        <>
          {/* Search and Filters */}
          <div className="flex items-center gap-4 bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search features..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as FeatureCategory | 'all')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <span className="text-sm text-gray-500 whitespace-nowrap">
              {filteredFeatures.length} feature{filteredFeatures.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Features Grid */}
          {filteredFeatures.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">
                {searchQuery || categoryFilter !== 'all'
                  ? 'No features match your filters'
                  : 'No features yet'}
              </h3>
              <p className="text-gray-500 mt-1">
                {searchQuery || categoryFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Scan a jig or setup to create your first feature'}
              </p>
              <button
                onClick={() => setViewMode('scanner')}
                className="mt-4 text-purple-600 hover:underline"
              >
                Scan New Feature
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFeatures.map((feature) => (
                <div
                  key={feature.id}
                  onClick={() => setSelectedFeature(selectedFeature?.id === feature.id ? null : feature)}
                  className={`bg-white rounded-lg border p-4 hover:shadow-md transition-all cursor-pointer ${
                    selectedFeature?.id === feature.id ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{feature.name}</h3>
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${CATEGORY_COLORS[feature.category]}`}>
                        {CATEGORY_LABELS[feature.category]}
                      </span>
                    </div>
                    <span className={`w-3 h-3 rounded-full ${feature.isAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
                  </div>
                  
                  {feature.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {feature.description}
                    </p>
                  )}
                  
                  {feature.tags && feature.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {feature.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                      {feature.tags.length > 3 && (
                        <span className="text-xs text-gray-400">+{feature.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t">
                    <span>{feature.requiredAssetIds?.length || 0} assets required</span>
                    <span>{feature.estimatedMinutes || 0} min</span>
                  </div>

                  {/* Expanded Detail */}
                  {selectedFeature?.id === feature.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Availability</h4>
                        <p className={`text-sm ${feature.isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                          {feature.availabilityReason || (feature.isAvailable ? 'Available' : 'Unavailable')}
                        </p>
                      </div>
                      {feature.requiredAssetIds && feature.requiredAssetIds.length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Required Assets</h4>
                          <div className="flex flex-wrap gap-1">
                            {feature.requiredAssetIds.map(id => (
                              <span key={id} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                                {id}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default FeatureLibraryPage;

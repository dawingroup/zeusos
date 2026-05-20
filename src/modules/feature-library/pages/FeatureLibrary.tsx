/**
 * Feature Library Page
 * Main page for managing manufacturing features with AI scanner
 */

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { FeatureScanner } from '../components/FeatureScanner';
import type { Feature, FeatureCategory } from '@/shared/types';

type ViewMode = 'list' | 'scanner';

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

export function FeatureLibrary() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [categoryFilter, setCategoryFilter] = useState<FeatureCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Subscribe to features collection
  useEffect(() => {
    const q = query(
      collection(db, 'features'),
      orderBy('name', 'asc')
    );

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
  }, []);

  // Filter features
  const filteredFeatures = features.filter(feature => {
    const matchesCategory = categoryFilter === 'all' || feature.category === categoryFilter;
    const matchesSearch = !searchQuery || 
      feature.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      feature.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      feature.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Handle feature creation from scanner
  const handleFeatureCreated = async (featureData: {
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
    setViewMode('list');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
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
        <button
          onClick={() => setViewMode(viewMode === 'list' ? 'scanner' : 'list')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          {viewMode === 'list' ? (
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

      {viewMode === 'scanner' ? (
        <FeatureScanner
          onFeatureCreated={handleFeatureCreated}
          onCancel={() => setViewMode('list')}
        />
      ) : (
        <>
          {/* Filters */}
          <div className="flex items-center gap-4 bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search features..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as FeatureCategory | 'all')}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <span className="text-sm text-gray-500">
              {filteredFeatures.length} feature{filteredFeatures.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Features Grid */}
          {filteredFeatures.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900">No features yet</h3>
              <p className="text-gray-500 mt-1">Scan a jig or setup to create your first feature.</p>
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
                  className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
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
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

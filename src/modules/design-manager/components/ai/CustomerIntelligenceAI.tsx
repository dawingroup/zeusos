/**
 * Customer Intelligence AI Component
 * 
 * Provides customer-specific insights for project planning:
 * - Material preferences from past projects
 * - Historical project patterns
 * - Preferred suppliers
 * - Quality expectations
 * 
 * Uses customer data from Firestore to enrich AI recommendations.
 */

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { 
  Users, 
  TrendingUp, 
  Star,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  History,
  Heart,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface CustomerProfile {
  id: string;
  name: string;
  segment?: string;
  preferences?: string;
  materialPreferences?: string[];
  preferredSuppliers?: string[];
  qualityExpectations?: string;
  priceSensitivity?: number; // 0-1 scale
  pastProjectCount?: number;
  lastProjectDate?: string;
  notes?: string;
}

export interface CustomerIntelligenceAIProps {
  customerId?: string;
  customerName?: string;
  onContextReady?: (context: CustomerProfile) => void;
  className?: string;
}

export function CustomerIntelligenceAI({
  customerId,
  customerName,
  onContextReady,
  className,
}: CustomerIntelligenceAIProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    preferences: true,
    patterns: false,
    history: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    if (customerId) {
      loadCustomerProfile(customerId);
    }
  }, [customerId]);

  const loadCustomerProfile = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Try to load from customers collection
      const customerDoc = await getDoc(doc(db, 'customers', id));
      
      if (customerDoc.exists()) {
        const data = customerDoc.data();
        const profile: CustomerProfile = {
          id,
          name: data.name || customerName || 'Unknown Customer',
          segment: data.segment,
          preferences: data.preferences,
          materialPreferences: data.materialPreferences || [],
          preferredSuppliers: data.preferredSuppliers || [],
          qualityExpectations: data.qualityExpectations,
          priceSensitivity: data.priceSensitivity,
          pastProjectCount: data.projectCount || 0,
          lastProjectDate: data.lastProjectDate?.toDate?.()?.toISOString?.() || null,
          notes: data.notes,
        };
        
        setCustomerProfile(profile);
        onContextReady?.(profile);
      } else {
        // Create a minimal profile if customer not found
        const minimalProfile: CustomerProfile = {
          id,
          name: customerName || 'New Customer',
          pastProjectCount: 0,
        };
        setCustomerProfile(minimalProfile);
        onContextReady?.(minimalProfile);
      }
    } catch (err) {
      console.error('Error loading customer profile:', err);
      setError('Failed to load customer profile');
    } finally {
      setIsLoading(false);
    }
  };

  const getPriceSensitivityLabel = (value?: number): string => {
    if (value === undefined) return 'Unknown';
    if (value < 0.3) return 'Low (Premium focus)';
    if (value < 0.7) return 'Medium (Value conscious)';
    return 'High (Budget focused)';
  };

  const getSegmentColor = (segment?: string): string => {
    switch (segment?.toLowerCase()) {
      case 'premium': return 'bg-purple-100 text-purple-700';
      case 'commercial': return 'bg-blue-100 text-blue-700';
      case 'residential': return 'bg-green-100 text-green-700';
      case 'hospitality': return 'bg-amber-100 text-amber-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (!customerId && !customerName) {
    return (
      <div className={cn('p-4 bg-gray-50 rounded-lg text-center', className)}>
        <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No customer selected</p>
        <p className="text-xs text-gray-400 mt-1">Link a customer to see intelligence</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg">
          <Users className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">Customer Intelligence</h4>
          <p className="text-sm text-gray-500">
            {customerProfile?.name || customerName || 'Loading...'}
          </p>
        </div>
        {customerProfile?.segment && (
          <span className={cn('px-2 py-1 text-xs font-medium rounded', getSegmentColor(customerProfile.segment))}>
            {customerProfile.segment}
          </span>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Profile Data */}
      {customerProfile && !isLoading && (
        <div className="space-y-3">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <div className="text-lg font-bold text-gray-900">{customerProfile.pastProjectCount || 0}</div>
              <div className="text-xs text-gray-500">Past Projects</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <div className="text-lg font-bold text-gray-900">
                {customerProfile.materialPreferences?.length || 0}
              </div>
              <div className="text-xs text-gray-500">Material Prefs</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <div className="text-lg font-bold text-gray-900">
                {customerProfile.preferredSuppliers?.length || 0}
              </div>
              <div className="text-xs text-gray-500">Pref. Suppliers</div>
            </div>
          </div>

          {/* Preferences Section */}
          <div className="border rounded-lg">
            <div 
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
              onClick={() => toggleSection('preferences')}
            >
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-500" />
                <span className="font-medium text-sm">Preferences</span>
              </div>
              {expandedSections.preferences ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
            {expandedSections.preferences && (
              <div className="px-3 pb-3 border-t space-y-3">
                {/* Material Preferences */}
                {customerProfile.materialPreferences && customerProfile.materialPreferences.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 mb-2">Preferred Materials</p>
                    <div className="flex flex-wrap gap-1">
                      {customerProfile.materialPreferences.map((mat, i) => (
                        <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                          {mat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preferred Suppliers */}
                {customerProfile.preferredSuppliers && customerProfile.preferredSuppliers.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Preferred Suppliers</p>
                    <div className="flex flex-wrap gap-1">
                      {customerProfile.preferredSuppliers.map((sup, i) => (
                        <span key={i} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded">
                          {sup}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quality & Price */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {customerProfile.qualityExpectations && (
                    <div>
                      <p className="text-xs text-gray-500">Quality Level</p>
                      <p className="font-medium flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-500" />
                        {customerProfile.qualityExpectations}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">Price Sensitivity</p>
                    <p className="font-medium">{getPriceSensitivityLabel(customerProfile.priceSensitivity)}</p>
                  </div>
                </div>

                {/* Notes */}
                {customerProfile.notes && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Notes</p>
                    <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{customerProfile.notes}</p>
                  </div>
                )}

                {/* Empty state */}
                {!customerProfile.materialPreferences?.length && 
                 !customerProfile.preferredSuppliers?.length && 
                 !customerProfile.notes && (
                  <p className="text-sm text-gray-500 mt-3 italic">
                    No preferences recorded yet. Complete more projects to build customer intelligence.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Project History */}
          <div className="border rounded-lg">
            <div 
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
              onClick={() => toggleSection('history')}
            >
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-gray-600" />
                <span className="font-medium text-sm">Project History</span>
              </div>
              {expandedSections.history ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
            {expandedSections.history && (
              <div className="px-3 pb-3 border-t">
                {customerProfile.pastProjectCount && customerProfile.pastProjectCount > 0 ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Total Projects</span>
                      <span className="font-medium">{customerProfile.pastProjectCount}</span>
                    </div>
                    {customerProfile.lastProjectDate && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Last Project</span>
                        <span className="font-medium">
                          {new Date(customerProfile.lastProjectDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mt-3 italic">
                    No previous projects with this customer.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* AI Recommendations */}
          {customerProfile.pastProjectCount && customerProfile.pastProjectCount > 0 && (
            <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg">
              <div className="flex items-center gap-2 text-teal-800 font-medium text-sm mb-2">
                <TrendingUp className="w-4 h-4" />
                AI Recommendations
              </div>
              <ul className="text-sm text-teal-700 space-y-1">
                {customerProfile.materialPreferences?.length ? (
                  <li>• Consider {customerProfile.materialPreferences[0]} based on past preferences</li>
                ) : null}
                {customerProfile.qualityExpectations && (
                  <li>• Target {customerProfile.qualityExpectations} quality grade</li>
                )}
                {customerProfile.priceSensitivity !== undefined && customerProfile.priceSensitivity < 0.3 && (
                  <li>• Customer values quality over price - present premium options</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CustomerIntelligenceAI;

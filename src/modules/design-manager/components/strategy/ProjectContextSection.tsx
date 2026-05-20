/**
 * Project Context Section
 * Enhanced data capture for strategy canvas - captures customer info,
 * timeline, style preferences, and other context for AI prompts
 */

import { useState } from 'react';
import {
  User,
  Calendar,
  Building2,
  Palette,
  Users,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';

export interface ProjectContext {
  // Customer Information
  customer: {
    name: string;
    company?: string;
    industry?: string;
    previousProjects?: number;
    preferredStyle?: string;
  };
  
  // Project Details
  project: {
    type: string;
    subType?: string;
    location: string;
    country: string;
    region?: string;
  };
  
  // Timeline
  timeline: {
    startDate?: string;
    targetCompletion?: string;
    urgency: 'flexible' | 'normal' | 'urgent' | 'critical';
    milestones?: string[];
  };
  
  // Style & Aesthetic
  style: {
    primary: string;
    secondary?: string;
    colorPreferences?: string[];
    materialPreferences?: string[];
    avoidStyles?: string[];
    inspirationNotes?: string;
  };
  
  // Target Users/Guests
  targetUsers: {
    demographic?: string;
    usagePattern?: string;
    specialNeeds?: string[];
    capacity?: number;
  };
  
  // Special Requirements
  requirements: {
    sustainability?: boolean;
    localSourcing?: boolean;
    accessibilityCompliant?: boolean;
    brandGuidelines?: boolean;
    customFinishes?: boolean;
    notes?: string;
  };
}

interface ProjectContextSectionProps {
  context: ProjectContext;
  onUpdate: (context: ProjectContext) => void;
  customerName?: string;
  projectName?: string;
}

const PROJECT_TYPES = [
  { value: 'hospitality', label: 'Hospitality', subTypes: ['Hotel', 'Resort', 'Boutique Hotel', 'Lodge', 'Hostel'] },
  { value: 'restaurant', label: 'Restaurant/F&B', subTypes: ['Fine Dining', 'Casual Dining', 'Cafe', 'Bar', 'Quick Service'] },
  { value: 'residential', label: 'Residential', subTypes: ['Single Family', 'Apartment', 'Villa', 'Penthouse', 'Vacation Home'] },
  { value: 'office', label: 'Office/Commercial', subTypes: ['Corporate', 'Co-working', 'Executive', 'Medical', 'Legal'] },
  { value: 'retail', label: 'Retail', subTypes: ['Boutique', 'Showroom', 'Flagship', 'Pop-up', 'Mall Kiosk'] },
  { value: 'healthcare', label: 'Healthcare', subTypes: ['Hospital', 'Clinic', 'Dental', 'Wellness Center', 'Spa'] },
  { value: 'education', label: 'Education', subTypes: ['School', 'University', 'Library', 'Training Center'] },
];

const STYLE_OPTIONS = [
  'Contemporary', 'Modern', 'Minimalist', 'Industrial', 'Scandinavian',
  'Mid-Century Modern', 'Art Deco', 'Traditional', 'Transitional', 'Rustic',
  'Coastal', 'Mediterranean', 'Asian-Inspired', 'African Contemporary', 'Bohemian',
  'Luxury', 'Boutique', 'Eco-Friendly', 'Biophilic', 'High-Tech',
];

const URGENCY_OPTIONS = [
  { value: 'flexible', label: 'Flexible', color: 'bg-green-100 text-green-700' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  { value: 'urgent', label: 'Urgent', color: 'bg-amber-100 text-amber-700' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700' },
];

const COUNTRIES = [
  'Uganda', 'Kenya', 'Tanzania', 'Rwanda', 'Ethiopia', 'South Africa',
  'Nigeria', 'Ghana', 'Egypt', 'Morocco', 'UAE', 'Saudi Arabia',
  'USA', 'UK', 'Germany', 'France', 'Other',
];

export function ProjectContextSection({
  context,
  onUpdate,
  customerName,
  projectName: _projectName,
}: ProjectContextSectionProps) {
  // Safety check: provide default empty context if undefined
  const safeContext: ProjectContext = context || {
    customer: { name: '' },
    project: { type: '', location: '', country: '' },
    timeline: { urgency: 'normal' },
    style: { primary: '' },
    targetUsers: {},
    requirements: {}
  };

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['customer', 'project', 'style'])
  );

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const updateField = <K extends keyof ProjectContext>(
    section: K,
    field: keyof ProjectContext[K],
    value: any
  ) => {
    onUpdate({
      ...safeContext,
      [section]: {
        ...safeContext[section],
        [field]: value,
      },
    });
  };

  const selectedProjectType = PROJECT_TYPES.find(t => t.value === safeContext.project?.type);

  return (
    <div className="space-y-4">
      {/* Customer Information */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('customer')}
          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-blue-500" />
            <span className="font-medium text-gray-900">Customer Information</span>
            {safeContext.customer.name && (
              <span className="text-sm text-gray-500">• {safeContext.customer.name}</span>
            )}
          </div>
          {expandedSections.has('customer') ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>
        
        {expandedSections.has('customer') && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={safeContext.customer.name || customerName || ''}
                  onChange={(e) => updateField('customer', 'name', e.target.value)}
                  placeholder="e.g., John Doe"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company/Organization
                </label>
                <input
                  type="text"
                  value={safeContext.customer.company || ''}
                  onChange={(e) => updateField('customer', 'company', e.target.value)}
                  placeholder="e.g., Marriott Hotels"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Industry
                </label>
                <select
                  value={safeContext.customer.industry || ''}
                  onChange={(e) => updateField('customer', 'industry', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">Select industry...</option>
                  <option value="hospitality">Hospitality</option>
                  <option value="real-estate">Real Estate</option>
                  <option value="retail">Retail</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="corporate">Corporate</option>
                  <option value="residential">Residential (Private)</option>
                  <option value="government">Government</option>
                  <option value="ngo">NGO/Non-Profit</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Previous Projects with Us
                </label>
                <input
                  type="number"
                  min="0"
                  value={safeContext.customer.previousProjects || 0}
                  onChange={(e) => updateField('customer', 'previousProjects', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Project Details */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('project')}
          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-500" />
            <span className="font-medium text-gray-900">Project Details</span>
            {safeContext.project?.type && (
              <span className="text-sm text-gray-500">• {safeContext.project?.type}</span>
            )}
          </div>
          {expandedSections.has('project') ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>
        
        {expandedSections.has('project') && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Type
                </label>
                <select
                  value={safeContext.project?.type}
                  onChange={(e) => updateField('project', 'type', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">Select type...</option>
                  {PROJECT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sub-Type
                </label>
                <select
                  value={safeContext.project?.subType || ''}
                  onChange={(e) => updateField('project', 'subType', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  disabled={!selectedProjectType}
                >
                  <option value="">Select sub-type...</option>
                  {selectedProjectType?.subTypes.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country
                </label>
                <select
                  value={safeContext.project?.country}
                  onChange={(e) => updateField('project', 'country', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">Select country...</option>
                  {COUNTRIES.map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location/City
                </label>
                <input
                  type="text"
                  value={safeContext.project?.location}
                  onChange={(e) => updateField('project', 'location', e.target.value)}
                  placeholder="e.g., Kampala, Nairobi"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('timeline')}
          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-500" />
            <span className="font-medium text-gray-900">Timeline</span>
            {safeContext.timeline.urgency && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                URGENCY_OPTIONS.find(u => u.value === safeContext.timeline.urgency)?.color
              }`}>
                {safeContext.timeline.urgency}
              </span>
            )}
          </div>
          {expandedSections.has('timeline') ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>
        
        {expandedSections.has('timeline') && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Start Date
                </label>
                <input
                  type="date"
                  value={safeContext.timeline.startDate || ''}
                  onChange={(e) => updateField('timeline', 'startDate', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Completion
                </label>
                <input
                  type="date"
                  value={safeContext.timeline.targetCompletion || ''}
                  onChange={(e) => updateField('timeline', 'targetCompletion', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Urgency Level
              </label>
              <div className="flex gap-2">
                {URGENCY_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => updateField('timeline', 'urgency', option.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      safeContext.timeline.urgency === option.value
                        ? option.color
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Style & Aesthetic */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('style')}
          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-purple-500" />
            <span className="font-medium text-gray-900">Style & Aesthetic</span>
            {safeContext.style.primary && (
              <span className="text-sm text-gray-500">• {safeContext.style.primary}</span>
            )}
          </div>
          {expandedSections.has('style') ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>
        
        {expandedSections.has('style') && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Style
                </label>
                <select
                  value={safeContext.style.primary}
                  onChange={(e) => updateField('style', 'primary', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">Select style...</option>
                  {STYLE_OPTIONS.map(style => (
                    <option key={style} value={style}>{style}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Secondary Style
                </label>
                <select
                  value={safeContext.style.secondary || ''}
                  onChange={(e) => updateField('style', 'secondary', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">Select style...</option>
                  {STYLE_OPTIONS.filter(s => s !== safeContext.style.primary).map(style => (
                    <option key={style} value={style}>{style}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Material Preferences
              </label>
              <input
                type="text"
                value={safeContext.style.materialPreferences?.join(', ') || ''}
                onChange={(e) => updateField('style', 'materialPreferences', 
                  e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                )}
                placeholder="e.g., Oak, Brass, Marble, Leather"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Comma-separated list</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color Preferences
              </label>
              <input
                type="text"
                value={safeContext.style.colorPreferences?.join(', ') || ''}
                onChange={(e) => updateField('style', 'colorPreferences', 
                  e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                )}
                placeholder="e.g., Navy Blue, Gold accents, Warm neutrals"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Inspiration Notes
              </label>
              <textarea
                value={safeContext.style.inspirationNotes || ''}
                onChange={(e) => updateField('style', 'inspirationNotes', e.target.value)}
                placeholder="Describe the desired look and feel, reference projects, or inspiration sources..."
                rows={3}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Target Users */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('targetUsers')}
          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-500" />
            <span className="font-medium text-gray-900">Target Users/Guests</span>
          </div>
          {expandedSections.has('targetUsers') ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>
        
        {expandedSections.has('targetUsers') && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Demographic
                </label>
                <input
                  type="text"
                  value={safeContext.targetUsers.demographic || ''}
                  onChange={(e) => updateField('targetUsers', 'demographic', e.target.value)}
                  placeholder="e.g., Business travelers, 30-50 years"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected Capacity
                </label>
                <input
                  type="number"
                  min="0"
                  value={safeContext.targetUsers.capacity || ''}
                  onChange={(e) => updateField('targetUsers', 'capacity', parseInt(e.target.value) || undefined)}
                  placeholder="e.g., 50 guests"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Usage Pattern
              </label>
              <input
                type="text"
                value={safeContext.targetUsers.usagePattern || ''}
                onChange={(e) => updateField('targetUsers', 'usagePattern', e.target.value)}
                placeholder="e.g., High turnover, 2-3 night stays average"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Special Needs/Accessibility
              </label>
              <input
                type="text"
                value={safeContext.targetUsers.specialNeeds?.join(', ') || ''}
                onChange={(e) => updateField('targetUsers', 'specialNeeds', 
                  e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                )}
                placeholder="e.g., ADA compliance, elderly-friendly, child-safe"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Special Requirements */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('requirements')}
          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="font-medium text-gray-900">Special Requirements</span>
          </div>
          {expandedSections.has('requirements') ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>
        
        {expandedSections.has('requirements') && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'sustainability', label: 'Sustainability Focus' },
                { key: 'localSourcing', label: 'Local Sourcing Preferred' },
                { key: 'accessibilityCompliant', label: 'Accessibility Compliant' },
                { key: 'brandGuidelines', label: 'Brand Guidelines Apply' },
                { key: 'customFinishes', label: 'Custom Finishes Required' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={safeContext.requirements[key as keyof typeof safeContext.requirements] as boolean || false}
                    onChange={(e) => updateField('requirements', key as keyof typeof safeContext.requirements, e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes
              </label>
              <textarea
                value={safeContext.requirements.notes || ''}
                onChange={(e) => updateField('requirements', 'notes', e.target.value)}
                placeholder="Any other special requirements or considerations..."
                rows={2}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const DEFAULT_PROJECT_CONTEXT: ProjectContext = {
  customer: {
    name: '',
    company: '',
    industry: '',
    previousProjects: 0,
    preferredStyle: '',
  },
  project: {
    type: '',
    subType: '',
    location: '',
    country: 'Uganda',
    region: 'East Africa',
  },
  timeline: {
    startDate: '',
    targetCompletion: '',
    urgency: 'normal',
    milestones: [],
  },
  style: {
    primary: '',
    secondary: '',
    colorPreferences: [],
    materialPreferences: [],
    avoidStyles: [],
    inspirationNotes: '',
  },
  targetUsers: {
    demographic: '',
    usagePattern: '',
    specialNeeds: [],
    capacity: undefined,
  },
  requirements: {
    sustainability: false,
    localSourcing: false,
    accessibilityCompliant: false,
    brandGuidelines: false,
    customFinishes: false,
    notes: '',
  },
};

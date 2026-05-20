/**
 * Pipeline Kanban - Drag-and-drop deal management
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { KanbanBoard } from '../components/pipeline/KanbanBoard';
import { PipelineFilters } from '../components/pipeline/PipelineFilters';
import { Plus, Search, Filter, Settings, Loader2 } from 'lucide-react';

// Types
type DealStage = 
  | 'screening'
  | 'initial_review'
  | 'preliminary_dd'
  | 'detailed_dd'
  | 'ic_memo'
  | 'ic_approval'
  | 'negotiation'
  | 'documentation'
  | 'closing'
  | 'post_closing';

interface Deal {
  id: string;
  name: string;
  dealCode: string;
  stage: DealStage;
  sector: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  targetInvestment: { amount: number; currency: string };
  expectedCloseDate?: Date;
  currentStageDays: number;
  geography: { country: string };
  team?: Array<{ userId: string; name: string; avatarUrl?: string }>;
}

// Mock data
const mockDeals: Deal[] = [
  {
    id: '1',
    name: 'Kampala Hospital Expansion',
    dealCode: 'KAM-2024-001',
    stage: 'detailed_dd',
    sector: 'healthcare',
    priority: 'high',
    targetInvestment: { amount: 15000000, currency: 'USD' },
    expectedCloseDate: new Date('2024-06-30'),
    currentStageDays: 14,
    geography: { country: 'UG' },
    team: [
      { userId: '1', name: 'John Doe' },
      { userId: '2', name: 'Jane Smith' },
    ]
  },
  {
    id: '2',
    name: 'Nairobi Solar Farm',
    dealCode: 'NAI-2024-002',
    stage: 'ic_memo',
    sector: 'energy',
    priority: 'urgent',
    targetInvestment: { amount: 25000000, currency: 'USD' },
    expectedCloseDate: new Date('2024-05-15'),
    currentStageDays: 7,
    geography: { country: 'KE' },
    team: [
      { userId: '3', name: 'Alice Brown' },
    ]
  },
  {
    id: '3',
    name: 'Dar Port Logistics',
    dealCode: 'DAR-2024-003',
    stage: 'negotiation',
    sector: 'transport',
    priority: 'medium',
    targetInvestment: { amount: 12000000, currency: 'USD' },
    currentStageDays: 21,
    geography: { country: 'TZ' },
  },
  {
    id: '4',
    name: 'Kigali Tech Hub',
    dealCode: 'KIG-2024-004',
    stage: 'screening',
    sector: 'digital',
    priority: 'low',
    targetInvestment: { amount: 5000000, currency: 'USD' },
    currentStageDays: 3,
    geography: { country: 'RW' },
  },
  {
    id: '5',
    name: 'Uganda Water Treatment',
    dealCode: 'UGA-2024-005',
    stage: 'preliminary_dd',
    sector: 'water',
    priority: 'medium',
    targetInvestment: { amount: 8000000, currency: 'USD' },
    currentStageDays: 10,
    geography: { country: 'UG' },
  },
];

export function PipelineKanban() {
  const navigate = useNavigate();
  
  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [deals, setDeals] = useState<Deal[]>(mockDeals);
  const [loading] = useState(false);

  // Handle stage change (drag and drop)
  const handleStageChange = useCallback((dealId: string, newStage: DealStage) => {
    setDeals(prev => 
      prev.map(deal => 
        deal.id === dealId ? { ...deal, stage: newStage, currentStageDays: 0 } : deal
      )
    );
  }, []);

  // Filter deals by search term
  const filteredDeals = deals.filter(deal =>
    deal.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    deal.dealCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Deal Pipeline</h1>
            <p className="text-sm text-gray-500">{filteredDeals.length} active deals</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search deals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-64 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${
                showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            
            {/* Pipeline Settings */}
            <button
              onClick={() => navigate('/investment/settings/pipeline')}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <Settings className="w-5 h-5" />
            </button>
            
            {/* New Deal */}
            <button
              onClick={() => navigate('/investment/deals/new')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              New Deal
            </button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <PipelineFilters 
          onFilterChange={() => {}}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden">
        <KanbanBoard
          deals={filteredDeals}
          onDealClick={(deal: { id: string }) => navigate(`/investment/deals/${deal.id}`)}
          onStageChange={handleStageChange}
        />
      </div>
    </div>
  );
}

export default PipelineKanban;

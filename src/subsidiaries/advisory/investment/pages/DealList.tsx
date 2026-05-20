/**
 * Deal List - Tabular view of all deals with filtering
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Filter, 
  Download,
  MoreHorizontal,
  Eye,
  Edit,
  ChevronUp,
  ChevronDown,
  Building2,
  Heart,
  Factory,
  Leaf,
  Cpu
} from 'lucide-react';

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
  targetInvestment: number;
  geography: string;
  expectedCloseDate?: string;
  dealLead: string;
  status: 'active' | 'on_hold' | 'closed_won' | 'closed_lost';
  createdAt: string;
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
    targetInvestment: 15000000,
    geography: 'Uganda',
    expectedCloseDate: '2024-06-30',
    dealLead: 'John Doe',
    status: 'active',
    createdAt: '2024-01-15',
  },
  {
    id: '2',
    name: 'Nairobi Solar Farm',
    dealCode: 'NAI-2024-002',
    stage: 'ic_memo',
    sector: 'energy',
    priority: 'urgent',
    targetInvestment: 25000000,
    geography: 'Kenya',
    expectedCloseDate: '2024-05-15',
    dealLead: 'Jane Smith',
    status: 'active',
    createdAt: '2024-02-01',
  },
  {
    id: '3',
    name: 'Dar Port Logistics',
    dealCode: 'DAR-2024-003',
    stage: 'negotiation',
    sector: 'transport',
    priority: 'medium',
    targetInvestment: 12000000,
    geography: 'Tanzania',
    dealLead: 'Alice Brown',
    status: 'active',
    createdAt: '2024-02-10',
  },
  {
    id: '4',
    name: 'Kigali Tech Hub',
    dealCode: 'KIG-2024-004',
    stage: 'screening',
    sector: 'digital',
    priority: 'low',
    targetInvestment: 5000000,
    geography: 'Rwanda',
    dealLead: 'Bob Wilson',
    status: 'active',
    createdAt: '2024-03-01',
  },
  {
    id: '5',
    name: 'Uganda Water Treatment',
    dealCode: 'UGA-2024-005',
    stage: 'preliminary_dd',
    sector: 'water',
    priority: 'medium',
    targetInvestment: 8000000,
    geography: 'Uganda',
    dealLead: 'Carol Davis',
    status: 'active',
    createdAt: '2024-02-20',
  },
  {
    id: '6',
    name: 'Addis Ababa Healthcare',
    dealCode: 'ADD-2024-006',
    stage: 'closing',
    sector: 'healthcare',
    priority: 'urgent',
    targetInvestment: 18000000,
    geography: 'Ethiopia',
    expectedCloseDate: '2024-04-30',
    dealLead: 'John Doe',
    status: 'active',
    createdAt: '2023-11-15',
  },
];

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

function formatStageName(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getStageColor(stage: DealStage): string {
  const colors: Record<DealStage, string> = {
    screening: 'bg-gray-100 text-gray-700',
    initial_review: 'bg-blue-100 text-blue-700',
    preliminary_dd: 'bg-indigo-100 text-indigo-700',
    detailed_dd: 'bg-violet-100 text-violet-700',
    ic_memo: 'bg-purple-100 text-purple-700',
    ic_approval: 'bg-fuchsia-100 text-fuchsia-700',
    negotiation: 'bg-pink-100 text-pink-700',
    documentation: 'bg-rose-100 text-rose-700',
    closing: 'bg-emerald-100 text-emerald-700',
    post_closing: 'bg-green-100 text-green-700',
  };
  return colors[stage];
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-blue-100 text-blue-600',
    high: 'bg-amber-100 text-amber-600',
    urgent: 'bg-red-100 text-red-600'
  };
  return colors[priority] || 'bg-gray-100 text-gray-600';
}

function getSectorIcon(sector: string) {
  const icons: Record<string, typeof Building2> = {
    healthcare: Heart,
    energy: Factory,
    transport: Building2,
    water: Leaf,
    digital: Cpu,
  };
  return icons[sector] || Building2;
}

export function DealList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof Deal>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedDeals, setSelectedDeals] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Filter and sort deals
  const filteredDeals = mockDeals
    .filter(deal =>
      deal.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deal.dealCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deal.sector.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  const handleSort = (field: keyof Deal) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleSelectAll = () => {
    if (selectedDeals.length === filteredDeals.length) {
      setSelectedDeals([]);
    } else {
      setSelectedDeals(filteredDeals.map(d => d.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedDeals(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const SortIcon = ({ field }: { field: keyof Deal }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4" /> 
      : <ChevronDown className="w-4 h-4" />;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deal List</h1>
          <p className="text-sm text-gray-500">{filteredDeals.length} deals</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => {}}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => navigate('/advisory/investment/deals/new')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            New Deal
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="p-4 flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search deals by name, code, or sector..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${
              showFilters ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="px-4 pb-4 pt-2 border-t border-gray-100 flex flex-wrap gap-4">
            <select className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">All Stages</option>
              <option value="screening">Screening</option>
              <option value="initial_review">Initial Review</option>
              <option value="preliminary_dd">Preliminary DD</option>
              <option value="detailed_dd">Detailed DD</option>
              <option value="ic_memo">IC Memo</option>
              <option value="ic_approval">IC Approval</option>
              <option value="negotiation">Negotiation</option>
              <option value="documentation">Documentation</option>
              <option value="closing">Closing</option>
            </select>
            <select className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">All Sectors</option>
              <option value="healthcare">Healthcare</option>
              <option value="energy">Energy</option>
              <option value="transport">Transport</option>
              <option value="water">Water</option>
              <option value="digital">Digital</option>
            </select>
            <select className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">All Countries</option>
              <option value="Uganda">Uganda</option>
              <option value="Kenya">Kenya</option>
              <option value="Tanzania">Tanzania</option>
              <option value="Rwanda">Rwanda</option>
              <option value="Ethiopia">Ethiopia</option>
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedDeals.length === filteredDeals.length && filteredDeals.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Deal <SortIcon field="name" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('stage')}
                >
                  <div className="flex items-center gap-1">
                    Stage <SortIcon field="stage" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('sector')}
                >
                  <div className="flex items-center gap-1">
                    Sector <SortIcon field="sector" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('targetInvestment')}
                >
                  <div className="flex items-center gap-1">
                    Investment <SortIcon field="targetInvestment" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('geography')}
                >
                  <div className="flex items-center gap-1">
                    Country <SortIcon field="geography" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('priority')}
                >
                  <div className="flex items-center gap-1">
                    Priority <SortIcon field="priority" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('dealLead')}
                >
                  <div className="flex items-center gap-1">
                    Lead <SortIcon field="dealLead" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDeals.map((deal) => {
                const SectorIcon = getSectorIcon(deal.sector);
                return (
                  <tr 
                    key={deal.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/advisory/investment/deals/${deal.id}`)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedDeals.includes(deal.id)}
                        onChange={() => toggleSelect(deal.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{deal.name}</p>
                        <p className="text-xs text-gray-500">{deal.dealCode}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStageColor(deal.stage)}`}>
                        {formatStageName(deal.stage)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <SectorIcon className="w-4 h-4 text-gray-400" />
                        <span className="capitalize text-sm">{deal.sector}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatCurrency(deal.targetInvestment)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {deal.geography}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getPriorityColor(deal.priority)}`}>
                        {deal.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {deal.dealLead}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => navigate(`/advisory/investment/deals/${deal.id}`)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => navigate(`/advisory/investment/deals/${deal.id}/edit`)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          title="More"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {filteredDeals.length} of {mockDeals.length} deals
          </p>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50" disabled>
              Previous
            </button>
            <button className="px-3 py-1.5 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50" disabled>
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DealList;

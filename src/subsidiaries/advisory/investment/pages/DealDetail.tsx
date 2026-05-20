/**
 * Deal Detail - Comprehensive view of a single deal
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DealHeader } from '../components/deals/DealHeader';
import { DealOverview } from '../components/deals/DealOverview';
import { DDProgressRing } from '../components/due-diligence/DDProgressRing';
import { ReturnMetricsCard } from '../components/financial/ReturnMetricsCard';
import { 
  Loader2, 
  FileText, 
  Users, 
  Activity,
  BarChart3,
  ClipboardList,
  Briefcase
} from 'lucide-react';

type TabId = 'overview' | 'due-diligence' | 'financial' | 'documents' | 'team' | 'activity';

// Mock deal data
const mockDeal = {
  id: '1',
  name: 'Kampala Hospital Expansion',
  dealCode: 'KAM-2024-001',
  stage: 'detailed_dd' as const,
  status: 'active' as const,
  sector: 'healthcare',
  subsector: 'Secondary Healthcare',
  priority: 'high' as const,
  dealType: 'greenfield' as const,
  targetInvestment: { amount: 15000000, currency: 'USD' },
  expectedCloseDate: new Date('2024-06-30'),
  currentStageDays: 14,
  geography: { 
    country: 'UG', 
    region: 'Central',
    city: 'Kampala'
  },
  investmentStructure: {
    type: 'equity',
    equityPercentage: 35,
  },
  team: [
    { userId: '1', name: 'John Doe', role: 'Deal Lead', avatarUrl: '' },
    { userId: '2', name: 'Jane Smith', role: 'Financial Analyst', avatarUrl: '' },
    { userId: '3', name: 'Alice Brown', role: 'Legal Counsel', avatarUrl: '' },
  ],
  linkedProjectId: null,
  description: 'Expansion of existing 50-bed hospital to 150 beds with new diagnostic center and emergency department.',
  investmentThesis: 'Strong demand for quality healthcare in Kampala. Existing facility has 95% occupancy. Government healthcare spending increasing.',
};

const mockDueDiligence = {
  id: 'dd-1',
  overallProgress: 45,
  workstreams: [
    { id: 'ws-1', type: 'financial', progress: 60, status: 'in_progress', tasksComplete: 6, totalTasks: 10 },
    { id: 'ws-2', type: 'legal', progress: 30, status: 'in_progress', tasksComplete: 3, totalTasks: 10 },
    { id: 'ws-3', type: 'technical', progress: 50, status: 'in_progress', tasksComplete: 5, totalTasks: 10 },
    { id: 'ws-4', type: 'commercial', progress: 40, status: 'in_progress', tasksComplete: 4, totalTasks: 10 },
  ],
  redFlags: 0,
  findings: 5,
};

const mockReturnMetrics = {
  projectIRR: 18.5,
  equityIRR: 24.2,
  moic: 2.3,
  npvAtWacc: 8500000,
  paybackPeriod: 4.5,
};

export function DealDetail() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loading] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!dealId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Deal not found</p>
      </div>
    );
  }

  const handleStageChange = (newStage: string) => {
    console.log('Stage changed to:', newStage);
  };

  const tabs = [
    { id: 'overview' as TabId, label: 'Overview', icon: Briefcase },
    { id: 'due-diligence' as TabId, label: 'Due Diligence', icon: ClipboardList },
    { id: 'financial' as TabId, label: 'Financial', icon: BarChart3 },
    { id: 'documents' as TabId, label: 'Documents', icon: FileText },
    { id: 'team' as TabId, label: 'Team', icon: Users },
    { id: 'activity' as TabId, label: 'Activity', icon: Activity },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <DealHeader 
        deal={mockDeal}
        onStageChange={handleStageChange}
        onEdit={() => navigate(`/investment/deals/${dealId}/edit`)}
      />

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content - 2 cols */}
            <div className="lg:col-span-2 space-y-6">
              <DealOverview deal={mockDeal} />
            </div>
            
            {/* Sidebar - 1 col */}
            <div className="space-y-6">
              {/* Quick Stats */}
              <ReturnMetricsCard metrics={mockReturnMetrics} compact />
              
              {/* DD Progress */}
              <DDProgressRing 
                dueDiligence={mockDueDiligence}
                onClick={() => setActiveTab('due-diligence')}
              />
            </div>
          </div>
        )}

        {activeTab === 'due-diligence' && (
          <div className="space-y-6">
            <DDProgressRing 
              dueDiligence={mockDueDiligence}
              size="lg"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {mockDueDiligence.workstreams.map((ws) => (
                <div 
                  key={ws.id}
                  className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/investment/deals/${dealId}/dd/${ws.id}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium capitalize">{ws.type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      ws.status === 'complete' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {ws.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${ws.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    {ws.tasksComplete}/{ws.totalTasks} tasks complete
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'financial' && (
          <div className="space-y-6">
            <ReturnMetricsCard metrics={mockReturnMetrics} />
            
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4">Financial Model</h3>
              <p className="text-gray-500 mb-4">No financial model created yet</p>
              <button 
                onClick={() => navigate(`/investment/deals/${dealId}/model/new`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Financial Model
              </button>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Documents</h3>
            <p className="text-gray-500">No documents uploaded yet</p>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Deal Team</h3>
            <div className="space-y-3">
              {mockDeal.team.map((member) => (
                <div key={member.userId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-gray-500">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Activity</h3>
            <p className="text-gray-500">No activity yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DealDetail;

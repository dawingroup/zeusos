/**
 * EstimateSubTabs
 * Sub-tab navigation for the Estimate section, ordered to match workflow:
 * Materials → Optimization → Estimate
 */

import { Package, Layers, Calculator } from 'lucide-react';
import type { WorkflowStepStatus } from '../../services/workflowStateService';

export type EstimateSubTab = 'materials' | 'optimization' | 'estimate';

interface EstimateSubTabsProps {
  activeTab: EstimateSubTab;
  onTabChange: (tab: EstimateSubTab) => void;
  /** Workflow statuses for status dot indicators */
  itemCostingStatus?: WorkflowStepStatus;
  optimizationStatus?: WorkflowStepStatus;
  estimateStatus?: WorkflowStepStatus;
  /** Content renderers */
  materialsContent: React.ReactNode;
  optimizationContent: React.ReactNode;
  estimateContent: React.ReactNode;
}

const STATUS_DOT: Record<WorkflowStepStatus, string> = {
  complete: 'bg-green-500',
  'in-progress': 'bg-blue-400',
  stale: 'bg-amber-400',
  'not-started': 'bg-gray-300',
};

export function EstimateSubTabs({
  activeTab,
  onTabChange,
  itemCostingStatus = 'not-started',
  optimizationStatus = 'not-started',
  estimateStatus = 'not-started',
  materialsContent,
  optimizationContent,
  estimateContent,
}: EstimateSubTabsProps) {
  const tabs: { key: EstimateSubTab; label: string; icon: React.ReactNode; status: WorkflowStepStatus }[] = [
    { key: 'materials', label: 'Materials', icon: <Package className="w-4 h-4" />, status: itemCostingStatus },
    { key: 'optimization', label: 'Optimization', icon: <Layers className="w-4 h-4" />, status: optimizationStatus },
    { key: 'estimate', label: 'Estimate', icon: <Calculator className="w-4 h-4" />, status: estimateStatus },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'text-[#0A7C8E] border-[#0A7C8E]'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
            <span
              className={`w-2 h-2 rounded-full ${STATUS_DOT[tab.status]}`}
              title={tab.status.replace('-', ' ')}
            />
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'materials' && materialsContent}
      {activeTab === 'optimization' && optimizationContent}
      {activeTab === 'estimate' && estimateContent}
    </div>
  );
}

export default EstimateSubTabs;

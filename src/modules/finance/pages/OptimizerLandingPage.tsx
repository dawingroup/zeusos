// ============================================================================
// OPTIMIZER LANDING PAGE
// Card grid: Dashboard, Spend Plan, Expenditure Queue, Projections,
//            Savings (placeholder), Liabilities (placeholder)
// ============================================================================

import { useNavigate } from 'react-router-dom';
import { Card } from '@/core/components/ui/card';
import {
  BarChart3,
  Calendar,
  ListOrdered,
  TrendingUp,
  PiggyBank,
  Scale,
  Zap,
  ArrowRight,
  Brain,
  GitBranch,
} from 'lucide-react';

interface LandingCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  color: string;
  available: boolean;
}

const OPTIMIZER_CARDS: LandingCard[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Cash position overview, 90-day projections, crisis alerts, and today\'s spend plan summary.',
    icon: BarChart3,
    path: '/finance/optimizer/dashboard',
    color: '#2563EB',
    available: true,
  },
  {
    id: 'spend-plan',
    title: 'Spend Plan',
    description: 'Daily payment schedule with approve/defer actions, cash waterfall, and running balances.',
    icon: Calendar,
    path: '/finance/optimizer/spend-plan',
    color: '#059669',
    available: true,
  },
  {
    id: 'expenditures',
    title: 'Expenditure Queue',
    description: 'All pending expenditures scored and ranked. Filter by tier, category, or project.',
    icon: ListOrdered,
    path: '/finance/optimizer/expenditures',
    color: '#EA580C',
    available: true,
  },
  {
    id: 'projections',
    title: 'Cash Projections',
    description: '90-day forward cash flow projections with confidence bands and crisis zone detection.',
    icon: TrendingUp,
    path: '/finance/optimizer/projections',
    color: '#7C3AED',
    available: true,
  },
  {
    id: 'savings',
    title: 'Savings Tracker',
    description: 'Automated savings allocations, withdrawal requests, and balance tracking.',
    icon: PiggyBank,
    path: '/finance/optimizer/savings',
    color: '#0891B2',
    available: true,
  },
  {
    id: 'liabilities',
    title: 'Liability Register',
    description: 'Statutory obligations (PAYE, NSSF, VAT), recurring liabilities, and deadline calendar.',
    icon: Scale,
    path: '/finance/optimizer/liabilities',
    color: '#BE185D',
    available: true,
  },
  {
    id: 'briefing',
    title: 'AI CFO Briefing',
    description: 'Claude-powered daily financial briefing with decisions, risk alerts, and recommendations.',
    icon: Brain,
    path: '/finance/optimizer/briefing',
    color: '#6366F1',
    available: true,
  },
  {
    id: 'scenarios',
    title: 'Scenario Analysis',
    description: 'What-if scenario builder — delay payments, late receipts, cost increases with AI impact analysis.',
    icon: GitBranch,
    path: '/finance/optimizer/scenarios',
    color: '#8B5CF6',
    available: true,
  },
];

export function OptimizerLandingPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-yellow-50">
          <Zap className="w-5 h-5 text-yellow-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Cash Flow Optimizer</h2>
          <p className="text-sm text-gray-500">
            Algorithmic expenditure prioritization and cash orchestration
          </p>
        </div>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {OPTIMIZER_CARDS.map(card => {
          const Icon = card.icon;
          return (
            <Card
              key={card.id}
              className={`p-5 transition-all ${
                card.available
                  ? 'cursor-pointer hover:shadow-md hover:border-gray-300'
                  : 'opacity-60'
              }`}
              onClick={() => card.available && navigate(card.path)}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-lg"
                  style={{ backgroundColor: `${card.color}12` }}
                >
                  <Icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
                {card.available ? (
                  <ArrowRight className="w-4 h-4 text-gray-300" />
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    Coming Soon
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{card.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{card.description}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default OptimizerLandingPage;

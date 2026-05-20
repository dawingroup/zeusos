/**
 * Portfolios Page
 * 
 * Portfolio management page for the Advisory module.
 */

import { useState } from 'react';
import { PortfolioList, PortfolioDetail } from '../components/portfolio';

type ViewMode = 'list' | 'detail';

interface PortfoliosPageProps {
  initialPortfolioId?: string;
}

export function PortfoliosPage({ initialPortfolioId }: PortfoliosPageProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialPortfolioId ? 'detail' : 'list');
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | undefined>(
    initialPortfolioId
  );
  
  // Mock portfolios data
  const mockPortfolios = [
    {
      id: '1',
      name: 'Growth Fund I',
      clientName: 'Pension Fund Alpha',
      status: 'active' as const,
      strategy: 'growth' as const,
      currentValue: 45000000,
      targetSize: 50000000,
      irr: 0.18,
      moic: 1.45,
      holdingsCount: 8,
      inceptionDate: new Date('2022-01-15'),
    },
    {
      id: '2',
      name: 'Infrastructure Fund',
      clientName: 'Pension Fund Alpha',
      status: 'active' as const,
      strategy: 'income' as const,
      currentValue: 32000000,
      targetSize: 40000000,
      irr: 0.14,
      moic: 1.32,
      holdingsCount: 5,
      inceptionDate: new Date('2022-06-01'),
    },
    {
      id: '3',
      name: 'Healthcare Portfolio',
      clientName: 'Smith Family Office',
      status: 'active' as const,
      strategy: 'balanced' as const,
      currentValue: 28000000,
      targetSize: 30000000,
      irr: 0.21,
      moic: 1.58,
      holdingsCount: 6,
      inceptionDate: new Date('2021-09-01'),
    },
    {
      id: '4',
      name: 'Opportunistic Fund II',
      clientName: 'Government Wealth Fund',
      status: 'active' as const,
      strategy: 'opportunistic' as const,
      currentValue: 120000000,
      targetSize: 150000000,
      irr: 0.25,
      moic: 1.72,
      holdingsCount: 12,
      inceptionDate: new Date('2023-01-01'),
    },
  ];
  
  const selectedPortfolio = selectedPortfolioId
    ? {
        id: selectedPortfolioId,
        name: mockPortfolios.find((p) => p.id === selectedPortfolioId)?.name || 'Portfolio',
        clientName: mockPortfolios.find((p) => p.id === selectedPortfolioId)?.clientName || 'Client',
        status: 'active' as const,
        strategy: 'growth',
        currentValue: 45000000,
        targetSize: 50000000,
        deployedPercentage: 0.9,
        inceptionDate: new Date('2022-01-15'),
        holdings: [
          { id: '1', name: 'Solar Plant Alpha', type: 'Direct Equity', value: 12000000, irr: 0.22, moic: 1.65, sector: 'Energy', vintage: 2022, status: 'invested' },
          { id: '2', name: 'Hospital Complex B', type: 'Direct Equity', value: 9500000, irr: 0.18, moic: 1.42, sector: 'Healthcare', vintage: 2022, status: 'invested' },
          { id: '3', name: 'Water Treatment C', type: 'Direct Equity', value: 8000000, irr: 0.15, moic: 1.28, sector: 'Water', vintage: 2023, status: 'invested' },
          { id: '4', name: 'Education Fund I', type: 'Fund', value: 7500000, irr: 0.12, moic: 1.18, sector: 'Education', vintage: 2022, status: 'invested' },
          { id: '5', name: 'Toll Road Alpha', type: 'Co-Investment', value: 8000000, irr: 0.20, moic: 1.55, sector: 'Transport', vintage: 2023, status: 'invested' },
        ],
        performance: {
          irr: 0.18,
          moic: 1.45,
          tvpi: 1.42,
          dpi: 0.35,
          rvpi: 1.07,
        },
      }
    : undefined;
  
  const handlePortfolioClick = (portfolioId: string) => {
    setSelectedPortfolioId(portfolioId);
    setViewMode('detail');
  };
  
  const handleBack = () => {
    setSelectedPortfolioId(undefined);
    setViewMode('list');
  };
  
  const handleAddPortfolio = () => {
    console.log('Add portfolio');
  };
  
  const handleEditPortfolio = () => {
    console.log('Edit portfolio');
  };
  
  const handleAddHolding = () => {
    console.log('Add holding');
  };
  
  const handleHoldingClick = (holdingId: string) => {
    console.log('View holding:', holdingId);
  };
  
  return (
    <div>
      <div>
        {viewMode === 'list' && (
          <PortfolioList
            portfolios={mockPortfolios}
            onPortfolioClick={handlePortfolioClick}
            onAddPortfolio={handleAddPortfolio}
          />
        )}
        
        {viewMode === 'detail' && (
          <PortfolioDetail
            portfolio={selectedPortfolio}
            onBack={handleBack}
            onEdit={handleEditPortfolio}
            onAddHolding={handleAddHolding}
            onHoldingClick={handleHoldingClick}
          />
        )}
      </div>
    </div>
  );
}

export default PortfoliosPage;

/**
 * Clients Page
 * 
 * Client management page for the Advisory module.
 */

import { useState } from 'react';
import { ClientList, ClientDetail, ClientForm } from '../components/client';

type ViewMode = 'list' | 'detail' | 'form';

interface ClientsPageProps {
  initialClientId?: string;
}

export function ClientsPage({ initialClientId }: ClientsPageProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialClientId ? 'detail' : 'list');
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(initialClientId);
  const [isEditing, setIsEditing] = useState(false);
  
  // Mock clients data
  const mockClients = [
    {
      id: '1',
      name: 'Pension Fund Alpha',
      type: 'institutional' as const,
      aum: 125000000,
      portfolioCount: 3,
      status: 'active' as const,
      relationshipManager: 'John Smith',
      lastActivity: new Date(),
    },
    {
      id: '2',
      name: 'Smith Family Office',
      type: 'family_office' as const,
      aum: 45000000,
      portfolioCount: 2,
      status: 'active' as const,
      relationshipManager: 'Jane Doe',
    },
    {
      id: '3',
      name: 'Government Wealth Fund',
      type: 'sovereign' as const,
      aum: 500000000,
      portfolioCount: 5,
      status: 'active' as const,
      relationshipManager: 'John Smith',
    },
  ];
  
  const selectedClient = selectedClientId
    ? {
        id: selectedClientId,
        name: mockClients.find((c) => c.id === selectedClientId)?.name || 'Client',
        type: 'institutional' as const,
        status: 'active' as const,
        totalAUM: 125000000,
        portfolioCount: 3,
        relationshipManager: 'John Smith',
        address: '123 Finance Street, New York, NY',
        jurisdiction: 'United States',
        taxId: 'XX-XXXXXXX',
        onboardingDate: new Date('2023-01-15'),
        contacts: [
          {
            id: '1',
            name: 'Michael Johnson',
            role: 'CIO',
            email: 'mjohnson@example.com',
            phone: '+1 555-0100',
            isPrimary: true,
          },
        ],
        portfolios: [
          { id: '1', name: 'Growth Fund I', value: 45000000, irr: 0.18, status: 'active' },
          { id: '2', name: 'Infrastructure Fund', value: 32000000, irr: 0.14, status: 'active' },
        ],
      }
    : undefined;
  
  const handleClientClick = (clientId: string) => {
    setSelectedClientId(clientId);
    setViewMode('detail');
  };
  
  const handleBack = () => {
    setSelectedClientId(undefined);
    setViewMode('list');
    setIsEditing(false);
  };
  
  const handleAddClient = () => {
    setSelectedClientId(undefined);
    setIsEditing(false);
    setViewMode('form');
  };
  
  const handleEditClient = () => {
    setIsEditing(true);
    setViewMode('form');
  };
  
  const handleFormSubmit = (data: any) => {
    console.log('Form submitted:', data);
    // Would save to backend
    if (selectedClientId) {
      setViewMode('detail');
    } else {
      setViewMode('list');
    }
    setIsEditing(false);
  };
  
  const handleFormCancel = () => {
    if (selectedClientId) {
      setViewMode('detail');
    } else {
      setViewMode('list');
    }
    setIsEditing(false);
  };
  
  return (
    <div>
      <div>
        {viewMode === 'list' && (
          <ClientList
            clients={mockClients}
            onClientClick={handleClientClick}
            onAddClient={handleAddClient}
          />
        )}
        
        {viewMode === 'detail' && (
          <ClientDetail
            client={selectedClient}
            onBack={handleBack}
            onEdit={handleEditClient}
            onAddPortfolio={() => console.log('Add portfolio')}
            onPortfolioClick={(id) => console.log('View portfolio:', id)}
          />
        )}
        
        {viewMode === 'form' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <ClientForm
              initialData={isEditing && selectedClient ? {
                name: selectedClient.name,
                type: selectedClient.type,
                status: selectedClient.status,
                jurisdiction: selectedClient.jurisdiction,
                taxId: selectedClient.taxId,
                address: selectedClient.address,
                relationshipManager: selectedClient.relationshipManager,
                contacts: selectedClient.contacts.map((c) => ({
                  name: c.name,
                  role: c.role,
                  email: c.email,
                  phone: c.phone || '',
                  isPrimary: c.isPrimary,
                })),
                notes: '',
              } : undefined}
              isEditing={isEditing}
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default ClientsPage;

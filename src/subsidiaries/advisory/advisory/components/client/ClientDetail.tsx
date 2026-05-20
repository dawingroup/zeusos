/**
 * Client Detail
 * 
 * Comprehensive view of a single client including
 * portfolios, contacts, and activity.
 */

import { useState } from 'react';
import {
  ArrowLeft,
  Edit,
  Download,
  Plus,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileText,
  Briefcase,
} from 'lucide-react';

interface ClientContact {
  id: string;
  name: string;
  role: string;
  email: string;
  phone?: string;
  isPrimary: boolean;
}

interface ClientPortfolio {
  id: string;
  name: string;
  value: number;
  irr: number;
  status: string;
}

interface ClientData {
  id: string;
  name: string;
  type: 'institutional' | 'family_office' | 'individual' | 'sovereign';
  status: 'active' | 'prospect' | 'dormant';
  totalAUM: number;
  portfolioCount: number;
  relationshipManager?: string;
  address?: string;
  jurisdiction?: string;
  taxId?: string;
  onboardingDate?: Date;
  contacts: ClientContact[];
  portfolios: ClientPortfolio[];
}

interface ClientDetailProps {
  client?: ClientData;
  loading?: boolean;
  onBack?: () => void;
  onEdit?: () => void;
  onAddPortfolio?: () => void;
  onPortfolioClick?: (portfolioId: string) => void;
}

export function ClientDetail({
  client,
  loading = false,
  onBack,
  onEdit,
  onAddPortfolio,
  onPortfolioClick,
}: ClientDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'portfolios' | 'contacts' | 'documents'>(
    'overview'
  );
  
  if (loading) {
    return <ClientDetailSkeleton />;
  }
  
  if (!client) {
    return (
      <div className="p-6 bg-red-50 rounded-lg">
        <p className="text-red-600">Client not found</p>
        <button
          onClick={onBack}
          className="mt-2 text-sm text-blue-600 hover:text-blue-700"
        >
          Back to Clients
        </button>
      </div>
    );
  }
  
  const statusColors: Record<ClientData['status'], string> = {
    active: 'bg-green-100 text-green-800',
    prospect: 'bg-blue-100 text-blue-800',
    dormant: 'bg-gray-100 text-gray-800',
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-md"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gray-100 rounded-lg">
              {client.type === 'individual' ? (
                <User className="h-6 w-6" />
              ) : (
                <Building2 className="h-6 w-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
                <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[client.status]}`}>
                  {client.status}
                </span>
              </div>
              <p className="text-gray-500 capitalize">
                {client.type.replace('_', ' ')}
                {client.jurisdiction && ` • ${client.jurisdiction}`}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </button>
          <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
          <button
            onClick={onAddPortfolio}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Portfolio
          </button>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Total AUM"
          value={formatCurrency(client.totalAUM)}
          icon={<Briefcase className="h-5 w-5 text-gray-400" />}
        />
        <SummaryCard
          title="Portfolios"
          value={client.portfolioCount.toString()}
          icon={<FileText className="h-5 w-5 text-gray-400" />}
        />
        <SummaryCard
          title="Primary Contact"
          value={client.contacts.find((c) => c.isPrimary)?.name || '-'}
          icon={<User className="h-5 w-5 text-gray-400" />}
        />
        <SummaryCard
          title="Client Since"
          value={
            client.onboardingDate
              ? formatDate(client.onboardingDate)
              : '-'
          }
          icon={<Calendar className="h-5 w-5 text-gray-400" />}
        />
      </div>
      
      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-8">
          {(['overview', 'portfolios', 'contacts', 'documents'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>
      
      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <OverviewTab client={client} />
        )}
        
        {activeTab === 'portfolios' && (
          <PortfoliosTab
            portfolios={client.portfolios}
            onPortfolioClick={onPortfolioClick}
          />
        )}
        
        {activeTab === 'contacts' && (
          <ContactsTab contacts={client.contacts} />
        )}
        
        {activeTab === 'documents' && (
          <DocumentsTab />
        )}
      </div>
    </div>
  );
}

function OverviewTab({ client }: { client: ClientData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Client Information */}
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Client Information</h3>
        <dl className="space-y-3">
          {client.address && (
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
              <div>
                <dt className="text-xs text-gray-500">Address</dt>
                <dd className="text-sm">{client.address}</dd>
              </div>
            </div>
          )}
          {client.taxId && (
            <div>
              <dt className="text-xs text-gray-500">Tax ID</dt>
              <dd className="text-sm">{client.taxId}</dd>
            </div>
          )}
          {client.relationshipManager && (
            <div>
              <dt className="text-xs text-gray-500">Relationship Manager</dt>
              <dd className="text-sm">{client.relationshipManager}</dd>
            </div>
          )}
        </dl>
      </div>
      
      {/* Recent Activity */}
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="text-center py-8 text-gray-500">
          <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p>No recent activity</p>
        </div>
      </div>
    </div>
  );
}

function PortfoliosTab({
  portfolios,
  onPortfolioClick,
}: {
  portfolios: ClientPortfolio[];
  onPortfolioClick?: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {portfolios.map((portfolio) => (
        <div
          key={portfolio.id}
          onClick={() => onPortfolioClick?.(portfolio.id)}
          className="bg-white rounded-lg border shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">{portfolio.name}</h4>
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${
                  portfolio.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {portfolio.status}
              </span>
            </div>
            <div className="text-right">
              <p className="font-semibold">{formatCurrency(portfolio.value)}</p>
              <p
                className={`text-sm ${
                  portfolio.irr >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatPercent(portfolio.irr)} IRR
              </p>
            </div>
          </div>
        </div>
      ))}
      
      {portfolios.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Briefcase className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No portfolios yet</p>
        </div>
      )}
    </div>
  );
}

function ContactsTab({ contacts }: { contacts: ClientContact[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {contacts.map((contact) => (
        <div
          key={contact.id}
          className="bg-white rounded-lg border shadow-sm p-4"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-full">
                <User className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">
                  {contact.name}
                  {contact.isPrimary && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                      Primary
                    </span>
                  )}
                </h4>
                <p className="text-sm text-gray-500">{contact.role}</p>
              </div>
            </div>
          </div>
          
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-gray-400" />
              <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                {contact.email}
              </a>
            </div>
            {contact.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-gray-400" />
                <span>{contact.phone}</span>
              </div>
            )}
          </div>
        </div>
      ))}
      
      {contacts.length === 0 && (
        <div className="col-span-full text-center py-12 text-gray-500">
          <User className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No contacts added</p>
        </div>
      )}
    </div>
  );
}

function DocumentsTab() {
  return (
    <div className="text-center py-12 text-gray-500">
      <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
      <p>No documents uploaded</p>
      <button className="mt-4 text-sm text-blue-600 hover:text-blue-700">
        Upload Document
      </button>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-xs text-gray-500">{title}</p>
          <p className="text-lg font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function ClientDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-12 bg-gray-200 rounded w-1/3" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="h-96 bg-gray-200 rounded-lg" />
    </div>
  );
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
  });
}

export default ClientDetail;

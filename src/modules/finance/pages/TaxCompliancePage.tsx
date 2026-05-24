// ============================================================================
// TAX COMPLIANCE PAGE
// ZeusOS v2.0 - Financial Management Module
// Tax compliance dashboard: portal links, filing calendar, required documents
// ============================================================================

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Globe,
  Calendar,
  FileCheck,
  CheckCircle,
  AlertTriangle,
  Clock,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/core/components/ui/card';
import { TaxPortalLinks } from '../components/admin/TaxPortalLinks';
import { useTaxPortals } from '../hooks/useTaxPortals';

const COMPANY_ID = 'dawinos';

// ============================================================================
// FILING CALENDAR DATA
// ============================================================================

interface TaxFiling {
  id: string;
  filingType: string;
  frequency: string;
  dueDescription: string;
  getNextDueDate: () => Date;
}

const TAX_FILINGS: TaxFiling[] = [
  {
    id: 'vat-monthly',
    filingType: 'Monthly VAT Return',
    frequency: 'Monthly',
    dueDescription: '15th of following month',
    getNextDueDate: () => {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15);
      if (now.getDate() > 15) {
        return nextMonth;
      }
      return new Date(now.getFullYear(), now.getMonth(), 15);
    },
  },
  {
    id: 'corp-tax-quarterly',
    filingType: 'Quarterly Corporation Tax',
    frequency: 'Quarterly',
    dueDescription: 'End of quarter + 30 days',
    getNextDueDate: () => {
      const now = new Date();
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const quarterEndMonth = (currentQuarter + 1) * 3;
      let dueDate = new Date(now.getFullYear(), quarterEndMonth, 30);
      if (now > dueDate) {
        dueDate = new Date(now.getFullYear(), quarterEndMonth + 3, 30);
      }
      return dueDate;
    },
  },
  {
    id: 'annual-return',
    filingType: 'Annual Tax Return',
    frequency: 'Annual',
    dueDescription: 'March 31',
    getNextDueDate: () => {
      const now = new Date();
      let year = now.getFullYear();
      const deadline = new Date(year, 2, 31); // March 31
      if (now > deadline) {
        year += 1;
      }
      return new Date(year, 2, 31);
    },
  },
  {
    id: 'paye-monthly',
    filingType: 'PAYE Returns',
    frequency: 'Monthly',
    dueDescription: 'By 9th of following month',
    getNextDueDate: () => {
      const now = new Date();
      if (now.getDate() > 9) {
        return new Date(now.getFullYear(), now.getMonth() + 1, 9);
      }
      return new Date(now.getFullYear(), now.getMonth(), 9);
    },
  },
];

// ============================================================================
// REQUIRED DOCUMENTS CHECKLIST
// ============================================================================

interface RequiredDocument {
  id: string;
  name: string;
  description: string;
  category: string;
}

const REQUIRED_DOCUMENTS: RequiredDocument[] = [
  {
    id: 'tax-clearance',
    name: 'Tax Clearance Certificate',
    description: 'Annual tax clearance from URA',
    category: 'Compliance',
  },
  {
    id: 'vat-returns',
    name: 'VAT Return Copies',
    description: 'Monthly VAT return filing confirmations',
    category: 'Returns',
  },
  {
    id: 'paye-returns',
    name: 'PAYE Return Filings',
    description: 'Monthly PAYE deduction records',
    category: 'Returns',
  },
  {
    id: 'nssf-contributions',
    name: 'NSSF Contribution Records',
    description: 'Monthly NSSF payments and remittances',
    category: 'Social Security',
  },
  {
    id: 'trading-license',
    name: 'Trading License',
    description: 'Current year KCCA trading license',
    category: 'Licenses',
  },
  {
    id: 'financial-statements',
    name: 'Audited Financial Statements',
    description: 'Annual audited accounts',
    category: 'Reports',
  },
  {
    id: 'withholding-tax',
    name: 'Withholding Tax Receipts',
    description: 'WHT deducted at source documentation',
    category: 'Returns',
  },
  {
    id: 'tin-certificate',
    name: 'TIN Certificate',
    description: 'Taxpayer identification number certificate',
    category: 'Registration',
  },
];

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getFilingStatus(dueDate: Date): { label: string; color: string; icon: typeof Clock } {
  const now = new Date();
  const daysDiff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff < 0) {
    return { label: 'Overdue', color: 'red', icon: AlertTriangle };
  }
  if (daysDiff <= 7) {
    return { label: 'Due Soon', color: 'amber', icon: Clock };
  }
  return { label: 'Upcoming', color: 'green', icon: CheckCircle };
}

export function TaxCompliancePage() {
  const taxPortals = useTaxPortals({ companyId: COMPANY_ID });
  const [showPortalForm, setShowPortalForm] = useState(false);
  const [checkedDocs, setCheckedDocs] = useState<Set<string>>(new Set());

  const toggleDoc = (docId: string) => {
    setCheckedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  // Group documents by category
  const docsByCategory = useMemo(() => {
    const grouped: Record<string, RequiredDocument[]> = {};
    for (const doc of REQUIRED_DOCUMENTS) {
      if (!grouped[doc.category]) grouped[doc.category] = [];
      grouped[doc.category].push(doc);
    }
    return grouped;
  }, []);

  return (
    <div className="space-y-8">
      {/* Back link */}
      <div className="flex items-center gap-3">
        <Link to="/finance/operations" className="text-sm text-muted-foreground hover:text-muted-foreground">
          &larr; Operations
        </Link>
      </div>

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">Tax Compliance</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage tax portals, track filing deadlines, and ensure document compliance
        </p>
      </div>

      {/* ================================================================
          SECTION 1: TAX PORTAL LINKS
          ================================================================ */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-[var(--rag-green)]" />
          <h3 className="text-lg font-semibold text-foreground">Tax Portal Links</h3>
        </div>
        <Card>
          <CardContent className="p-6">
            <TaxPortalLinks
              groupedByCategory={taxPortals.groupedByCategory}
              loading={taxPortals.loading}
              onAddLink={() => setShowPortalForm(true)}
              onDeleteLink={taxPortals.removeLink}
            />
          </CardContent>
        </Card>

        {/* Add Portal Link Modal */}
        {showPortalForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-md mx-4">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <h3 className="font-semibold text-foreground">Add Custom Portal Link</h3>
                <button
                  onClick={() => setShowPortalForm(false)}
                  className="p-1 hover:bg-[var(--bg-sunken)] rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <PortalLinkForm
                onSubmit={async (link) => {
                  await taxPortals.addLink(link);
                  setShowPortalForm(false);
                }}
                onCancel={() => setShowPortalForm(false)}
              />
            </div>
          </div>
        )}
      </section>

      {/* ================================================================
          SECTION 2: FILING CALENDAR
          ================================================================ */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-[var(--rag-green)]" />
          <h3 className="text-lg font-semibold text-foreground">Filing Calendar</h3>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-[var(--bg-sunken)]">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Filing Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Frequency</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Next Due</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {TAX_FILINGS.map((filing) => {
                    const dueDate = filing.getNextDueDate();
                    const status = getFilingStatus(dueDate);
                    const StatusIcon = status.icon;

                    return (
                      <tr
                        key={filing.id}
                        className="border-b last:border-b-0 hover:bg-[var(--bg-sunken)] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{filing.filingType}</p>
                          <p className="text-xs text-muted-foreground">{filing.dueDescription}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{filing.frequency}</td>
                        <td className="px-4 py-3 text-foreground">{formatDate(dueDate)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-${status.color}-100 text-${status.color}-700`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ================================================================
          SECTION 3: REQUIRED DOCUMENTS
          ================================================================ */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-[var(--rag-green)]" />
            <h3 className="text-lg font-semibold text-foreground">Required Documents</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {checkedDocs.size} / {REQUIRED_DOCUMENTS.length} complete
          </p>
        </div>

        <div className="space-y-4">
          {Object.entries(docsByCategory).map(([category, docs]) => (
            <Card key={category}>
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold text-muted-foreground mb-3">{category}</h4>
                <div className="space-y-2">
                  {docs.map((docItem) => {
                    const isChecked = checkedDocs.has(docItem.id);
                    return (
                      <label
                        key={docItem.id}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-[var(--rag-green-soft)] border border-[var(--rag-green)]'
                            : 'bg-[var(--bg-sunken)] border border-transparent hover:bg-[var(--bg-sunken)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleDoc(docItem.id)}
                          className="mt-0.5 h-4 w-4 rounded border-[var(--border-default)] text-[var(--rag-green)] focus:ring-[var(--rag-green)]"
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium ${
                              isChecked ? 'text-[var(--rag-green)] line-through' : 'text-foreground'
                            }`}
                          >
                            {docItem.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{docItem.description}</p>
                        </div>
                        {isChecked && (
                          <CheckCircle className="w-4 h-4 text-[var(--rag-green)] mt-0.5 flex-shrink-0" />
                        )}
                      </label>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// PORTAL LINK FORM (inline)
// ============================================================================

function PortalLinkForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (link: any) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name,
        url,
        description,
        category: 'custom' as const,
        icon: 'Link',
        country: 'UG',
        order: 99,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. URA Web Portal"
          className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--rag-green)]"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">URL</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--rag-green)]"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description..."
          className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--rag-green)]"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-muted-foreground hover:bg-[var(--bg-sunken)] rounded-lg"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 text-sm bg-[var(--rag-green)] text-white rounded-lg hover:bg-[var(--rag-green)] disabled:opacity-50"
        >
          {submitting ? 'Adding...' : 'Add Link'}
        </button>
      </div>
    </form>
  );
}

export default TaxCompliancePage;

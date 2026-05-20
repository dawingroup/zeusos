/**
 * Supplier Detail Page
 *
 * Displays full supplier profile with contact information, financial data,
 * performance metrics, and transaction history sourced from accountabilities.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  Globe,
  Star,
  Edit2,
  Save,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Banknote,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  FileText,
  CreditCard,
  User,
  Loader2,
  Hash,
  Wrench,
  Plus,
  X as XIcon,
  Sparkles,
  Award,
  ShieldAlert,
  Lightbulb,
  Calendar,
  Users,
  ShoppingCart,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useSupplier } from '../hooks/useSuppliers';
import { useSupplierOrders } from '../hooks/useSupplierOrders';
import { SmartProcurementAdvisor } from '@/modules/procurement/components/SmartProcurementAdvisor';
import { useAuth } from '@/shared/hooks';
import type {
  Supplier,
  SupplierStatus,
  SupplierAddress,
  BankDetails,
  SupplierCategory,
  SubsidiaryId,
} from '../types/supplier';
import { SUBSIDIARY_CONFIG, SUPPLIER_STATUS_CONFIG, SUPPLIER_CATEGORY_CONFIG } from '../types/supplier';
import type { ContractorPerformanceMetrics } from '../types/supplier';
import { PO_STATUS_LABELS } from '@/modules/procurement/types/purchaseOrder';
import type { PurchaseOrderStatus } from '@/modules/procurement/types/purchaseOrder';
import { computeContractorPerformance } from '@/modules/procurement/services/contractorPerformanceService';

// ============================================================================
// STATUS BADGE
// ============================================================================

const STATUS_ICONS: Record<SupplierStatus, React.ElementType> = {
  active: CheckCircle,
  inactive: XCircle,
  pending_approval: Clock,
  blacklisted: AlertTriangle,
};

function StatusBadge({ status }: { status: SupplierStatus }) {
  const config = SUPPLIER_STATUS_CONFIG[status];
  const Icon = STATUS_ICONS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-full ${config.bgClass} ${config.textClass}`}>
      <Icon className="w-4 h-4" />
      {config.label}
    </span>
  );
}

// ============================================================================
// SECTION CARD
// ============================================================================

function SectionCard({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ============================================================================
// DETAIL ROW
// ============================================================================

function DetailRow({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm text-gray-900 break-words">{value || <span className="text-gray-400 italic">Not provided</span>}</div>
      </div>
    </div>
  );
}

// ============================================================================
// EDITABLE CONTACT FORM
// ============================================================================

interface EditContactFormProps {
  supplier: Supplier;
  onSave: (updates: Partial<Supplier>) => Promise<void>;
  onCancel: () => void;
}

function EditContactForm({ supplier, onSave, onCancel }: EditContactFormProps) {
  const [contactPerson, setContactPerson] = useState(supplier.contactPerson || '');
  const [email, setEmail] = useState(supplier.email || '');
  const [phone, setPhone] = useState(supplier.phone || '');
  const [alternatePhone, setAlternatePhone] = useState(supplier.alternatePhone || '');
  const [website, setWebsite] = useState(supplier.website || '');
  const [addressLine1, setAddressLine1] = useState(supplier.address?.line1 || '');
  const [addressLine2, setAddressLine2] = useState(supplier.address?.line2 || '');
  const [city, setCity] = useState(supplier.address?.city || '');
  const [region, setRegion] = useState(supplier.address?.region || '');
  const [country, setCountry] = useState(supplier.address?.country || 'Uganda');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        contactPerson,
        email,
        phone,
        alternatePhone: alternatePhone || undefined,
        website: website || undefined,
        address: {
          line1: addressLine1,
          line2: addressLine2 || undefined,
          city,
          region: region || undefined,
          country,
        } as SupplierAddress,
      });
      onCancel();
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Contact Person</label>
          <input className={inputClass} value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Full name" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
          <input className={inputClass} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+256..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Alternate Phone</label>
          <input className={inputClass} type="tel" value={alternatePhone} onChange={(e) => setAlternatePhone(e.target.value)} placeholder="Optional" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">Website</label>
          <input className={inputClass} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-3 mt-3">
        <div className="text-xs font-medium text-gray-500 mb-2">Address</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <input className={inputClass} value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="Address line 1" />
          </div>
          <div className="sm:col-span-2">
            <input className={inputClass} value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} placeholder="Address line 2 (optional)" />
          </div>
          <div>
            <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
          </div>
          <div>
            <input className={inputClass} value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Region" />
          </div>
          <div>
            <input className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" />
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// EDITABLE BANK DETAILS FORM
// ============================================================================

interface EditBankFormProps {
  bankDetails?: BankDetails;
  taxId?: string;
  registrationNumber?: string;
  paymentTerms?: string;
  onSave: (updates: Partial<Supplier>) => Promise<void>;
  onCancel: () => void;
}

function EditBankForm({ bankDetails, taxId, registrationNumber, paymentTerms, onSave, onCancel }: EditBankFormProps) {
  const [bankName, setBankName] = useState(bankDetails?.bankName || '');
  const [accountName, setAccountName] = useState(bankDetails?.accountName || '');
  const [accountNumber, setAccountNumber] = useState(bankDetails?.accountNumber || '');
  const [swiftCode, setSwiftCode] = useState(bankDetails?.swiftCode || '');
  const [branchCode, setBranchCode] = useState(bankDetails?.branchCode || '');
  const [editTaxId, setEditTaxId] = useState(taxId || '');
  const [editRegNum, setEditRegNum] = useState(registrationNumber || '');
  const [editPaymentTerms, setEditPaymentTerms] = useState(paymentTerms || 'Net 30');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Partial<Supplier> = {
        taxId: editTaxId || undefined,
        registrationNumber: editRegNum || undefined,
        paymentTerms: editPaymentTerms || undefined,
      };

      if (bankName || accountNumber) {
        updates.bankDetails = {
          bankName,
          accountName,
          accountNumber,
          swiftCode: swiftCode || undefined,
          branchCode: branchCode || undefined,
        };
      }

      await onSave(updates);
      onCancel();
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Tax ID / TIN</label>
          <input className={inputClass} value={editTaxId} onChange={(e) => setEditTaxId(e.target.value)} placeholder="Tax identification number" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Registration Number</label>
          <input className={inputClass} value={editRegNum} onChange={(e) => setEditRegNum(e.target.value)} placeholder="Business registration" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Payment Terms</label>
          <select className={inputClass} value={editPaymentTerms} onChange={(e) => setEditPaymentTerms(e.target.value)}>
            <option value="Cash on Delivery">Cash on Delivery</option>
            <option value="Net 7">Net 7</option>
            <option value="Net 15">Net 15</option>
            <option value="Net 30">Net 30</option>
            <option value="Net 60">Net 60</option>
            <option value="Net 90">Net 90</option>
          </select>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-3 mt-3">
        <div className="text-xs font-medium text-gray-500 mb-2">Bank Details</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Bank Name</label>
            <input className={inputClass} value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g., Stanbic Bank" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Account Name</label>
            <input className={inputClass} value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Account holder name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Account Number</label>
            <input className={inputClass} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Account number" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">SWIFT Code</label>
            <input className={inputClass} value={swiftCode} onChange={(e) => setSwiftCode(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Branch Code</label>
            <input className={inputClass} value={branchCode} onChange={(e) => setBranchCode(e.target.value)} placeholder="Optional" />
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// EDITABLE BASIC INFO FORM (Name, Trade Name, Categories, Subsidiaries)
// ============================================================================

interface EditBasicInfoFormProps {
  supplier: Supplier;
  onSave: (updates: Partial<Supplier>) => Promise<void>;
  onCancel: () => void;
}

const ALL_CATEGORIES: SupplierCategory[] = ['materials', 'equipment', 'services', 'subcontractor', 'contractor', 'other'];
const ALL_SUBSIDIARIES: SubsidiaryId[] = ['all', 'finishes', 'advisory', 'matflow'];

function EditBasicInfoForm({ supplier, onSave, onCancel }: EditBasicInfoFormProps) {
  const [name, setName] = useState(supplier.name || '');
  const [tradeName, setTradeName] = useState(supplier.tradeName || '');
  const [categories, setCategories] = useState<string[]>(supplier.categories || []);
  const [subsidiaries, setSubsidiaries] = useState<SubsidiaryId[]>(supplier.subsidiaries || ['all']);
  const [creditLimitAmount, setCreditLimitAmount] = useState(
    supplier.creditLimit?.amount?.toString() || ''
  );
  const [saving, setSaving] = useState(false);

  const toggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleSubsidiary = (sub: SubsidiaryId) => {
    if (sub === 'all') {
      setSubsidiaries(['all']);
      return;
    }
    setSubsidiaries((prev) => {
      const withoutAll = prev.filter((s) => s !== 'all');
      if (withoutAll.includes(sub)) {
        const result = withoutAll.filter((s) => s !== sub);
        return result.length === 0 ? ['all'] : result;
      }
      return [...withoutAll, sub];
    });
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const updates: Partial<Supplier> = {
        name: name.trim(),
        categories,
        subsidiaries,
      };
      if (tradeName.trim()) updates.tradeName = tradeName.trim();
      if (creditLimitAmount) {
        updates.creditLimit = {
          amount: parseFloat(creditLimitAmount) || 0,
          currency: supplier.creditLimit?.currency || 'UGX',
        };
      }
      await onSave(updates);
      onCancel();
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Edit2 className="w-4 h-4 text-gray-500" />
        <h3 className="font-semibold text-gray-900">Edit Supplier Details</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Supplier Name *</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Company / supplier name" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Trade Name</label>
          <input className={inputClass} value={tradeName} onChange={(e) => setTradeName(e.target.value)} placeholder="Optional trade / DBA name" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Credit Limit (UGX)</label>
          <input
            className={inputClass}
            type="number"
            value={creditLimitAmount}
            onChange={(e) => setCreditLimitAmount(e.target.value)}
            placeholder="e.g., 50000000"
          />
        </div>
      </div>

      {/* Categories */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Categories</label>
        <div className="flex flex-wrap gap-2">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCategory(cat)}
              className={`px-3 py-1.5 text-xs rounded-full border font-medium transition-colors ${
                categories.includes(cat)
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {SUPPLIER_CATEGORY_CONFIG[cat]?.label || cat}
            </button>
          ))}
        </div>
      </div>

      {/* Subsidiaries */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Subsidiaries</label>
        <div className="flex flex-wrap gap-2">
          {ALL_SUBSIDIARIES.map((sub) => (
            <button
              key={sub}
              type="button"
              onClick={() => toggleSubsidiary(sub)}
              className={`px-3 py-1.5 text-xs rounded-full border font-medium transition-colors ${
                subsidiaries.includes(sub)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {SUBSIDIARY_CONFIG[sub]?.label || sub}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// CONTRACTOR SETTINGS SECTION
// ============================================================================

interface ContractorSettingsSectionProps {
  supplier: Supplier;
  onSave: (updates: Partial<Supplier>) => Promise<void>;
}

function ContractorSettingsSection({ supplier, onSave }: ContractorSettingsSectionProps) {
  const [editing, setEditing] = useState(false);
  const [capabilities, setCapabilities] = useState<string[]>(supplier.contractorCapabilities || []);
  const [capInput, setCapInput] = useState('');
  const [leadTime, setLeadTime] = useState<string>(
    supplier.defaultLeadTimeDays?.toString() || ''
  );
  const [saving, setSaving] = useState(false);

  const addCapability = () => {
    const trimmed = capInput.trim().toLowerCase();
    if (trimmed && !capabilities.includes(trimmed)) {
      setCapabilities(prev => [...prev, trimmed]);
    }
    setCapInput('');
  };

  const removeCapability = (cap: string) => {
    setCapabilities(prev => prev.filter(c => c !== cap));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCapability();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        contractorCapabilities: capabilities,
        defaultLeadTimeDays: leadTime ? parseInt(leadTime, 10) : undefined,
      });
      setEditing(false);
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setCapabilities(supplier.contractorCapabilities || []);
    setLeadTime(supplier.defaultLeadTimeDays?.toString() || '');
    setEditing(false);
  };

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <SectionCard
      title="Contractor Settings"
      icon={Wrench}
      action={
        !editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit
          </button>
        ) : undefined
      }
    >
      {editing ? (
        <div className="space-y-4">
          {/* Capabilities */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Capabilities</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {capabilities.map(cap => (
                <span
                  key={cap}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 text-teal-700 text-xs rounded-full font-medium border border-teal-200"
                >
                  {cap}
                  <button
                    type="button"
                    onClick={() => removeCapability(cap)}
                    className="hover:text-red-600 transition-colors"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {capabilities.length === 0 && (
                <span className="text-xs text-gray-400 italic">No capabilities added yet</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={capInput}
                onChange={e => setCapInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g., metalwork, upholstery, lacquer..."
              />
              <button
                type="button"
                onClick={addCapability}
                disabled={!capInput.trim()}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>

          {/* Default Lead Time */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Default Lead Time (days)</label>
            <input
              className={inputClass}
              type="number"
              min="0"
              value={leadTime}
              onChange={e => setLeadTime(e.target.value)}
              placeholder="e.g., 14"
            />
          </div>

          {/* Linked Warehouse (read-only for now) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Linked Warehouse</label>
            <div className="text-sm text-gray-600 px-3 py-2 bg-gray-50 rounded-lg">
              {supplier.contractorWarehouseId || <span className="text-gray-400 italic">Not linked</span>}
            </div>
          </div>

          {/* Save / Cancel */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Capabilities display */}
          <div>
            <div className="text-xs text-gray-500 mb-1.5">Capabilities</div>
            {supplier.contractorCapabilities && supplier.contractorCapabilities.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {supplier.contractorCapabilities.map(cap => (
                  <span
                    key={cap}
                    className="px-2.5 py-1 bg-teal-50 text-teal-700 text-xs rounded-full font-medium border border-teal-200"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-sm text-gray-400 italic">No capabilities defined</span>
            )}
          </div>

          {/* Lead Time */}
          <DetailRow
            label="Default Lead Time"
            value={supplier.defaultLeadTimeDays ? `${supplier.defaultLeadTimeDays} days` : undefined}
            icon={Clock}
          />

          {/* Linked Warehouse */}
          <DetailRow
            label="Linked Warehouse"
            value={supplier.contractorWarehouseId || 'Not linked'}
            icon={Package}
          />
        </div>
      )}
    </SectionCard>
  );
}

// ============================================================================
// CONTRACTOR PERFORMANCE SECTION
// ============================================================================

function ContractorPerformanceSection({ supplierId, subsidiaryId }: { supplierId: string; subsidiaryId: string }) {
  const [metrics, setMetrics] = useState<ContractorPerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    computeContractorPerformance(supplierId, subsidiaryId)
      .then(result => {
        if (!cancelled) {
          setMetrics(result);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err?.message || 'Failed to load performance data');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [supplierId, subsidiaryId]);

  if (loading) {
    return (
      <SectionCard title="Contractor Performance" icon={Award}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-500">Loading performance data...</span>
        </div>
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard title="Contractor Performance" icon={Award}>
        <div className="text-sm text-red-500 py-4">{error}</div>
      </SectionCard>
    );
  }

  if (!metrics || metrics.totalOrders === 0) {
    return (
      <SectionCard title="Contractor Performance" icon={Award}>
        <div className="text-sm text-gray-400 italic py-4">
          No outsourced purchase orders found for this contractor.
        </div>
      </SectionCard>
    );
  }

  const scoreColor =
    metrics.performanceScore >= 80
      ? 'text-green-600 bg-green-50 border-green-200'
      : metrics.performanceScore >= 50
        ? 'text-amber-600 bg-amber-50 border-amber-200'
        : 'text-red-600 bg-red-50 border-red-200';

  const scoreDotColor =
    metrics.performanceScore >= 80
      ? 'bg-green-500'
      : metrics.performanceScore >= 50
        ? 'bg-amber-500'
        : 'bg-red-500';

  const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`;

  return (
    <SectionCard title="Contractor Performance" icon={Award}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Orders */}
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <ShoppingCart className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-xl font-bold text-gray-900">{metrics.totalOrders}</div>
          <div className="text-xs text-gray-500">Total Orders</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{metrics.completedOrders} completed</div>
        </div>

        {/* On-Time Rate */}
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-gray-900">{metrics.onTimeRate}%</div>
          <div className="text-xs text-gray-500">On-Time Rate</div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            {metrics.onTimeDeliveries} on-time / {metrics.lateDeliveries} late
          </div>
        </div>

        {/* Avg Lead Time */}
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <Calendar className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-gray-900">{metrics.averageLeadTimeDays}</div>
          <div className="text-xs text-gray-500">Avg Lead Time (days)</div>
        </div>

        {/* Total Spend */}
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <Banknote className="w-4 h-4 text-green-400" />
          </div>
          <div className="text-lg font-bold text-gray-900 truncate" title={formatCurrency(metrics.totalSpend)}>
            {metrics.totalSpend >= 1_000_000
              ? `${(metrics.totalSpend / 1_000_000).toFixed(1)}M`
              : metrics.totalSpend >= 1_000
                ? `${(metrics.totalSpend / 1_000).toFixed(0)}K`
                : metrics.totalSpend.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">Total Spend (UGX)</div>
        </div>

        {/* Performance Score */}
        <div className={`rounded-lg p-3 text-center border ${scoreColor}`}>
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <span className={`w-2 h-2 rounded-full ${scoreDotColor}`} />
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold">{metrics.performanceScore}</div>
          <div className="text-xs">Performance Score</div>
        </div>
      </div>
    </SectionCard>
  );
}

// ============================================================================
// METRIC CARD
// ============================================================================

function MetricCard({ label, value, subtext, icon: Icon, color }: {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          <div className="text-xs text-gray-500">{label}</div>
          {subtext && <div className="text-xs text-gray-400">{subtext}</div>}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PO STATUS BADGE
// ============================================================================

const PO_STATUS_COLORS: Record<PurchaseOrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  'pending-approval': 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  sent: 'bg-indigo-100 text-indigo-700',
  'partially-received': 'bg-orange-100 text-orange-700',
  received: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-50 text-red-500',
};

function POStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${PO_STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
      {PO_STATUS_LABELS[status] || status}
    </span>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

const SupplierDetailPage: React.FC = () => {
  const { supplierId } = useParams<{ supplierId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const { supplier, loading, error, updateSupplier } = useSupplier(
    supplierId || null,
    user?.uid || ''
  );

  // Auto-open edit mode when ?edit=true is in the URL
  const shouldEdit = searchParams.get('edit') === 'true';
  const [editingBasicInfo, setEditingBasicInfo] = useState(shouldEdit);
  const [editingContact, setEditingContact] = useState(false);
  const [editingFinancial, setEditingFinancial] = useState(false);
  const [showAllOrders, setShowAllOrders] = useState(false);

  const { orders, loading: ordersLoading, stats: orderStats } = useSupplierOrders(supplierId || null);

  const handleUpdate = async (updates: Partial<Supplier>) => {
    await updateSupplier(updates);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error / not found
  if (error || !supplier) {
    return (
      <div className="py-12 text-center">
        <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Supplier Not Found</h2>
        <p className="text-gray-500 mb-4">{error || 'The requested supplier could not be loaded.'}</p>
        <button onClick={() => navigate('/suppliers')} className="text-primary hover:underline">
          Back to Suppliers
        </button>
      </div>
    );
  }

  const sourceMetadata = (supplier as any).sourceMetadata;
  const formatCurrency = (amount: number, currency: string = 'UGX') => {
    return `${currency} ${amount.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 -mx-4 -mt-4 px-4 py-4 sm:-mx-6 sm:px-6">
        <button
          onClick={() => navigate('/suppliers')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Suppliers
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">{supplier.name || supplier.code}</h1>
              <StatusBadge status={supplier.status} />
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Hash className="w-3.5 h-3.5" />
                {supplier.code}
              </span>
              {supplier.categories?.length > 0 && (
                <span className="capitalize">{supplier.categories.join(', ')}</span>
              )}
              {supplier.subsidiaries && supplier.subsidiaries.length > 0 && (
                <span>
                  {supplier.subsidiaries.map(s => SUBSIDIARY_CONFIG[s]?.label || s).join(', ')}
                </span>
              )}
            </div>
          </div>
          {!editingBasicInfo && (
            <button
              onClick={() => setEditingBasicInfo(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 shrink-0"
            >
              <Edit2 className="w-4 h-4" />
              Edit Supplier
            </button>
          )}
        </div>
      </div>

      {/* Basic Info Edit Form */}
      {editingBasicInfo && (
        <EditBasicInfoForm
          supplier={supplier}
          onSave={handleUpdate}
          onCancel={() => {
            setEditingBasicInfo(false);
            if (searchParams.get('edit')) {
              searchParams.delete('edit');
              setSearchParams(searchParams, { replace: true });
            }
          }}
        />
      )}

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total Orders"
          value={supplier.totalOrders || 0}
          icon={Package}
          color="bg-blue-50 text-blue-600"
        />
        <MetricCard
          label="Total Value"
          value={formatCurrency(supplier.totalValue?.amount || 0, supplier.totalValue?.currency)}
          icon={Banknote}
          color="bg-green-50 text-green-600"
        />
        <MetricCard
          label="On-Time Delivery"
          value={supplier.onTimeDeliveryRate ? `${Math.round(supplier.onTimeDeliveryRate * 100)}%` : 'N/A'}
          icon={TrendingUp}
          color="bg-amber-50 text-amber-600"
        />
        <MetricCard
          label="Rating"
          value={supplier.rating?.toFixed(1) || 'N/A'}
          subtext={supplier.rating ? `${supplier.rating >= 4 ? 'Excellent' : supplier.rating >= 3 ? 'Good' : 'Needs Improvement'}` : undefined}
          icon={Star}
          color="bg-purple-50 text-purple-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Information */}
        <SectionCard
          title="Contact Information"
          icon={User}
          action={
            !editingContact ? (
              <button onClick={() => setEditingContact(true)} className="flex items-center gap-1 text-sm text-primary hover:underline">
                <Edit2 className="w-3.5 h-3.5" />
                Edit
              </button>
            ) : undefined
          }
        >
          {editingContact ? (
            <EditContactForm
              supplier={supplier}
              onSave={handleUpdate}
              onCancel={() => setEditingContact(false)}
            />
          ) : (
            <div className="space-y-1">
              <DetailRow label="Contact Person" value={supplier.contactPerson} icon={User} />
              <DetailRow label="Phone" value={supplier.phone} icon={Phone} />
              {supplier.alternatePhone && (
                <DetailRow label="Alternate Phone" value={supplier.alternatePhone} icon={Phone} />
              )}
              <DetailRow label="Email" value={supplier.email} icon={Mail} />
              {supplier.website && (
                <DetailRow
                  label="Website"
                  value={
                    <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {supplier.website}
                    </a>
                  }
                  icon={Globe}
                />
              )}
              <DetailRow
                label="Address"
                value={
                  [supplier.address?.line1, supplier.address?.line2, supplier.address?.city, supplier.address?.region, supplier.address?.country]
                    .filter(Boolean)
                    .join(', ') || undefined
                }
                icon={MapPin}
              />
            </div>
          )}
        </SectionCard>

        {/* Financial Information */}
        <SectionCard
          title="Financial Information"
          icon={CreditCard}
          action={
            !editingFinancial ? (
              <button onClick={() => setEditingFinancial(true)} className="flex items-center gap-1 text-sm text-primary hover:underline">
                <Edit2 className="w-3.5 h-3.5" />
                Edit
              </button>
            ) : undefined
          }
        >
          {editingFinancial ? (
            <EditBankForm
              bankDetails={supplier.bankDetails}
              taxId={supplier.taxId}
              registrationNumber={supplier.registrationNumber}
              paymentTerms={supplier.paymentTerms}
              onSave={handleUpdate}
              onCancel={() => setEditingFinancial(false)}
            />
          ) : (
            <div className="space-y-1">
              <DetailRow label="Payment Terms" value={supplier.paymentTerms} icon={FileText} />
              <DetailRow label="Tax ID / TIN" value={supplier.taxId} icon={Hash} />
              <DetailRow label="Registration Number" value={supplier.registrationNumber} icon={FileText} />
              {supplier.creditLimit && (
                <DetailRow
                  label="Credit Limit"
                  value={formatCurrency(supplier.creditLimit.amount, supplier.creditLimit.currency)}
                  icon={Banknote}
                />
              )}
              {supplier.currentBalance && (
                <DetailRow
                  label="Current Balance"
                  value={formatCurrency(supplier.currentBalance.amount, supplier.currentBalance.currency)}
                  icon={Banknote}
                />
              )}

              {/* Bank Details */}
              {supplier.bankDetails ? (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="text-xs font-medium text-gray-500 mb-2">Bank Details</div>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Bank</span>
                      <span className="font-medium">{supplier.bankDetails.bankName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Account Name</span>
                      <span className="font-medium">{supplier.bankDetails.accountName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Account Number</span>
                      <span className="font-medium">{supplier.bankDetails.accountNumber}</span>
                    </div>
                    {supplier.bankDetails.swiftCode && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">SWIFT</span>
                        <span className="font-medium">{supplier.bankDetails.swiftCode}</span>
                      </div>
                    )}
                    {supplier.bankDetails.branchCode && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Branch</span>
                        <span className="font-medium">{supplier.bankDetails.branchCode}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="text-xs text-gray-400 italic">No bank details on file</div>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Contractor Settings — only for contractor/subcontractor suppliers */}
      {(supplier.categories?.includes('contractor') || supplier.categories?.includes('subcontractor')) && (
        <ContractorSettingsSection supplier={supplier} onSave={handleUpdate} />
      )}

      {/* Contractor Performance — only for contractor/subcontractor suppliers */}
      {(supplier.categories?.includes('contractor') || supplier.categories?.includes('subcontractor')) && supplierId && (
        <ContractorPerformanceSection supplierId={supplierId} subsidiaryId={supplier.subsidiaries?.[0] || ''} />
      )}

      {/* Source Metadata (for vendors imported from accountabilities) */}
      {sourceMetadata && (
        <SectionCard title="Import History" icon={FileText}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-gray-900">{sourceMetadata.transactionCount || 0}</div>
              <div className="text-xs text-gray-500">Transactions</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-gray-900">{sourceMetadata.requisitionCount || 0}</div>
              <div className="text-xs text-gray-500">Requisitions</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-green-600">
                {sourceMetadata.totalSpend ? formatCurrency(sourceMetadata.totalSpend, sourceMetadata.currency || 'UGX') : 'N/A'}
              </div>
              <div className="text-xs text-gray-500">Total Spend</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs font-medium text-gray-900">
                {sourceMetadata.importedFrom === 'advisory_accountabilities' ? 'Advisory Accountabilities' : sourceMetadata.importedFrom}
              </div>
              <div className="text-xs text-gray-500">Source</div>
            </div>
          </div>

          {sourceMetadata.sampleDescriptions?.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium text-gray-500 mb-2">Recent Transaction Descriptions</div>
              <ul className="space-y-1">
                {sourceMetadata.sampleDescriptions.map((desc: string, i: number) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-gray-300 mt-0.5">-</span>
                    {desc}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SectionCard>
      )}

      {/* QuickBooks Sync Status */}
      {supplier.externalIds?.quickbooksId && (
        <SectionCard title="QuickBooks Integration" icon={TrendingUp}>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-gray-500">QuickBooks ID:</span>{' '}
              <span className="font-mono">{supplier.externalIds.quickbooksId}</span>
            </div>
            {supplier.qboSyncStatus && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
                supplier.qboSyncStatus === 'synced'
                  ? 'bg-green-100 text-green-700'
                  : supplier.qboSyncStatus === 'error'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
              }`}>
                {supplier.qboSyncStatus === 'synced' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                {supplier.qboSyncStatus}
              </span>
            )}
          </div>
        </SectionCard>
      )}

      {/* ================================================================ */}
      {/* PURCHASE ORDER HISTORY                                           */}
      {/* ================================================================ */}

      <SectionCard
        title={`Purchase Orders (${orderStats.totalOrders})`}
        icon={ShoppingCart}
        action={
          orderStats.totalOrders > 0 ? (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">
                {orderStats.openOrders} open
              </span>
              <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded font-medium">
                {orderStats.receivedOrders} received
              </span>
            </div>
          ) : undefined
        }
      >
        {ordersLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingCart className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No purchase orders with this supplier yet</p>
          </div>
        ) : (
          <>
            {/* Order Stats Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                <div className="text-lg font-bold text-gray-900">{orderStats.totalOrders}</div>
                <div className="text-[10px] text-gray-500">Total POs</div>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                <div className="text-lg font-bold text-green-600">
                  {orderStats.currency} {orderStats.totalValue.toLocaleString()}
                </div>
                <div className="text-[10px] text-gray-500">Total Spend</div>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                <div className="text-lg font-bold text-gray-900">
                  {orderStats.currency} {Math.round(orderStats.avgOrderValue).toLocaleString()}
                </div>
                <div className="text-[10px] text-gray-500">Avg Order Value</div>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                <div className="text-lg font-bold text-blue-600">{orderStats.openOrders}</div>
                <div className="text-[10px] text-gray-500">Open Orders</div>
              </div>
            </div>

            {/* Orders Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">PO Number</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-500 uppercase">Received</th>
                    <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(showAllOrders ? orders : orders.slice(0, 5)).map((po) => {
                    const totalQty = po.lineItems.reduce((s, li) => s + li.quantity, 0);
                    const totalReceived = po.lineItems.reduce((s, li) => s + li.quantityReceived, 0);
                    const receivePercent = totalQty > 0 ? Math.round((totalReceived / totalQty) * 100) : 0;
                    const raw = po.createdAt;
                    const poDate = raw && typeof raw === 'object' && 'toDate' in raw
                      ? (raw as any).toDate()
                      : typeof raw === 'string' || typeof raw === 'number'
                        ? new Date(raw)
                        : null;

                    return (
                      <tr
                        key={po.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/manufacturing/purchase-orders/${po.id}`)}
                      >
                        <td className="px-3 py-2">
                          <span className="text-sm font-medium text-primary">{po.poNumber}</span>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {poDate && !isNaN(poDate.getTime())
                            ? poDate.toLocaleDateString()
                            : '-'}
                        </td>
                        <td className="px-3 py-2">
                          <POStatusBadge status={po.status} />
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {po.lineItems.length} item{po.lineItems.length !== 1 ? 's' : ''}
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                          {po.totals?.currency || 'UGX'} {(po.totals?.grandTotal || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  receivePercent >= 100 ? 'bg-green-500' : receivePercent > 0 ? 'bg-blue-500' : 'bg-gray-200'
                                }`}
                                style={{ width: `${Math.min(receivePercent, 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-gray-500 w-8">{receivePercent}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <ExternalLink className="w-3.5 h-3.5 text-gray-300" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Show more/less toggle */}
            {orders.length > 5 && (
              <button
                onClick={() => setShowAllOrders(!showAllOrders)}
                className="flex items-center gap-1 mx-auto mt-3 px-3 py-1.5 text-xs text-primary hover:text-primary/80 font-medium"
              >
                {showAllOrders ? (
                  <>Show Less <ChevronUp className="w-3.5 h-3.5" /></>
                ) : (
                  <>Show All {orders.length} Orders <ChevronDown className="w-3.5 h-3.5" /></>
                )}
              </button>
            )}

            {/* Recent Line Items Summary */}
            {orders.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h4 className="text-xs font-medium text-gray-500 mb-2">Recently Ordered Items</h4>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(
                    new Set(
                      orders
                        .slice(0, 10)
                        .flatMap((o) => o.lineItems.map((li) => li.description))
                    )
                  )
                    .slice(0, 12)
                    .map((desc, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded truncate max-w-[200px]"
                        title={desc}
                      >
                        {desc}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>

      {/* ================================================================ */}
      {/* PERSISTED AI INTELLIGENCE SECTIONS                               */}
      {/* ================================================================ */}

      {supplier.aiIntelligence && (
        <>
          {/* AI Intelligence Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h2 className="text-base font-semibold text-gray-900">AI Intelligence</h2>
              {supplier.aiIntelligence.lastAnalyzedAt && (
                <span className="text-xs text-gray-400">
                  Last updated: {new Date(supplier.aiIntelligence.lastAnalyzedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          {/* Enrichment: Business Profile */}
          {supplier.aiIntelligence.enrichment && (
            <SectionCard title="AI Business Profile" icon={Building2}>
              <div className="space-y-4">
                {/* Business Info Summary */}
                {(supplier.aiIntelligence.enrichment.yearEstablished ||
                  supplier.aiIntelligence.enrichment.employeeCount ||
                  supplier.aiIntelligence.enrichment.annualRevenue) && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {supplier.aiIntelligence.enrichment.yearEstablished && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
                          <Calendar className="w-3 h-3" />
                          Established
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {supplier.aiIntelligence.enrichment.yearEstablished}
                        </div>
                      </div>
                    )}
                    {supplier.aiIntelligence.enrichment.employeeCount && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
                          <Users className="w-3 h-3" />
                          Employees
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {supplier.aiIntelligence.enrichment.employeeCount}
                        </div>
                      </div>
                    )}
                    {supplier.aiIntelligence.enrichment.annualRevenue && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <div className="text-[10px] text-gray-400 mb-0.5">Annual Revenue</div>
                        <div className="text-sm font-medium text-gray-900">
                          {supplier.aiIntelligence.enrichment.annualRevenue}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Certifications */}
                {supplier.aiIntelligence.enrichment.certifications &&
                  supplier.aiIntelligence.enrichment.certifications.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-2">
                      <Award className="w-3.5 h-3.5" />
                      Certifications
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {supplier.aiIntelligence.enrichment.certifications.map((cert, i) => (
                        <span key={i} className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded font-medium">
                          {cert}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Brands */}
                {supplier.aiIntelligence.enrichment.brands &&
                  supplier.aiIntelligence.enrichment.brands.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-2">Brands Distributed</div>
                    <div className="flex flex-wrap gap-1.5">
                      {supplier.aiIntelligence.enrichment.brands.map((brand, i) => (
                        <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                          {brand}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Specializations */}
                {supplier.aiIntelligence.enrichment.specializations &&
                  supplier.aiIntelligence.enrichment.specializations.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-2">Specializations</div>
                    <div className="flex flex-wrap gap-1.5">
                      {supplier.aiIntelligence.enrichment.specializations.map((spec, i) => (
                        <span key={i} className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded">
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Service Areas */}
                {supplier.aiIntelligence.enrichment.serviceAreas &&
                  supplier.aiIntelligence.enrichment.serviceAreas.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-2">Service Areas</div>
                    <div className="flex flex-wrap gap-1.5">
                      {supplier.aiIntelligence.enrichment.serviceAreas.map((area, i) => (
                        <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reviews */}
                {supplier.aiIntelligence.enrichment.reviews &&
                  supplier.aiIntelligence.enrichment.reviews.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-2">Online Reviews</div>
                    <div className="flex flex-wrap gap-3">
                      {supplier.aiIntelligence.enrichment.reviews.map((review, i) => (
                        <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                          <Star className="w-4 h-4 text-amber-500" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{review.rating}/5</div>
                            <div className="text-[10px] text-gray-400">
                              {review.reviewCount} reviews on {review.source}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Risk Alerts & Recommendations side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Alerts */}
            {supplier.aiIntelligence.riskAlerts && supplier.aiIntelligence.riskAlerts.length > 0 && (
              <SectionCard title="Risk Alerts" icon={ShieldAlert}>
                <div className="space-y-3">
                  {supplier.aiIntelligence.riskAlerts.map((alert, i) => {
                    const severityColors: Record<string, string> = {
                      low: 'bg-green-100 text-green-700',
                      medium: 'bg-amber-100 text-amber-700',
                      high: 'bg-red-100 text-red-700',
                    };
                    const riskLabels: Record<string, string> = {
                      delivery: 'Delivery', quality: 'Quality', financial: 'Financial',
                      concentration: 'Concentration', geopolitical: 'Geopolitical',
                    };
                    return (
                      <div key={i} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <ShieldAlert className={`w-3.5 h-3.5 ${alert.severity === 'high' ? 'text-red-500' : alert.severity === 'medium' ? 'text-amber-500' : 'text-gray-400'}`} />
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[alert.severity] || severityColors.low}`}>
                            {alert.severity.toUpperCase()}
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            {riskLabels[alert.riskType] || alert.riskType}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 mb-1">{alert.description}</p>
                        <p className="text-xs text-gray-500"><strong>Recommendation:</strong> {alert.recommendation}</p>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}

            {/* Procurement Recommendations */}
            {supplier.aiIntelligence.recommendations && supplier.aiIntelligence.recommendations.length > 0 && (
              <SectionCard title="Procurement Recommendations" icon={Lightbulb}>
                <div className="space-y-3">
                  {supplier.aiIntelligence.recommendations.map((rec, i) => {
                    const actionColors: Record<string, string> = {
                      keep: 'bg-green-100 text-green-700',
                      switch: 'bg-red-100 text-red-700',
                      renegotiate: 'bg-amber-100 text-amber-700',
                      'add-backup': 'bg-blue-100 text-blue-700',
                    };
                    const actionLabels: Record<string, string> = {
                      keep: 'Keep', switch: 'Switch', renegotiate: 'Renegotiate', 'add-backup': 'Add Backup',
                    };
                    return (
                      <div key={i} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionColors[rec.action] || actionColors.keep}`}>
                              {actionLabels[rec.action] || rec.action}
                            </span>
                            <span className="text-xs text-gray-400">{rec.confidence}% confidence</span>
                          </div>
                          {rec.potentialSavings && (
                            <span className="text-xs font-medium text-green-600">
                              Save {rec.potentialSavings.percentage}%
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-medium text-gray-900 mb-0.5">{rec.itemName}</h4>
                        <p className="text-xs text-gray-500">{rec.reason}</p>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}
          </div>

          {/* Price Trends */}
          {supplier.aiIntelligence.priceTrends && supplier.aiIntelligence.priceTrends.length > 0 && (
            <SectionCard title="Price Trends" icon={TrendingUp}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {supplier.aiIntelligence.priceTrends.map((trend, i) => {
                  const TrendIcon = trend.trend === 'rising' ? TrendingUp : trend.trend === 'falling' ? TrendingDown : Minus;
                  const trendColor = trend.trend === 'rising' ? 'text-red-600' : trend.trend === 'falling' ? 'text-green-600' : 'text-gray-600';

                  return (
                    <div key={i} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-900">{trend.supplierName}</h4>
                        <div className={`flex items-center gap-1 ${trendColor}`}>
                          <TrendIcon className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium capitalize">
                            {trend.trend} ({trend.avgChangePercent > 0 ? '+' : ''}{trend.avgChangePercent.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                      {trend.dataPoints.length > 1 && (
                        <div className="flex items-end gap-0.5 h-6 mb-2">
                          {trend.dataPoints.map((dp, j) => {
                            const maxPrice = Math.max(...trend.dataPoints.map(d => d.price));
                            const height = maxPrice > 0 ? (dp.price / maxPrice) * 100 : 50;
                            return (
                              <div
                                key={j}
                                className={`flex-1 rounded-t ${
                                  trend.trend === 'rising' ? 'bg-red-200' : trend.trend === 'falling' ? 'bg-green-200' : 'bg-gray-200'
                                }`}
                                style={{ height: `${height}%` }}
                                title={`${dp.date}: ${dp.price.toLocaleString()}`}
                              />
                            );
                          })}
                        </div>
                      )}
                      {trend.renegotiationWindow && (
                        <div className="px-2 py-1 bg-amber-50 border border-amber-100 rounded text-xs text-amber-700">
                          Renegotiate: {trend.renegotiationWindow}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* Market Insights */}
          {supplier.aiIntelligence.marketInsights && supplier.aiIntelligence.marketInsights.length > 0 && (
            <SectionCard title="Market Insights" icon={Globe}>
              <div className="space-y-2">
                {supplier.aiIntelligence.marketInsights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-800">
                    <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {insight}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}

      {/* Smart Procurement Advisor (for running new analyses) */}
      <SmartProcurementAdvisor supplier={supplier} />
    </div>
  );
};

export default SupplierDetailPage;

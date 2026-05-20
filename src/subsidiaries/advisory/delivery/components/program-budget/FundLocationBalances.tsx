/**
 * FundLocationBalances
 *
 * Cards showing fund balances per location. Treasury (HQ) card is
 * highlighted with a blue border. Each card shows received / disbursed /
 * pending / available amounts with a mini progress bar and optional
 * contact info.
 */

import { useState } from 'react';
import {
  Building2,
  MapPin,
  Mail,
  User,
  Plus,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import {
  FUND_LOCATION_TYPE_CONFIG,
  getFundLocationTypeLabel,
} from '../../types/fund-location';
import type {
  FundLocation,
  FundLocationBalance,
  FundLocationType,
} from '../../types/fund-location';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

interface FundLocationBalancesProps {
  locations: FundLocation[];
  balances: FundLocationBalance[];
  onAddLocation?: (data: {
    name: string;
    type: FundLocationType;
    currency: string;
    country: string;
    region?: string;
    isTreasury: boolean;
    contactPerson?: string;
    contactEmail?: string;
  }) => void;
  onDeactivateLocation?: (locationId: string) => void;
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function fmtAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function disbursedRatio(balance: FundLocationBalance): number {
  if (balance.totalReceived <= 0) return 0;
  return Math.min((balance.totalDisbursed / balance.totalReceived) * 100, 100);
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function FundLocationBalances({
  locations,
  balances,
  onAddLocation,
  onDeactivateLocation,
}: FundLocationBalancesProps) {
  const [showAddForm, setShowAddForm] = useState(false);

  if (locations.length === 0 && !showAddForm) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
        <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500 mb-3">No fund locations configured.</p>
        {onAddLocation && (
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add First Location
          </button>
        )}
      </div>
    );
  }

  // Index balances by locationId for fast lookup
  const balanceMap = new Map(balances.map((b) => [b.locationId, b]));

  // Sort: treasury first, then by name
  const sorted = [...locations]
    .filter((l) => l.isActive)
    .sort((a, b) => {
      if (a.isTreasury !== b.isTreasury) return a.isTreasury ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Fund Locations</h3>
        {onAddLocation && (
          <button
            onClick={() => setShowAddForm(prev => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            {showAddForm ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Close
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add Location
              </>
            )}
          </button>
        )}
      </div>

      {showAddForm && onAddLocation && (
        <AddLocationForm
          onAdd={(data) => {
            onAddLocation(data);
            setShowAddForm(false);
          }}
          onCancel={() => setShowAddForm(false)}
          existingLocations={locations}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((location) => {
          const balance = balanceMap.get(location.id);
          const typeCfg = FUND_LOCATION_TYPE_CONFIG[location.type];
          const ratio = balance ? disbursedRatio(balance) : 0;

          return (
            <div
              key={location.id}
              className={`rounded-lg border bg-white p-4 ${
                location.isTreasury
                  ? 'border-blue-400 ring-1 ring-blue-200'
                  : 'border-gray-200'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2
                    className={`w-5 h-5 flex-shrink-0 ${
                      location.isTreasury ? 'text-blue-600' : 'text-gray-400'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{location.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeCfg.color} ${typeCfg.bgColor}`}
                      >
                        {getFundLocationTypeLabel(location.type)}
                      </span>
                      <span className="text-xs text-gray-500">{location.currency}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {location.isTreasury && (
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 rounded-full px-2 py-0.5">
                      Treasury
                    </span>
                  )}
                  {onDeactivateLocation && !location.isTreasury && (
                    <button
                      onClick={() => onDeactivateLocation(location.id)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Deactivate location"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Amounts */}
              {balance ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Received</span>
                      <span className="font-medium text-gray-900">
                        {fmtAmount(balance.totalReceived, balance.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Disbursed</span>
                      <span className="font-medium text-gray-900">
                        {fmtAmount(balance.totalDisbursed, balance.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Pending</span>
                      <span className="font-medium text-amber-600">
                        {fmtAmount(balance.totalPending, balance.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Available</span>
                      <span className="font-semibold text-green-600">
                        {fmtAmount(balance.availableBalance, balance.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Mini progress bar: disbursed / received */}
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Disbursed / Received</span>
                      <span>{ratio.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          ratio > 90
                            ? 'bg-red-500'
                            : ratio > 70
                              ? 'bg-amber-500'
                              : 'bg-blue-500'
                        }`}
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No balance data</p>
              )}

              {/* Contact info */}
              {(location.contactPerson || location.contactEmail) && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                  {location.contactPerson && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <User className="w-3 h-3 flex-shrink-0" />
                      <span>{location.contactPerson}</span>
                    </div>
                  )}
                  {location.contactEmail && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{location.contactEmail}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Country / region */}
              <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span>
                  {location.country}
                  {location.region ? ` - ${location.region}` : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ADD LOCATION FORM (internal)
// ─────────────────────────────────────────────────────────────────

interface AddLocationFormProps {
  onAdd: (data: {
    name: string;
    type: FundLocationType;
    currency: string;
    country: string;
    region?: string;
    isTreasury: boolean;
    contactPerson?: string;
    contactEmail?: string;
  }) => void;
  onCancel: () => void;
  existingLocations: FundLocation[];
}

function AddLocationForm({ onAdd, onCancel, existingLocations }: AddLocationFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<FundLocationType>('field_office');
  const [currency, setCurrency] = useState('UGX');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [isTreasury, setIsTreasury] = useState(false);
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const hasTreasury = existingLocations.some(l => l.isTreasury);

  const handleSubmit = () => {
    setError(null);

    if (!name.trim()) {
      setError('Location name is required.');
      return;
    }
    if (!country.trim()) {
      setError('Country is required.');
      return;
    }
    if (!currency.trim()) {
      setError('Currency is required.');
      return;
    }
    if (isTreasury && hasTreasury) {
      setError('A treasury location already exists. Only one treasury is allowed per program.');
      return;
    }

    onAdd({
      name: name.trim(),
      type,
      currency: currency.trim().toUpperCase(),
      country: country.trim(),
      region: region.trim() || undefined,
      isTreasury,
      contactPerson: contactPerson.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
    });
  };

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Add Fund Location</h4>

      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Name */}
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Kampala Field Office"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
          <select
            value={type}
            onChange={e => setType(e.target.value as FundLocationType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="international_hq">International HQ</option>
            <option value="regional_office">Regional Office</option>
            <option value="field_office">Field Office</option>
          </select>
        </div>

        {/* Currency */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Currency</label>
          <input
            type="text"
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            maxLength={3}
            placeholder="UGX"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Country */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Country</label>
          <input
            type="text"
            value={country}
            onChange={e => setCountry(e.target.value)}
            placeholder="e.g. Uganda"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Region */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Region (optional)</label>
          <input
            type="text"
            value={region}
            onChange={e => setRegion(e.target.value)}
            placeholder="e.g. Central"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Contact Person */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Contact (optional)</label>
          <input
            type="text"
            value={contactPerson}
            onChange={e => setContactPerson(e.target.value)}
            placeholder="Contact name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Contact Email */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Email (optional)</label>
          <input
            type="email"
            value={contactEmail}
            onChange={e => setContactEmail(e.target.value)}
            placeholder="email@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Treasury toggle */}
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isTreasury}
              onChange={e => setIsTreasury(e.target.checked)}
              disabled={hasTreasury}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Treasury</span>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 mt-4">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Location
        </button>
      </div>
    </div>
  );
}

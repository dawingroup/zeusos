import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { StatusChip } from '../components/shared/StatusChip';
import { formatCurrency } from '../components/shared/CurrencyDisplay';
import {
  FACILITY_STATUS_LABELS,
  FACILITY_STATUS_COLORS,
  PRODUCT_TYPE_LABELS,
  INTEREST_TYPE_LABELS,
  REPAYMENT_FREQUENCY_LABELS,
} from '../constants/capital.constants';
import { facilityService } from '../services/facilityService';
import type { CapitalFacility } from '../types/capital.types';

const COMPANY_ID = 'default';

export default function FacilityDetailPage() {
  const { facilityId } = useParams<{ facilityId: string }>();
  const navigate = useNavigate();
  const [facility, setFacility] = useState<CapitalFacility | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!facilityId) return;
    setLoading(true);
    facilityService
      .getFacility(COMPANY_ID, facilityId)
      .then(setFacility)
      .finally(() => setLoading(false));
  }, [facilityId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Facility not found</p>
        <Button onClick={() => navigate('/capital/facilities')} variant="outline">
          Back to Facilities
        </Button>
      </div>
    );
  }

  const utilizationPercent = Math.round(
    (facility.outstandingBalance / facility.facilityLimit) * 100,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/capital/facilities')}>
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{facility.facilityName}</h1>
          <p className="text-muted-foreground">
            {facility.provider} — {PRODUCT_TYPE_LABELS[facility.productType]}
          </p>
        </div>
        <StatusChip
          label={FACILITY_STATUS_LABELS[facility.status]}
          color={FACILITY_STATUS_COLORS[facility.status]}
        />
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Facility Limit</div>
            <div className="text-lg font-bold">
              {formatCurrency(facility.facilityLimit, facility.currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Outstanding</div>
            <div className="text-lg font-bold text-amber-600">
              {formatCurrency(facility.outstandingBalance, facility.currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Total Repaid</div>
            <div className="text-lg font-bold text-green-600">
              {formatCurrency(facility.amountRepaid, facility.currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Utilization</div>
            <div className="text-lg font-bold">{utilizationPercent}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Utilization bar */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Facility Utilization</span>
            <span className="font-medium">{utilizationPercent}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                utilizationPercent > 90 ? 'bg-red-500' : utilizationPercent > 70 ? 'bg-amber-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, utilizationPercent)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Terms */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Facility Terms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Interest Rate</span>
                <span className="font-medium">{facility.terms.interestRate}% p.a.</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Interest Type</span>
                <span className="font-medium">
                  {INTEREST_TYPE_LABELS[facility.terms.interestType]}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Tenor</span>
                <span className="font-medium">{facility.terms.tenorMonths} months</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Repayment</span>
                <span className="font-medium">
                  {REPAYMENT_FREQUENCY_LABELS[facility.terms.repaymentFrequency]}
                </span>
              </div>
              {facility.terms.gracePeriodMonths !== undefined && facility.terms.gracePeriodMonths > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground block">Grace Period</span>
                  <span className="font-medium">{facility.terms.gracePeriodMonths} months</span>
                </div>
              )}
              {facility.accountReference && (
                <div>
                  <span className="text-xs text-muted-foreground block">Account Ref</span>
                  <span className="font-medium">{facility.accountReference}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Covenants */}
        {facility.covenants && facility.covenants.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Covenants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {facility.covenants.map((cov, i) => (
                  <div key={i} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="font-medium text-sm">{cov.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {cov.metric} {cov.operator === 'gte' ? '≥' : cov.operator === 'lte' ? '≤' : '='}{' '}
                        {cov.threshold}
                      </div>
                    </div>
                    {cov.isCompliant !== undefined && (
                      <StatusChip
                        label={cov.isCompliant ? 'Compliant' : 'Breach'}
                        color={cov.isCompliant ? '#4CAF50' : '#F44336'}
                      />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Repayment schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Repayment Schedule ({facility.repaymentSchedule.length} payments)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {facility.repaymentSchedule.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No repayment schedule generated
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4">#</th>
                    <th className="text-right py-2 pr-4">Principal</th>
                    <th className="text-right py-2 pr-4">Interest</th>
                    <th className="text-right py-2 pr-4">Total</th>
                    <th className="text-center py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {facility.repaymentSchedule.map((entry, i) => (
                    <tr key={entry.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{i + 1}</td>
                      <td className="text-right py-2 pr-4">
                        {formatCurrency(entry.principalDue, facility.currency)}
                      </td>
                      <td className="text-right py-2 pr-4">
                        {formatCurrency(entry.interestDue, facility.currency)}
                      </td>
                      <td className="text-right py-2 pr-4 font-medium">
                        {formatCurrency(entry.totalDue, facility.currency)}
                      </td>
                      <td className="text-center py-2">
                        <StatusChip
                          label={entry.status}
                          color={
                            entry.status === 'paid'
                              ? '#4CAF50'
                              : entry.status === 'overdue'
                                ? '#F44336'
                                : '#FF9800'
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

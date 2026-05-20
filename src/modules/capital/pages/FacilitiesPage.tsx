import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { useFacilities } from '../hooks/useFacilities';
import { StatusChip } from '../components/shared/StatusChip';
import { formatCurrency } from '../components/shared/CurrencyDisplay';
import {
  FACILITY_STATUS_LABELS,
  FACILITY_STATUS_COLORS,
  PRODUCT_TYPE_LABELS,
  INTEREST_TYPE_LABELS,
} from '../constants/capital.constants';
import { useNavigate } from 'react-router-dom';
import { KPICard, KPIGrid } from '@/shared/components/data-display';

const COMPANY_ID = 'default';

export default function FacilitiesPage() {
  const { facilities, summary, loading } = useFacilities(COMPANY_ID);
  const navigate = useNavigate();

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1>Capital Facilities</h1>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
            Manage active loans, credit lines, and other capital facilities
          </p>
        </div>
        <Button variant="primary" size="sm">Add Facility</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div
            className="animate-spin rounded-full h-7 w-7 border-2 border-t-transparent"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : (
        <>
          {/* Summary KPIs */}
          {summary && (
            <KPIGrid>
              <KPICard
                label="Active Facilities"
                value={summary.activeFacilities}
                sparkColor="var(--rag-blue)"
              />
              <KPICard
                label="Total Facility Limit"
                value={formatCurrency(summary.totalFacilityLimit, 'UGX', true)}
                sparkColor="var(--accent)"
              />
              <KPICard
                label="Outstanding Balance"
                value={formatCurrency(summary.totalOutstanding, 'UGX', true)}
                trend="down"
                sparkColor="var(--rag-amber)"
              />
              <KPICard
                label="Available (Revolving)"
                value={formatCurrency(summary.totalAvailable, 'UGX', true)}
                trend="up"
                sparkColor="var(--rag-green)"
              />
            </KPIGrid>
          )}

          {/* Facilities list */}
          {facilities.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">No facilities recorded yet</p>
                <Button variant="outline">Add Your First Facility</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {facilities.map(facility => (
                <Card
                  key={facility.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/capital/facilities/${facility.id}`)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{facility.facilityName}</span>
                          <StatusChip
                            label={FACILITY_STATUS_LABELS[facility.status]}
                            color={FACILITY_STATUS_COLORS[facility.status]}
                          />
                        </div>
                        <div className="text-sm text-muted-foreground">{facility.provider}</div>
                        <div className="flex gap-2 flex-wrap">
                          <StatusChip
                            label={PRODUCT_TYPE_LABELS[facility.productType]}
                            variant="outline"
                          />
                          <span className="text-xs text-muted-foreground">
                            {facility.terms.interestRate}% {INTEREST_TYPE_LABELS[facility.terms.interestType]}
                          </span>
                          {facility.isRevolving && (
                            <StatusChip label="Revolving" variant="outline" />
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">
                          {formatCurrency(facility.outstandingBalance, facility.currency, true)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          of {formatCurrency(facility.facilityLimit, facility.currency, true)}
                        </div>
                        {facility.nextPaymentAmount && (
                          <div className="text-xs text-amber-600 mt-1">
                            Next: {formatCurrency(facility.nextPaymentAmount, facility.currency, true)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Utilization bar */}
                    <div className="mt-3">
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-amber-500 h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (facility.outstandingBalance / facility.facilityLimit) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>
                          {Math.round((facility.outstandingBalance / facility.facilityLimit) * 100)}%
                          utilized
                        </span>
                        <span>{facility.terms.tenorMonths} month term</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Upcoming repayments */}
          {summary && summary.upcomingRepayments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upcoming Repayments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {summary.upcomingRepayments.map((r: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-sm">{r.facilityName}</div>
                        <div className="text-xs text-muted-foreground">{r.provider}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {formatCurrency(r.totalDue, 'UGX', true)}
                        </div>
                        <StatusChip
                          label={r.status}
                          color={r.status === 'overdue' ? '#F44336' : '#FF9800'}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

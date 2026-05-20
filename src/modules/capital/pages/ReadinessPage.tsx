import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { useReadiness } from '../hooks/useReadiness';
import { ScoreGauge } from '../components/shared/ScoreGauge';
import { StatusChip } from '../components/shared/StatusChip';
import { formatCurrency } from '../components/shared/CurrencyDisplay';
import {
  CHECKLIST_STATUS_LABELS,
  CHECKLIST_STATUS_COLORS,
} from '../constants/capital.constants';

const COMPANY_ID = 'default';

export default function ReadinessPage() {
  const { assessment, loading, error, generateAssessment, updateChecklistItem } =
    useReadiness(COMPANY_ID);

  if (loading && !assessment) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1>Capital Readiness</h1>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
            Assess and improve your readiness to apply for capital
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={generateAssessment} disabled={loading}>
          {assessment ? 'Refresh Assessment' : 'Run Assessment'}
        </Button>
      </div>

      {error && (
        <div
          className="rounded-[10px] border p-3 text-[12.5px]"
          style={{
            backgroundColor: 'var(--rag-red-soft)',
            borderColor: 'var(--rag-red)',
            color: 'var(--rag-red)',
          }}
        >
          {error}
        </div>
      )}

      {!assessment ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No readiness assessment found. Generate one to evaluate your capital readiness.
            </p>
            <Button onClick={generateAssessment}>Generate Assessment</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Score overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="md:col-span-1">
              <CardContent className="pt-6 flex flex-col items-center">
                <ScoreGauge score={assessment.overallScore} label="Overall Readiness" size="lg" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex flex-col items-center">
                <ScoreGauge
                  score={assessment.financialHealth.score}
                  label="Financial Health"
                  size="md"
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex flex-col items-center">
                <ScoreGauge
                  score={assessment.documentReadiness.score}
                  label="Documents"
                  size="md"
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex flex-col items-center">
                <ScoreGauge
                  score={assessment.complianceStatus.score}
                  label="Compliance"
                  size="md"
                />
              </CardContent>
            </Card>
          </div>

          {/* Financial health metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Financial Health Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground block">Monthly Revenue</span>
                  <span className="text-lg font-bold">
                    {formatCurrency(assessment.financialHealth.metrics.monthlyRevenue, 'UGX', true)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Cash Runway</span>
                  <span className="text-lg font-bold">
                    {assessment.financialHealth.metrics.cashRunwayDays} days
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">DSCR</span>
                  <span className="text-lg font-bold">
                    {assessment.financialHealth.metrics.debtServiceCoverageRatio}x
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Debt-to-Equity</span>
                  <span className="text-lg font-bold">
                    {assessment.financialHealth.metrics.debtToEquityRatio}x
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Daily Burn Rate</span>
                  <span className="text-lg font-bold">
                    {formatCurrency(assessment.financialHealth.metrics.averageDailyBurn, 'UGX', true)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Current Ratio</span>
                  <span className="text-lg font-bold">
                    {assessment.financialHealth.metrics.currentRatio || '—'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Document checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Document Readiness ({assessment.documentReadiness.score}%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {['financial', 'legal', 'compliance', 'business'].map(category => {
                  const items = assessment.documentReadiness.items.filter(
                    i => i.category === category,
                  );
                  if (items.length === 0) return null;
                  return (
                    <div key={category}>
                      <h4 className="text-sm font-medium capitalize mb-2">{category}</h4>
                      <div className="space-y-1">
                        {items.map(item => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                          >
                            <span className="text-sm">{item.label}</span>
                            <button
                              onClick={() => {
                                const nextStatus =
                                  item.status === 'missing'
                                    ? 'partial'
                                    : item.status === 'partial'
                                      ? 'complete'
                                      : 'missing';
                                updateChecklistItem('documentReadiness', item.id, {
                                  status: nextStatus,
                                });
                              }}
                              className="cursor-pointer"
                            >
                              <StatusChip
                                label={CHECKLIST_STATUS_LABELS[item.status]}
                                color={CHECKLIST_STATUS_COLORS[item.status]}
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Compliance checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Compliance Status ({assessment.complianceStatus.score}%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {assessment.complianceStatus.items.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                  >
                    <span className="text-sm">{item.label}</span>
                    <button
                      onClick={() => {
                        const nextStatus =
                          item.status === 'missing'
                            ? 'partial'
                            : item.status === 'partial'
                              ? 'complete'
                              : 'missing';
                        updateChecklistItem('complianceStatus', item.id, {
                          status: nextStatus,
                        });
                      }}
                      className="cursor-pointer"
                    >
                      <StatusChip
                        label={CHECKLIST_STATUS_LABELS[item.status]}
                        color={CHECKLIST_STATUS_COLORS[item.status]}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

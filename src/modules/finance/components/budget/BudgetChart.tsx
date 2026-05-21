// ============================================================================
// BUDGET CHART COMPONENT
// ZeusOS v2.0 - Financial Management Module
// Component for budget visualization using Recharts
// ============================================================================

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Grid as MuiGrid,
  Typography,
  useTheme,
} from '@mui/material';
const Grid = MuiGrid as any;
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { SafeResponsiveContainer } from '@/core/components/ui/SafeResponsiveContainer';
import { BudgetVariance, BudgetForecast, MonthlyProjection } from '../../types/budget.types';
import { FISCAL_MONTHS } from '../../constants/budget.constants';
import { ACCOUNT_TYPE_LABELS } from '../../constants/account.constants';
import { abbreviateNumber } from '../../utils/formatters';
import { CurrencyCode } from '../../constants/currency.constants';

interface BudgetChartProps {
  variance?: BudgetVariance;
  forecast?: BudgetForecast;
  currency: CurrencyCode;
}

const COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0', '#00BCD4'];

export const BudgetChart: React.FC<BudgetChartProps> = ({
  variance,
  forecast,
  currency,
}) => {
  const theme = useTheme();

  // Prepare variance by account type data
  const accountTypeData = variance
    ? Object.entries(variance.byAccountType).map(([type, data]) => ({
        name: ACCOUNT_TYPE_LABELS[type as keyof typeof ACCOUNT_TYPE_LABELS] || type,
        budget: data.budget,
        actual: data.actual,
        variance: data.variance,
      }))
    : [];

  // Prepare monthly trend data
  const monthlyTrendData = forecast?.monthlyProjections.map((proj: MonthlyProjection) => {
    const monthInfo = FISCAL_MONTHS[proj.period - 1];
    return {
      name: monthInfo?.name.slice(0, 3) || `M${proj.period}`,
      budget: proj.budgetAmount,
      actual: proj.isActual ? proj.actualAmount : null,
      forecast: proj.isActual ? null : proj.forecastAmount,
      cumulativeBudget: proj.cumulativeBudget,
      cumulativeForecast: proj.cumulativeForecast,
    };
  }) || [];

  // Prepare variance distribution data for pie chart
  const varianceDistribution = variance
    ? [
        { name: 'Favorable', value: variance.lineVariances.filter(l => l.varianceStatus === 'favorable').length },
        { name: 'Minor', value: variance.lineVariances.filter(l => l.varianceStatus === 'minor').length },
        { name: 'Moderate', value: variance.lineVariances.filter(l => l.varianceStatus === 'moderate').length },
        { name: 'Significant', value: variance.lineVariances.filter(l => l.varianceStatus === 'significant').length },
        { name: 'Critical', value: variance.lineVariances.filter(l => l.varianceStatus === 'critical').length },
      ].filter(d => d.value > 0)
    : [];

  const varianceColors: Record<string, string> = {
    Favorable: '#4CAF50',
    Minor: '#8BC34A',
    Moderate: '#FF9800',
    Significant: '#FF5722',
    Critical: '#F44336',
  };

  const formatYAxis = (value: number) => abbreviateNumber(value, 0);

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            backgroundColor: 'background.paper',
            p: 1.5,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
          }}
        >
          <Typography variant="subtitle2">{label}</Typography>
          {payload.map((entry, index) => (
            <Typography key={index} variant="body2" sx={{ color: entry.color }}>
              {entry.name}: {currency} {abbreviateNumber(entry.value, 1)}
            </Typography>
          ))}
        </Box>
      );
    }
    return null;
  };

  return (
    <Grid container spacing={3}>
      {/* Variance by Account Type */}
      {accountTypeData.length > 0 && (
        <Grid item xs={12} lg={6}>
          <Card>
            <CardHeader title="Budget vs Actual by Category" />
            <CardContent>
              <SafeResponsiveContainer width="100%" height={300}>
                <BarChart data={accountTypeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={formatYAxis} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="budget" name="Budget" fill={theme.palette.primary.main} />
                  <Bar dataKey="actual" name="Actual" fill={theme.palette.secondary.main} />
                </BarChart>
              </SafeResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Variance Distribution Pie Chart */}
      {varianceDistribution.length > 0 && (
        <Grid item xs={12} lg={6}>
          <Card>
            <CardHeader title="Variance Status Distribution" />
            <CardContent>
              <SafeResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={varianceDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(({ name, percent }: { name: string; percent: number }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    ) as any}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {varianceDistribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={varianceColors[entry.name] || COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </SafeResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Monthly Trend */}
      {monthlyTrendData.length > 0 && (
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Monthly Budget Trend" />
            <CardContent>
              <SafeResponsiveContainer width="100%" height={350}>
                <LineChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={formatYAxis} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="budget"
                    name="Budget"
                    stroke={theme.palette.primary.main}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Actual"
                    stroke={theme.palette.success.main}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    name="Forecast"
                    stroke={theme.palette.warning.main}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    connectNulls={false}
                  />
                </LineChart>
              </SafeResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Cumulative Trend */}
      {monthlyTrendData.length > 0 && (
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Cumulative Budget vs Forecast" />
            <CardContent>
              <SafeResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={formatYAxis} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="cumulativeBudget"
                    name="Cumulative Budget"
                    stroke={theme.palette.primary.main}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulativeForecast"
                    name="Cumulative Forecast"
                    stroke={theme.palette.warning.main}
                    strokeWidth={2}
                  />
                </LineChart>
              </SafeResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Forecast Summary */}
      {forecast && (
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Forecast Summary" />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="textSecondary">
                    Linear Forecast
                  </Typography>
                  <Typography variant="h6">
                    {currency} {abbreviateNumber(forecast.linearForecast, 1)}
                  </Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="textSecondary">
                    Seasonal Forecast
                  </Typography>
                  <Typography variant="h6">
                    {currency} {abbreviateNumber(forecast.seasonalForecast, 1)}
                  </Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="textSecondary">
                    Recommended Forecast
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {currency} {abbreviateNumber(forecast.recommendedForecast, 1)}
                  </Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="textSecondary">
                    Forecast Confidence
                  </Typography>
                  <Typography variant="h6">
                    {forecast.forecastConfidence}%
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  );
};

export default BudgetChart;

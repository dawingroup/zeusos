/**
 * CampaignPerformanceChart Component
 * Line and area charts for campaign performance over time using Recharts
 */

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { SafeResponsiveContainer } from '@/core/components/ui/SafeResponsiveContainer';
import type { DailyMetric } from '../../types';

interface CampaignPerformanceChartProps {
  dailyMetrics: DailyMetric[];
  chartType?: 'area' | 'bar';
  height?: number;
}

export function CampaignPerformanceChart({
  dailyMetrics,
  chartType = 'area',
  height = 300,
}: CampaignPerformanceChartProps) {
  const data = useMemo(() => {
    return dailyMetrics.map((m) => ({
      date: new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      Sent: m.sent,
      Reach: m.reach,
      Engagements: m.engagements,
    }));
  }, [dailyMetrics]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">
        No data available for the selected period
      </div>
    );
  }

  const Chart = chartType === 'bar' ? BarChartView : AreaChartView;
  return <Chart data={data} height={height} />;
}

function AreaChartView({ data, height }: { data: any[]; height: number }) {
  return (
    <SafeResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#888' }} />
        <YAxis tick={{ fontSize: 11, fill: '#888' }} />
        <Tooltip
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="Sent"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.1}
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="Reach"
          stroke="#10b981"
          fill="#10b981"
          fillOpacity={0.1}
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="Engagements"
          stroke="#8b5cf6"
          fill="#8b5cf6"
          fillOpacity={0.1}
          strokeWidth={2}
        />
      </AreaChart>
    </SafeResponsiveContainer>
  );
}

function BarChartView({ data, height }: { data: any[]; height: number }) {
  return (
    <SafeResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#888' }} />
        <YAxis tick={{ fontSize: 11, fill: '#888' }} />
        <Tooltip
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Sent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Reach" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Engagements" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </SafeResponsiveContainer>
  );
}

// ============================================
// Campaign Type Breakdown Chart
// ============================================

interface TypeBreakdownChartProps {
  data: { type: string; count: number; sent: number; reach: number }[];
  height?: number;
}

export function TypeBreakdownChart({ data, height = 250 }: TypeBreakdownChartProps) {
  const LABELS: Record<string, string> = {
    whatsapp: 'WhatsApp',
    social_media: 'Social',
    product_promotion: 'Promo',
    hybrid: 'Hybrid',
  };

  const chartData = data.map((d) => ({
    name: LABELS[d.type] || d.type,
    Campaigns: d.count,
    Sent: d.sent,
    Reach: d.reach,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">
        No campaign data
      </div>
    );
  }

  return (
    <SafeResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#666' }} />
        <YAxis tick={{ fontSize: 11, fill: '#888' }} />
        <Tooltip
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Campaigns" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Sent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Reach" fill="#10b981" radius={[4, 4, 0, 0]} />
      </BarChart>
    </SafeResponsiveContainer>
  );
}

// ============================================
// WhatsApp Funnel Chart
// ============================================

interface WhatsAppFunnelProps {
  sent: number;
  delivered: number;
  read: number;
  replied: number;
}

export function WhatsAppFunnelChart({ sent, delivered, read, replied }: WhatsAppFunnelProps) {
  const stages = [
    { label: 'Sent', value: sent, color: '#3b82f6', pct: 100 },
    { label: 'Delivered', value: delivered, color: '#10b981', pct: sent > 0 ? (delivered / sent) * 100 : 0 },
    { label: 'Read', value: read, color: '#8b5cf6', pct: sent > 0 ? (read / sent) * 100 : 0 },
    { label: 'Replied', value: replied, color: '#f59e0b', pct: sent > 0 ? (replied / sent) * 100 : 0 },
  ];

  return (
    <div className="space-y-3">
      {stages.map((stage) => (
        <div key={stage.label}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-medium text-gray-700">{stage.label}</span>
            <span className="text-gray-500">
              {stage.value.toLocaleString()} ({stage.pct.toFixed(1)}%)
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${stage.pct}%`, backgroundColor: stage.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default CampaignPerformanceChart;

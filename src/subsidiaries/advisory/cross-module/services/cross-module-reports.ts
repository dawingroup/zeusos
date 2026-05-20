import {
  collection,
  getDocs,
  doc,
  setDoc,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import {
  CrossModuleReport,
  CrossModuleReportConfig,
  CrossModuleReportType,
  ReportMetric,
  ReportChart,
  ModuleType
} from '../types/cross-module';
import { entityLinkerService } from './entity-linker';

const REPORTS_COLLECTION = 'crossModuleReports';

const REPORT_TEMPLATES: Record<CrossModuleReportType, CrossModuleReportConfig> = {
  portfolio_infrastructure: {
    id: 'portfolio_infrastructure',
    type: 'portfolio_infrastructure',
    name: 'Portfolio Infrastructure Performance',
    description: 'Track infrastructure project performance across investment portfolios',
    modules: ['infrastructure', 'investment'],
    metrics: [
      { id: 'total_investment', name: 'Total Investment', field: 'totalValue', aggregation: 'sum', format: 'currency' },
      { id: 'project_count', name: 'Project Count', field: 'id', aggregation: 'count' },
      { id: 'avg_completion', name: 'Avg Completion', field: 'completionPercentage', aggregation: 'avg', format: 'percentage' }
    ],
    dimensions: [
      { id: 'portfolio', name: 'Portfolio', field: 'portfolioName', groupBy: true },
      { id: 'status', name: 'Project Status', field: 'status', groupBy: true }
    ]
  },
  deal_project_pipeline: {
    id: 'deal_project_pipeline',
    type: 'deal_project_pipeline',
    name: 'Deal to Project Pipeline',
    description: 'Track deals progressing to infrastructure projects',
    modules: ['investment', 'infrastructure'],
    metrics: [
      { id: 'deal_value', name: 'Deal Value', field: 'dealValue', aggregation: 'sum', format: 'currency' },
      { id: 'conversion_rate', name: 'Conversion Rate', field: 'converted', aggregation: 'avg', format: 'percentage' },
      { id: 'pipeline_count', name: 'Pipeline Count', field: 'id', aggregation: 'count' }
    ],
    dimensions: [
      { id: 'stage', name: 'Deal Stage', field: 'stage', groupBy: true },
      { id: 'sector', name: 'Sector', field: 'sector', groupBy: true }
    ]
  },
  procurement_analysis: {
    id: 'procurement_analysis',
    type: 'procurement_analysis',
    name: 'Procurement Analysis',
    description: 'Analyze procurement across projects and suppliers',
    modules: ['matflow', 'infrastructure'],
    metrics: [
      { id: 'total_spend', name: 'Total Spend', field: 'totalAmount', aggregation: 'sum', format: 'currency' },
      { id: 'order_count', name: 'Order Count', field: 'id', aggregation: 'count' },
      { id: 'avg_order_value', name: 'Avg Order Value', field: 'totalAmount', aggregation: 'avg', format: 'currency' }
    ],
    dimensions: [
      { id: 'supplier', name: 'Supplier', field: 'supplierName', groupBy: true },
      { id: 'project', name: 'Project', field: 'projectName', groupBy: true }
    ]
  },
  engagement_overview: {
    id: 'engagement_overview',
    type: 'engagement_overview',
    name: 'Engagement Overview',
    description: 'Overview of all engagements across modules',
    modules: ['infrastructure', 'investment', 'advisory'],
    metrics: [
      { id: 'engagement_count', name: 'Total Engagements', field: 'id', aggregation: 'count' },
      { id: 'total_value', name: 'Total Value', field: 'value', aggregation: 'sum', format: 'currency' },
      { id: 'active_count', name: 'Active Count', field: 'isActive', aggregation: 'count' }
    ],
    dimensions: [
      { id: 'type', name: 'Engagement Type', field: 'type', groupBy: true },
      { id: 'status', name: 'Status', field: 'status', groupBy: true }
    ]
  },
  financial_consolidated: {
    id: 'financial_consolidated',
    type: 'financial_consolidated',
    name: 'Consolidated Financial Report',
    description: 'Consolidated financial view across all modules',
    modules: ['infrastructure', 'investment', 'advisory', 'matflow'],
    metrics: [
      { id: 'total_revenue', name: 'Total Revenue', field: 'revenue', aggregation: 'sum', format: 'currency' },
      { id: 'total_costs', name: 'Total Costs', field: 'costs', aggregation: 'sum', format: 'currency' },
      { id: 'net_value', name: 'Net Value', field: 'netValue', aggregation: 'sum', format: 'currency' }
    ],
    dimensions: [
      { id: 'module', name: 'Module', field: 'module', groupBy: true },
      { id: 'quarter', name: 'Quarter', field: 'quarter', groupBy: true }
    ]
  },
  supplier_performance: {
    id: 'supplier_performance',
    type: 'supplier_performance',
    name: 'Supplier Performance',
    description: 'Track supplier performance across projects',
    modules: ['matflow', 'infrastructure'],
    metrics: [
      { id: 'delivery_rate', name: 'On-Time Delivery Rate', field: 'onTimeDelivery', aggregation: 'avg', format: 'percentage' },
      { id: 'quality_score', name: 'Quality Score', field: 'qualityScore', aggregation: 'avg', format: 'number' },
      { id: 'total_orders', name: 'Total Orders', field: 'id', aggregation: 'count' }
    ],
    dimensions: [
      { id: 'supplier', name: 'Supplier', field: 'supplierName', groupBy: true },
      { id: 'category', name: 'Category', field: 'category', groupBy: true }
    ]
  }
};

export class CrossModuleReportsService {
  getReportTemplate(type: CrossModuleReportType): CrossModuleReportConfig {
    return REPORT_TEMPLATES[type];
  }

  getAllReportTemplates(): CrossModuleReportConfig[] {
    return Object.values(REPORT_TEMPLATES);
  }

  async generateReport(
    type: CrossModuleReportType,
    filters: Record<string, unknown> = {},
    userId: string
  ): Promise<CrossModuleReport> {
    const config = this.getReportTemplate(type);
    if (!config) {
      throw new Error(`Unknown report type: ${type}`);
    }

    const moduleData: Record<string, Record<string, unknown>[]> = {};
    for (const module of config.modules) {
      moduleData[module] = await this.fetchModuleData(module, filters);
    }

    const correlatedData = await this.correlateModuleData(moduleData, config);

    const summary: Record<string, number> = {};
    for (const metric of config.metrics) {
      summary[metric.id] = this.calculateMetric(correlatedData, metric);
    }

    const groupedData = this.groupByDimensions(correlatedData, config.dimensions);
    const charts = this.generateCharts(groupedData, config);

    const reportId = doc(collection(db, REPORTS_COLLECTION)).id;
    const report: CrossModuleReport = {
      id: reportId,
      config,
      data: correlatedData,
      summary,
      charts,
      generatedAt: Timestamp.now(),
      generatedBy: userId
    };

    await setDoc(doc(db, REPORTS_COLLECTION, reportId), report);

    return report;
  }

  private async fetchModuleData(
    module: ModuleType,
    filters: Record<string, unknown>
  ): Promise<Record<string, unknown>[]> {
    const collections: Record<ModuleType, string[]> = {
      infrastructure: ['projects', 'engagements', 'ipcs'],
      investment: ['deals', 'portfolios', 'investments'],
      advisory: ['mandates', 'proposals'],
      matflow: ['requisitions', 'purchaseOrders', 'suppliers']
    };

    const data: Record<string, unknown>[] = [];

    for (const collectionName of collections[module]) {
      let q = query(collection(db, collectionName));
      
      if (filters.status) {
        q = query(q, where('status', '==', filters.status));
      }
      if (filters.startDate) {
        q = query(q, where('createdAt', '>=', Timestamp.fromDate(new Date(filters.startDate as string))));
      }
      if (filters.endDate) {
        q = query(q, where('createdAt', '<=', Timestamp.fromDate(new Date(filters.endDate as string))));
      }

      const snapshot = await getDocs(q);
      snapshot.forEach(docSnap => {
        data.push({
          id: docSnap.id,
          module,
          collection: collectionName,
          ...docSnap.data()
        });
      });
    }

    return data;
  }

  private async correlateModuleData(
    moduleData: Record<string, Record<string, unknown>[]>,
    config: CrossModuleReportConfig
  ): Promise<Record<string, unknown>[]> {
    const correlatedData: Record<string, unknown>[] = [];

    const baseModule = config.modules.includes('infrastructure') 
      ? 'infrastructure' 
      : config.modules[0];
    const baseData = moduleData[baseModule] || [];

    for (const item of baseData) {
      const correlatedItem: Record<string, unknown> = { ...item };

      const entityType = this.getEntityTypeFromCollection(item.collection as string);
      const links = await entityLinkerService.getEntityLinks(
        item.id as string,
        entityType,
        'both'
      );

      for (const link of links) {
        const linkedModule = link.targetEntity.module;
        if (linkedModule !== baseModule && config.modules.includes(linkedModule)) {
          const linkedData = moduleData[linkedModule]?.find(
            d => d.id === link.targetEntity.id
          );
          if (linkedData) {
            correlatedItem[`${linkedModule}Data`] = linkedData;
          }
        }
      }

      correlatedData.push(correlatedItem);
    }

    return correlatedData;
  }

  private calculateMetric(data: Record<string, unknown>[], metric: ReportMetric): number {
    const values = data
      .map(d => parseFloat(d[metric.field] as string) || 0)
      .filter(v => !isNaN(v));

    if (values.length === 0) return 0;

    switch (metric.aggregation) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'count':
        return data.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      default:
        return 0;
    }
  }

  private groupByDimensions(
    data: Record<string, unknown>[],
    dimensions: { id: string; field: string; groupBy: boolean }[]
  ): Record<string, Record<string, unknown>[]> {
    const grouped: Record<string, any> = {};

    for (const dimension of dimensions.filter(d => d.groupBy)) {
      grouped[dimension.id] = {};

      for (const item of data) {
        const key = (item[dimension.field] as string) || 'Unknown';
        if (!grouped[dimension.id][key]) {
          grouped[dimension.id][key] = [];
        }
        grouped[dimension.id][key].push(item);
      }
    }

    return grouped;
  }

  private generateCharts(
    groupedData: Record<string, Record<string, unknown>[]>,
    config: CrossModuleReportConfig
  ): ReportChart[] {
    const charts: ReportChart[] = [];

    const firstDimension = config.dimensions.find(d => d.groupBy);
    if (firstDimension && groupedData[firstDimension.id]) {
      const chartData = Object.entries(groupedData[firstDimension.id]).map(
        ([key, items]) => ({
          name: key,
          value: (items as unknown as unknown[]).length
        })
      );

      charts.push({
        id: `${firstDimension.id}_bar`,
        type: 'bar',
        title: `By ${firstDimension.name}`,
        data: chartData
      });
    }

    const statusDimension = config.dimensions.find(d => d.field === 'status');
    if (statusDimension && groupedData[statusDimension.id]) {
      const pieData = Object.entries(groupedData[statusDimension.id]).map(
        ([key, items]) => ({
          name: key,
          value: (items as unknown as unknown[]).length
        })
      );

      charts.push({
        id: 'status_pie',
        type: 'pie',
        title: 'Status Distribution',
        data: pieData
      });
    }

    return charts;
  }

  private getEntityTypeFromCollection(collectionName: string): 
    'project' | 'engagement' | 'ipc' | 'deal' | 'portfolio' | 'investment' | 'mandate' | 'proposal' | 'requisition' | 'purchase_order' | 'supplier' {
    const mapping: Record<string, 'project' | 'engagement' | 'ipc' | 'deal' | 'portfolio' | 'investment' | 'mandate' | 'proposal' | 'requisition' | 'purchase_order' | 'supplier'> = {
      projects: 'project',
      engagements: 'engagement',
      ipcs: 'ipc',
      deals: 'deal',
      portfolios: 'portfolio',
      investments: 'investment',
      mandates: 'mandate',
      proposals: 'proposal',
      requisitions: 'requisition',
      purchaseOrders: 'purchase_order',
      suppliers: 'supplier'
    };
    return mapping[collectionName] || 'project';
  }
}

export const crossModuleReportsService = new CrossModuleReportsService();

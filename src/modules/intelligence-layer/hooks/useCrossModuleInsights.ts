// ============================================================================
// USE CROSS MODULE INSIGHTS HOOK
// DawinOS v2.0 - Intelligence Layer
// Generate insights by correlating data across modules
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import type { CrossModuleInsight } from '../types';

const INSIGHTS_COLLECTION = 'intelligenceInsights';

interface UseCrossModuleInsightsReturn {
  insights: CrossModuleInsight[];
  loading: boolean;
  error: string | null;
  updateInsightStatus: (
    insightId: string,
    status: 'new' | 'reviewed' | 'actioned' | 'dismissed'
  ) => Promise<void>;
}

export const useCrossModuleInsights = (): UseCrossModuleInsightsReturn => {
  const [insights, setInsights] = useState<CrossModuleInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const q = query(
      collection(db, INSIGHTS_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          generateCrossModuleInsights().then((generated) => {
            setInsights(generated);
            setLoading(false);
          });
          return;
        }

        const data = snapshot.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            title: raw.title || '',
            description: raw.description || '',
            sourceModules: raw.sourceModules || [],
            insightType: raw.insightType || 'correlation',
            severity: raw.severity || 'medium',
            confidence: raw.confidence || 0.5,
            dataPoints: raw.dataPoints || [],
            recommendations: raw.recommendations || [],
            status: raw.status || 'new',
            createdAt: raw.createdAt?.toDate() || new Date(),
          } as CrossModuleInsight;
        });

        setInsights(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching insights:', err);
        generateCrossModuleInsights().then((generated) => {
          setInsights(generated);
          setError(null);
          setLoading(false);
        });
      }
    );

    return () => unsubscribe();
  }, []);

  const updateInsightStatus = useCallback(
    async (insightId: string, status: 'new' | 'reviewed' | 'actioned' | 'dismissed') => {
      try {
        await updateDoc(doc(db, INSIGHTS_COLLECTION, insightId), { status });
      } catch {
        setInsights((prev) =>
          prev.map((i) => (i.id === insightId ? { ...i, status } : i))
        );
      }
    },
    []
  );

  return { insights, loading, error, updateInsightStatus };
};

// ============================================================================
// Generate cross-module insights from events and tasks
// ============================================================================

async function generateCrossModuleInsights(): Promise<CrossModuleInsight[]> {
  try {
    const eventsQuery = query(
      collection(db, 'businessEvents'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const tasksQuery = query(
      collection(db, 'generatedTasks'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const [eventsSnap, tasksSnap] = await Promise.all([
      new Promise<any>((resolve) => {
        const unsub = onSnapshot(eventsQuery, (s) => { unsub(); resolve(s); }, () => { unsub(); resolve({ docs: [] }); });
      }),
      new Promise<any>((resolve) => {
        const unsub = onSnapshot(tasksQuery, (s) => { unsub(); resolve(s); }, () => { unsub(); resolve({ docs: [] }); });
      }),
    ]);

    const events = eventsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const tasks = tasksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const insights: CrossModuleInsight[] = [];
    const now = new Date();

    if (events.length === 0 && tasks.length === 0) return insights;

    // Cross-module event correlation
    const moduleEvents: Record<string, number> = {};
    const moduleTaskCounts: Record<string, number> = {};

    events.forEach((e: any) => {
      moduleEvents[e.sourceModule] = (moduleEvents[e.sourceModule] || 0) + 1;
    });

    tasks.forEach((t: any) => {
      moduleTaskCounts[t.sourceModule] = (moduleTaskCounts[t.sourceModule] || 0) + 1;
    });

    const activeModules = Object.keys(moduleEvents);

    // Insight: Design-to-Inventory correlation
    if (moduleEvents['design_manager'] && moduleEvents['inventory']) {
      const designEvents = moduleEvents['design_manager'];
      const inventoryEvents = moduleEvents['inventory'];

      insights.push({
        id: `insight-design-inv-${Date.now()}`,
        title: 'Design Activity Driving Inventory Demand',
        description: `Design Manager has generated ${designEvents} events correlating with ${inventoryEvents} inventory events. Increased design activity is creating proportional inventory demand.`,
        sourceModules: ['design_manager', 'inventory'],
        insightType: 'correlation',
        severity: inventoryEvents > designEvents ? 'high' : 'medium',
        confidence: 0.82,
        dataPoints: [
          { module: 'design_manager', metric: 'Recent Events', value: designEvents, trend: 'up', period: 'Recent' },
          { module: 'inventory', metric: 'Recent Events', value: inventoryEvents, trend: inventoryEvents > 5 ? 'up' : 'stable', period: 'Recent' },
        ],
        recommendations: [
          'Pre-order materials for upcoming design projects',
          'Review inventory reorder points to match design pipeline',
          'Consider bulk purchasing for frequently used materials',
        ],
        status: 'new',
        createdAt: now,
      });
    }

    // Insight: Cross-module task distribution imbalance
    if (activeModules.length >= 2) {
      const taskValues = Object.values(moduleTaskCounts);
      const maxTasks = Math.max(...taskValues, 0);
      const minTasks = Math.min(...taskValues, 0);

      if (maxTasks > 0 && maxTasks > minTasks * 3) {
        const heaviestModule = Object.entries(moduleTaskCounts).sort(([, a], [, b]) => b - a)[0];
        const lightestModule = Object.entries(moduleTaskCounts).sort(([, a], [, b]) => a - b)[0];

        insights.push({
          id: `insight-imbalance-${Date.now()}`,
          title: 'Task Distribution Imbalance Across Modules',
          description: `${heaviestModule[0].replace('_', ' ')} has ${heaviestModule[1]} tasks while ${lightestModule[0].replace('_', ' ')} has only ${lightestModule[1]}. Consider rebalancing team focus.`,
          sourceModules: [heaviestModule[0] as any, lightestModule[0] as any],
          insightType: 'optimization',
          severity: 'medium',
          confidence: 0.75,
          dataPoints: [
            { module: heaviestModule[0] as any, metric: 'Task Count', value: heaviestModule[1], trend: 'up', period: 'Recent' },
            { module: lightestModule[0] as any, metric: 'Task Count', value: lightestModule[1], trend: 'stable', period: 'Recent' },
          ],
          recommendations: [
            `Review resource allocation for ${heaviestModule[0].replace('_', ' ')}`,
            'Consider cross-training team members',
            'Evaluate if task generation rules need adjustment',
          ],
          status: 'new',
          createdAt: now,
        });
      }
    }

    // Insight: High severity event pattern
    const highSeverityByModule: Record<string, number> = {};
    events.forEach((e: any) => {
      if (e.severity === 'high' || e.severity === 'critical') {
        highSeverityByModule[e.sourceModule] = (highSeverityByModule[e.sourceModule] || 0) + 1;
      }
    });

    const riskyModules = Object.entries(highSeverityByModule).filter(([, count]) => count >= 2);
    if (riskyModules.length >= 2) {
      insights.push({
        id: `insight-multi-risk-${Date.now()}`,
        title: 'Multiple Modules Showing Risk Indicators',
        description: `High severity events detected across ${riskyModules.length} modules simultaneously. This may indicate a systemic issue requiring coordinated attention.`,
        sourceModules: riskyModules.map(([m]) => m as any),
        insightType: 'risk',
        severity: 'high',
        confidence: 0.85,
        dataPoints: riskyModules.map(([mod, count]) => ({
          module: mod as any,
          metric: 'High Severity Events',
          value: count,
          trend: 'up' as const,
          period: 'Recent',
        })),
        recommendations: [
          'Conduct cross-module risk review',
          'Escalate to leadership team',
          'Identify root causes across modules',
          'Consider temporary process adjustments',
        ],
        status: 'new',
        createdAt: now,
      });
    }

    // Insight: Task completion velocity opportunity
    const completedTasks = tasks.filter((t: any) => t.status === 'completed');
    const avgChecklistProgress = tasks.reduce((sum: number, t: any) => sum + (t.checklistProgress || 0), 0) / Math.max(tasks.length, 1);

    if (completedTasks.length > 5 && avgChecklistProgress < 60) {
      insights.push({
        id: `insight-velocity-${Date.now()}`,
        title: 'Task Completion Velocity Optimization',
        description: `Average checklist progress is ${Math.round(avgChecklistProgress)}% across ${tasks.length} tasks. There may be opportunities to streamline task checklists or provide better resources.`,
        sourceModules: activeModules.slice(0, 3) as any[],
        insightType: 'optimization',
        severity: 'medium',
        confidence: 0.73,
        dataPoints: [
          { module: 'design_manager' as any, metric: 'Avg Checklist Progress', value: Math.round(avgChecklistProgress), trend: 'stable', period: 'Overall' },
          { module: 'design_manager' as any, metric: 'Completed Tasks', value: completedTasks.length, trend: 'up', period: 'Overall' },
        ],
        recommendations: [
          'Review checklist items for relevance',
          'Identify commonly skipped checklist items',
          'Provide templates or resources for complex steps',
        ],
        status: 'new',
        createdAt: now,
      });
    }

    return insights;
  } catch (err) {
    console.error('Error generating cross-module insights:', err);
    return [];
  }
}

export default useCrossModuleInsights;

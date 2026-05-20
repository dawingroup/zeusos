/**
 * Program Breakdown Card - Shows per-program stats table
 */

import { Link } from 'react-router-dom';
import { ChevronRight, FolderOpen } from 'lucide-react';
import { BaseCard } from '@/shared/components/cards';
import type { Project } from '@/subsidiaries/advisory/core/project/types/project.types';

interface ProgramStats {
  id: string;
  name: string;
  projectCount: number;
  activeProjects: number;
  totalBudget: number;
  totalSpent: number;
  avgProgress: number;
  currency: string;
}

interface ProgramBreakdownCardProps {
  programs: Array<{ id: string; name: string }>;
  projects: Project[];
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000000) return `${(amount / 1000000000).toFixed(1)}B`;
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  return amount.toLocaleString();
}

export function ProgramBreakdownCard({ programs, projects }: ProgramBreakdownCardProps) {
  const programStats: ProgramStats[] = programs.map(program => {
    const programProjects = projects.filter(p => p.programId === program.id);
    const activeProjects = programProjects.filter(p =>
      ['active', 'in_progress', 'mobilization'].includes(p.status)
    ).length;
    const totalBudget = programProjects.reduce((sum, p) => sum + (p.budget?.totalBudget || 0), 0);
    const totalSpent = programProjects.reduce((sum, p) => sum + (p.budget?.spent || 0), 0);
    const avgProgress = programProjects.length > 0
      ? Math.round(programProjects.reduce((sum, p) => sum + (p.progress?.physicalProgress || 0), 0) / programProjects.length)
      : 0;

    const currency = programProjects[0]?.budget?.currency || 'UGX';
    return {
      id: program.id,
      name: program.name,
      projectCount: programProjects.length,
      activeProjects,
      totalBudget,
      totalSpent,
      avgProgress,
      currency,
    };
  });

  if (programStats.length === 0) {
    return (
      <BaseCard padding="lg">
        <div className="text-center py-6 text-gray-500">
          <FolderOpen className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p>No programs found</p>
        </div>
      </BaseCard>
    );
  }

  return (
    <BaseCard padding="lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-900">Program Breakdown</h2>
        <Link
          to="/advisory/delivery/programs"
          className="text-primary text-sm hover:underline flex items-center"
        >
          View all <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="py-2.5 px-3 text-left font-medium text-gray-500">Program</th>
              <th className="py-2.5 px-3 text-center font-medium text-gray-500">Projects</th>
              <th className="py-2.5 px-3 text-center font-medium text-gray-500">Active</th>
              <th className="py-2.5 px-3 text-right font-medium text-gray-500">Budget</th>
              <th className="py-2.5 px-3 text-right font-medium text-gray-500">Utilization</th>
              <th className="py-2.5 px-3 text-center font-medium text-gray-500">Avg Progress</th>
            </tr>
          </thead>
          <tbody>
            {programStats.map(stat => {
              const utilization = stat.totalBudget > 0
                ? ((stat.totalSpent / stat.totalBudget) * 100).toFixed(0)
                : '0';

              return (
                <tr key={stat.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-3">
                    <Link
                      to={`/advisory/delivery/programs/${stat.id}`}
                      className="font-medium text-gray-900 hover:text-primary"
                    >
                      {stat.name}
                    </Link>
                  </td>
                  <td className="py-3 px-3 text-center text-gray-600">{stat.projectCount}</td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      {stat.activeProjects}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-gray-600">{stat.currency} {formatCurrency(stat.totalBudget)}</td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(100, Number(utilization))}%` }}
                        />
                      </div>
                      <span className="text-gray-600 w-10 text-right">{utilization}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full">
                        <div
                          className={`h-full rounded-full ${
                            stat.avgProgress >= 75 ? 'bg-green-500' :
                            stat.avgProgress >= 50 ? 'bg-blue-500' :
                            stat.avgProgress >= 25 ? 'bg-yellow-500' :
                            'bg-gray-400'
                          }`}
                          style={{ width: `${stat.avgProgress}%` }}
                        />
                      </div>
                      <span className="text-gray-600 w-10 text-right">{stat.avgProgress}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </BaseCard>
  );
}

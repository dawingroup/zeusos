/**
 * Module Card Component
 * DawinOS v2.0 - Dawin Advisory
 * Card for navigating to sub-modules
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { getIconByName, iconMap } from '@/shared/utils/iconMap';
import { Card, CardContent } from '@/core/components/ui/card';

interface ModuleCardProps {
  id: string;
  name: string;
  description: string;
  icon: string;
  path: string;
  color: string;
  stats?: {
    label: string;
    value: string | number;
  }[];
}

export const ModuleCard: React.FC<ModuleCardProps> = ({
  name,
  description,
  icon,
  path,
  color,
  stats,
}) => {
  const navigate = useNavigate();
  const Icon = getIconByName(icon) || iconMap.Box;

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-all group border-0 shadow-sm"
      onClick={() => navigate(path)}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div 
            className="p-3 rounded-xl"
            style={{ backgroundColor: color }}
          >
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 group-hover:text-amber-600 transition-colors">
                {name}
              </h3>
              <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
            
            {stats && stats.length > 0 && (
              <div className="mt-4 flex gap-4">
                {stats.map((stat, index) => (
                  <div key={index} className="text-center">
                    <p className="text-lg font-semibold text-gray-900">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ModuleCard;

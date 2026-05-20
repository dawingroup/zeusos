// src/subsidiaries/advisory/ai/components/AIEntityChip.tsx

import React from 'react';
import { 
  Building2, 
  Receipt, 
  Truck, 
  Store, 
  Package, 
  DollarSign, 
  Percent, 
  Calendar, 
  User 
} from 'lucide-react';
import { DetectedEntity, EntityType } from '../types/agent';
import { cn } from '@/lib/utils';

interface AIEntityChipProps {
  entity: DetectedEntity;
  onClick?: () => void;
}

export const AIEntityChip: React.FC<AIEntityChipProps> = ({
  entity,
  onClick,
}) => {
  const getEntityConfig = (type: EntityType) => {
    const configs: Record<EntityType, { icon: React.ReactNode; color: string; bgColor: string }> = {
      project: { 
        icon: <Building2 className="w-3 h-3" />, 
        color: 'text-amber-700', 
        bgColor: 'bg-amber-50' 
      },
      engagement: { 
        icon: <Building2 className="w-3 h-3" />, 
        color: 'text-blue-700', 
        bgColor: 'bg-blue-50' 
      },
      deal: { 
        icon: <Building2 className="w-3 h-3" />, 
        color: 'text-blue-700', 
        bgColor: 'bg-blue-50' 
      },
      portfolio: { 
        icon: <Building2 className="w-3 h-3" />, 
        color: 'text-green-700', 
        bgColor: 'bg-green-50' 
      },
      investment: { 
        icon: <Building2 className="w-3 h-3" />, 
        color: 'text-green-700', 
        bgColor: 'bg-green-50' 
      },
      facility: { 
        icon: <Building2 className="w-3 h-3" />, 
        color: 'text-amber-700', 
        bgColor: 'bg-amber-50' 
      },
      requisition: { 
        icon: <Receipt className="w-3 h-3" />, 
        color: 'text-purple-700', 
        bgColor: 'bg-purple-50' 
      },
      purchase_order: { 
        icon: <Truck className="w-3 h-3" />, 
        color: 'text-indigo-700', 
        bgColor: 'bg-indigo-50' 
      },
      supplier: { 
        icon: <Store className="w-3 h-3" />, 
        color: 'text-cyan-700', 
        bgColor: 'bg-cyan-50' 
      },
      material: { 
        icon: <Package className="w-3 h-3" />, 
        color: 'text-purple-700', 
        bgColor: 'bg-purple-50' 
      },
      boq: { 
        icon: <Package className="w-3 h-3" />, 
        color: 'text-purple-700', 
        bgColor: 'bg-purple-50' 
      },
      person: { 
        icon: <User className="w-3 h-3" />, 
        color: 'text-gray-700', 
        bgColor: 'bg-gray-50' 
      },
      organization: { 
        icon: <Building2 className="w-3 h-3" />, 
        color: 'text-gray-700', 
        bgColor: 'bg-gray-50' 
      },
      date: { 
        icon: <Calendar className="w-3 h-3" />, 
        color: 'text-gray-600', 
        bgColor: 'bg-gray-50' 
      },
      currency: { 
        icon: <DollarSign className="w-3 h-3" />, 
        color: 'text-green-700', 
        bgColor: 'bg-green-50' 
      },
      amount: { 
        icon: <DollarSign className="w-3 h-3" />, 
        color: 'text-green-700', 
        bgColor: 'bg-green-50' 
      },
      percentage: { 
        icon: <Percent className="w-3 h-3" />, 
        color: 'text-blue-700', 
        bgColor: 'bg-blue-50' 
      },
    };
    return configs[type] || { icon: null, color: 'text-gray-600', bgColor: 'bg-gray-50' };
  };

  const config = getEntityConfig(entity.type);
  const isClickable = Boolean(entity.id && onClick);

  return (
    <button
      onClick={isClickable ? onClick : undefined}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        config.bgColor,
        config.color,
        isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
      )}
      title={`${entity.type}: ${entity.value}${entity.id ? ` (ID: ${entity.id})` : ''}\nConfidence: ${Math.round(entity.confidence * 100)}%`}
    >
      {config.icon}
      <span>{entity.value}</span>
    </button>
  );
};

export default AIEntityChip;

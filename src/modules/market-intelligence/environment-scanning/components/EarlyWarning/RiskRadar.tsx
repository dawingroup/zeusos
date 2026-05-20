// ============================================================================
// RISK RADAR COMPONENT
// DawinOS v2.0 - Market Intelligence Module
// Visual radar showing risk distribution by priority
// ============================================================================

import React, { useMemo } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Bell,
  BellOff,
} from 'lucide-react';
import { EarlyWarningAlert } from '../../types/scanning.types';
import {
  ALERT_PRIORITY_CONFIG,
  AlertPriority,
} from '../../constants/scanning.constants';

interface RiskRadarProps {
  alerts: EarlyWarningAlert[];
  onAlertClick?: (alert: EarlyWarningAlert) => void;
}

export const RiskRadar: React.FC<RiskRadarProps> = ({
  alerts,
  onAlertClick,
}) => {
  const activeAlerts = useMemo(() => 
    alerts.filter(a => a.status === 'active'),
    [alerts]
  );

  const alertsByPriority = useMemo(() => {
    const map: Record<AlertPriority, EarlyWarningAlert[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      info: [],
    };
    
    activeAlerts.forEach(alert => {
      if (map[alert.priority as AlertPriority]) {
        map[alert.priority as AlertPriority].push(alert);
      }
    });
    
    return map;
  }, [activeAlerts]);

  const getPriorityIcon = (priority: AlertPriority) => {
    switch (priority) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4" />;
      case 'high':
        return <AlertCircle className="w-4 h-4" />;
      case 'medium':
        return <Info className="w-4 h-4" />;
      case 'low':
        return <Bell className="w-4 h-4" />;
      default:
        return <BellOff className="w-4 h-4" />;
    }
  };

  const rings = [
    { priority: 'critical' as AlertPriority, radius: 20 },
    { priority: 'high' as AlertPriority, radius: 40 },
    { priority: 'medium' as AlertPriority, radius: 60 },
    { priority: 'low' as AlertPriority, radius: 80 },
    { priority: 'info' as AlertPriority, radius: 100 },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Risk Radar</h3>
        <span className="text-sm text-gray-500">
          {activeAlerts.length} active alert{activeAlerts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Radar Visualization */}
      <div className="relative w-full aspect-square max-w-xs mx-auto">
        {/* Radar Rings */}
        <svg viewBox="0 0 220 220" className="w-full h-full">
          {/* Background circles */}
          {rings.map(ring => (
            <circle
              key={ring.priority}
              cx="110"
              cy="110"
              r={ring.radius}
              fill="none"
              stroke={`${ALERT_PRIORITY_CONFIG[ring.priority].color}30`}
              strokeWidth="2"
            />
          ))}
          
          {/* Cross lines */}
          <line x1="110" y1="10" x2="110" y2="210" stroke="#e5e7eb" strokeWidth="1" />
          <line x1="10" y1="110" x2="210" y2="110" stroke="#e5e7eb" strokeWidth="1" />
          <line x1="30" y1="30" x2="190" y2="190" stroke="#e5e7eb" strokeWidth="1" />
          <line x1="190" y1="30" x2="30" y2="190" stroke="#e5e7eb" strokeWidth="1" />

          {/* Alert dots */}
          {rings.map((ring) => {
            const ringAlerts = alertsByPriority[ring.priority];
            const angleStep = ringAlerts.length > 0 ? (2 * Math.PI) / ringAlerts.length : 0;
            
            return ringAlerts.map((alert, idx) => {
              const angle = angleStep * idx - Math.PI / 2;
              const x = 110 + ring.radius * Math.cos(angle);
              const y = 110 + ring.radius * Math.sin(angle);
              
              return (
                <g key={alert.id}>
                  <circle
                    cx={x}
                    cy={y}
                    r={8}
                    fill={ALERT_PRIORITY_CONFIG[ring.priority].color}
                    className="cursor-pointer hover:r-10 transition-all"
                    onClick={() => onAlertClick?.(alert)}
                  />
                  {ring.priority === 'critical' && (
                    <circle
                      cx={x}
                      cy={y}
                      r={12}
                      fill="none"
                      stroke={ALERT_PRIORITY_CONFIG[ring.priority].color}
                      strokeWidth="2"
                      className="animate-ping"
                      opacity="0.5"
                    />
                  )}
                </g>
              );
            });
          })}

          {/* Center */}
          <circle
            cx="110"
            cy="110"
            r="15"
            fill={activeAlerts.length > 0 
              ? ALERT_PRIORITY_CONFIG[activeAlerts.sort((a, b) => {
                  const order = ['critical', 'high', 'medium', 'low', 'info'];
                  return order.indexOf(a.priority) - order.indexOf(b.priority);
                })[0].priority as AlertPriority].color
              : '#22c55e'
            }
          />
          <text
            x="110"
            y="115"
            textAnchor="middle"
            fill="white"
            fontSize="12"
            fontWeight="bold"
          >
            {activeAlerts.length}
          </text>
        </svg>

        {/* Ring Labels */}
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-xs text-gray-400">
          Critical
        </div>
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-gray-400">
          Info
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-5 gap-2">
        {Object.entries(ALERT_PRIORITY_CONFIG).map(([key, config]) => {
          const count = alertsByPriority[key as AlertPriority]?.length || 0;
          return (
            <div
              key={key}
              className="text-center p-2 rounded-lg"
              style={{ backgroundColor: count > 0 ? `${config.color}10` : 'transparent' }}
            >
              <div
                className="flex items-center justify-center mb-1"
                style={{ color: config.color }}
              >
                {getPriorityIcon(key as AlertPriority)}
              </div>
              <div className="text-lg font-bold" style={{ color: config.color }}>
                {count}
              </div>
              <div className="text-xs text-gray-500">{config.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RiskRadar;

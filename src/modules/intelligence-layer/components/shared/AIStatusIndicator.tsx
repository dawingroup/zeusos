// ============================================================================
// AI STATUS INDICATOR
// DawinOS v2.0 - Intelligence Layer
// Shows AI processing status and model info
// ============================================================================

import React from 'react';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';

import { Badge } from '@/core/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/core/components/ui/tooltip';

import { MODULE_COLOR, AI_MODELS } from '../../constants';

interface AIStatusIndicatorProps {
  status: 'idle' | 'processing' | 'success' | 'error';
  modelId?: string;
  progress?: number;
  message?: string;
  compact?: boolean;
}

export const AIStatusIndicator: React.FC<AIStatusIndicatorProps> = ({
  status,
  modelId = 'gemini-pro',
  progress,
  message,
  compact = false,
}) => {
  const modelConfig = AI_MODELS.find(m => m.id === modelId) || AI_MODELS[0];

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin" style={{ color: MODULE_COLOR }} />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return MODULE_COLOR;
      case 'success':
        return '#4caf50';
      case 'error':
        return '#f44336';
      default:
        return '#9e9e9e';
    }
  };

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              <div
                className="h-4 w-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${MODULE_COLOR}20` }}
              >
                <span className="text-xs" style={{ color: MODULE_COLOR }}>AI</span>
              </div>
              {getStatusIcon()}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {modelConfig.label} - {message || status}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
      <div
        className="p-2 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${MODULE_COLOR}15` }}
      >
        <span className="text-sm font-medium" style={{ color: MODULE_COLOR }}>AI</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">{modelConfig.label}</span>
          <Badge
            className="text-xs capitalize"
            style={{ backgroundColor: getStatusColor(), color: 'white' }}
          >
            {status}
          </Badge>
        </div>

        {message && (
          <p className="text-xs text-muted-foreground truncate">{message}</p>
        )}

        {status === 'processing' && progress !== undefined && (
          <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, backgroundColor: MODULE_COLOR }}
            />
          </div>
        )}
      </div>

      {getStatusIcon()}
    </div>
  );
};

export default AIStatusIndicator;

// ============================================================================
// AI ASSISTANT FAB
// DawinOS v2.0 - Intelligence Layer
// Floating action button to open AI assistant
// ============================================================================

import React, { useState } from 'react';
import { Bot } from 'lucide-react';

import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/core/components/ui/tooltip';

import { MODULE_COLOR } from '../../constants';
import { AIAssistantPanel } from './AIAssistantPanel';

interface AIAssistantFABProps {
  notificationCount?: number;
  defaultOpen?: boolean;
  context?: Record<string, any>;
}

export const AIAssistantFAB: React.FC<AIAssistantFABProps> = ({
  notificationCount = 0,
  defaultOpen = false,
  context,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const [minimized, setMinimized] = useState(false);

  const handleOpen = () => {
    setOpen(true);
    setMinimized(false);
  };

  const handleClose = () => {
    setOpen(false);
    setMinimized(false);
  };

  const handleMinimize = () => {
    setMinimized(true);
    setOpen(false);
  };

  return (
    <>
      {(!open || minimized) && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleOpen}
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40"
                style={{ backgroundColor: MODULE_COLOR }}
              >
                <div className="relative">
                  <Bot className="h-6 w-6" />
                  {notificationCount > 0 && (
                    <Badge
                      className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-red-500"
                    >
                      {notificationCount}
                    </Badge>
                  )}
                </div>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">AI Assistant</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <AIAssistantPanel
        open={open && !minimized}
        onClose={handleClose}
        onMinimize={handleMinimize}
        context={context}
      />
    </>
  );
};

export default AIAssistantFAB;

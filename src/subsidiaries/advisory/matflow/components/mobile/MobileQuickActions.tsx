/**
 * Mobile Quick Actions Component
 * Floating action button with quick field actions
 */

import React, { useState } from 'react';
import { Button } from '@/core/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/core/components/ui/sheet';
import {
  Plus,
  Camera,
  Package,
  ClipboardCheck,
  FileUp,
  QrCode,
  Truck,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  action: () => void;
}

interface MobileQuickActionsProps {
  projectId?: string;
  onLogDelivery?: () => void;
  onLogPurchase?: () => void;
  onScanQR?: () => void;
  onTakePhoto?: () => void;
}

export function MobileQuickActions({
  projectId,
  onLogDelivery,
  onLogPurchase,
  onScanQR,
  onTakePhoto,
}: MobileQuickActionsProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  const quickActions: QuickAction[] = [
    {
      id: 'delivery',
      label: 'Log Delivery',
      description: 'Record material delivery at site',
      icon: Truck,
      color: 'bg-blue-500',
      action: () => {
        setOpen(false);
        onLogDelivery?.();
      },
    },
    {
      id: 'purchase',
      label: 'Log Purchase',
      description: 'Record material purchase',
      icon: Package,
      color: 'bg-green-500',
      action: () => {
        setOpen(false);
        onLogPurchase?.();
      },
    },
    {
      id: 'quality',
      label: 'Quality Check',
      description: 'Perform quality inspection',
      icon: ClipboardCheck,
      color: 'bg-purple-500',
      action: () => {
        setOpen(false);
        if (projectId) {
          navigate(`/advisory/matflow/projects/${projectId}/quality-check`);
        }
      },
    },
    {
      id: 'scan',
      label: 'Scan QR',
      description: 'Scan material or delivery QR code',
      icon: QrCode,
      color: 'bg-orange-500',
      action: () => {
        setOpen(false);
        onScanQR?.();
      },
    },
    {
      id: 'photo',
      label: 'Take Photo',
      description: 'Capture site photo',
      icon: Camera,
      color: 'bg-pink-500',
      action: () => {
        setOpen(false);
        onTakePhoto?.();
      },
    },
    {
      id: 'upload',
      label: 'Upload Document',
      description: 'Upload delivery note or invoice',
      icon: FileUp,
      color: 'bg-teal-500',
      action: () => {
        setOpen(false);
        if (projectId) {
          navigate(`/advisory/matflow/projects/${projectId}/upload`);
        }
      },
    },
  ];

  return (
    <>
      {/* Floating Action Button */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            size="lg"
            className={cn(
              'fixed right-4 bottom-20 z-40 h-14 w-14 rounded-full shadow-lg',
              'bg-primary hover:bg-primary/90'
            )}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-auto rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle>Quick Actions</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-4 pb-8">
            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={action.action}
                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted transition-colors"
              >
                <div
                  className={cn(
                    'h-12 w-12 rounded-full flex items-center justify-center text-white',
                    action.color
                  )}
                >
                  <action.icon className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-center">
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default MobileQuickActions;

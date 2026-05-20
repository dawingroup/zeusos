/**
 * PWA Install Prompt Component
 * Prompt users to install the app on their device
 */

import { useState, useEffect } from 'react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent } from '@/core/components/ui/card';
import { Download, X, Smartphone, Monitor } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallPromptProps {
  className?: string;
  onInstall?: () => void;
  onDismiss?: () => void;
}

export function InstallPrompt({
  className,
  onInstall,
  onDismiss,
}: InstallPromptProps) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const isMobile = useIsMobile();

  // Check if already installed
  useEffect(() => {
    const checkInstalled = () => {
      // Check display-mode media query
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      // Check iOS standalone
      const isIOSStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      
      setIsInstalled(isStandalone || isIOSStandalone);
    };

    checkInstalled();

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkInstalled);

    return () => mediaQuery.removeEventListener('change', checkInstalled);
  }, []);

  // Capture the install prompt event
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Check if prompt was already captured
    const storedDismissed = localStorage.getItem('pwa-install-dismissed');
    if (storedDismissed) {
      const dismissedAt = new Date(storedDismissed);
      const daysSinceDismissed = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24);
      // Show again after 7 days
      if (daysSinceDismissed < 7) {
        setDismissed(true);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  // Listen for successful install
  useEffect(() => {
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      onInstall?.();
    };

    window.addEventListener('appinstalled', handleAppInstalled);
    return () => window.removeEventListener('appinstalled', handleAppInstalled);
  }, [onInstall]);

  const handleInstall = async () => {
    if (!installPrompt) return;

    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setInstallPrompt(null);
        onInstall?.();
      }
    } catch (error) {
      console.error('[PWA] Install prompt failed:', error);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
    onDismiss?.();
  };

  // Don't show if already installed, dismissed, or no prompt available
  if (isInstalled || dismissed || !installPrompt) {
    return null;
  }

  return (
    <Card
      className={cn(
        'fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm',
        'animate-in slide-in-from-bottom duration-300',
        className
      )}
    >
      <CardContent className="p-4">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center shrink-0">
            {isMobile ? (
              <Smartphone className="h-6 w-6 text-primary-foreground" />
            ) : (
              <Monitor className="h-6 w-6 text-primary-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <h4 className="font-semibold">Install MatFlow</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Install for quick access and offline support. Works just like a native app!
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={handleInstall} className="flex-1">
            <Download className="h-4 w-4 mr-2" />
            Install
          </Button>
          <Button variant="outline" onClick={handleDismiss}>
            Not Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * iOS Install Instructions
 * Show instructions for iOS users (no beforeinstallprompt support)
 */
export function IOSInstallInstructions({ className }: { className?: string }) {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only show on iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    
    if (isIOS && isSafari && !isStandalone) {
      const storedDismissed = localStorage.getItem('ios-install-dismissed');
      if (!storedDismissed) {
        setShow(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    setShow(false);
    localStorage.setItem('ios-install-dismissed', 'true');
  };

  if (!show || dismissed) {
    return null;
  }

  return (
    <Card
      className={cn(
        'fixed bottom-20 left-4 right-4 z-50',
        'animate-in slide-in-from-bottom duration-300',
        className
      )}
    >
      <CardContent className="p-4">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        <h4 className="font-semibold pr-6">Install MatFlow</h4>
        <p className="text-sm text-muted-foreground mt-2">
          To install this app on your iPhone:
        </p>
        <ol className="text-sm mt-2 space-y-2">
          <li className="flex items-center gap-2">
            <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">1</span>
            Tap the Share button
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </li>
          <li className="flex items-center gap-2">
            <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">2</span>
            Scroll and tap "Add to Home Screen"
          </li>
          <li className="flex items-center gap-2">
            <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">3</span>
            Tap "Add"
          </li>
        </ol>

        <Button variant="outline" onClick={handleDismiss} className="w-full mt-4">
          Got it
        </Button>
      </CardContent>
    </Card>
  );
}

export default InstallPrompt;

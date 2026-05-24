import { useState, useEffect } from 'react';
import Header from './components/Header';
import QuickActions from './components/QuickActions';
import Settings from './components/Settings';
import SignInScreen from './components/SignInScreen';
import LoadingScreen from './components/LoadingScreen';
import { ClipGallery } from './components/ClipGallery';
import { ClipDetail } from './components/ClipDetail';
import { DetailedClipForm } from './components/DetailedClipForm';
import { SyncStatusIndicator } from './components/SyncStatusIndicator';
import type { ClipType } from './components/DetailedClipForm';
import { useAuth } from './hooks/useAuth';
import { useClips } from './hooks/useClips';
import { useSyncStatus } from './hooks/useSyncStatus';
import type { PopupClipRecord } from './types';

type View = 'gallery' | 'detail' | 'settings' | 'clip-form';

interface PendingClipMetadata {
  price?: {
    amount: number;
    currency: string;
    formatted: string;
    confidence: number;
  };
  brand?: string;
  sku?: string;
  category?: string;
  dimensions?: {
    width: number;
    height: number;
    depth?: number;
    unit: string;
  };
  materials?: string[];
  colors?: string[];
  description?: string;
}

interface PendingClip {
  imageUrl: string;
  sourceUrl: string;
  pageTitle: string;
  metadata?: PendingClipMetadata;
}

export default function App() {
  const { user, isLoading: authLoading, isSigningIn, error: authError, signIn, signOut } = useAuth();
  const { clips, pendingCount, syncClips, deleteClip, updateClip } = useClips();
  const { syncStatus, triggerSync } = useSyncStatus();
  const [currentView, setCurrentView] = useState<View>('gallery');
  const [selectedClip, setSelectedClip] = useState<PopupClipRecord | null>(null);
  const [pendingClip, setPendingClip] = useState<PendingClip | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check for pending clip data when popup opens
  useEffect(() => {
    const checkPendingClip = async () => {
      try {
        const result = await chrome.storage.local.get(['pendingClip']);
        if (result.pendingClip) {
          const clipData = result.pendingClip;
          // Check if clip is recent (within last 5 minutes)
          const isRecent = Date.now() - clipData.timestamp < 5 * 60 * 1000;
          if (isRecent) {
            setPendingClip({
              imageUrl: clipData.imageUrl,
              sourceUrl: clipData.sourceUrl,
              pageTitle: clipData.title || 'Untitled',
              metadata: clipData.metadata,
            });
            setCurrentView('clip-form');
          } else {
            // Clear stale pending clip
            await chrome.storage.local.remove(['pendingClip']);
          }
        }
      } catch (error) {
        console.error('Failed to check pending clip:', error);
      }
    };

    checkPendingClip();
  }, []);

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <SignInScreen onSignIn={signIn} isSigningIn={isSigningIn} error={authError} />;
  }

  const handleStartClipping = async () => {
    try {
      // Send through service worker which handles content script injection
      await chrome.runtime.sendMessage({ type: 'TOGGLE_CLIPPING_MODE' });
      window.close();
    } catch (error) {
      console.error('Failed to start clipping:', error);
    }
  };

  const handleDetailedClipSubmit = async (data: {
    clipType: ClipType;
    projectId?: string;
    designItemId?: string;
    notes?: string;
  }) => {
    if (!pendingClip) return;

    setIsSubmitting(true);
    try {
      await chrome.runtime.sendMessage({
        type: 'SAVE_DETAILED_CLIP',
        data: {
          imageUrl: pendingClip.imageUrl,
          sourceUrl: pendingClip.sourceUrl,
          title: pendingClip.pageTitle,
          clipType: data.clipType,
          projectId: data.projectId,
          designItemId: data.designItemId,
          notes: data.notes,
          // Include metadata with price, brand, etc.
          price: pendingClip.metadata?.price,
          brand: pendingClip.metadata?.brand,
          sku: pendingClip.metadata?.sku,
          dimensions: pendingClip.metadata?.dimensions,
          materials: pendingClip.metadata?.materials,
          colors: pendingClip.metadata?.colors,
          description: pendingClip.metadata?.description,
        },
      });
      // Clear pending clip from storage after successful save
      await chrome.storage.local.remove(['pendingClip']);
      setPendingClip(null);
      setCurrentView('gallery');
      // Refresh clips
      syncClips();
    } catch (error) {
      console.error('Failed to save clip:', error);
    }
    setIsSubmitting(false);
  };

  const handleCancelClipForm = async () => {
    // Clear pending clip from storage
    await chrome.storage.local.remove(['pendingClip']);
    setPendingClip(null);
    setCurrentView('gallery');
  };

  const handleSelectClip = (clip: PopupClipRecord) => {
    setSelectedClip(clip);
    setCurrentView('detail');
  };

  const handleBackToGallery = () => {
    setSelectedClip(null);
    setCurrentView('gallery');
  };

  const handleBulkAction = async (action: 'delete' | 'tag' | 'project', ids: string[]) => {
    if (action === 'delete') {
      for (const id of ids) {
        await deleteClip(id);
      }
    } else if (action === 'tag') {
      const tagName = prompt('Enter tag name to apply:');
      if (tagName) {
        for (const id of ids) {
          try {
            const clip = clips?.find((c: any) => c.id === id);
            if (clip) {
              const existingTags = (clip as any).tags || [];
              if (!existingTags.includes(tagName)) {
                await updateClip(id, { tags: [...existingTags, tagName] });
              }
            }
          } catch (error) {
            console.error('Failed to tag clip:', id, error);
          }
        }
      }
    } else if (action === 'project') {
      const projectName = prompt('Enter project name to assign:');
      if (projectName) {
        for (const id of ids) {
          try {
            await updateClip(id, { projectId: projectName });
          } catch (error) {
            console.error('Failed to assign project to clip:', id, error);
          }
        }
      }
    }
  };

  return (
    <div className="w-[400px] h-[500px] bg-[var(--bg-sunken)] flex flex-col">
      {currentView !== 'detail' && currentView !== 'clip-form' && (
        <>
          <Header
            user={user}
            pendingCount={pendingCount}
            onSettingsClick={() => setCurrentView(currentView === 'settings' ? 'gallery' : 'settings')}
            onSignOut={signOut}
          />

          <QuickActions
            onStartClipping={handleStartClipping}
            onSyncNow={triggerSync}
          />
          
          {/* Sync Status Banner */}
          {(syncStatus.pendingCount > 0 || syncStatus.status !== 'idle') && (
            <div className="px-3 pb-2">
              <SyncStatusIndicator status={syncStatus} onSync={triggerSync} />
            </div>
          )}
        </>
      )}

      <main className="flex-1 overflow-hidden">
        {currentView === 'gallery' && (
          <ClipGallery
            clips={clips}
            onDelete={deleteClip}
            onSelect={handleSelectClip}
            onBulkAction={handleBulkAction}
          />
        )}
        {currentView === 'detail' && selectedClip && (
          <ClipDetail
            clip={selectedClip}
            onBack={handleBackToGallery}
            onUpdate={updateClip}
            onDelete={(id) => {
              deleteClip(id);
              handleBackToGallery();
            }}
          />
        )}
        {currentView === 'settings' && (
          <Settings onBack={() => setCurrentView('gallery')} />
        )}
        {currentView === 'clip-form' && pendingClip && (
          <DetailedClipForm
            imageUrl={pendingClip.imageUrl}
            sourceUrl={pendingClip.sourceUrl}
            pageTitle={pendingClip.pageTitle}
            onSubmit={handleDetailedClipSubmit}
            onCancel={handleCancelClipForm}
            isSubmitting={isSubmitting}
          />
        )}
      </main>
    </div>
  );
}

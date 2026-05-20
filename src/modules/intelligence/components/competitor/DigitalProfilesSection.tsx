// ============================================================================
// DIGITAL PROFILES SECTION
// DawinOS v2.0 - Market Intelligence Module
// Discover and track competitor digital profiles
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Linkedin,
  Twitter,
  Facebook,
  Instagram,
  Youtube,
  Github,
  Search,
  Plus,
  Loader2,
  ExternalLink,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  MapPin,
  Smartphone,
  BookOpen,
  PenTool,
  MessageCircle,
  Image,
  Link2,
  Music2,
  Building2,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Badge } from '@/core/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';

import { useAuth } from '@/shared/hooks/useAuth';
import { digitalProfileService } from '../../services/digitalProfileService';
import {
  DigitalProfile,
  ProfileDiscoveryResult,
  DigitalPlatform,
  PLATFORM_LABELS,
  PLATFORM_COLORS,
} from '../../types/digitalProfile.types';
import { MODULE_COLOR } from '../../constants';

// Platform icon mapping
const PlatformIcon: React.FC<{ platform: DigitalPlatform; className?: string }> = ({ platform, className = 'h-5 w-5' }) => {
  const icons: Record<string, React.ReactNode> = {
    website: <Globe className={className} />,
    linkedin: <Linkedin className={className} />,
    twitter: <Twitter className={className} />,
    facebook: <Facebook className={className} />,
    instagram: <Instagram className={className} />,
    youtube: <Youtube className={className} />,
    tiktok: <Music2 className={className} />,
    github: <Github className={className} />,
    crunchbase: <TrendingUp className={className} />,
    glassdoor: <Building2 className={className} />,
    google_business: <MapPin className={className} />,
    app_store: <Smartphone className={className} />,
    play_store: <Smartphone className={className} />,
    blog: <PenTool className={className} />,
    medium: <BookOpen className={className} />,
    reddit: <MessageCircle className={className} />,
    pinterest: <Image className={className} />,
    other: <Link2 className={className} />,
  };
  return <>{icons[platform] || icons.other}</>;
};

interface DigitalProfilesSectionProps {
  competitorId: string;
  competitorName: string;
  competitorWebsite?: string;
}

export const DigitalProfilesSection: React.FC<DigitalProfilesSectionProps> = ({
  competitorId,
  competitorName,
  competitorWebsite,
}) => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<DigitalProfile[]>([]);
  const [discoveryResults, setDiscoveryResults] = useState<ProfileDiscoveryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [showAddManual, setShowAddManual] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const results = await digitalProfileService.getCompetitorProfiles(competitorId);
      setProfiles(results);
    } catch (err) {
      console.error('Error fetching profiles:', err);
    } finally {
      setLoading(false);
    }
  }, [competitorId]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleDiscover = async () => {
    setDiscovering(true);
    setShowDiscovery(true);
    try {
      const results = await digitalProfileService.discoverProfiles(
        competitorName,
        competitorId,
        competitorWebsite
      );
      // Mark already tracked
      const existingUrls = new Set(profiles.map(p => p.profileUrl.toLowerCase()));
      const enriched = results.map(r => ({
        ...r,
        alreadyTracked: existingUrls.has(r.url.toLowerCase()),
      }));
      setDiscoveryResults(enriched);
    } catch (err) {
      console.error('Discovery error:', err);
      setDiscoveryResults([]);
    } finally {
      setDiscovering(false);
    }
  };

  const handleTrackDiscovered = async (result: ProfileDiscoveryResult) => {
    const key = result.url;
    setSavingIds(prev => new Set(prev).add(key));
    try {
      await digitalProfileService.createFromDiscovery(
        result,
        competitorId,
        competitorName,
        user?.uid || 'unknown'
      );
      // Mark as tracked
      setDiscoveryResults(prev =>
        prev.map(r => r.url === result.url ? { ...r, alreadyTracked: true } : r)
      );
      await fetchProfiles();
    } catch (err) {
      console.error('Error tracking profile:', err);
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleTrackAll = async () => {
    const untracked = discoveryResults.filter(r => !r.alreadyTracked);
    for (const result of untracked) {
      await handleTrackDiscovered(result);
    }
  };

  const handleToggleTracking = async (profileId: string) => {
    await digitalProfileService.toggleTracking(profileId);
    await fetchProfiles();
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('Stop tracking this profile?')) return;
    await digitalProfileService.deleteProfile(profileId);
    await fetchProfiles();
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleDiscover}
          disabled={discovering}
          style={{ backgroundColor: MODULE_COLOR }}
        >
          {discovering ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          {discovering ? 'Searching...' : 'Discover Digital Profiles'}
        </Button>
        <Button variant="outline" onClick={() => setShowAddManual(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Manually
        </Button>
      </div>

      {/* Discovery Results */}
      {showDiscovery && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-5 w-5" />
                Discovery Results
                {discoveryResults.length > 0 && (
                  <Badge variant="secondary">{discoveryResults.length} found</Badge>
                )}
              </CardTitle>
              <div className="flex gap-2">
                {discoveryResults.filter(r => !r.alreadyTracked).length > 0 && (
                  <Button size="sm" variant="outline" onClick={handleTrackAll}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Track All New
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setShowDiscovery(false)}>
                  Close
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {discovering ? (
              <div className="flex items-center justify-center py-8 gap-3">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: MODULE_COLOR }} />
                <p className="text-muted-foreground">
                  Searching Google for {competitorName} digital profiles...
                </p>
              </div>
            ) : discoveryResults.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-2">No profiles discovered</p>
                <p className="text-xs text-muted-foreground">
                  Google Custom Search API may not be configured. You can add profiles manually.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {discoveryResults.map((result, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${PLATFORM_COLORS[result.platform]}15`,
                        color: PLATFORM_COLORS[result.platform],
                      }}
                    >
                      <PlatformIcon platform={result.platform} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{ color: PLATFORM_COLORS[result.platform], borderColor: PLATFORM_COLORS[result.platform] }}
                        >
                          {PLATFORM_LABELS[result.platform]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {result.confidence}% match
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate mt-0.5">{result.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{result.url}</p>
                    </div>
                    <div className="shrink-0">
                      {result.alreadyTracked ? (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Tracked
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTrackDiscovered(result)}
                          disabled={savingIds.has(result.url)}
                        >
                          {savingIds.has(result.url) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Plus className="h-3 w-3 mr-1" />
                              Track
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tracked Profiles */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <Card className="p-8 text-center">
          <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold mb-1">No Digital Profiles Tracked</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Click "Discover Digital Profiles" to automatically find {competitorName}'s online presence
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {profiles.map(profile => (
            <Card
              key={profile.id}
              className={`hover:shadow-md transition-all ${!profile.isTracking ? 'opacity-60' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `${PLATFORM_COLORS[profile.platform]}15`,
                      color: PLATFORM_COLORS[profile.platform],
                    }}
                  >
                    <PlatformIcon platform={profile.platform} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{ color: PLATFORM_COLORS[profile.platform], borderColor: PLATFORM_COLORS[profile.platform] }}
                      >
                        {PLATFORM_LABELS[profile.platform]}
                      </Badge>
                      {profile.verified && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                      )}
                    </div>
                    <p className="text-sm font-medium truncate mt-1">
                      {profile.profileName || profile.profileHandle || profile.profileUrl}
                    </p>
                    {profile.followers !== undefined && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {profile.followers.toLocaleString()} followers
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <a href={profile.profileUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleToggleTracking(profile.id)}
                    >
                      {profile.isTracking ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500"
                      onClick={() => handleDeleteProfile(profile.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Manual Add Dialog */}
      <ManualAddDialog
        open={showAddManual}
        onOpenChange={setShowAddManual}
        competitorId={competitorId}
        competitorName={competitorName}
        userId={user?.uid || 'unknown'}
        onAdded={fetchProfiles}
      />
    </div>
  );
};

// ============================================================================
// MANUAL ADD DIALOG
// ============================================================================

interface ManualAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competitorId: string;
  competitorName: string;
  userId: string;
  onAdded: () => void;
}

const ManualAddDialog: React.FC<ManualAddDialogProps> = ({
  open, onOpenChange, competitorId, competitorName, userId, onAdded,
}) => {
  const [platform, setPlatform] = useState<DigitalPlatform>('website');
  const [url, setUrl] = useState('');
  const [handle, setHandle] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setSaving(true);
    try {
      await digitalProfileService.createProfile(
        {
          competitorId,
          competitorName,
          platform,
          profileUrl: url.trim(),
          profileHandle: handle.trim() || undefined,
        },
        userId
      );
      setUrl('');
      setHandle('');
      onOpenChange(false);
      onAdded();
    } catch (err) {
      console.error('Error adding profile:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Digital Profile</DialogTitle>
          <DialogDescription>
            Manually add a digital profile for {competitorName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Platform</Label>
            <Select value={platform} onValueChange={v => setPlatform(v as DigitalPlatform)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="profile-url">Profile URL *</Label>
            <Input
              id="profile-url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div>
            <Label htmlFor="profile-handle">Handle / Username</Label>
            <Input
              id="profile-handle"
              value={handle}
              onChange={e => setHandle(e.target.value)}
              placeholder="@handle"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !url.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Profile
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DigitalProfilesSection;

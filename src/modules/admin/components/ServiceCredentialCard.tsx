/**
 * ServiceCredentialCard
 * One row per managed secret on the API Keys page.
 */

import { useState } from 'react';
import {
  Check,
  Loader2,
  X,
  PencilLine,
  Zap,
  ExternalLink,
  KeyRound,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { cn } from '@/shared/lib/utils';
import {
  setServiceCredential,
  testServiceCredential,
  type ServiceCredentialStatus,
  type ServiceCredentialTestResult,
} from '../services/secretsService';

interface Props {
  credential: ServiceCredentialStatus;
  canEdit: boolean;
  onSaved: () => void;
}

export function ServiceCredentialCard({ credential, canEdit, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ServiceCredentialTestResult | null>(null);

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await setServiceCredential(credential.id, value.trim());
      setOpen(false);
      setValue('');
      onSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save credential');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testServiceCredential(credential.id);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="border border-[var(--border-subtle)] rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[var(--bg-sunken)] rounded-lg flex items-center justify-center shrink-0">
            <KeyRound className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-foreground truncate">{credential.label}</h4>
              <code className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-sunken)] text-muted-foreground font-mono">
                {credential.id}
              </code>
              {credential.helpUrl && (
                <a
                  href={credential.helpUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--fg-tertiary)] hover:text-muted-foreground"
                  aria-label="Open documentation"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {credential.configured ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--rag-green)]">
                  <Check className="w-3 h-3" /> Configured
                  {credential.lastFour && (
                    <span className="text-muted-foreground font-mono">••••-{credential.lastFour}</span>
                  )}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--rag-amber)]">
                  <X className="w-3 h-3" /> Not set
                </span>
              )}
              {credential.description && (
                <span className="text-xs text-muted-foreground truncate">{credential.description}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testing || !credential.configured}
              title={!credential.configured ? 'Configure a value first' : undefined}
            >
              {testing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              <span className="ml-1.5">Test</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setValue('');
                setSaveError(null);
                setOpen(true);
              }}
              disabled={!canEdit}
              title={!canEdit ? 'Only super admins can rotate credentials' : undefined}
            >
              <PencilLine className="w-3.5 h-3.5" />
              <span className="ml-1.5">{credential.configured ? 'Rotate' : 'Set'}</span>
            </Button>
          </div>
        </div>

        {testResult && (
          <div
            className={cn(
              'mt-2 text-xs rounded px-2 py-1.5 flex items-start gap-1.5',
              testResult.ok
                ? 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]'
                : 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
            )}
          >
            {testResult.ok ? (
              <Check className="w-3 h-3 mt-0.5 shrink-0" />
            ) : (
              <X className="w-3 h-3 mt-0.5 shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {credential.configured ? 'Rotate' : 'Set'} {credential.label}
            </DialogTitle>
            <DialogDescription>
              The value is written to Firebase Secret Manager. It will never be displayed
              again after saving. Functions consuming <code className="font-mono">{credential.id}</code>{' '}
              pick up the new version on next cold start.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="credential-value">New value</Label>
            <Input
              id="credential-value"
              type="password"
              autoComplete="new-password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Paste new secret value"
            />
            {saveError && <p className="text-xs text-[var(--rag-red)]">{saveError}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !value.trim()}>
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

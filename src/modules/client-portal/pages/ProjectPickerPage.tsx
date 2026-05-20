import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Btn, BarLine, Sep, Img, Eyebrow, Mono } from '../components/primitives';
import { Icon } from '../components/Icon';
import { useUserPortalProjects } from '../hooks/useFinishesPortalProject';
import type { DesignProject } from '@/modules/design-manager/types';
import { tsToDate } from '../utils/dates';
import '../styles/portal.css';

const TONE_BY_HASH = ['interior-warm', 'render', 'render-2', 'interior', 'fabric'] as const;

export default function ProjectPickerPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { projects, loading, error } = useUserPortalProjects();

  // Redirect unauthenticated visitors to the sign-in.
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/portal/sign-in', { replace: true });
    }
  }, [authLoading, user, navigate]);

  return (
    <div className="portal-root" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header user={user} />

      <div style={{ flex: 1, padding: '40px 72px', background: 'var(--paper)' }}>
        <div style={{
          marginBottom: 32,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}>
          <div>
            <Eyebrow>Your projects · {projects.length} active</Eyebrow>
            <div className="h-d2" style={{ marginTop: 12, maxWidth: 700 }}>
              {greeting(user?.displayName ?? user?.email ?? '')}<br />
              <span style={{ color: 'var(--ink-2)' }}>
                {projects.length === 0
                  ? "You don't have access to any projects yet."
                  : `${projects.length} project${projects.length === 1 ? '' : 's'} on your portal.`}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn icon="plus">New request</Btn>
            <Btn ghost>Switch organisation ↗</Btn>
          </div>
        </div>

        {loading ? (
          <div className="h-p is-dim">Loading your projects…</div>
        ) : error ? (
          <div className="h-p" style={{ color: 'var(--signal)' }}>
            {error.message}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState />
        ) : (
          // Auto-fill grid with a per-card width cap so cards don't
          // stretch to half-viewport on wide screens. Each card sits
          // between 360 and 460px wide; multi-row when more than two
          // projects exist, stacked on narrow viewports.
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 460px))',
            gap: 20,
            justifyContent: 'start',
          }}>
            {projects.map((p, i) => (
              <ProjectCard
                key={p.id}
                project={p}
                tone={TONE_BY_HASH[i % TONE_BY_HASH.length]}
                onClick={() => navigate(`/portal/p/${p.code}/dashboard`)}
              />
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, marginTop: 22 }}>
          <DashedRow label="Archived projects" />
          <DashedRow label="Engagement letters" />
        </div>
      </div>
    </div>
  );
}

function Header({ user }: { user: { displayName?: string | null; email?: string | null } | null }) {
  return (
    <div style={{
      height: 64,
      borderBottom: '1px solid var(--line)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      background: 'var(--paper)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="h-side-brand-mark">D</div>
        <div className="h-side-brand-t">Dawin<span style={{ color: 'var(--ink-3)' }}>OS</span></div>
        <span className="h-mono" style={{ color: 'var(--ink-3)' }}>·</span>
        <div className="h-mono" style={{ color: 'var(--ink-2)' }}>Client Portal</div>
      </div>
      <div className="h-top-r">
        <div className="h-iconbtn"><Icon name="search" size={16} /></div>
        <div className="h-iconbtn has-dot"><Icon name="bell" size={16} /></div>
        <div className="h-top-avatar">
          <div>
            <div className="h-top-avatar-l">{user?.displayName ?? user?.email ?? 'Guest'}</div>
            <div className="h-top-avatar-s">{user?.email ? '' : 'Not signed in'}</div>
          </div>
          <div className="h-top-avatar-img" />
        </div>
      </div>
    </div>
  );
}

function greeting(name: string): string {
  const first = name.split(' ')[0] || name.split('@')[0] || 'Hello';
  const h = new Date().getHours();
  const time = h < 12 ? 'good morning' : h < 18 ? 'good afternoon' : 'good evening';
  return `${first} — ${time}.`;
}

function EmptyState() {
  return (
    <div style={{
      padding: '48px 56px',
      borderRadius: 16,
      border: '1px dashed var(--line)',
      background: 'var(--surface)',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      maxWidth: 720,
    }}>
      <Eyebrow>No projects yet</Eyebrow>
      <div className="h-d4">You'll see your projects here when they're live.</div>
      <div className="h-p is-dim">
        Your project director will invite you to the portal once your project is
        set up. If you think this is wrong, contact the team that engaged you.
      </div>
    </div>
  );
}

interface ProjectCardProps {
  project: DesignProject;
  tone: typeof TONE_BY_HASH[number];
  onClick: () => void;
}

function ProjectCard({ project, tone, onClick }: ProjectCardProps) {
  const progress = project.physicalProgress ?? 0;
  const dueDateJs = tsToDate(project.dueDate);
  const dueLabel = dueDateJs
    ? dueDateJs.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  const siteLocation = project.siteLocation?.address ?? project.siteLocation?.city ?? '';

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 16,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
      }}
    >
      <Img tone={tone} h={220} hero>
        <div style={{
          position: 'absolute',
          top: 16, left: 18, right: 18,
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            font: '500 10.5px/1 var(--font-mono)',
            color: 'rgba(255,255,255,0.95)',
            background: 'rgba(20,18,14,0.45)',
            backdropFilter: 'blur(6px)',
            padding: '6px 10px',
            borderRadius: 999,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>Finishes · Fit-out</span>
        </div>
        <div style={{ position: 'absolute', bottom: 22, left: 24, right: 24 }}>
          <div style={{
            font: '600 32px/1.05 var(--font-display)',
            letterSpacing: '-0.025em',
            color: '#fff',
          }}>{project.name}</div>
          <div style={{
            font: '500 12px/1 var(--font-mono)',
            color: 'rgba(255,255,255,0.85)',
            marginTop: 8,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>{siteLocation || project.customerName} · {project.code}</div>
        </div>
      </Img>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <BarLine label={`Progress · ${project.status}`} right={progress + '%'} pct={progress} />
        <Sep />
        <div className="h-grid cols-3" style={{ gap: 16 }}>
          <div>
            <Eyebrow style={{ fontSize: 9.5 }}>Handover</Eyebrow>
            <div style={{ font: '500 13px/1.3 var(--font-sans)', marginTop: 6 }}>{dueLabel}</div>
            <Mono style={{ marginTop: 2 }}>{project.code}</Mono>
          </div>
          <div>
            <Eyebrow style={{ fontSize: 9.5 }}>Status</Eyebrow>
            <div style={{ font: '500 13px/1.3 var(--font-sans)', marginTop: 6, textTransform: 'capitalize' }}>
              {project.status}
            </div>
            <Mono style={{ marginTop: 2 }}>
              {(() => {
                const sd = tsToDate(project.startDate);
                return sd
                  ? `Since ${sd.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
                  : 'New';
              })()}
            </Mono>
          </div>
          <div>
            <Eyebrow style={{ fontSize: 9.5 }}>Client</Eyebrow>
            <div style={{ font: '500 13px/1.3 var(--font-sans)', marginTop: 6 }}>{project.customerName}</div>
            <Mono style={{ marginTop: 2 }}>You</Mono>
          </div>
        </div>
        <Btn primary lg full iconRight="arrow-r">Enter project</Btn>
      </div>
    </div>
  );
}

function DashedRow({ label }: { label: string }) {
  return (
    <div style={{
      flex: 1,
      padding: '18px 22px',
      borderRadius: 12,
      border: '1px dashed var(--line)',
      background: 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      color: 'var(--ink-2)',
      font: '500 13px/1 var(--font-sans)',
      cursor: 'pointer',
    }}>
      <span>{label}</span>
      <Icon name="arrow-r" size={14} />
    </div>
  );
}

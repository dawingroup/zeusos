import type { ReactNode } from 'react';
import { BrowserFrame } from '../components/BrowserFrame';
import { PhoneFrame } from '../components/MobileShell';
import { Img, Eyebrow } from '../components/primitives';

// Re-import the screen "content" components so we can embed them in chrome
import { MobileProjectPickerContent } from './mobile/MobileProjectPickerPage';
import { MobileDashboardContent } from './mobile/MobileDashboardPage';
import { MobileApprovalsContent } from './mobile/MobileApprovalsPage';
import { MobileQuoteDetailContent } from './mobile/MobileQuoteDetailPage';
import { MobileDrawingDetailContent } from './mobile/MobileDrawingDetailPage';

import SignInPage from './SignInPage';
import ProjectPickerPage from './ProjectPickerPage';
import FinishesDashboardPage from './finishes/FinishesDashboardPage';
import FinishesApprovalsPage from './finishes/FinishesApprovalsPage';
import FinishesDrawingPage from './finishes/FinishesDrawingPage';
import FinishesFinancialsPage from './finishes/FinishesFinancialsPage';
import FinishesSchedulePage from './finishes/FinishesSchedulePage';
import AdvisoryDashboardPage from './advisory/AdvisoryDashboardPage';

import '../styles/portal.css';

/**
 * Design-canvas preview — every hi-fi screen at its design dimensions,
 * inside its real device chrome (phone or browser). Useful for review
 * and stakeholder demos.
 */
export default function PortalPreviewPage() {
  return (
    <div className="portal-root portal-canvas" style={{ padding: '60px 60px 80px' }}>
      <Cover />

      <Section title="ZeusOS · Client Portal" subtitle="Hi-fidelity design · editorial · warm paper" />

      <Section title="Mobile · Finishes flow" subtitle="iPhone · Vela Boutique — DIFC">
        <Row>
          <PhoneArtboard label="01 · Project picker" tabActive="home">
            <MobileProjectPickerContent />
          </PhoneArtboard>
          <PhoneArtboard label="02 · Dashboard" tabActive="home">
            <MobileDashboardContent />
          </PhoneArtboard>
          <PhoneArtboard label="03 · Approvals" tabActive="approvals">
            <MobileApprovalsContent />
          </PhoneArtboard>
          <PhoneArtboard label="04 · Quote detail" tabbar={false}>
            <MobileQuoteDetailContent />
          </PhoneArtboard>
          <PhoneArtboard label="05 · Shop drawing" tabbar={false}>
            <MobileDrawingDetailContent />
          </PhoneArtboard>
        </Row>
      </Section>

      <Section title="Web · Entry" subtitle="Sign in & project picker">
        <Row>
          <BrowserArtboard label="06 · Sign in (web)" url="portal.dawinos.com / sign-in">
            <ScreenInChrome><SignInPage /></ScreenInChrome>
          </BrowserArtboard>
          <BrowserArtboard label="07 · Project picker (web)" url="portal.dawinos.com / projects">
            <ScreenInChrome><ProjectPickerPage /></ScreenInChrome>
          </BrowserArtboard>
        </Row>
      </Section>

      <Section title="Web · Finishes · Vela Boutique" subtitle="Same flows, desktop density">
        <Row>
          <BrowserArtboard label="08 · Dashboard" url="portal.dawinos.com / naqaa / vela-difc / dashboard">
            <ScreenInChrome><FinishesDashboardPage /></ScreenInChrome>
          </BrowserArtboard>
          <BrowserArtboard label="09 · Approvals (inbox split)" url="portal.dawinos.com / naqaa / vela-difc / approvals">
            <ScreenInChrome><FinishesApprovalsPage /></ScreenInChrome>
          </BrowserArtboard>
          <BrowserArtboard label="10 · Shop drawing (approve)" url="portal.dawinos.com / naqaa / vela-difc / drawings / sd-104">
            <ScreenInChrome><FinishesDrawingPage /></ScreenInChrome>
          </BrowserArtboard>
          <BrowserArtboard label="11 · Financials" url="portal.dawinos.com / naqaa / vela-difc / financials">
            <ScreenInChrome><FinishesFinancialsPage /></ScreenInChrome>
          </BrowserArtboard>
          <BrowserArtboard label="12 · Schedule (gantt)" url="portal.dawinos.com / naqaa / vela-difc / schedule">
            <ScreenInChrome><FinishesSchedulePage /></ScreenInChrome>
          </BrowserArtboard>
        </Row>
      </Section>

      <Section title="Web · Advisory · Naqaa Retail Rollout" subtitle="Programme governance density">
        <Row>
          <BrowserArtboard label="13 · Advisory dashboard" url="portal.dawinos.com / naqaa / advisory">
            <ScreenInChrome><AdvisoryDashboardPage /></ScreenInChrome>
          </BrowserArtboard>
        </Row>
      </Section>
    </div>
  );
}

// ── Layout helpers ──────────────────────────────────────

function Cover() {
  return (
    <div style={{
      width: 1320, maxWidth: '100%',
      background: 'var(--paper)',
      borderRadius: 14,
      border: '1px solid var(--line)',
      padding: '52px 64px',
      display: 'grid',
      gridTemplateColumns: '1.4fr 1fr',
      gap: 40,
      overflow: 'hidden',
      marginBottom: 80,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <Eyebrow style={{ letterSpacing: '0.18em' }}>ZeusOS · Client Portal</Eyebrow>
          <div className="h-d1" style={{ marginTop: 14, maxWidth: 720 }}>
            Every approval, drawing<br />
            &amp; payment <span style={{ color: 'var(--ink-2)', fontStyle: 'italic' }}>— in one place.</span>
          </div>
          <div className="h-p is-dim is-lg" style={{ marginTop: 22, maxWidth: 580 }}>
            Hi-fidelity design system for the client portal — covering Finishes fit-out and Advisory retail rollouts.
            Mobile and web. One signal color, used only for items that need a client signature.
          </div>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 24,
          paddingTop: 24,
          borderTop: '1px solid var(--line)',
        }}>
          <div>
            <Eyebrow>Scope</Eyebrow>
            <div style={{ font: '500 14px/1.4 var(--font-sans)', marginTop: 6 }}>
              13 hero screens<br />
              <span style={{ color: 'var(--ink-2)' }}>Mobile + web · 2 flows</span>
            </div>
          </div>
          <div>
            <Eyebrow>Type</Eyebrow>
            <div style={{ font: '500 14px/1.4 var(--font-sans)', marginTop: 6 }}>
              Outfit · Geist Mono<br />
              <span style={{ color: 'var(--ink-2)' }}>Editorial scale</span>
            </div>
          </div>
          <div>
            <Eyebrow>Palette</Eyebrow>
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              <Swatch color="var(--paper)" border />
              <Swatch color="var(--paper-2)" />
              <Swatch color="var(--paper-3)" />
              <Swatch color="var(--ink-2)" />
              <Swatch color="var(--ink)" />
              <Swatch color="var(--signal)" />
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'stretch', gap: 12 }}>
        <Img tone="interior-warm" hero style={{ flex: 1.6, borderRadius: 14 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Img tone="stone" style={{ flex: 1, borderRadius: 14 }} />
          <Img tone="render" hero style={{ flex: 1, borderRadius: 14 }} />
        </div>
      </div>
    </div>
  );
}

function Swatch({ color, border }: { color: string; border?: boolean }) {
  return (
    <div style={{
      width: 22, height: 22, borderRadius: 4,
      background: color,
      border: border ? '1px solid var(--line)' : undefined,
    }} />
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <div style={{ marginBottom: 80 }}>
      <div style={{ marginBottom: 32, borderBottom: '1px solid var(--line)', paddingBottom: 16, maxWidth: 1320 }}>
        <Eyebrow>{title}</Eyebrow>
        <div style={{ font: '600 24px/1.15 var(--font-display)', marginTop: 6 }}>{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '64px 48px',
      paddingTop: 32,
    }}>{children}</div>
  );
}

function PhoneArtboard({
  label, tabActive, tabbar = true, children,
}: {
  label: string;
  tabActive?: any;
  tabbar?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <PhoneFrame label={label} tabActive={tabActive} tabbar={tabbar}>
        {children}
      </PhoneFrame>
    </div>
  );
}

function BrowserArtboard({
  label, url, children,
}: { label: string; url: string; children: ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <BrowserFrame label={label} url={url}>
        {children}
      </BrowserFrame>
    </div>
  );
}

/**
 * Wraps a real portal page inside the browser-frame artboard. We strip the
 * outer .portal-root + min-height from the page so it lays out properly
 * inside the fixed-height browser frame.
 */
function ScreenInChrome({ children }: { children: ReactNode }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

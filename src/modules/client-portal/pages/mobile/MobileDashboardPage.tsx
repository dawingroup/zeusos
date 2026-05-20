import { MobileNav } from '../../components/MobileShell';
import {
  Btn, Card, BarLine, Sep, Dial, Img, SignalLine, Row, Section, Eyebrow, Mono,
} from '../../components/primitives';
import { Icon } from '../../components/Icon';
import '../../styles/portal.css';

export default function MobileDashboardPage() {
  return (
    <div className="portal-root" style={{ minHeight: '100vh' }}>
      <MobileDashboardContent />
    </div>
  );
}

export function MobileDashboardContent() {
  return (
    <>
      <MobileNav
        title="Vela Boutique"
        sub="FIN · 2026 · 014"
        right={<>
          <div className="h-iconbtn"><Icon name="search" size={16} /></div>
          <div className="h-mtopnav-avatar" />
        </>}
      />

      <div className="h-screen">
        <Card signal>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <SignalLine>3 items need your signoff</SignalLine>
            <Mono style={{ color: 'var(--signal)' }}>Avg 1.4d</Mono>
          </div>
          <div style={{ font: '600 17px/1.3 var(--font-sans)', letterSpacing: '-0.015em' }}>
            Q-019 v2 · SD-104 Rev C · Lighting finish
          </div>
          <div className="h-p is-dim" style={{ fontSize: 12.5 }}>
            Open approvals are gating joinery install on 22 May.
          </div>
          <Btn signal full iconRight="arrow-r">Review 3 approvals</Btn>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Eyebrow>Overall progress</Eyebrow>
              <div className="h-d2" style={{ fontSize: 38, marginTop: 6 }}>62%</div>
              <Mono>Wk 14 of 22 · on schedule</Mono>
            </div>
            <Dial pct={62} size={86} />
          </div>
          <Sep />
          <BarLine label="Design" right="Sealed" pct={100} />
          <BarLine label="Procurement" right="94%" pct={94} />
          <BarLine label="Construction" right="58%" pct={58} />
          <BarLine label="Snagging & handover" right="Wk 21" pct={0} />
        </Card>

        <Section title="Up next" action="Schedule →">
          <Card>
            <Row title="Joinery install" sub="22 May · 4 days on site" right="Wk 15" />
            <Row title="Stone arrival on site" sub="26 May · supplier ETA" right="Wk 15" />
            <Row title="MEP first fix complete" sub="2 Jun · inspection" right="Wk 17" />
          </Card>
        </Section>

        <Section title="Financials" action="View all →">
          <div className="h-grid cols-3" style={{ gap: 8 }}>
            <Card style={{ padding: 12, gap: 4 }}>
              <Eyebrow style={{ fontSize: 9.5 }}>Contract</Eyebrow>
              <div style={{ font: '600 16px/1 var(--font-display)', letterSpacing: '-0.02em' }}>2.84Bn</div>
              <Mono style={{ fontSize: 10 }}>UGX</Mono>
            </Card>
            <Card style={{ padding: 12, gap: 4 }}>
              <Eyebrow style={{ fontSize: 9.5 }}>Paid</Eyebrow>
              <div style={{ font: '600 16px/1 var(--font-display)', letterSpacing: '-0.02em' }}>1.45M</div>
              <Mono style={{ fontSize: 10 }}>51% paid</Mono>
            </Card>
            <Card style={{
              padding: 12, gap: 4,
              background: 'var(--signal-bg)',
              border: '1px solid var(--signal-tint)',
            }}>
              <Eyebrow style={{ fontSize: 9.5, color: 'var(--signal)' }}>Open</Eyebrow>
              <div style={{
                font: '600 16px/1 var(--font-display)',
                letterSpacing: '-0.02em',
                color: 'var(--signal)',
              }}>312K</div>
              <Mono style={{ fontSize: 10, color: 'var(--signal)' }}>Due 22 May</Mono>
            </Card>
          </div>
        </Section>

        <Section title="Latest from site" action="Reports →">
          <div className="h-grid cols-3" style={{ gap: 6 }}>
            <Img tone="site" h={92} ratio="1 / 1" />
            <Img tone="interior-warm" h={92} ratio="1 / 1" />
            <Img tone="fabric" h={92} ratio="1 / 1" />
          </div>
        </Section>
      </div>
    </>
  );
}

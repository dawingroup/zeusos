import { MobileNav } from '../../components/MobileShell';
import { Btn, Card, Row, Section, Eyebrow, Mono } from '../../components/primitives';
import { Icon } from '../../components/Icon';
import '../../styles/portal.css';

export default function MobileApprovalsPage() {
  return (
    <div className="portal-root" style={{ minHeight: '100vh' }}>
      <MobileApprovalsContent />
    </div>
  );
}

export function MobileApprovalsContent() {
  return (
    <>
      <MobileNav
        title="Approvals"
        sub="3 awaiting · 14 history"
        right={<div className="h-iconbtn"><Icon name="search" size={16} /></div>}
      />

      <div className="h-screen">
        <div className="h-segment">
          <div className="h-segment-i is-on">Awaiting you · 3</div>
          <div className="h-segment-i">Team · 2</div>
          <div className="h-segment-i">History</div>
        </div>

        <Card signal>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Eyebrow signal>Quotation · Q-019 v2</Eyebrow>
            <Mono style={{ fontSize: 11 }}>Due 16 May</Mono>
          </div>
          <div style={{ font: '600 17px/1.3 var(--font-sans)', letterSpacing: '-0.015em' }}>
            Stone variation — Calacatta upgrade
          </div>
          <div className="h-p is-dim" style={{ fontSize: 12.5 }}>
            Revised after client request for slab thickness.{' '}
            <span style={{ color: 'var(--signal)', fontWeight: 500 }}>Δ +UGX 42.8M</span> vs. v1.
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <div>
              <Eyebrow style={{ fontSize: 9.5 }}>Total · UGX</Eyebrow>
              <div style={{ font: '600 22px/1 var(--font-display)', letterSpacing: '-0.025em', marginTop: 4 }}>184.3M</div>
            </div>
            <Btn signal sm iconRight="arrow-r">Review</Btn>
          </div>
        </Card>

        <Card signal>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Eyebrow signal>Shop drawing · SD-104</Eyebrow>
            <Mono style={{ fontSize: 11 }}>Due 18 May</Mono>
          </div>
          <div style={{ font: '600 17px/1.3 var(--font-sans)', letterSpacing: '-0.015em' }}>
            Cashwrap joinery — Rev C
          </div>
          <div className="h-p is-dim" style={{ fontSize: 12.5 }}>
            Updated with veneer direction per 8 May site visit.
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <Mono style={{ color: 'var(--ink-3)' }}>4 sheets · 3 pins</Mono>
            <Btn signal sm iconRight="arrow-r">Review</Btn>
          </div>
        </Card>

        <Card signal>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Eyebrow signal>FF&amp;E · Lighting</Eyebrow>
            <Mono style={{ fontSize: 11 }}>Due 20 May</Mono>
          </div>
          <div style={{ font: '600 17px/1.3 var(--font-sans)', letterSpacing: '-0.015em' }}>
            Track-head finish — bronze or black
          </div>
          <div className="h-p is-dim" style={{ fontSize: 12.5 }}>
            Pick one. Affects 28 fixtures in zones A &amp; C.
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <div style={{
              flex: 1, height: 38, borderRadius: 8,
              background: 'linear-gradient(135deg, #b08e62 0%, #6a5234 100%)',
              border: '1px solid var(--line)',
              display: 'flex', alignItems: 'flex-end', padding: '6px 8px',
            }}>
              <span style={{
                font: '500 10px/1 var(--font-mono)',
                color: '#fff',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>Bronze</span>
            </div>
            <div style={{
              flex: 1, height: 38, borderRadius: 8,
              background: 'linear-gradient(135deg, #3a3530 0%, #18171a 100%)',
              border: '1px solid var(--line)',
              display: 'flex', alignItems: 'flex-end', padding: '6px 8px',
            }}>
              <span style={{
                font: '500 10px/1 var(--font-mono)',
                color: '#fff',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>Black</span>
            </div>
            <Btn signal sm>Review</Btn>
          </div>
        </Card>

        <Section title="Recently signed">
          <Card>
            <Row icon="check" title="Q-017 · MEP package" sub="Signed 8 May · UGX 412M" right={<Icon name="arrow-r" size={14} color="var(--ink-3)" />} />
            <Row icon="check" title="SD-099 · Storefront" sub="Signed 6 May · Rev B" right={<Icon name="arrow-r" size={14} color="var(--ink-3)" />} />
            <Row icon="check" title="Material board · Phase 1" sub="Signed 30 Apr" right={<Icon name="arrow-r" size={14} color="var(--ink-3)" />} />
          </Card>
        </Section>
      </div>
    </>
  );
}

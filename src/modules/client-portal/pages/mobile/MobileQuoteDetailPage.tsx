import { MobileNav } from '../../components/MobileShell';
import { Btn, Img, Row, Section, Sep, Eyebrow, Mono } from '../../components/primitives';
import { Icon } from '../../components/Icon';
import '../../styles/portal.css';

export default function MobileQuoteDetailPage() {
  return (
    <div className="portal-root" style={{ minHeight: '100vh' }}>
      <MobileQuoteDetailContent />
    </div>
  );
}

export function MobileQuoteDetailContent() {
  return (
    <>
      <MobileNav
        back
        title="Q-019 v2"
        sub="Stone variation · Phase 3"
        right={<div className="h-iconbtn"><Icon name="more" size={16} /></div>}
      />

      <div className="h-screen" style={{ paddingBottom: 0, gap: 14 }}>
        <div>
          <Eyebrow signal>Signoff required · issued 9 May</Eyebrow>
          <div style={{
            font: '600 56px/0.95 var(--font-display)',
            letterSpacing: '-0.04em',
            marginTop: 10,
            fontFeatureSettings: '"tnum" 1',
          }}>184,250</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
            <Mono style={{ fontSize: 12 }}>UGX · Total</Mono>
            <Mono style={{ fontSize: 12, color: 'var(--signal)' }}>+42,800 vs v1</Mono>
          </div>
          <Mono style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4, display: 'block' }}>
            ≈ USD 49.8K @ 3,700
          </Mono>
        </div>

        <Sep />

        <Section title="Line items">
          <Row title="Calacatta Borghini slab 20mm" sub="Italy · 18.4 m² · book-matched" right="96.4M" rightSub="UGX" />
          <Row title="Edge polishing & cuts" sub="Workshop · 4 days" right="28.3M" rightSub="UGX" />
          <Row title="Templating & install" sub="On site · 3 days" right="41.2M" rightSub="UGX" />
          <Row title="Sealing & maintenance kit" right="18.4M" rightSub="UGX" />
        </Section>

        <Section title="Attachments">
          <div className="h-card is-flush">
            <Img tone="stone" h={140} label="Spec sheet · slab.pdf · 4 pages" />
          </div>
          <div className="h-grid cols-3" style={{ gap: 6 }}>
            <Img tone="stone" h={68} ratio="1 / 1" />
            <Img tone="fabric" h={68} ratio="1 / 1" />
            <Img tone="interior" h={68} ratio="1 / 1" />
          </div>
        </Section>

        <div style={{
          marginTop: 'auto',
          padding: '14px 0 20px',
          borderTop: '1px solid var(--line)',
          background: 'var(--paper)',
          display: 'flex',
          gap: 8,
        }}>
          <Btn sm>Reject</Btn>
          <Btn sm>Comment</Btn>
          <Btn signal style={{ marginLeft: 'auto', flex: 1 }}>Sign &amp; approve</Btn>
        </div>
      </div>
    </>
  );
}

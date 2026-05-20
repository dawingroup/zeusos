import { MobileNav } from '../../components/MobileShell';
import { Btn, Card, Row, Section, Chip, Eyebrow, Mono } from '../../components/primitives';
import { DrawingViewer } from '../../components/DrawingViewer';
import { Icon } from '../../components/Icon';
import '../../styles/portal.css';

export default function MobileDrawingDetailPage() {
  return (
    <div className="portal-root" style={{ minHeight: '100vh' }}>
      <MobileDrawingDetailContent />
    </div>
  );
}

export function MobileDrawingDetailContent() {
  return (
    <>
      <MobileNav
        back
        title="SD-104 · Rev C"
        sub="Cashwrap joinery"
        right={<div className="h-iconbtn"><Icon name="more" size={16} /></div>}
      />

      <div className="h-screen" style={{ paddingBottom: 0, gap: 14 }}>
        <div style={{
          height: 240,
          borderRadius: 12,
          border: '1px solid var(--line)',
          background: 'var(--paper-2)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <DrawingViewer
            kind="elevation"
            h={240}
            pins={[
              { n: 1, x: 28, y: 36 },
              { n: 2, x: 58, y: 52, signal: true },
              { n: 3, x: 72, y: 70 },
            ]}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <Chip quiet>Plan</Chip>
            <Chip active>Elev. A</Chip>
            <Chip quiet>Elev. B</Chip>
            <Chip quiet>Sect.</Chip>
          </div>
          <Mono style={{ fontSize: 11, color: 'var(--ink-3)' }}>2 of 4</Mono>
        </div>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Eyebrow>Revision · C</Eyebrow>
            <Mono style={{ fontSize: 11 }}>3 pins</Mono>
          </div>
          <div className="h-p" style={{ fontSize: 13 }}>
            Veneer now runs vertically on front face per client direction.
            Cable tray detail updated to suit POS unit footprint.
          </div>
        </Card>

        <Section title="Open comments">
          <Card>
            <Row title="① Grain match between panels" sub="D. Wahab · 9 May" right={<Icon name="comment" size={14} color="var(--ink-3)" />} />
            <Row attn title="② Confirm POS cable cut-out" sub="You · 8 May · 2 replies" right={<Icon name="arrow-r" size={14} color="var(--ink-3)" />} />
            <Row title="③ Plinth height" sub="M. Othmani · 7 May" right={<Icon name="comment" size={14} color="var(--ink-3)" />} />
          </Card>
        </Section>

        <div style={{
          marginTop: 'auto',
          padding: '14px 0 20px',
          borderTop: '1px solid var(--line)',
          background: 'var(--paper)',
          display: 'flex',
          gap: 8,
        }}>
          <Btn sm icon="pin">Pin</Btn>
          <Btn sm>Changes</Btn>
          <Btn signal style={{ marginLeft: 'auto', flex: 1 }}>Sign Rev C</Btn>
        </div>
      </div>
    </>
  );
}

import { useNavigate } from 'react-router-dom';
import {
  Card, Chip, Bar, BarLine, Sep, Img, Eyebrow, Mono,
} from '../../components/primitives';
import { Icon } from '../../components/Icon';
import { VELA_PROJECT, NAQAA_PROJECT } from '../../fixtures/projects';
import '../../styles/portal.css';

export default function MobileProjectPickerPage() {
  const navigate = useNavigate();
  return (
    <div className="portal-root" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <MobileProjectPickerContent
        onSelectFinishes={() => navigate(`/portal/p/${VELA_PROJECT.slug}/dashboard`)}
        onSelectAdvisory={() => navigate(`/portal/p/${NAQAA_PROJECT.slug}/dashboard`)}
      />
    </div>
  );
}

export function MobileProjectPickerContent({ onSelectFinishes, onSelectAdvisory }: {
  onSelectFinishes?: () => void;
  onSelectAdvisory?: () => void;
}) {
  return (
    <>
      <div className="h-mtopnav" style={{ paddingTop: 12, paddingBottom: 10 }}>
        <div className="h-mtopnav-l">
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--ink)', color: 'var(--paper)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            font: '600 14px/1 var(--font-display)', letterSpacing: '-0.02em',
          }}>D</div>
          <div>
            <div className="h-mtopnav-t" style={{ fontSize: 15 }}>Selina Saleh</div>
            <div className="h-mtopnav-s">Naqaa Holding</div>
          </div>
        </div>
        <div className="h-iconbtn has-dot"><Icon name="bell" size={16} /></div>
      </div>

      <div className="h-screen">
        <div style={{ marginTop: 4 }}>
          <Eyebrow>Your projects · 2 active</Eyebrow>
          <div className="h-d3" style={{ marginTop: 8, lineHeight: 1.05 }}>
            Good morning.<br />
            <span style={{ color: 'var(--ink-2)' }}>4 things need you.</span>
          </div>
        </div>

        <Card flush style={{ overflow: 'hidden', cursor: 'pointer' }} onClick={onSelectFinishes}>
          <Img tone="interior-warm" h={150} hero>
            <div style={{
              position: 'absolute', top: 12, left: 14, right: 14,
              display: 'flex', justifyContent: 'space-between',
            }}>
              <Chip outline style={{ background: 'rgba(250,250,247,0.85)' }}>Finishes · Fit-out</Chip>
              <span className="h-badge">3</span>
            </div>
            <div style={{ position: 'absolute', bottom: 14, left: 16, right: 16 }}>
              <div style={{ font: '600 22px/1.1 var(--font-display)', letterSpacing: '-0.02em', color: '#fff' }}>
                Vela Boutique
              </div>
              <div style={{
                font: '500 11px/1 var(--font-mono)',
                color: 'rgba(255,255,255,0.85)',
                marginTop: 6,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>DIFC · 412 m²</div>
            </div>
          </Img>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Eyebrow>Construction · Wk 14 of 22</Eyebrow>
              <Mono style={{ font: '500 13px/1.3 var(--font-mono)', color: 'var(--ink)' }}>62%</Mono>
            </div>
            <Bar pct={62} thick />
            <Sep style={{ marginTop: 4 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Eyebrow style={{ fontSize: 9.5 }}>Next milestone</Eyebrow>
                <div style={{ font: '500 13px/1.2 var(--font-sans)', marginTop: 4 }}>Joinery install</div>
                <Mono style={{ marginTop: 2 }}>22 May · 4 days</Mono>
              </div>
              <div className="h-iconbtn" style={{ background: 'var(--ink)', color: 'var(--paper)', border: 0 }}>
                <Icon name="arrow-r" size={16} />
              </div>
            </div>
          </div>
        </Card>

        <Card flush style={{ overflow: 'hidden', cursor: 'pointer' }} onClick={onSelectAdvisory}>
          <Img tone="render-2" h={120} hero>
            <div style={{
              position: 'absolute', top: 12, left: 14, right: 14,
              display: 'flex', justifyContent: 'space-between',
            }}>
              <Chip outline style={{ background: 'rgba(250,250,247,0.85)' }}>Advisory · Retail rollout</Chip>
              <span className="h-badge">1</span>
            </div>
            <div style={{ position: 'absolute', bottom: 14, left: 16, right: 16 }}>
              <div style={{ font: '600 19px/1.1 var(--font-display)', letterSpacing: '-0.02em', color: '#fff' }}>
                Naqaa Retail Rollout 2026
              </div>
              <div style={{
                font: '500 11px/1 var(--font-mono)',
                color: 'rgba(255,255,255,0.85)',
                marginTop: 6,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>14 stores · KSA + UAE</div>
            </div>
          </Img>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <BarLine label="Implementation · Phase 2 of 5" right="28%" pct={28} />
            <Sep style={{ marginTop: 2 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Mono>Next · BOQ pack v3 · 16 May</Mono>
              <Icon name="arrow-r" size={16} color="var(--ink-2)" />
            </div>
          </div>
        </Card>

        <div style={{ marginTop: 'auto', textAlign: 'center', padding: '8px 0' }}>
          <Mono style={{ color: 'var(--ink-3)' }}>+ Archived · 3</Mono>
        </div>
      </div>
    </>
  );
}

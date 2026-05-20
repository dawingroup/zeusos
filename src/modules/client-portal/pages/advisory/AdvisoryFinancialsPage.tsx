import { PortalShell, PageHead } from '../../components/DesktopShell';
import {
  Btn, Pane, Stat, Card, Chip, Sep, BarLine, SignalLine, Eyebrow,
} from '../../components/primitives';
import { Tbl, Cell, CellNum, Tabs } from '../../components/Table';
import { NAQAA_PROJECT } from '../../fixtures/projects';
import '../../styles/portal.css';

export default function AdvisoryFinancialsPage() {
  return (
    <div className="portal-root">
      <PortalShell
        project={NAQAA_PROJECT}
        crumbs={['Advisory', 'Financials']}
        title="Programme financials"
        actions={
          <>
            <Btn sm icon="download">Capex report</Btn>
            <Btn sm>Export CSV</Btn>
          </>
        }
      >
        <PageHead
          eyebrow="All amounts in UGX · USD ref @ 3,700 · capex"
          title="Programme value UGX 45.9Bn"
          sub="14 stores · 4 phases · 39% committed to date · forecast UGX 45.6Bn at completion"
        />

        <div className="h-grid cols-4" style={{ gap: 14 }}>
          <Stat label="Programme budget" value="45.9Bn" sub="UGX · capex" />
          <Stat label="Committed" value="17.8Bn" sub="39% · POs out" />
          <Stat label="Paid to date" value="9.2Bn" sub="20% · invoices settled" />
          <Stat label="Forecast at completion" value="45.6Bn" sub="−0.7% vs baseline" signal />
        </div>

        <Tabs items={[
          { l: 'Capex profile', on: true },
          { l: 'Cost variance', c: 4 },
          { l: 'Invoices', c: 18 },
          { l: 'Vendor lock', c: 22 },
          { l: 'Currency · UGX' },
        ]} />

        <div className="h-grid cols-3-2" style={{ gap: 16 }}>
          <Pane title="Capex by phase" flush>
            <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <BarLine label="Phase 1 · Design (sealed)" right="UGX 1.8Bn · 100%" pct={100} />
              <BarLine label="Phase 2 · Implementation · 5 stores" right="UGX 12.4Bn · 58%" pct={58} />
              <BarLine label="Phase 3 · Rollout · 9 stores" right="UGX 28.2Bn · 12%" pct={12} />
              <BarLine label="Phase 4 · Operations handover" right="UGX 3.5Bn · 0%" pct={0} />
              <Sep />
              <Tbl
                cols={[
                  { l: 'Phase', w: '2fr' },
                  { l: 'Budget', w: '1fr', a: 'right' },
                  { l: 'Committed', w: '1fr', a: 'right' },
                  { l: 'Forecast', w: '1fr', a: 'right' },
                  { l: 'Variance', w: '100px', a: 'right' },
                ]}
                rows={[
                  { cells: [<Cell t="Phase 1 · Design" s="Sealed Wk 8" />, <CellNum>1,820,000</CellNum>, <CellNum>1,820,000</CellNum>, <CellNum>1,820,000</CellNum>, <Chip>0%</Chip>] },
                  { cells: [<Cell t="Phase 2 · Implementation" s="5 stores · live" />, <CellNum>12,400,000</CellNum>, <CellNum>7,250,000</CellNum>, <CellNum>12,310,000</CellNum>, <Chip>−0.7%</Chip>] },
                  { cells: [<Cell t="Phase 3 · Rollout" s="9 stores · BOQ approval" />, <CellNum>28,180,000</CellNum>, <CellNum>3,420,000</CellNum>, <CellNum>27,920,000</CellNum>, <Chip>−0.9%</Chip>] },
                  { dim: true, cells: [<Cell t="Phase 4 · Operations handover" s="Pending" />, <CellNum>3,500,000</CellNum>, <CellNum>—</CellNum>, <CellNum>3,500,000</CellNum>, <Chip>—</Chip>] },
                ]}
              />
            </div>
          </Pane>

          <Pane title="Latest invoice" action="Pay →">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <SignalLine>Open · due 24 May</SignalLine>
              <div className="h-d4" style={{ marginTop: 4 }}>INV-018</div>
              <div className="h-p is-dim" style={{ fontSize: 12.5 }}>
                Phase 2 advisory fee · April milestone
              </div>
            </div>
            <Sep />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="h-p">Advisory fee · April</span>
              <span className="h-num">320,000</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="h-p is-dim">Vendor pass-through</span>
              <span className="h-num" style={{ color: 'var(--ink-2)' }}>184,200</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="h-p is-dim">VAT 5%</span>
              <span className="h-num" style={{ color: 'var(--ink-2)' }}>25,210</span>
            </div>
            <Sep />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ font: '600 14px/1 var(--font-sans)' }}>Total UGX</span>
              <span className="h-bignum" style={{ fontSize: 30 }}>529.4M</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <Btn sm full icon="download">View PDF</Btn>
              <Btn signal sm full iconRight="check">Mark as paid</Btn>
            </div>
          </Pane>
        </div>

        <Pane title="Per-store capex roll-up" action="14 stores · UGX 45.9Bn" flush>
          <Tbl
            cols={[
              { l: 'Store', w: '2fr' },
              { l: 'Region', w: '80px' },
              { l: 'Budget', w: '120px', a: 'right' },
              { l: 'Committed', w: '120px', a: 'right' },
              { l: 'Spent', w: '120px', a: 'right' },
              { l: 'Status', w: '120px', a: 'right' },
            ]}
            rows={[
              { cells: [<Cell t="Naqaa-01 · Dubai Mall" s="Flagship · 312 m²" />, 'UAE', <CellNum>3,840,000</CellNum>, <CellNum>3,840,000</CellNum>, <CellNum>3,720,000</CellNum>, <Chip>Live</Chip>] },
              { cells: [<Cell t="Naqaa-02 · Mall of Emirates" s="Standard · 224 m²" />, 'UAE', <CellNum>2,460,000</CellNum>, <CellNum>2,460,000</CellNum>, <CellNum>2,310,000</CellNum>, <Chip>Live</Chip>] },
              { cells: [<Cell t="Naqaa-03 · Riyadh Park" s="Standard · 240 m²" />, 'KSA', <CellNum>2,610,000</CellNum>, <CellNum>2,610,000</CellNum>, <CellNum>2,490,000</CellNum>, <Chip>Live</Chip>] },
              { cells: [<Cell t="Naqaa-04 · The Avenues" s="Standard · 198 m²" />, 'KSA', <CellNum>2,180,000</CellNum>, <CellNum>1,920,000</CellNum>, <CellNum>820,000</CellNum>,   <Chip>Fit-out</Chip>] },
              { cells: [<Cell t="Naqaa-05 · Yas Mall" s="Standard · 264 m²" />, 'UAE', <CellNum>2,840,000</CellNum>, <CellNum>2,160,000</CellNum>, <CellNum>420,000</CellNum>,   <Chip>Fit-out</Chip>] },
              { signal: true, cells: [<Cell t="Naqaa-08 · Riyadh Front" s="Flagship · 380 m²" />, 'KSA', <CellNum>3,940,000</CellNum>, <CellNum>0</CellNum>, <CellNum>—</CellNum>,             <Chip signal>BOQ approval</Chip>] },
              { signal: true, cells: [<Cell t="Naqaa-09 · Red Sea Mall" s="Standard · 218 m²" />, 'KSA', <CellNum>2,870,000</CellNum>, <CellNum>0</CellNum>, <CellNum>—</CellNum>,             <Chip signal>BOQ approval</Chip>] },
              { dim: true, cells: [<Cell t="Naqaa-10 to 14" s="5 stores · schematic" />, 'Mixed', <CellNum>25,160,000</CellNum>, <CellNum>—</CellNum>, <CellNum>—</CellNum>, <Chip>Pending</Chip>] },
            ]}
          />
        </Pane>

        <div className="h-grid cols-2" style={{ gap: 16 }}>
          <Card>
            <Eyebrow>Cost variance vs BOQ baseline</Eyebrow>
            <BarLine label="Joinery & millwork" right="−1.2%" pct={48} />
            <BarLine label="Lighting" right="+0.4%" pct={52} />
            <BarLine label="MEP" right="−0.8%" pct={47} />
            <BarLine label="Stone & flooring" right="−1.4%" pct={47} />
            <BarLine label="FF&E" right="+0.6%" pct={53} />
            <Sep />
            <div className="h-p is-dim" style={{ fontSize: 12.5 }}>
              Net programme variance: <strong style={{ color: 'var(--ink)' }}>−0.8% vs BOQ</strong>.
              Driven by joinery and stone consolidation across stores 04–07.
            </div>
          </Card>

          <Card>
            <Eyebrow>Vendor lock summary</Eyebrow>
            <Tbl
              cols={[
                { l: 'Vendor', w: '2fr' },
                { l: 'Lock', w: '1fr' },
                { l: 'Expires', w: '120px', a: 'right' },
              ]}
              rows={[
                { cells: [<Cell t="Falcon · KSA" s="Joinery rollout" />, '14 days', <CellNum>23 May</CellNum>] },
                { cells: [<Cell t="Vibia ME" s="Lighting" />, '14 days', <CellNum>23 May</CellNum>] },
                { cells: [<Cell t="Marmi Bruno" s="Stone" />, '14 days', <CellNum>20 May</CellNum>] },
                { cells: [<Cell t="Kvadrat" s="Fabric · soft" />, '30 days', <CellNum>4 Jun</CellNum>] },
              ]}
            />
          </Card>
        </div>
      </PortalShell>
    </div>
  );
}

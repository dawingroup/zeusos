import { PortalShell, PageHead } from '../../components/DesktopShell';
import {
  Btn, Pane, Stat, Card, Chip, Sep, BarLine, Eyebrow, Mono, Row, SignalLine,
} from '../../components/primitives';
import { Tbl, Cell, CellNum, Tabs } from '../../components/Table';
import { Gantt } from '../../components/Gantt';
import { NAQAA_PROJECT } from '../../fixtures/projects';
import '../../styles/portal.css';

export default function AdvisoryImplementationPage() {
  return (
    <div className="portal-root">
      <PortalShell
        project={NAQAA_PROJECT}
        crumbs={['Advisory', 'Implementation']}
        title="Implementation"
        actions={
          <>
            <Btn sm>Baseline view</Btn>
            <Btn sm icon="download">Programme PDF</Btn>
          </>
        }
      >
        <PageHead
          eyebrow="Phase 2 of 5 · weeks 9–18 · 14-store rollout"
          title="3 live · 2 in fit-out · 9 ahead"
          sub="Phase 2 implementation is on track. Phase 3 release gated by BOQ pack v3 signoff (Naqaa-08, 09)."
        />

        <div className="h-grid cols-4" style={{ gap: 14 }}>
          <Stat label="Phase progress" value="28%" sub="Weeks 9 of 18" />
          <Stat label="Live stores" value="3 of 14" sub="21% · revenue active" />
          <Stat label="Fit-out" value="2" sub="Avenues · Yas Mall" />
          <Stat label="Critical path" value="BOQ pack v3" sub="Gates Phase 3" signal />
        </div>

        <Tabs items={[
          { l: 'Phase view', on: true },
          { l: 'Store grid', c: 14 },
          { l: 'Stage gates', c: 5 },
          { l: 'RAG status' },
        ]} />

        <Pane title="Phase 2 programme · 14 stores" action="Week 14 · today" flush>
          <Gantt
            cols={['W9', 'W10', 'W11', 'W12', 'W13', 'W14', 'W15', 'W16', 'W17', 'W18']}
            todayPct={50}
            rows={[
              { t: 'Naqaa-01 · Dubai Mall',    s: 'Live · 14 Feb',  start: 0,  end: 12, pct: 100, label: 'Live' },
              { t: 'Naqaa-02 · Mall of Emirates', s: 'Live · 28 Mar', start: 0, end: 30, pct: 100, label: 'Live' },
              { t: 'Naqaa-03 · Riyadh Park',   s: 'Live · 22 Apr',  start: 0,  end: 46, pct: 100, label: 'Live' },
              { t: 'Naqaa-04 · The Avenues',   s: 'Fit-out · Wk 6', start: 30, end: 70, pct: 60 },
              { t: 'Naqaa-05 · Yas Mall',      s: 'Fit-out · Wk 2', start: 40, end: 82, pct: 22 },
              { t: 'Naqaa-06 · Riyadh Gallery',s: 'Procurement',    start: 50, end: 92, pct: 0 },
              { t: 'Naqaa-07 · Dubai Hills',   s: 'Procurement',    start: 50, end: 96, pct: 0 },
              { t: 'Naqaa-08 · Riyadh Front',  s: 'BOQ approval',   start: 56, end: 100, pct: 0, signal: true, label: 'Gated by BOQ v3' },
              { t: 'Naqaa-09 · Red Sea Mall',  s: 'BOQ approval',   start: 60, end: 100, pct: 0, signal: true, label: 'Gated by BOQ v3' },
            ]}
          />
        </Pane>

        <div className="h-grid cols-2-3" style={{ gap: 16 }}>
          <Card signal>
            <SignalLine>Phase 3 release gate</SignalLine>
            <div className="h-d4" style={{ fontSize: 22, marginTop: 6 }}>
              Awaiting BOQ pack v3 signoff
            </div>
            <Sep />
            <div className="h-p is-dim" style={{ fontSize: 13 }}>
              Naqaa-08 (flagship) and Naqaa-09 (standard) unlock once signed.
              Vendor pricing locked for 14 days from 9 May — expires 23 May.
            </div>
            <Btn signal iconRight="arrow-r">Open BOQ pack v3</Btn>
          </Card>

          <Pane title="Stage gates" action="5 phases">
            <Row title="Phase 1 · Design closeout" sub="Sealed Wk 8" right="✓ Sealed" />
            <Row title="Phase 2 · Implementation start" sub="Wk 9 · 5 stores released" right="✓ Sealed" />
            <Row attn title="Phase 3 · Rollout release" sub="Gated by BOQ pack v3 · Naqaa-08, 09" right="Open" />
            <Row dim title="Phase 4 · Operations cutover" sub="Wk 32 forecast" right="Pending" />
            <Row dim title="Phase 5 · Programme closeout" sub="Wk 42 forecast" right="Pending" />
          </Pane>
        </div>

        <Pane title="Per-store status · Phase 2" action="14 stores" flush>
          <Tbl
            cols={[
              { l: 'Store', w: '2fr' },
              { l: 'Phase', w: '1.2fr' },
              { l: 'Progress', w: '1.6fr' },
              { l: 'Open date', w: '110px', a: 'right' },
              { l: 'RAG', w: '70px', a: 'right' },
            ]}
            rows={[
              { cells: [<Cell t="Naqaa-01 · Dubai Mall" s="Flagship · 312 m²" />, 'Live · 12 wk', <BarLine label="" right="100%" pct={100} />, <CellNum>14 Feb</CellNum>, <Chip>🟢</Chip>] },
              { cells: [<Cell t="Naqaa-02 · Mall of Emirates" s="Standard · 224 m²" />, 'Live · 6 wk', <BarLine label="" right="100%" pct={100} />, <CellNum>28 Mar</CellNum>, <Chip>🟢</Chip>] },
              { cells: [<Cell t="Naqaa-03 · Riyadh Park" s="Standard · 240 m²" />, 'Live · 2 wk', <BarLine label="" right="100%" pct={100} />, <CellNum>22 Apr</CellNum>, <Chip>🟢</Chip>] },
              { cells: [<Cell t="Naqaa-04 · The Avenues" s="Standard · 198 m²" />, 'Fit-out · Wk 6 of 10', <BarLine label="" right="62%" pct={62} />, <CellNum>4 Jun</CellNum>, <Chip>🟢</Chip>] },
              { cells: [<Cell t="Naqaa-05 · Yas Mall" s="Standard · 264 m²" />, 'Fit-out · Wk 2 of 10', <BarLine label="" right="22%" pct={22} />, <CellNum>22 Jun</CellNum>, <Chip>🟢</Chip>] },
              { cells: [<Cell t="Naqaa-06 · Riyadh Gallery" s="Standard · 230 m²" />, 'Procurement · 60%', <BarLine label="" right="32%" pct={32} />, <CellNum>14 Jul</CellNum>, <Chip>🟢</Chip>] },
              { cells: [<Cell t="Naqaa-07 · Dubai Hills" s="Standard · 198 m²" />, 'Procurement · 40%', <BarLine label="" right="22%" pct={22} />, <CellNum>28 Jul</CellNum>, <Chip>🟢</Chip>] },
              { signal: true, cells: [<Cell t="Naqaa-08 · Riyadh Front" s="Flagship · 380 m²" />, 'BOQ approval', <BarLine label="" right="—" pct={0} signal />, <CellNum>14 Aug</CellNum>, <Chip signal>🔴</Chip>] },
              { signal: true, cells: [<Cell t="Naqaa-09 · Red Sea Mall" s="Standard · 218 m²" />, 'BOQ approval', <BarLine label="" right="—" pct={0} signal />, <CellNum>28 Aug</CellNum>, <Chip signal>🔴</Chip>] },
              { dim: true, cells: [<Cell t="Naqaa-10 to 14" s="5 stores · schematic" />, 'Design', <Mono>Pending Phase 3 release</Mono>, <CellNum>Q4 26</CellNum>, <Chip>⚪</Chip>] },
            ]}
          />
        </Pane>

        <div className="h-grid cols-3" style={{ gap: 16 }}>
          <Card>
            <Eyebrow>RAG flags · open</Eyebrow>
            <Row attn title="BOQ pack v3 awaiting client" sub="Gates Phase 3" right="High" />
            <Row title="Storefront sign · Naqaa-04" sub="Vendor re-fix Tue" right="Med" />
            <Row dim title="Vendor cycle review · Q3" sub="On track" right="Low" />
          </Card>
          <Card>
            <Eyebrow>This month's gates</Eyebrow>
            <Row title="BOQ pack v3 signoff" sub="Naqaa-08, 09" right="16 May" />
            <Row title="Vendor LOA · 3 new" sub="Phase 3 prep" right="22 May" />
            <Row title="Steerco · May" sub="Programme review" right="28 May" />
          </Card>
          <Card>
            <Eyebrow>Country directors on the ground</Eyebrow>
            <Row title="CD KSA" sub="On site Naqaa-04, 08, 09" right="6 stores" />
            <Row title="CD UAE" sub="On site Naqaa-05, 07" right="5 stores" />
            <Row title="Programme delivery" sub="D. Wahab" right="14 stores" />
          </Card>
        </div>
      </PortalShell>
    </div>
  );
}

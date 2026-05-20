import { PortalShell, PageHead } from '../../components/DesktopShell';
import {
  Btn, Pane, Stat, Card, Chip, Mono, Sep,
} from '../../components/primitives';
import { Tbl, Cell, CellNum, Tabs } from '../../components/Table';
import { NAQAA_PROJECT } from '../../fixtures/projects';
import '../../styles/portal.css';

export default function AdvisoryDrawingsIndexPage() {
  return (
    <div className="portal-root">
      <PortalShell
        project={NAQAA_PROJECT}
        crumbs={['Advisory', 'Plans & drawings']}
        title="Plans &amp; drawings"
        actions={
          <>
            <Btn sm icon="search">Filter</Btn>
            <Btn sm icon="download">Drawing pack PDF</Btn>
          </>
        }
      >
        <PageHead
          eyebrow="184 sheets · 14 stores · standardised set per format"
          title="Programme drawing register"
          sub="Every plan ever issued across the rollout. Flagship and standard formats inherit from the master design."
        />

        <div className="h-grid cols-4" style={{ gap: 14 }}>
          <Stat label="Sheets" value="184" sub="across 14 stores" />
          <Stat label="Sealed sets" value="9" sub="of 14 stores" />
          <Stat label="Open revs" value="2" sub="Naqaa-08, 09 design intent" signal />
          <Stat label="Master sets" value="2" sub="flagship + standard" />
        </div>

        <Tabs items={[
          { l: 'All sheets', c: 184, on: true },
          { l: 'Master design', c: 24 },
          { l: 'Per-store IFC', c: 132 },
          { l: 'As-built', c: 22 },
          { l: 'Marked up', c: 6 },
        ]} />

        <div className="h-grid cols-2-3" style={{ gap: 16 }}>
          <Card>
            <Mono style={{ color: 'var(--ink-3)' }}>MASTER · FLAGSHIP</Mono>
            <div style={{ font: '600 24px/1.1 var(--font-display)', marginTop: 6, letterSpacing: '-0.025em' }}>
              Naqaa flagship reference set
            </div>
            <Mono>24 sheets · Rev D sealed · 14 Feb 2026</Mono>
            <Sep />
            <div className="h-p is-dim" style={{ fontSize: 13 }}>
              Inherited by Naqaa-01 (Dubai Mall) and Naqaa-08 (Riyadh Front).
              Adapted per site for storefront, MEP, and lease conditions.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn icon="download">Master pack</Btn>
              <Btn>Open viewer</Btn>
            </div>
          </Card>

          <Pane title="Open revisions" flush>
            <Tbl
              cols={[
                { l: 'Sheet', w: '2.5fr' },
                { l: 'Store', w: '1.4fr' },
                { l: 'Rev', w: '70px' },
                { l: 'Issued', w: '110px', a: 'right' },
                { l: 'Status', w: '110px', a: 'right' },
              ]}
              rows={[
                { signal: true, cells: [<Cell t="DI-08-101 · Cashwrap" s="Adapted from flagship master" />, 'Naqaa-08', <Mono>A</Mono>, <CellNum>9 May</CellNum>, <Chip signal>Design intent</Chip>] },
                { signal: true, cells: [<Cell t="DI-09-101 · Storefront" s="Lease-adapted" />, 'Naqaa-09', <Mono>A</Mono>, <CellNum>9 May</CellNum>, <Chip signal>Design intent</Chip>] },
                { cells: [<Cell t="IFC-05-04 · Floor finish" s="Adapted from standard master" />, 'Naqaa-05', <Mono>B</Mono>, <CellNum>22 Apr</CellNum>, <Chip>Sealed</Chip>] },
                { cells: [<Cell t="AS-03-04 · As-built" s="Storefront mount" />, 'Naqaa-04', <Mono>—</Mono>, <CellNum>4 May</CellNum>, <Chip>Draft</Chip>] },
              ]}
            />
          </Pane>
        </div>

        <Pane title="Per-store sheet register" action="14 stores · 184 sheets" flush>
          <Tbl
            cols={[
              { l: 'Store', w: '2fr' },
              { l: 'Master', w: '1.2fr' },
              { l: 'Sheets', w: '90px', a: 'right' },
              { l: 'Latest rev', w: '110px', a: 'right' },
              { l: 'Status', w: '120px', a: 'right' },
            ]}
            rows={[
              { cells: [<Cell t="Naqaa-01 · Dubai Mall" s="Flagship · 312 m²" />, 'Flagship', <CellNum>22</CellNum>, <CellNum>Rev D · 14 Feb</CellNum>, <Chip>Sealed</Chip>] },
              { cells: [<Cell t="Naqaa-02 · Mall of Emirates" s="Standard · 224 m²" />, 'Standard', <CellNum>16</CellNum>, <CellNum>Rev C · 28 Mar</CellNum>, <Chip>Sealed</Chip>] },
              { cells: [<Cell t="Naqaa-03 · Riyadh Park" s="Standard · 240 m²" />, 'Standard', <CellNum>16</CellNum>, <CellNum>Rev C · 22 Apr</CellNum>, <Chip>Sealed</Chip>] },
              { cells: [<Cell t="Naqaa-04 · The Avenues" s="Standard · 198 m²" />, 'Standard', <CellNum>16</CellNum>, <CellNum>Rev C · 4 May</CellNum>, <Chip>Sealed</Chip>] },
              { cells: [<Cell t="Naqaa-05 · Yas Mall" s="Standard · 264 m²" />, 'Standard', <CellNum>17</CellNum>, <CellNum>Rev B · 22 Apr</CellNum>, <Chip>Sealed</Chip>] },
              { cells: [<Cell t="Naqaa-06 · Riyadh Gallery" s="Standard · 230 m²" />, 'Standard', <CellNum>15</CellNum>, <CellNum>Rev A · 28 Apr</CellNum>, <Chip>Sealed</Chip>] },
              { cells: [<Cell t="Naqaa-07 · Dubai Hills" s="Standard · 198 m²" />, 'Standard', <CellNum>15</CellNum>, <CellNum>Rev A · 28 Apr</CellNum>, <Chip>Sealed</Chip>] },
              { signal: true, cells: [<Cell t="Naqaa-08 · Riyadh Front" s="Flagship · 380 m²" />, 'Flagship', <CellNum>24</CellNum>, <CellNum>Rev A · 9 May</CellNum>, <Chip signal>Design intent</Chip>] },
              { signal: true, cells: [<Cell t="Naqaa-09 · Red Sea Mall" s="Standard · 218 m²" />, 'Standard', <CellNum>16</CellNum>, <CellNum>Rev A · 9 May</CellNum>, <Chip signal>Design intent</Chip>] },
              { dim: true, cells: [<Cell t="Naqaa-10 to 14" s="5 stores · schematic" />, 'TBD', <CellNum>27</CellNum>, <CellNum>—</CellNum>, <Chip>Schematic</Chip>] },
            ]}
          />
        </Pane>
      </PortalShell>
    </div>
  );
}

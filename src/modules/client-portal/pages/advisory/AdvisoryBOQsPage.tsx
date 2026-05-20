import { PortalShell, PageHead } from '../../components/DesktopShell';
import {
  Btn, Pane, Stat, Card, Chip, Sep, BarLine, Eyebrow, Mono, SignalLine,
} from '../../components/primitives';
import { Tbl, Cell, CellNum, Tabs } from '../../components/Table';
import { NAQAA_PROJECT } from '../../fixtures/projects';
import '../../styles/portal.css';

export default function AdvisoryBOQsPage() {
  return (
    <div className="portal-root">
      <PortalShell
        project={NAQAA_PROJECT}
        crumbs={['Advisory', 'BOQs']}
        title="Bills of quantity"
        actions={
          <>
            <Btn sm icon="search">Filter</Btn>
            <Btn sm icon="download">BOQ pack PDF</Btn>
            <Btn primary sm>Compare versions</Btn>
          </>
        }
      >
        <PageHead
          eyebrow="14 stores · 3 BOQ packs sealed · 1 awaiting client"
          title="BOQ library"
          sub="Each pack consolidates vendor pricing for a store cohort. Pricing is locked for 14 days from issue."
        />

        <div className="h-grid cols-4" style={{ gap: 14 }}>
          <Stat label="Sealed packs" value="3" sub="9 stores released" />
          <Stat label="Open" value="1" sub="v3 · Naqaa-08, 09" signal />
          <Stat label="Cost variance" value="−0.8%" sub="vs baseline BOQ" />
          <Stat label="Vendor lock" value="14d" sub="rolling" />
        </div>

        <Tabs items={[
          { l: 'Active packs', c: 4, on: true },
          { l: 'Sealed', c: 3 },
          { l: 'Superseded', c: 5 },
          { l: 'Vendor breakdown' },
        ]} />

        <div className="h-grid cols-2-3" style={{ gap: 16 }}>
          <Card signal>
            <SignalLine>Pack v3 awaiting client signoff</SignalLine>
            <div className="h-d4" style={{ marginTop: 6 }}>Naqaa-08 + Naqaa-09</div>
            <Mono>UGX 6.81Bn combined · 14-day lock expires 23 May</Mono>
            <Sep />
            <BarLine label="Joinery & millwork" right="36%" pct={36} />
            <BarLine label="Lighting" right="12%" pct={12} />
            <BarLine label="MEP" right="22%" pct={22} />
            <BarLine label="Stone & flooring" right="9%" pct={9} />
            <BarLine label="FF&E + soft" right="13%" pct={13} />
            <BarLine label="Logistics + contingency" right="8%" pct={8} />
            <Btn signal iconRight="arrow-r">Open BOQ pack v3</Btn>
          </Card>

          <Pane title="BOQ pack register" action="4 active" flush>
            <Tbl
              cols={[
                { l: 'Pack', w: '2.5fr' },
                { l: 'Stores', w: '1.4fr' },
                { l: 'Issued', w: '1fr' },
                { l: 'Value UGX', w: '140px', a: 'right' },
                { l: 'Status', w: '120px', a: 'right' },
              ]}
              rows={[
                { signal: true, cells: [<Cell t="v3 · Phase 3 release" s="Naqaa-08, 09" />, '2 stores', <CellNum>9 May</CellNum>, <CellNum>6,810,000</CellNum>, <Chip signal>Open</Chip>] },
                { cells: [<Cell t="v2 · Phase 2 part 2" s="Naqaa-04, 05, 06, 07" />, '4 stores', <CellNum>28 Apr</CellNum>, <CellNum>9,860,000</CellNum>, <Chip>Sealed</Chip>] },
                { cells: [<Cell t="v1 · Phase 2 part 1" s="Naqaa-01, 02, 03" />, '3 stores', <CellNum>14 Mar</CellNum>, <CellNum>8,910,000</CellNum>, <Chip>Sealed</Chip>] },
                { dim: true, cells: [<Cell t="v0 · Phase 1 pilot" s="Naqaa-01 baseline" />, '1 store', <CellNum>4 Feb</CellNum>, <CellNum>3,840,000</CellNum>, <Chip>Sealed</Chip>] },
              ]}
            />
          </Pane>
        </div>

        <Pane title="Line items · BOQ pack v3 (Naqaa-08)" action="View pack v3 (Naqaa-09) →" flush>
          <Tbl
            cols={[
              { l: 'Trade', w: '2fr' },
              { l: 'Spec', w: '2.5fr' },
              { l: 'Vendor', w: '1.4fr' },
              { l: 'Unit', w: '90px', a: 'right' },
              { l: 'Qty', w: '90px', a: 'right' },
              { l: 'Total UGX', w: '120px', a: 'right' },
            ]}
            rows={[
              { cells: [<Cell t="Joinery · cashwrap" />, 'Walnut veneer · book-matched', 'Falcon KSA', 'lot', <CellNum>1</CellNum>, <CellNum>620,000</CellNum>] },
              { cells: [<Cell t="Joinery · display walls" />, 'Painted MDF · brass insets', 'Falcon KSA', 'lot', <CellNum>1</CellNum>, <CellNum>540,000</CellNum>] },
              { cells: [<Cell t="Joinery · POS + queue" />, 'Modular pods · 4 stations', 'Falcon KSA', 'ea', <CellNum>4</CellNum>, <CellNum>260,000</CellNum>] },
              { cells: [<Cell t="Lighting · track + heads" />, 'Vibia · bronze finish', 'Vibia ME', 'ea', <CellNum>42</CellNum>, <CellNum>410,000</CellNum>] },
              { cells: [<Cell t="Lighting · pendants" />, 'North 5650 · custom drop', 'Vibia ME', 'ea', <CellNum>8</CellNum>, <CellNum>174,000</CellNum>] },
              { cells: [<Cell t="Stone · feature wall" />, 'Calacatta book-matched 20mm', 'Marmi Bruno', 'm²', <CellNum>22.4</CellNum>, <CellNum>414,000</CellNum>] },
              { cells: [<Cell t="MEP · first + final" />, 'Local consortium · standardised', 'Various', 'lot', <CellNum>1</CellNum>, <CellNum>892,000</CellNum>] },
              { cells: [<Cell t="FF&E · seating + display" />, 'Custom · Kvadrat upholstery', 'Multi', 'lot', <CellNum>1</CellNum>, <CellNum>388,500</CellNum>] },
              { dim: true, cells: [<Cell t="Logistics + contingency" />, '10% standard · Phase 3', 'Programme', 'lot', <CellNum>1</CellNum>, <CellNum>241,500</CellNum>] },
            ]}
          />
        </Pane>

        <div className="h-grid cols-2" style={{ gap: 16 }}>
          <Card>
            <Eyebrow>Cost evolution · per store</Eyebrow>
            <BarLine label="Naqaa-01 baseline" right="UGX 3.84Bn" pct={100} />
            <BarLine label="Naqaa-02 standard" right="UGX 2.46Bn · −1.0% std" pct={88} />
            <BarLine label="Naqaa-03 standard" right="UGX 2.61Bn · +0.4% std" pct={92} />
            <BarLine label="Naqaa-04 standard" right="UGX 2.18Bn · −1.2% std" pct={86} />
            <Sep />
            <Mono>Variance trend favourable across pack v2 cohort.</Mono>
          </Card>
          <Card>
            <Eyebrow>Vendor allocation · pack v3</Eyebrow>
            <BarLine label="Falcon KSA · joinery" right="UGX 2.44Bn · 36%" pct={36} />
            <BarLine label="Vibia ME · lighting" right="UGX 824M · 12%" pct={12} />
            <BarLine label="MEP consortium" right="UGX 1.51Bn · 22%" pct={22} />
            <BarLine label="Marmi Bruno · stone" right="UGX 611M · 9%" pct={9} />
            <BarLine label="Multi · FF&E" right="UGX 907M · 13%" pct={13} />
            <BarLine label="Programme contingency" right="UGX 517M · 8%" pct={8} />
          </Card>
        </div>
      </PortalShell>
    </div>
  );
}

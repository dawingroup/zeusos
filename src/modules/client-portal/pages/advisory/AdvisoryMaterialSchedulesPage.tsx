import { PortalShell, PageHead } from '../../components/DesktopShell';
import {
  Btn, Pane, Stat, Card, Chip, Sep, BarLine, Eyebrow, Mono, Row,
} from '../../components/primitives';
import { Tbl, Cell, CellNum, Tabs } from '../../components/Table';
import { NAQAA_PROJECT } from '../../fixtures/projects';
import '../../styles/portal.css';

export default function AdvisoryMaterialSchedulesPage() {
  return (
    <div className="portal-root">
      <PortalShell
        project={NAQAA_PROJECT}
        crumbs={['Advisory', 'Material schedules']}
        title="Material schedules"
        actions={
          <>
            <Btn sm icon="search">Filter</Btn>
            <Btn sm icon="download">Schedule PDF</Btn>
          </>
        }
      >
        <PageHead
          eyebrow="Programme aggregate · 14 stores · trade-by-trade"
          title="Aggregated material demand"
          sub="Quantities consolidated across the rollout. Procurement uses these to negotiate vendor lock and lead-time pricing."
        />

        <div className="h-grid cols-4" style={{ gap: 14 }}>
          <Stat label="Trades" value="9" sub="active categories" />
          <Stat label="SKUs" value="184" sub="across all packs" />
          <Stat label="Consolidated" value="68%" sub="discount unlocked" />
          <Stat label="Open RFQs" value="6" sub="responses due" signal />
        </div>

        <Tabs items={[
          { l: 'By trade', on: true },
          { l: 'By store', c: 14 },
          { l: 'By vendor', c: 22 },
          { l: 'Open RFQs', c: 6, signal: true },
        ]} />

        <Pane title="Trade-level aggregate · all stores" action="184 SKUs" flush>
          <Tbl
            cols={[
              { l: 'Trade', w: '2fr' },
              { l: 'SKUs', w: '80px', a: 'right' },
              { l: 'Total qty', w: '120px', a: 'right' },
              { l: 'Lead time', w: '120px', a: 'right' },
              { l: 'Vendor', w: '1.4fr' },
              { l: 'Status', w: '120px', a: 'right' },
            ]}
            rows={[
              { cells: [<Cell t="Joinery & millwork" s="Cashwrap · display · POS · seating" />, <CellNum>42</CellNum>, <CellNum>14 packs</CellNum>, <CellNum>21 days</CellNum>, 'Falcon KSA', <Chip>Locked</Chip>] },
              { cells: [<Cell t="Lighting" s="Track · pendant · accent" />, <CellNum>18</CellNum>, <CellNum>312 ea</CellNum>, <CellNum>14 days</CellNum>, 'Vibia ME', <Chip>Locked</Chip>] },
              { cells: [<Cell t="Stone & flooring" s="Calacatta · oak · porcelain" />, <CellNum>22</CellNum>, <CellNum>1,840 m²</CellNum>, <CellNum>21 days</CellNum>, 'Marmi Bruno', <Chip>Locked</Chip>] },
              { cells: [<Cell t="Fabric & soft" s="Upholstery · drapery" />, <CellNum>14</CellNum>, <CellNum>284 m</CellNum>, <CellNum>9 days</CellNum>, 'Kvadrat', <Chip>Locked</Chip>] },
              { cells: [<Cell t="MEP fittings" s="Outlets · ducts · returns" />, <CellNum>48</CellNum>, <CellNum>14 packs</CellNum>, <CellNum>14 days</CellNum>, 'Multi consortium', <Chip>Locked</Chip>] },
              { cells: [<Cell t="Hardware" s="Pulls · slides · brackets" />, <CellNum>22</CellNum>, <CellNum>1,260 ea</CellNum>, <CellNum>21 days</CellNum>, 'Sugatsune ME', <Chip>Locked</Chip>] },
              { signal: true, cells: [<Cell t="Glazing & film" s="Storefront privacy" />, <CellNum>6</CellNum>, <CellNum>312 m²</CellNum>, <CellNum>14 days</CellNum>, '3 vendors · RFQ', <Chip signal>RFQ open</Chip>] },
              { signal: true, cells: [<Cell t="Signage" s="Front lit + non-lit" />, <CellNum>8</CellNum>, <CellNum>14 ea</CellNum>, <CellNum>21 days</CellNum>, '2 vendors · RFQ', <Chip signal>RFQ open</Chip>] },
              { dim: true, cells: [<Cell t="Misc + branding artefacts" s="Phase 3 scope TBC" />, <CellNum>4</CellNum>, <CellNum>—</CellNum>, <CellNum>—</CellNum>, 'TBC', <Chip>Pending</Chip>] },
            ]}
          />
        </Pane>

        <div className="h-grid cols-2-3" style={{ gap: 16 }}>
          <Card>
            <Eyebrow>Consolidation savings</Eyebrow>
            <BarLine label="Joinery" right="−4.2%" pct={42} />
            <BarLine label="Lighting" right="−6.8%" pct={68} />
            <BarLine label="Stone" right="−5.1%" pct={51} />
            <BarLine label="Hardware" right="−7.4%" pct={74} />
            <BarLine label="MEP" right="−3.6%" pct={36} />
            <Sep />
            <Mono>Avg saving vs. per-store procurement: <strong style={{ color: 'var(--ink)' }}>−5.4%</strong></Mono>
          </Card>

          <Pane title="Open RFQs · responses due" flush>
            <Tbl
              cols={[
                { l: 'RFQ', w: '2.5fr' },
                { l: 'Vendors', w: '90px', a: 'right' },
                { l: 'Due', w: '110px', a: 'right' },
                { l: 'Est UGX', w: '120px', a: 'right' },
              ]}
              rows={[
                { cells: [<Cell t="Glazing privacy film" s="Storefront · 6 stores" />, <CellNum>3</CellNum>, <CellNum>18 May</CellNum>, <CellNum>22,400</CellNum>] },
                { cells: [<Cell t="Storefront sign · LED" s="14 stores" />, <CellNum>2</CellNum>, <CellNum>22 May</CellNum>, <CellNum>184,500</CellNum>] },
                { cells: [<Cell t="Modular bag-rail system" s="6 standard stores" />, <CellNum>4</CellNum>, <CellNum>24 May</CellNum>, <CellNum>68,400</CellNum>] },
                { cells: [<Cell t="Floor mat · entry" s="Logo-cut · 14 stores" />, <CellNum>2</CellNum>, <CellNum>26 May</CellNum>, <CellNum>22,800</CellNum>] },
                { cells: [<Cell t="Music + ambience" s="System rollout · 14 stores" />, <CellNum>3</CellNum>, <CellNum>28 May</CellNum>, <CellNum>62,200</CellNum>] },
                { cells: [<Cell t="Stockroom shelving" s="14 stores" />, <CellNum>2</CellNum>, <CellNum>30 May</CellNum>, <CellNum>38,400</CellNum>] },
              ]}
            />
          </Pane>
        </div>

        <Pane title="Demand · per store breakdown" action="Trade × store grid" flush>
          <Tbl
            cols={[
              { l: 'Store', w: '2fr' },
              { l: 'Joinery', w: '90px', a: 'right' },
              { l: 'Lighting', w: '90px', a: 'right' },
              { l: 'Stone m²', w: '90px', a: 'right' },
              { l: 'Fabric m', w: '90px', a: 'right' },
              { l: 'Hardware', w: '90px', a: 'right' },
            ]}
            rows={[
              { cells: [<Cell t="Naqaa-01 · Dubai Mall" s="Flagship" />, <CellNum>1 pack</CellNum>, <CellNum>42 ea</CellNum>, <CellNum>168</CellNum>, <CellNum>32</CellNum>, <CellNum>124</CellNum>] },
              { cells: [<Cell t="Naqaa-02 · Mall of Emirates" s="Standard" />, <CellNum>1 pack</CellNum>, <CellNum>28 ea</CellNum>, <CellNum>112</CellNum>, <CellNum>24</CellNum>, <CellNum>96</CellNum>] },
              { cells: [<Cell t="Naqaa-03 · Riyadh Park" s="Standard" />, <CellNum>1 pack</CellNum>, <CellNum>28 ea</CellNum>, <CellNum>118</CellNum>, <CellNum>24</CellNum>, <CellNum>96</CellNum>] },
              { cells: [<Cell t="Naqaa-04 · The Avenues" s="Standard" />, <CellNum>1 pack</CellNum>, <CellNum>26 ea</CellNum>, <CellNum>108</CellNum>, <CellNum>22</CellNum>, <CellNum>86</CellNum>] },
              { cells: [<Cell t="Naqaa-05 · Yas Mall" s="Standard" />, <CellNum>1 pack</CellNum>, <CellNum>30 ea</CellNum>, <CellNum>128</CellNum>, <CellNum>26</CellNum>, <CellNum>108</CellNum>] },
              { signal: true, cells: [<Cell t="Naqaa-08 · Riyadh Front" s="Flagship · BOQ approval" />, <CellNum>1 pack</CellNum>, <CellNum>50 ea</CellNum>, <CellNum>196</CellNum>, <CellNum>38</CellNum>, <CellNum>164</CellNum>] },
              { signal: true, cells: [<Cell t="Naqaa-09 · Red Sea Mall" s="Standard · BOQ approval" />, <CellNum>1 pack</CellNum>, <CellNum>28 ea</CellNum>, <CellNum>108</CellNum>, <CellNum>22</CellNum>, <CellNum>96</CellNum>] },
              { dim: true, cells: [<Cell t="Naqaa-10 to 14" s="5 stores · schematic" />, <CellNum>—</CellNum>, <CellNum>—</CellNum>, <CellNum>—</CellNum>, <CellNum>—</CellNum>, <CellNum>—</CellNum>] },
            ]}
          />
        </Pane>

        <Card>
          <Eyebrow>Why we consolidate</Eyebrow>
          <Row title="One vendor · multiple stores" sub="14-day rolling lock with delivery windows" right="−5.4% avg" />
          <Row title="Same SKU across stores" sub="Identical fittings reduce service inventory" right="184 SKUs" />
          <Row title="Phase 3 release coordinated" sub="9 stores in one lot for joinery + lighting" right="Q3 2026" />
        </Card>
      </PortalShell>
    </div>
  );
}

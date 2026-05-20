import { PortalShell } from '../../components/DesktopShell';
import {
  Btn, Pane, Sep, Row, Img, SignalLine, Eyebrow, Mono,
} from '../../components/primitives';
import { Tbl, Cell, CellNum, Tabs } from '../../components/Table';
import { InboxItem } from '../../components/InboxItem';
import { Icon } from '../../components/Icon';
import { NAQAA_PROJECT } from '../../fixtures/projects';
import '../../styles/portal.css';

export default function AdvisoryApprovalsPage() {
  return (
    <div className="portal-root">
      <PortalShell
        project={NAQAA_PROJECT}
        crumbs={['Advisory', 'Approvals']}
        title="Approvals"
        actions={
          <>
            <Btn sm icon="search">Filter</Btn>
            <Btn sm>History · 24</Btn>
          </>
        }
      >
        <Tabs items={[
          { l: 'Awaiting you', c: 1, on: true, signal: true },
          { l: 'Awaiting team', c: 3 },
          { l: 'History', c: 24 },
          { l: 'Superseded', c: 6 },
        ]} />

        <div className="h-grid" style={{ gridTemplateColumns: '440px 1fr', gap: 16, flex: 1, minHeight: 0 }}>
          <Pane title="Awaiting your signoff" action="1 item · 14-day vendor lock" flush>
            <div className="h-inbox">
              <InboxItem
                tag="BOQ pack · v3" due="Due 16 May" signal on
                title="Naqaa-08 Riyadh · Naqaa-09 Red Sea Mall"
                sub="Two store packs · pricing locked with vendors · 14 days"
                amount="UGX 6.81Bn combined"
              />
              <InboxItem
                tag="LOA · Vendor onboarding" due="Due 22 May"
                title="Add 3 vendors to approved roster"
                sub="2 lighting · 1 millwork · Phase 3 prep"
              />
              <InboxItem
                tag="BOQ pack · v2" due="Sealed 28 Apr"
                title="Naqaa-04, 05 store packs"
                sub="Sealed and triggered procurement"
                amount="UGX 4.92Bn"
              />
              <InboxItem
                tag="Phase gate" due="Sealed 24 Apr"
                title="Phase 2 implementation start"
                sub="Stage gate passed · all 5 stores released"
              />
            </div>
          </Pane>

          <Pane title="BOQ pack v3 · Naqaa-08 + Naqaa-09" action="Open in new tab ↗">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <SignalLine>Signoff required · issued 9 May</SignalLine>
                <div className="h-d4" style={{ marginTop: 2 }}>
                  Two store packs · flagship + standard format
                </div>
                <div className="h-p is-dim" style={{ maxWidth: 540, marginTop: 4 }}>
                  Pricing locked with 8 vendors for 14 days. Stage gate to Phase 3 rollout.
                  Combines joinery, lighting, MEP, and finishes packages per pack.
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Eyebrow>Combined · UGX</Eyebrow>
                <div className="h-bignum" style={{ fontSize: 44, marginTop: 6 }}>6.81Bn</div>
                <Mono style={{ color: 'var(--ink-2)', marginTop: 4 }}>≈ USD 1.84M @ 3,700</Mono>
                <Mono style={{ color: 'var(--ink-2)', marginTop: 2 }}>14-day vendor lock</Mono>
              </div>
            </div>

            <Sep />

            <Tbl
              cols={[
                { l: 'Pack', w: '2.5fr' },
                { l: 'Format', w: '1.2fr' },
                { l: 'Area m²', w: '90px', a: 'right' },
                { l: 'Total UGX', w: '140px', a: 'right' },
              ]}
              rows={[
                { cells: [<Cell t="Naqaa-08 · Riyadh Front" s="Flagship · 14 Aug 2026 opening" />, 'Flagship', <CellNum>380</CellNum>, <CellNum>3,940,000</CellNum>] },
                { cells: [<Cell t="Naqaa-09 · Red Sea Mall" s="Standard · 28 Aug 2026 opening" />, 'Standard', <CellNum>218</CellNum>, <CellNum>2,870,000</CellNum>] },
              ]}
            />

            <Tbl
              cols={[
                { l: 'Package', w: '2.5fr' },
                { l: 'Vendor', w: '1.5fr' },
                { l: '08 UGX', w: '120px', a: 'right' },
                { l: '09 UGX', w: '120px', a: 'right' },
              ]}
              rows={[
                { cells: [<Cell t="Joinery & millwork" s="14-day lock" />, 'Falcon · KSA', <CellNum>1,420,000</CellNum>, <CellNum>1,020,000</CellNum>] },
                { cells: [<Cell t="Lighting fixtures" s="Vibia ME" />, 'Vibia ME',     <CellNum>584,000</CellNum>, <CellNum>240,000</CellNum>] },
                { cells: [<Cell t="MEP first + final" s="Local MEP partners" />, 'Various',  <CellNum>892,000</CellNum>, <CellNum>620,000</CellNum>] },
                { cells: [<Cell t="Stone & flooring" s="Marmi Bruno" />, 'Marmi Bruno', <CellNum>414,000</CellNum>, <CellNum>196,800</CellNum>] },
                { cells: [<Cell t="FF&E + soft furnishing" s="Kvadrat + Sugatsune" />, 'Multi', <CellNum>388,500</CellNum>, <CellNum>518,200</CellNum>] },
                { cells: [<Cell t="Logistics & contingency" s="10% standard" />, 'Programme', <CellNum>241,500</CellNum>, <CellNum>275,000</CellNum>] },
              ]}
            />

            <div className="h-grid cols-2" style={{ gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Eyebrow>Attachments</Eyebrow>
                <Img tone="render" h={140} label="BOQ pack v3 · 96 pages" />
                <Row title="Vendor LOA · Falcon KSA" sub="Letter of Award · 12 pages" right={<Icon name="download" size={14} />} />
                <Row title="Vendor LOA · Vibia ME" sub="6 pages" right={<Icon name="download" size={14} />} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Eyebrow>History</Eyebrow>
                <Row title="v3 issued · D. Wahab" sub="9 May 14:22 · this revision" />
                <Row title="v2 sealed · Naqaa-04, 05, 06, 07" sub="28 Apr" dim />
                <Row title="v1 issued · pilot pack" sub="4 Mar" dim />
                <Eyebrow style={{ marginTop: 6 }}>Comment to delivery team</Eyebrow>
                <div style={{
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  font: '400 12.5px/1.4 var(--font-sans)',
                  color: 'var(--ink-3)',
                  minHeight: 64,
                }}>Type a note…</div>
              </div>
            </div>

            <Sep />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Icon name="paperclip" size={14} color="var(--ink-3)" />
                <Mono style={{ color: 'var(--ink-3)' }}>4 files · 8.2 MB</Mono>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn sm>Reject</Btn>
                <Btn sm>Request changes</Btn>
                <Btn signal iconRight="check">Sign &amp; trigger procurement</Btn>
              </div>
            </div>
          </Pane>
        </div>
      </PortalShell>
    </div>
  );
}

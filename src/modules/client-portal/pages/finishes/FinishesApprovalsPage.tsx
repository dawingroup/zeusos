import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { PortalShell, type PortalProject } from '../../components/DesktopShell';
import {
  Btn, Pane, Sep, Row, Img, SignalLine, Eyebrow, Mono, Card,
} from '../../components/primitives';
import { Tbl, Cell, CellNum, Tabs } from '../../components/Table';
import { InboxItem } from '../../components/InboxItem';
import { Icon } from '../../components/Icon';
import { RejectDialog } from '../../components/RejectDialog';
import { VELA_PROJECT } from '../../fixtures/projects';
import {
  useFinishesPortalApprovals,
  type ApprovalItem,
  type ApprovalBucket,
  type PortalApprovalsData,
} from '../../hooks/useFinishesPortalApprovals';
import {
  approveChangeOrderFromPortal,
  rejectChangeOrderFromPortal,
  approveSignOffFromPortal,
  rejectSignOffFromPortal,
} from '@/modules/customer-hub/services/client-portal/portalApprovalActions';
import { useAuth } from '@/contexts/AuthContext.jsx';
import type { DesignProject } from '@/modules/design-manager/types';
import type {
  ChangeOrder,
  DesignSignOff,
  SalesOrder,
} from '@/modules/sales-orders/types';
import '../../styles/portal.css';

/**
 * Approvals inbox.
 *
 * Mock mode (no `:code`) renders wireframe fixtures so the design
 * canvas at `/portal/preview` still works as a visual showcase.
 *
 * Live mode (with `:code`) reads `designSignOffs` + `changeOrders`
 * for the project's linked SalesOrder via `useFinishesPortalApprovals`.
 * This round wires read-only — the Sign / Reject / Request changes
 * actions still render but don't yet mutate. That's a deliberate
 * second-pass, as it needs careful security rule work.
 */
export default function FinishesApprovalsPage() {
  const params = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data, loading, error, refetch } = useFinishesPortalApprovals(params.code);

  useEffect(() => {
    if (params.code && !authLoading && !user) {
      navigate('/portal/sign-in', { replace: true });
    }
  }, [params.code, authLoading, user, navigate]);

  if (!params.code) {
    return <ApprovalsView mode="mock" project={VELA_PROJECT} />;
  }

  if (loading && !data || authLoading) return <LoadingState project={params.code} />;
  if (error) return <ErrorState project={params.code} message={error.message} />;
  if (!data) return <ErrorState project={params.code} message="Project not found" />;

  return (
    <ApprovalsView
      mode="live"
      project={dataToShellProject(data.project)}
      data={data}
      refetch={refetch}
    />
  );
}

// ── View ────────────────────────────────────────────────────

interface ViewProps {
  mode: 'mock' | 'live';
  project: PortalProject;
  data?: PortalApprovalsData;
  refetch?: () => void;
}

type ActionKind = 'approve' | 'reject';

interface PendingAction {
  item: ApprovalItem;
  kind: ActionKind;
}

function ApprovalsView({ mode, project, data, refetch }: ViewProps) {
  const live = mode === 'live' && data;
  const { user } = useAuth();
  const [bucket, setBucket] = useState<ApprovalBucket>('awaiting');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null);

  const bucketItems = useMemo<ApprovalItem[]>(() => {
    if (!live) return [];
    return data!.items.filter((i) => i.bucket === bucket);
  }, [live, data, bucket]);

  // Auto-select first item in the current bucket when it changes.
  useEffect(() => {
    if (live) {
      const first = bucketItems[0];
      if (first && first.id !== selectedId) setSelectedId(first.id);
      if (!first) setSelectedId(null);
    }
  }, [live, bucketItems, selectedId]);

  const selected = useMemo<ApprovalItem | null>(() => {
    if (!live) return null;
    return data!.items.find((i) => i.id === selectedId) ?? null;
  }, [live, data, selectedId]);

  const counts = live ? data!.counts : { awaiting: 3, team: 2, history: 14, superseded: 4 };
  const totalAwaiting = counts.awaiting;

  return (
    <div className="portal-root">
      <PortalShell
        project={project}
        dataMode={mode}
        badges={live ? { approvals: totalAwaiting || undefined } : undefined}
        crumbs={['Finishes', project.name, 'Approvals']}
        title="Approvals"
        actions={
          <>
            <Btn sm icon="search">Filter</Btn>
            <Btn sm>History · {counts.history}</Btn>
          </>
        }
      >
        <Tabs items={[
          { l: 'Awaiting you', c: counts.awaiting, on: bucket === 'awaiting', signal: bucket === 'awaiting' && counts.awaiting > 0 },
          { l: 'Awaiting team', c: counts.team, on: bucket === 'team' },
          { l: 'History', c: counts.history, on: bucket === 'history' },
          { l: 'Superseded', c: counts.superseded, on: bucket === 'superseded' },
        ]} onSelect={(i) => setBucket((['awaiting', 'team', 'history', 'superseded'] as ApprovalBucket[])[i])} />

        <div className="h-grid" style={{ gridTemplateColumns: '420px 1fr', gap: 16, flex: 1, minHeight: 0 }}>
          <Pane
            title={bucketTitle(bucket)}
            action={`${live ? bucketItems.length : 3} item${(live ? bucketItems.length : 3) === 1 ? '' : 's'}`}
            flush
          >
            {live
              ? <LiveInbox items={bucketItems} selectedId={selectedId} onSelect={setSelectedId} />
              : <MockInbox />}
          </Pane>

          {live
            ? <LiveDetail
                item={selected}
                so={data!.salesOrder}
                onApprove={(item) => setPending({ item, kind: 'approve' })}
                onReject={(item) => setPending({ item, kind: 'reject' })}
              />
            : <MockDetail />}
        </div>
        {toast ? (
          <div style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: toast.kind === 'ok' ? 'var(--ink)' : 'var(--signal)',
            color: '#fff',
            padding: '14px 18px',
            borderRadius: 12,
            font: '500 13px/1.3 var(--font-sans)',
            letterSpacing: '-0.005em',
            zIndex: 900,
            boxShadow: '0 20px 40px -15px rgba(20,18,14,0.45)',
            maxWidth: 360,
          }}>
            {toast.message}
          </div>
        ) : null}
        <RejectDialog
          open={pending !== null}
          title={pending ? actionDialogTitle(pending) : ''}
          description={pending ? actionDialogDescription(pending) : ''}
          confirmLabel={pending?.kind === 'reject' ? 'Reject' : 'Sign & approve'}
          confirmSignal={pending?.kind === 'reject'}
          confirmPrimary={pending?.kind === 'approve'}
          reasonRequired={pending?.kind === 'reject'}
          reasonPlaceholder={pending?.kind === 'reject'
            ? 'What needs to change before we can approve?'
            : 'Optional: any context for the team'}
          onClose={() => setPending(null)}
          onConfirm={async (reason) => {
            if (!pending || !user) return;
            const { item, kind } = pending;
            try {
              if (item.kind === 'change_order') {
                if (kind === 'approve') {
                  await approveChangeOrderFromPortal(item.id, user, { notes: reason || undefined });
                } else {
                  await rejectChangeOrderFromPortal(item.id, user, reason);
                }
              } else {
                if (kind === 'approve') {
                  await approveSignOffFromPortal(item.id, user, { notes: reason || undefined });
                } else {
                  await rejectSignOffFromPortal(item.id, user, reason);
                }
              }
              setToast({
                kind: 'ok',
                message: kind === 'approve'
                  ? `Approved · ${item.tag}`
                  : `Rejected · ${item.tag}`,
              });
              setTimeout(() => setToast(null), 4000);
              refetch?.();
            } catch (err) {
              setToast({
                kind: 'err',
                message: `Failed to ${kind}: ${(err as Error).message}`,
              });
              setTimeout(() => setToast(null), 6000);
              throw err;
            }
          }}
        />
      </PortalShell>
    </div>
  );
}

function actionDialogTitle(p: PendingAction): string {
  const verb = p.kind === 'approve' ? 'Approve' : 'Reject';
  return `${verb} ${p.item.tag} · ${p.item.title}`;
}

function actionDialogDescription(p: PendingAction): string {
  if (p.kind === 'approve') {
    return p.item.kind === 'change_order'
      ? 'Signing seals this change order. The team will be notified and POs will be raised against it. You can\'t undo this without a counter-CO.'
      : 'Signing approves this drawing/spec at the current revision. The team will move into fabrication. Pin comments stay open for follow-up.';
  }
  return p.item.kind === 'change_order'
    ? 'Reject this change order — the team will be notified with your reason. They\'ll revise and re-issue.'
    : 'Reject this drawing — the team will revise and re-issue with your reason recorded in the history.';
}

// ── Live inbox ──────────────────────────────────────────────

function LiveInbox({
  items, selectedId, onSelect,
}: { items: ApprovalItem[]; selectedId: string | null; onSelect: (id: string) => void }) {
  if (items.length === 0) {
    return (
      <div style={{ padding: '40px 24px' }}>
        <Eyebrow>Nothing here</Eyebrow>
        <div className="h-p is-dim" style={{ marginTop: 8, fontSize: 13 }}>
          This bucket is empty right now. Your project team will let you know when something needs review.
        </div>
      </div>
    );
  }
  return (
    <div className="h-inbox">
      {items.map((item) => (
        <InboxItem
          key={item.id}
          tag={item.tag}
          due={formatDue(item.dueDate)}
          signal={item.signal}
          on={item.id === selectedId}
          title={item.title}
          sub={item.sub}
          amount={item.amount}
          onClick={() => onSelect(item.id)}
        />
      ))}
    </div>
  );
}

// ── Live detail ─────────────────────────────────────────────

interface DetailProps {
  item: ApprovalItem | null;
  so: SalesOrder;
  onApprove: (item: ApprovalItem) => void;
  onReject: (item: ApprovalItem) => void;
}

function LiveDetail({ item, so, onApprove, onReject }: DetailProps) {
  if (!item) {
    return (
      <Pane title="Nothing selected" action="Pick an approval to review">
        <div className="h-p is-dim" style={{ fontSize: 13 }}>
          When approvals come in they'll appear in the list on the left. Pick one to see line items, attachments, and the sign / reject actions.
        </div>
      </Pane>
    );
  }
  const actionable = item.bucket === 'awaiting';
  return item.kind === 'change_order'
    ? <ChangeOrderDetail
        co={item.raw as ChangeOrder}
        so={so}
        onApprove={actionable ? () => onApprove(item) : undefined}
        onReject={actionable ? () => onReject(item) : undefined}
      />
    : <SignOffDetail
        so_off={item.raw as DesignSignOff}
        onApprove={actionable ? () => onApprove(item) : undefined}
        onReject={actionable ? () => onReject(item) : undefined}
      />;
}

function ChangeOrderDetail({ co, so, onApprove, onReject }: { co: ChangeOrder; so: SalesOrder; onApprove?: () => void; onReject?: () => void }) {
  const currency = so.currency;
  const issued = tsToDate(co.submittedToClientAt) ?? tsToDate(co.createdAt);
  return (
    <Pane title={`${co.changeOrderNumber} · ${co.title}`} action="Open in new tab ↗">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SignalLine>{statusEyebrow(co.status)}{issued ? ` · issued ${formatDate(issued)}` : ''}</SignalLine>
          <div className="h-d4" style={{ marginTop: 2 }}>{co.title}</div>
          <div className="h-p is-dim" style={{ maxWidth: 520, marginTop: 4 }}>
            {co.description || co.reason || '—'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Eyebrow>Total · {currency}</Eyebrow>
          <div className="h-bignum" style={{ fontSize: 44, marginTop: 6 }}>
            {formatBig(co.newOrderTotal)}
          </div>
          {co.priceImpact != null && co.priceImpact !== 0 ? (
            <Mono style={{ color: co.priceImpact > 0 ? 'var(--signal)' : 'var(--ink-2)', marginTop: 4 }}>
              {co.priceImpact > 0 ? '+' : '-'}{currency} {formatBig(Math.abs(co.priceImpact))} vs prior
            </Mono>
          ) : null}
          <Mono style={{ color: 'var(--ink-3)', marginTop: 2 }}>
            ≈ USD {formatBig(co.newOrderTotal / 3700)} @ 3,700
          </Mono>
        </div>
      </div>

      <Sep />

      {co.itemsAdded?.length > 0 ? (
        <Tbl
          cols={[
            { l: 'Line item', w: '3fr' },
            { l: 'Qty', w: '100px', a: 'right' },
            { l: 'Rate', w: '120px', a: 'right' },
            { l: 'Total', w: '130px', a: 'right' },
          ]}
          rows={co.itemsAdded.map((li) => ({
            cells: [
              <Cell t={li.description} s={li.specification ?? li.category} />,
              <CellNum>{li.quantity} {li.unit}</CellNum>,
              <CellNum>{formatNum(li.unitPrice)}</CellNum>,
              <CellNum>{formatNum(li.totalPrice)}</CellNum>,
            ],
          }))}
        />
      ) : (
        <div className="h-p is-dim" style={{ fontSize: 13 }}>
          No itemised lines on this change order. See full description above.
        </div>
      )}

      <div className="h-grid cols-2" style={{ gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Eyebrow>Reason for change</Eyebrow>
          <div className="h-p" style={{ fontSize: 13 }}>{co.reason || 'Not provided.'}</div>
          {co.deliveryDateImpact ? (
            <>
              <Eyebrow style={{ marginTop: 6 }}>Schedule impact</Eyebrow>
              <Mono>
                {co.deliveryDateImpact > 0 ? '+' : ''}{co.deliveryDateImpact} day{Math.abs(co.deliveryDateImpact) === 1 ? '' : 's'}
                {co.newDeliveryDate ? ` · new handover ${formatDate(tsToDate(co.newDeliveryDate)!)}` : ''}
              </Mono>
            </>
          ) : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>History</Eyebrow>
          {issued ? <Row title={`Submitted to client by ${co.submittedToClientBy ?? '—'}`} sub={formatDateTime(issued)} /> : null}
          {tsToDate(co.internalApprovedAt) ? <Row title={`Internal approval · ${co.internalApprovedBy ?? '—'}`} sub={formatDateTime(tsToDate(co.internalApprovedAt)!)} dim /> : null}
          {tsToDate(co.createdAt) ? <Row title={`Created by ${co.createdBy}`} sub={formatDateTime(tsToDate(co.createdAt)!)} dim /> : null}
          <Eyebrow style={{ marginTop: 6 }}>Comment for the team</Eyebrow>
          <div style={{
            border: '1px solid var(--line)',
            borderRadius: 10,
            padding: '12px 14px',
            font: '400 12.5px/1.4 var(--font-sans)',
            color: 'var(--ink-3)',
            minHeight: 64,
          }}>Comments coming in the next round.</div>
        </div>
      </div>

      <Sep />

      <DetailActionBar onApprove={onApprove} onReject={onReject} />
    </Pane>
  );
}

function SignOffDetail({ so_off, onApprove, onReject }: { so_off: DesignSignOff; onApprove?: () => void; onReject?: () => void }) {
  const issued = tsToDate(so_off.sentToClientAt) ?? tsToDate(so_off.createdAt);
  return (
    <Pane title={`${so_off.signOffNumber} · ${so_off.title}`} action="Open in new tab ↗">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SignalLine>{statusEyebrow(so_off.status)}{issued ? ` · issued ${formatDate(issued)}` : ''}</SignalLine>
          <div className="h-d4" style={{ marginTop: 2 }}>{so_off.title}</div>
          <div className="h-p is-dim" style={{ maxWidth: 520, marginTop: 4 }}>
            {so_off.description || '—'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Eyebrow>Revision</Eyebrow>
          <div className="h-bignum" style={{ fontSize: 36, marginTop: 6 }}>v{so_off.designVersion}</div>
          <Mono style={{ color: 'var(--ink-3)', marginTop: 4 }}>
            Scope rev {so_off.scopeVersion}
          </Mono>
        </div>
      </div>

      <Sep />

      <div className="h-grid cols-2" style={{ gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Eyebrow>Documents</Eyebrow>
          {so_off.designDocuments?.length ? (
            so_off.designDocuments.map((d) => (
              <Row
                key={d.id}
                icon="doc"
                title={d.fileName}
                sub={d.description ?? d.type}
                right={<Icon name="arrow-r" size={14} color="var(--ink-3)" />}
              />
            ))
          ) : (
            <div className="h-p is-dim" style={{ fontSize: 13 }}>No documents attached.</div>
          )}
          {so_off.itemsCovered?.length ? (
            <>
              <Eyebrow style={{ marginTop: 6 }}>Items covered</Eyebrow>
              <Mono>{so_off.itemsCovered.length} item{so_off.itemsCovered.length === 1 ? '' : 's'}</Mono>
            </>
          ) : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>History</Eyebrow>
          {issued ? <Row title={`Sent via ${so_off.sentToClientVia ?? 'portal'}`} sub={formatDateTime(issued)} /> : null}
          {tsToDate(so_off.createdAt) ? <Row title={`Created by ${so_off.createdBy}`} sub={formatDateTime(tsToDate(so_off.createdAt)!)} dim /> : null}
          {so_off.expiresAt ? <Row dim title="Expires" sub={formatDateTime(tsToDate(so_off.expiresAt)!)} /> : null}
          <Eyebrow style={{ marginTop: 6 }}>Disclaimer</Eyebrow>
          <div className="h-p is-dim" style={{ fontSize: 11.5 }}>{so_off.disclaimerText || '—'}</div>
        </div>
      </div>

      <Sep />

      <DetailActionBar
        attachmentsHint={`${so_off.designDocuments?.length ?? 0} document${(so_off.designDocuments?.length ?? 0) === 1 ? '' : 's'}`}
        onApprove={onApprove}
        onReject={onReject}
      />
    </Pane>
  );
}

function DetailActionBar({
  attachmentsHint, onApprove, onReject,
}: {
  attachmentsHint?: string;
  onApprove?: () => void;
  onReject?: () => void;
} = {}) {
  const actionable = !!(onApprove || onReject);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {attachmentsHint ? (
          <>
            <Icon name="paperclip" size={14} color="var(--ink-3)" />
            <Mono style={{ color: 'var(--ink-3)' }}>{attachmentsHint}</Mono>
          </>
        ) : null}
        {!actionable ? (
          <Mono style={{ color: 'var(--ink-3)' }}>
            {attachmentsHint ? '·  ' : ''}This item is no longer awaiting your action.
          </Mono>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn sm onClick={onReject} disabled={!onReject}>Reject</Btn>
        <Btn
          sm
          signal
          iconRight="check"
          onClick={onApprove}
          disabled={!onApprove}
        >Sign &amp; approve</Btn>
      </div>
    </div>
  );
}

// ── Mock sub-views (wireframe fixtures) ─────────────────────

function MockInbox() {
  return (
    <div className="h-inbox">
      <InboxItem
        tag="Quotation · Q-019 v2" due="Due 16 May" signal on
        title="Stone variation — Calacatta upgrade"
        sub="Δ +UGX 42.8M vs. v1 · 18.4 m² · Italy"
        amount="UGX 184.3M"
      />
      <InboxItem
        tag="Shop drawing · SD-104 Rev C" due="Due 18 May" signal
        title="Cashwrap joinery"
        sub="Veneer direction updated · 4 sheets · 3 pins"
      />
      <InboxItem
        tag="FF&E · Lighting schedule" due="Due 20 May" signal
        title="Track-head finish — bronze or black"
        sub="Affects 28 fixtures in zones A & C"
      />
      <InboxItem
        tag="Quotation · Q-021" due="Due 22 May"
        title="Lighting top-up"
        sub="12 fittings · zone C"
        amount="UGX 64.8M"
      />
      <InboxItem
        tag="Quotation · Q-022" due="Due 24 May"
        title="Storefront glazing film"
        sub="Privacy treatment · 24 m²"
        amount="UGX 22.4M"
      />
      <InboxItem
        tag="Shop drawing · SD-106 Rev A" due="Due 25 May"
        title="Stone wall panel"
        sub="2 sheets · zone A"
      />
    </div>
  );
}

function MockDetail() {
  return (
    <Pane title="Q-019 v2 · Stone variation" action="Open in new tab ↗">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SignalLine>Signoff required · issued 9 May</SignalLine>
          <div className="h-d4" style={{ marginTop: 2 }}>
            Calacatta Borghini — slab upgrade to 20mm
          </div>
          <div className="h-p is-dim" style={{ maxWidth: 520, marginTop: 4 }}>
            Revised after your direction on the 7 May call. Locks the stone install slot in week 15.
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Eyebrow>Total · UGX</Eyebrow>
          <div className="h-bignum" style={{ fontSize: 44, marginTop: 6 }}>184.3M</div>
          <Mono style={{ color: 'var(--signal)', marginTop: 4 }}>+UGX 42.8M vs v1</Mono>
          <Mono style={{ color: 'var(--ink-3)', marginTop: 2 }}>≈ USD 49.8K @ 3,700</Mono>
        </div>
      </div>

      <Sep />

      <Tbl
        cols={[
          { l: 'Line item', w: '3fr' },
          { l: 'Qty', w: '100px', a: 'right' },
          { l: 'Rate', w: '120px', a: 'right' },
          { l: 'Total', w: '130px', a: 'right' },
        ]}
        rows={[
          { cells: [<Cell t="Calacatta Borghini slab 20mm" s="Italy · book-matched · sealed" />, <CellNum>18.4 m²</CellNum>, <CellNum>5,240</CellNum>, <CellNum>96,400</CellNum>] },
          { cells: [<Cell t="Edge polishing & water-jet cuts" s="Workshop · 4 days" />, <CellNum>1 lot</CellNum>, <CellNum>28,300</CellNum>, <CellNum>28,300</CellNum>] },
          { cells: [<Cell t="Templating & install on site" s="3 days · 2 fitters" />, <CellNum>1 lot</CellNum>, <CellNum>41,200</CellNum>, <CellNum>41,200</CellNum>] },
          { cells: [<Cell t="Sealing & maintenance kit" s="6-month seal warranty" />, <CellNum>1 lot</CellNum>, <CellNum>18,350</CellNum>, <CellNum>18,350</CellNum>] },
        ]}
      />

      <div className="h-grid cols-2" style={{ gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Eyebrow>Attachments</Eyebrow>
          <Img tone="stone" h={130} label="Spec sheet · slab.pdf · 4 pages" />
          <div className="h-grid cols-3" style={{ gap: 6 }}>
            <Img tone="stone" h={60} label="A" />
            <Img tone="fabric" h={60} label="B" />
            <Img tone="interior" h={60} label="C" />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>History</Eyebrow>
          <Row title="v2 issued · D. Wahab" sub="9 May 14:22 · this revision" />
          <Row title="You requested 20mm slab" sub="7 May · call notes" dim />
          <Row title="v1 issued · UGX 141.5M" sub="2 May" dim />
          <Eyebrow style={{ marginTop: 6 }}>Comment for the team</Eyebrow>
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
          <Mono style={{ color: 'var(--ink-3)' }}>2 files · 184 KB</Mono>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn sm>Reject</Btn>
          <Btn sm>Request changes</Btn>
          <Btn signal iconRight="check">Sign &amp; approve</Btn>
        </div>
      </div>
    </Pane>
  );
}

// ── Helpers ─────────────────────────────────────────────────

function dataToShellProject(p: DesignProject): PortalProject {
  return {
    name: p.name,
    tag: p.code,
    sub: p.customerName,
    slug: p.code,
    line: 'finishes',
  };
}

function bucketTitle(b: ApprovalBucket): string {
  switch (b) {
    case 'awaiting': return 'Awaiting your signoff';
    case 'team': return 'Awaiting your team';
    case 'history': return 'History';
    case 'superseded': return 'Superseded';
  }
}

function statusEyebrow(status: ChangeOrder['status'] | DesignSignOff['status']): string {
  switch (status) {
    case 'pending_client':
    case 'sent_to_client':
      return 'Signoff required';
    case 'pending_internal':
      return 'Awaiting internal approval';
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    case 'withdrawn': return 'Withdrawn';
    case 'expired': return 'Expired';
    case 'superseded': return 'Superseded';
    default: return String(status);
  }
}

function formatDue(d: Date | undefined): string {
  if (!d) return '';
  return `Due ${formatDate(d)}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatDateTime(d: Date): string {
  return `${formatDate(d)} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatBig(amount: number | undefined | null): string {
  if (amount == null) return '—';
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}Bn`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return amount.toFixed(0);
}

function formatNum(n: number): string {
  return n.toLocaleString('en-US');
}

function tsToDate(t: import('firebase/firestore').Timestamp | undefined): Date | undefined {
  if (!t) return undefined;
  if (typeof (t as any).toDate === 'function') return (t as any).toDate();
  return undefined;
}

// ── Loading / error states ──────────────────────────────────

function LoadingState({ project }: { project: string }) {
  return (
    <div className="portal-root">
      <PortalShell
        project={{ slug: project, name: 'Loading…', tag: project, sub: '', line: 'finishes' }}
        title="Approvals"
        dataMode="live"
      >
        <Card>
          <Eyebrow>Loading approvals…</Eyebrow>
          <div className="h-p is-dim" style={{ fontSize: 13 }}>Resolving {project}</div>
        </Card>
      </PortalShell>
    </div>
  );
}

function ErrorState({ project, message }: { project: string; message: string }) {
  return (
    <div className="portal-root">
      <PortalShell
        project={{ slug: project, name: 'Project', tag: project, sub: '', line: 'finishes' }}
        title="Approvals"
        dataMode="live"
      >
        <Card>
          <Eyebrow signal>Couldn't load — {message}</Eyebrow>
          <Mono>1. The project code <strong>{project}</strong> doesn't exist.</Mono>
          <Mono>2. You don't have portal access to it yet — your project director can grant access.</Mono>
          <Mono>3. No sales order has been raised for this project yet.</Mono>
        </Card>
      </PortalShell>
    </div>
  );
}

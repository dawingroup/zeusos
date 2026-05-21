import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Save,
  ArrowRight,
  Star,
  Bell,
  Bot,
  Sparkles,
} from 'lucide-react';
import { ModuleTabNav } from '@/core/components/navigation/ModuleTabNav';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { Checkbox } from '@/core/components/ui/checkbox';
import { Switch } from '@/core/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/core/components/ui/radio-group';
import { Badge } from '@/core/components/ui/badge';
import { Field } from '@/shared/components/forms/Field';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/core/components/ui/dialog';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from '@/core/components/ui/sheet';
import {
  RagBadge,
  KPICard,
  KPIGrid,
  Sparkline,
  Banner,
  EmptyStateV2 as EmptyState,
  Stepper,
  AvatarGroup,
  DataTable,
  type DataTableColumn,
} from '@/shared/components/data-display';

type Tab = 'components' | 'colors' | 'typography' | 'spacing';

// ─── Sample data for DataTable demo
interface DemoRow {
  id: string;
  po: string;
  supplier: string;
  amount: number;
  status: 'awaiting' | 'approved' | 'in-transit' | 'received';
  created: string;
  progress: number;
}

const DEMO_ROWS: DemoRow[] = [
  { id: '1', po: 'PO-2026-0142', supplier: 'Kampala Hardwoods Ltd', amount: 8_450_000, status: 'awaiting',   created: '2026-05-12', progress: 20 },
  { id: '2', po: 'PO-2026-0141', supplier: 'East Africa Boards',    amount: 12_300_000, status: 'in-transit', created: '2026-05-10', progress: 65 },
  { id: '3', po: 'PO-2026-0140', supplier: 'NileFinish Supplies',   amount: 3_675_000, status: 'approved',   created: '2026-05-08', progress: 45 },
  { id: '4', po: 'PO-2026-0139', supplier: 'Lake View Materials',   amount: 21_900_000, status: 'received',   created: '2026-05-05', progress: 100 },
  { id: '5', po: 'PO-2026-0138', supplier: 'Equator Lumber Co',     amount: 5_220_000, status: 'awaiting',   created: '2026-05-04', progress: 10 },
];

const DEMO_COLUMNS: DataTableColumn<DemoRow>[] = [
  { key: 'po', label: 'PO #', type: 'mono', width: 170 },
  { key: 'supplier', label: 'Supplier' },
  { key: 'amount', label: 'Amount (UGX)', type: 'money', align: 'right' },
  {
    key: 'status',
    label: 'Status',
    type: 'status',
    statusMap: {
      awaiting:    { tone: 'amber', label: 'Awaiting approval' },
      approved:    { tone: 'blue',  label: 'Approved' },
      'in-transit':{ tone: 'blue',  label: 'In transit' },
      received:    { tone: 'green', label: 'Received' },
    },
  },
  { key: 'progress', label: 'Progress', type: 'progress' },
  { key: 'created', label: 'Created', type: 'date' },
];

// ─── Color tokens
const COLOR_GROUPS: { title: string; tokens: { name: string; varName: string; hex?: string }[] }[] = [
  {
    title: 'Surfaces',
    tokens: [
      { name: 'bg-app',      varName: '--bg-app',      hex: '#f6f5f2' },
      { name: 'bg-surface',  varName: '--bg-surface',  hex: '#ffffff' },
      { name: 'bg-sunken',   varName: '--bg-sunken',   hex: '#efede8' },
      { name: 'bg-sidebar',  varName: '--bg-sidebar',  hex: '#1a1a1c' },
    ],
  },
  {
    title: 'Foregrounds',
    tokens: [
      { name: 'fg-primary',    varName: '--fg-primary',    hex: '#1a1a1c' },
      { name: 'fg-secondary',  varName: '--fg-secondary',  hex: '#555358' },
      { name: 'fg-tertiary',   varName: '--fg-tertiary',   hex: '#8a8790' },
      { name: 'fg-quaternary', varName: '--fg-quaternary', hex: '#b8b5bd' },
    ],
  },
  {
    title: 'Brand',
    tokens: [
      { name: 'boysenberry', varName: '--boysenberry', hex: '#872e5c' },
      { name: 'golden-bell', varName: '--golden-bell', hex: '#e18425' },
      { name: 'cashmere',    varName: '--cashmere',    hex: '#e2caa9' },
      { name: 'pesto',       varName: '--pesto',       hex: '#8a7d4b' },
      { name: 'seafoam',     varName: '--seafoam',     hex: '#7abdcd' },
    ],
  },
  {
    title: 'RAG',
    tokens: [
      { name: 'rag-red',   varName: '--rag-red',   hex: '#d4413a' },
      { name: 'rag-amber', varName: '--rag-amber', hex: '#e18425' },
      { name: 'rag-green', varName: '--rag-green', hex: '#4e8a4a' },
      { name: 'rag-blue',  varName: '--rag-blue',  hex: '#4172a8' },
      { name: 'rag-na',    varName: '--rag-na',    hex: '#9c9aa1' },
    ],
  },
];

const SPACE_TOKENS = [
  { name: 'space-1', px: 4 },
  { name: 'space-2', px: 8 },
  { name: 'space-3', px: 12 },
  { name: 'space-4', px: 16 },
  { name: 'space-5', px: 20 },
  { name: 'space-6', px: 24 },
  { name: 'space-8', px: 32 },
];

const RADII = [
  { name: '--radius-sm', value: '6px' },
  { name: '--radius',    value: '10px' },
  { name: '--radius-lg', value: '14px' },
];

const SHADOWS = [
  { name: '--shadow-sm', desc: 'Cards at rest' },
  { name: '--shadow-md', desc: 'Hover / popovers' },
  { name: '--shadow-lg', desc: 'Modals / drawers' },
];

const STEPPER_STEPS = [
  { id: '1', label: 'Draft', description: 'Created' },
  { id: '2', label: 'Review', description: 'Approver assigned' },
  { id: '3', label: 'Approved', description: 'Awaiting fulfillment' },
  { id: '4', label: 'Closed', description: 'Settled' },
];

const PEOPLE = [
  { id: 'a', name: 'Aisha Nakato' },
  { id: 'b', name: 'Brian Okello' },
  { id: 'c', name: 'Cynthia Aine' },
  { id: 'd', name: 'David Mwangi' },
  { id: 'e', name: 'Esther Nansubuga' },
  { id: 'f', name: 'Frank Sserwadda' },
];

export default function DesignSystemPage() {
  const [tab, setTab] = useState<Tab>('components');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div>
      <ModuleTabNav
        title="Design System"
        subtitle="Living reference for every primitive, token and pattern in the ZeusOS portal."
        tabs={[
          { id: 'components', label: 'Components',  path: '#components' },
          { id: 'colors',     label: 'Color tokens',path: '#colors' },
          { id: 'typography', label: 'Typography',  path: '#typography' },
          { id: 'spacing',    label: 'Spacing',     path: '#spacing' },
        ].map((t) => ({ ...t, exact: true }))}
        rightContent={
          <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
            <ArrowRight className="h-3.5 w-3.5 rotate-180" /> Admin
          </Button>
        }
      />

      {/* In-page tab switcher (hash-router would be heavier here; just toggle state) */}
      <div className="max-w-[1640px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="flex flex-wrap gap-2 mb-4">
          {(['components', 'colors', 'typography', 'spacing'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`h-8 px-3 rounded-md text-[12.5px] font-medium border transition-colors ${
                tab === t
                  ? 'bg-[var(--accent-soft)] border-[var(--accent)]/40 text-[var(--accent)]'
                  : 'bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--fg-secondary)] hover:bg-[var(--bg-sunken)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'components' && (
          <div className="flex flex-col gap-8 pb-12">
            <Section title="KPI cards">
              <KPIGrid>
                <KPICard
                  label="Group revenue · MTD"
                  value="2.84B"
                  unit="UGX"
                  delta="+12.4%"
                  trend="up"
                  spark={[10, 14, 11, 18, 22, 19, 26, 24, 31, 29, 34]}
                />
                <KPICard
                  label="Active POs"
                  value="142"
                  delta="+8"
                  trend="up"
                  spark={[20, 18, 22, 19, 24, 27, 23, 26, 29, 30, 28]}
                />
                <KPICard
                  label="Inventory at risk"
                  value="34"
                  unit="SKUs"
                  delta="−5"
                  trend="down"
                  spark={[40, 42, 38, 37, 36, 38, 35, 34, 32, 33, 34]}
                  sparkColor="var(--rag-red)"
                />
                <KPICard
                  label="On-time fulfillment"
                  value="96.4"
                  unit="%"
                  delta="No change"
                  trend="flat"
                />
              </KPIGrid>
            </Section>

            <Section title="RAG badges">
              <div className="flex flex-wrap items-center gap-2">
                <RagBadge tone="green">On track</RagBadge>
                <RagBadge tone="amber">At risk</RagBadge>
                <RagBadge tone="red">Blocked</RagBadge>
                <RagBadge tone="blue">In review</RagBadge>
                <RagBadge tone="na">N/A</RagBadge>
              </div>
            </Section>

            <Section title="Badges">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Default</Badge>
                <Badge variant="muted">Muted</Badge>
                <Badge variant="accent">Accent</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="destructive">Destructive</Badge>
                <Badge variant="info">Info</Badge>
              </div>
            </Section>

            <Section title="Buttons">
              <div className="flex flex-wrap items-center gap-2">
                <Button>Default</Button>
                <Button variant="primary">Primary accent</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="link">Link</Button>
                <Button size="sm" variant="outline">
                  <Plus className="h-3.5 w-3.5" /> Small
                </Button>
                <Button size="icon" variant="ghost" aria-label="Edit">
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </Section>

            <Section title="Form fields">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                <Field label="Email" htmlFor="ds-email" hint="Used for sign-in." required>
                  <Input id="ds-email" type="email" placeholder="you@dawin.com" />
                </Field>
                <Field label="Country" htmlFor="ds-country">
                  <Select>
                    <SelectTrigger id="ds-country">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ug">Uganda</SelectItem>
                      <SelectItem value="ke">Kenya</SelectItem>
                      <SelectItem value="tz">Tanzania</SelectItem>
                      <SelectItem value="rw">Rwanda</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Notes" htmlFor="ds-notes" className="md:col-span-2">
                  <Textarea id="ds-notes" placeholder="Free-form text…" />
                </Field>
                <Field label="Receive product updates" htmlFor="ds-marketing">
                  <div className="flex items-center gap-2">
                    <Switch id="ds-marketing" defaultChecked />
                    <span className="text-[12.5px] text-[var(--fg-secondary)]">
                      Monthly digest
                    </span>
                  </div>
                </Field>
                <Field label="Preferred contact" hint="Select one">
                  <RadioGroup defaultValue="email" className="flex gap-4">
                    <label className="inline-flex items-center gap-1.5 text-[12.5px]">
                      <RadioGroupItem value="email" /> Email
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-[12.5px]">
                      <RadioGroupItem value="sms" /> SMS
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-[12.5px]">
                      <RadioGroupItem value="whatsapp" /> WhatsApp
                    </label>
                  </RadioGroup>
                </Field>
                <Field label="Confirm" error="Please accept the terms to continue.">
                  <label className="inline-flex items-center gap-2 text-[12.5px]">
                    <Checkbox /> I accept the terms
                  </label>
                </Field>
              </div>
            </Section>

            <Section title="Banners">
              <div className="flex flex-col gap-3">
                <Banner
                  tone="info"
                  title="Tax filing window opens Monday."
                  message="Submit Q1 returns by 2026-06-05 to avoid penalties."
                />
                <Banner
                  tone="warning"
                  title="Payroll readiness 78%"
                  message="6 employee records are missing bank details."
                  actions={<Button size="sm" variant="outline">Review</Button>}
                />
                <Banner
                  tone="danger"
                  title="2 documents expire this week"
                  message="Trading license expires 2026-05-22, NSSF cert 2026-05-24."
                />
                <Banner
                  tone="success"
                  title="May close completed"
                  message="All subledgers reconciled. Audit pack ready."
                />
              </div>
            </Section>

            <Section title="Empty state">
              <div className="border rounded-[10px] border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                <EmptyState
                  title="No items yet"
                  message="Create your first inventory family to start tracking stock."
                  action={<Button variant="primary"><Plus className="h-3.5 w-3.5" /> New family</Button>}
                />
              </div>
            </Section>

            <Section title="Stepper">
              <Stepper steps={STEPPER_STEPS} current={2} />
            </Section>

            <Section title="Avatar group">
              <div className="flex items-center gap-6">
                <AvatarGroup people={PEOPLE.slice(0, 3)} />
                <AvatarGroup people={PEOPLE} max={4} />
                <AvatarGroup people={PEOPLE} max={2} size={36} />
              </div>
            </Section>

            <Section title="Sparklines">
              <div className="flex items-center gap-6">
                <Sparkline points={[3, 5, 4, 7, 6, 9, 8, 11, 12, 10, 14]} />
                <Sparkline points={[12, 9, 10, 7, 8, 6, 5, 4, 5, 3, 2]} color="var(--rag-red)" />
                <Sparkline points={[5, 5, 5, 5, 6, 5, 5, 5, 5, 5, 5]} color="var(--rag-green)" />
              </div>
            </Section>

            <Section title="Drawer + Dialog">
              <div className="flex flex-wrap gap-3">
                <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline"><Eye className="h-3.5 w-3.5" /> Open drawer</Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Inventory item · CK-OAK-2440</SheetTitle>
                      <SheetDescription>Oak board · 2440 × 1220 × 18mm</SheetDescription>
                    </SheetHeader>
                    <SheetBody>
                      <dl className="grid grid-cols-3 gap-2 text-[13px]">
                        <dt className="col-span-1 text-[var(--fg-tertiary)]">SKU</dt>
                        <dd className="col-span-2 font-mono">CK-OAK-2440</dd>
                        <dt className="col-span-1 text-[var(--fg-tertiary)]">On hand</dt>
                        <dd className="col-span-2">42 sheets</dd>
                        <dt className="col-span-1 text-[var(--fg-tertiary)]">Reorder at</dt>
                        <dd className="col-span-2">20 sheets</dd>
                        <dt className="col-span-1 text-[var(--fg-tertiary)]">Supplier</dt>
                        <dd className="col-span-2">East Africa Boards</dd>
                      </dl>
                    </SheetBody>
                    <SheetFooter>
                      <Button variant="ghost" onClick={() => setDrawerOpen(false)}>Cancel</Button>
                      <Button variant="primary"><Save className="h-3.5 w-3.5" /> Save</Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>

                <Button variant="outline" onClick={() => setDialogOpen(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Confirm delete (danger dialog)
                </Button>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                  <DialogHeader kind="danger">
                    <DialogTitle>Delete this purchase order?</DialogTitle>
                    <DialogDescription>
                      This action cannot be undone. The supplier and the team will be notified.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={() => setDialogOpen(false)}>
                      Delete
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </Section>

            <Section title="DataTable">
              <DataTable
                data={DEMO_ROWS}
                columns={DEMO_COLUMNS}
                search="Search PO #, supplier…"
                filters={[
                  {
                    label: 'Status',
                    key: 'status',
                    options: ['All', 'awaiting', 'approved', 'in-transit', 'received'],
                  },
                ]}
                onRowClick={(row) => console.info('Row clicked', row)}
                footer={{
                  supplier: 'Total',
                  amount: '51,545,000',
                }}
              />
            </Section>

            <Section title="Status icons & dots">
              <div className="flex items-center gap-4 text-[12.5px]">
                <span className="inline-flex items-center gap-2">
                  <Bell className="h-4 w-4 text-[var(--rag-amber)]" /> Notification
                </span>
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[var(--accent)]" /> AI Intelligence
                </span>
                <span className="inline-flex items-center gap-2">
                  <Bot className="h-4 w-4 text-[var(--rag-blue)]" /> AI assistant
                </span>
                <span className="inline-flex items-center gap-2">
                  <Star className="h-4 w-4 text-[var(--rag-amber)] fill-[var(--rag-amber)]" /> Favorite
                </span>
                <span className="inline-flex items-center gap-2">
                  <Settings className="h-4 w-4 text-[var(--fg-tertiary)]" /> Settings
                </span>
              </div>
            </Section>
          </div>
        )}

        {tab === 'colors' && (
          <div className="flex flex-col gap-8 pb-12">
            {COLOR_GROUPS.map((group) => (
              <Section key={group.title} title={group.title}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {group.tokens.map((tok) => (
                    <div
                      key={tok.varName}
                      className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden"
                    >
                      <div
                        className="h-16 w-full"
                        style={{ backgroundColor: `var(${tok.varName})` }}
                      />
                      <div className="p-3">
                        <div className="text-[12.5px] font-medium text-[var(--fg-primary)]">
                          {tok.name}
                        </div>
                        <div className="text-[11px] font-mono text-[var(--fg-tertiary)] mt-0.5">
                          {tok.varName}
                        </div>
                        {tok.hex && (
                          <div className="text-[11px] font-mono text-[var(--fg-tertiary)]">
                            {tok.hex}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            ))}
          </div>
        )}

        {tab === 'typography' && (
          <div className="flex flex-col gap-6 pb-12">
            <Section title="Scale">
              <div className="space-y-5">
                <SampleType label="h1 · 26/600 · -0.02em" element="h1">Bring order to operations.</SampleType>
                <SampleType label="h2 · 19/600 · -0.015em" element="h2">Inventory snapshot</SampleType>
                <SampleType label="h3 · 13/500 · 0.08em · uppercase" element="h3">Awaiting approval</SampleType>
                <SampleType label="body · 14/400" element="p">
                  The ZeusOS portal balances dense data with calm chrome — we keep the
                  text comfortable to read across long sessions on procurement and
                  finance modules.
                </SampleType>
                <SampleType label="caption · 11/500 · tertiary" element="caption">
                  Last updated 12 minutes ago
                </SampleType>
              </div>
            </Section>
            <Section title="Mono / numeric">
              <div className="flex items-center gap-6 text-[14px] tabular-nums font-mono">
                <span>UGX 1,284,500.00</span>
                <span>2026-05-18</span>
                <span>PO-2026-0142</span>
              </div>
            </Section>
          </div>
        )}

        {tab === 'spacing' && (
          <div className="flex flex-col gap-8 pb-12">
            <Section title="8px grid">
              <div className="flex flex-col gap-2">
                {SPACE_TOKENS.map((tok) => (
                  <div key={tok.name} className="flex items-center gap-3">
                    <code className="text-[11.5px] font-mono w-20 text-[var(--fg-tertiary)]">
                      {tok.name}
                    </code>
                    <div
                      className="h-3 rounded-sm"
                      style={{ width: tok.px, backgroundColor: 'var(--accent)' }}
                    />
                    <span className="text-[11.5px] text-[var(--fg-tertiary)]">{tok.px}px</span>
                  </div>
                ))}
              </div>
            </Section>
            <Section title="Radius">
              <div className="flex items-center gap-4">
                {RADII.map((r) => (
                  <div key={r.name} className="flex flex-col items-center gap-2">
                    <div
                      className="h-16 w-16"
                      style={{
                        backgroundColor: 'var(--accent-soft)',
                        border: '1px solid var(--border-default)',
                        borderRadius: r.value,
                      }}
                    />
                    <code className="text-[11px] font-mono text-[var(--fg-tertiary)]">{r.name}</code>
                    <span className="text-[11px] text-[var(--fg-secondary)]">{r.value}</span>
                  </div>
                ))}
              </div>
            </Section>
            <Section title="Shadows">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {SHADOWS.map((s) => (
                  <div
                    key={s.name}
                    className="h-24 rounded-[10px] bg-[var(--bg-surface)] grid place-items-center"
                    style={{ boxShadow: `var(${s.name})` }}
                  >
                    <div className="text-center">
                      <code className="text-[11px] font-mono text-[var(--fg-tertiary)]">
                        {s.name}
                      </code>
                      <div className="text-[11.5px] text-[var(--fg-secondary)] mt-1">
                        {s.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3">{title}</h3>
      {children}
    </section>
  );
}

function SampleType({
  label,
  element,
  children,
}: {
  label: string;
  element: 'h1' | 'h2' | 'h3' | 'p' | 'caption';
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10.5px] uppercase tracking-wider text-[var(--fg-tertiary)]">
        {label}
      </span>
      {element === 'h1' && <h1>{children}</h1>}
      {element === 'h2' && <h2>{children}</h2>}
      {element === 'h3' && <h3>{children}</h3>}
      {element === 'p' && <p style={{ maxWidth: '64ch' }}>{children}</p>}
      {element === 'caption' && <p className="caption">{children}</p>}
    </div>
  );
}

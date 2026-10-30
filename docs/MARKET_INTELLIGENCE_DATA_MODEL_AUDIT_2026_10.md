# Market Intelligence data-model audit — 2026-10

Scope: the persisted data models of the Market Intelligence module — every Firestore
collection the module reads or writes (`src/modules/intelligence/**` as the routed surface at
`/market-intel/*`, the former `src/modules/market-intelligence/**` submodules, the Cloud
Functions in `functions/src/intelligence/*` and `functions/src/ai/marketIntelligence.js`, the
agent read tool, the MCP tool), the TypeScript types that claim to describe them, the rules and
indexes that guard them, and what the live database contains.

This is the ZeusOS port of the DawinOS audit of the same name (stream H of the 2026-10 port
map). Every finding was confirmed against ZeusOS source on 2026-10-29; the DawinOS numbers are
quoted only where they explain why a rule exists. Where DawinOS had thousands of documents to
repair, ZeusOS has none (§6), so this audit fixes the model **before the first document is
written** and ships no backfill.

**Status (2026-10-29):** WP0 (integrity script), WP1 (callable gate + rules), WP2 (vocabulary),
WP3 (one report shape), WP4 (retire + converge), the D-3 cascade and archive, the D-4 shell
refusal, and the D-13 module boundary ship in one PR (`port-h-market-intel`). All thirteen
decisions are taken (§4). What is deliberately left (§5) is listed with the reason.

---

## 1. Headline

The module reached ZeusOS as a verbatim copy of the DawinOS one, then was renamed in places and
never used. **Three client surfaces, 35 named collections, three subsidiary vocabularies — and
not one of them is a Zeus brand.**

The five numbers that matter:

| What | Measured | Why it matters |
|---|---|---|
| Market-intelligence collections present in the live `zeusos` database | **0** of 35 (§6) | Nothing to repair; everything to prevent |
| Subsidiary vocabulary the module speaks | `finishes \| advisory \| technology \| capital` on the scan type, the scan brief, the MCP enum and every scoped field — **0** of them a `SubsidiaryId` | A scan could only be run "for" a company that does not exist |
| Cloud Functions that check more than `request.auth` | **0** of 12 callables (+1 schedule) | An anonymous client-portal identity could run a paid Gemini scan |
| Rules blocks on `isAuthenticated()` for read **and** write | **20** (5 of them delete on `isAuthenticated()` too), plus `market_insights` with no code behind it | The portal identity above could also write every record directly |
| Client surfaces for one module | **3** (`intelligence` 30.8k lines routed; `market-intelligence` 10.9k lines unrouted and unimported; `executive/market-intelligence` 28 lines of stubs) | CLAUDE.md asked for the boundary to be drawn in 6.F.6 |

Nothing here has lost data, because nothing has been written. What it would have lost on the
first real use is trust: a report stamped `finishes`, invisible to the brand it was about; a
competitor deleted with "all associated data" still pointing at it; a social sync writing rows
with made-up ids.

---

## 2. Collection register

"Subsidiary" is the field that scopes the doc and the spelling it carried before this audit.
Verdict: **keep** (fixed in place), **converge** (folded into another collection), **retire**.
Every collection holds 0 documents (§6).

| Collection | Type | Client writer | Server writer | Rules before (read / write / delete) | Subsidiary field · spelling before | Verdict |
|---|---|---|---|---|---|---|
| `competitors` | `Competitor` (`types/competitor.types.ts`) | `competitorService` create/update/**delete** | `enhanceCompetitorProfile`, `discoverCompetitors`, AI scan (reads) | auth / auth / isAdmin | `subsidiariesCompeting[]` · DawinOS short | keep |
| `competitor_swot` | `SWOTAnalysis` | `swotService` | — | auth / auth / isAdmin | none | keep |
| `competitive_moves` | `CompetitiveMove` | `competitiveMoveService` | AI scan (`marketIntelligence.js`) | auth / auth / isAdmin | `impactedSubsidiaries[]` · short | keep |
| `win_loss_records` | `WinLossRecord` | `winLossService` | — | auth / auth / isAdmin | `dawinSubsidiary` · short | keep (pitch win/loss is a real agency record) — field renamed `subsidiaryId` |
| `digital_profiles` | `DigitalProfile` | `digitalProfileService` (incl. delete) | `discoverDigitalProfiles`, marketing's `registerOwnDigitalProfile` | auth / auth / **auth** | none (own accounts carry `subsidiaryId` as marketing provenance) | keep |
| `profile_snapshots` | `ProfileSnapshot` | `saveSnapshot` (no caller) | — | auth / create only / isAdmin | none | **retire** |
| `social_posts` | `SocialPost` | read only | `syncSocialMetrics`, `fetchSocialPosts`, `triggerSocialSync` | auth / auth / isAdmin | `subsidiaryId` (own accounts only) | keep — shells refused (D-4) |
| `social_metrics` | `SocialMetrics` | read only | same | auth / create only / isAdmin | same | keep — zero rows refused (D-4) |
| `tracked_topics` | `TrackedTopic` | `topicTrackingService` (incl. delete) | `scanTopicMentions` | auth / auth / **auth** | none | keep |
| `topic_mentions` | `TopicMention` | `topicTrackingService` (incl. delete) | `scanTopicMentions` | auth / auth / **auth** | none | keep |
| `news_articles` | `NewsArticle` | `useNewsFeed` (`isRead` / `isBookmarked`) | `scanMarketNews` | auth / auth / isAdmin | none | keep |
| `ai_insights` | `Insight` (`types.ts`) | `useInsights` status | `generateMarketInsights` | auth / auth / isAdmin | none | keep — **the** insight collection (D-6) |
| `market_analyses` | none (read as `any`) | — | `analyzeMarketSector` | auth / auth / isAdmin | none | keep |
| `market_intelligence_reports` | `StoredMarketIntelligenceReport` | `intelligenceService.createReport` (unrouted) | AI scan | auth / auth / isAdmin | `subsidiaryId` · short | keep — one shape (WP3), server-written |
| `market_intelligence_insights`, `_action_items`, `_dashboards`, `_widgets`, `_data_sources`, `_analytics`, `_report_schedules` | `intelligence-dashboard` submodule | `intelligenceService` (unrouted) | — | **no rules block at all** | `organizationId` | **retire** (D-5) |
| `pestel_analyses`, `environment_signals`, `regulatory_items`, `scenarios`, `early_warning_alerts`, `alert_triggers`, `tracked_indicators` | `environment-scanning` submodule | `scanningService` (unrouted); `strategyDataAggregator` reads 5 of them | — | auth / auth / isAdmin | none | **retire** (D-5) |
| `market_insights` | — | nothing (task-engine module map only) | — | auth / **auth** / isAdmin, 2 indexes | — | **retire** (rules hole) |
| `market_share_data`, `pricing_intelligence`, `market_signals`, `market_reports`, `intelligence_items`, `swot_analyses` | types/schemas only (`MarketShareData`, `PricingIntelligence`) | nothing | — | auth / auth / isAdmin (two on **auth** delete); `market_signals` ×4 and `market_share_data` ×1 indexes | — | **retire** |
| `executive/market_intelligence/**` | — | nothing (`src/executive/market-intelligence` is four empty `export {}` files) | — | isExecutive | — | **retire** |

Rules helpers after this audit (`firestore.rules`, next to `isExecutive()`): `callerStaffDoc()`,
`isActiveStaff()`, `canReadMarketIntel()` = admin ∨ executive claim ∨ active staff profile,
`canWriteMarketIntel()` = the same minus the `viewer` globalRole. One block per owned
collection, nothing else; the owned list is `MARKET_INTEL_COLLECTIONS` in
[`functions/src/lib/marketIntelVocabulary.js`](../functions/src/lib/marketIntelVocabulary.js)
and the lockstep test fails when the rules and the registry disagree.

---

## 3. Findings

Severity: Critical / High / Medium / Low / note. "Closed" names what this PR did.

### A. Identity and scoping

| # | Finding | Where | Sev | Closed |
|---|---|---|---|---|
| A1 | **Three subsidiary vocabularies, none a Zeus brand.** `MarketIntelSubsidiaryId = 'finishes' \| 'advisory' \| 'technology' \| 'capital'` on the client; `SUBSIDIARY_CONTEXT` keyed the same on the server with "Dawin Finishes … custom millwork" briefs; the MCP enum `['finishes','technology','capital']`; `SUBSIDIARY_OPTIONS` half-renamed ("Zeus Group" twice, "Zeus Technology", "Zeus Capital"); the task-engine map stamped `market_intelligence → 'finishes'`. The Smart Task Core inside the same module carries a fourth list (`SUBSIDIARY_IDS {group, finishes, technology, capital}` in `config/constants.ts`, 60 occurrences across `skills-catalog.ts` and `role-profile.constants.ts`). | `types/market-intelligence.types.ts:11,233`; `functions/src/ai/marketIntelligence.js:33`; `zeusos-mcp-server/src/tools/finance.ts:345`; `intelligence-layer/services/intelligenceIntegrationService.ts` | High | D-1: one registry, the five brands. The Smart Task Core list is **not** market intelligence and is left for 6.A (§5). |
| A2 | **One reports collection, two writer shapes.** The AI scan stored whatever the model wrote — `reportTitle`, a `generatedAt` the model typed as a string (`"ISO date string"` is literally in the prompt), a short-form `subsidiaryId` — plus `status: 'completed'`; the unrouted dashboard wrote `title` / `type` / `organizationId`. `getMarketIntelligenceReports` filtered on `subsidiaryId`, the MCP tool printed `reportTitle`, the strategy aggregator filtered on `title` (so scan reports never reached strategy). | `marketIntelligence.js:331,476,521`; `finance.ts:392`; `strategyDataAggregator.ts:352` | High | D-6/WP3: `scanReportCore` stamps the core, `toReportWire` normalises every read. |
| A3 | **Two insight models and a phantom.** `ai_insights` (server writer, routed page), `market_intelligence_insights` (unrouted, no server writer) and `market_insights` (rules block, two indexes, named only by the task-engine module map — writable by any signed-in user). | `firestore.rules`, `firestore.indexes.json`, `intelligenceIntegrationService.ts:54` | Medium | D-6: `ai_insights` is the one; the other two retired. |
| A4 | The dashboard submodule declared its own `BaseEntity {organizationId, createdBy, updatedBy}` while the routed module scopes by brand with optional actors; 0 competitors would ever carry `createdByName` (the `stampActor` contract). | `market-intelligence/intelligence-dashboard/types` | Low | Submodule retired; `createdByName` on competitors remains open (§5). |

### B. Referential integrity

| # | Finding | Where | Sev | Closed |
|---|---|---|---|---|
| B1 | **Competitor delete is a bare `deleteDoc` and nothing cascades.** The confirm dialog promised "all associated data will be removed"; no server trigger existed; `archiveCompetitor` overwrote `notes` with the reason and had no caller. Six child collections key on `competitorId`. | `services/competitorService.ts:313-325`; `pages/CompetitorDetailPage.tsx:721` | Critical | D-3: client archives; admin hard delete cascades (`onCompetitorDeleted`, pure `planCompetitorCascade`). |
| B2 | **The FK field carries sentinels.** Marketing's bridge stamps own accounts `competitorId: 'OWN_<subsidiaryId>_<accountId>'` so the scraper's required-field check passes. A join reads them as orphans. | `functions/src/marketing/registerOwnDigitalProfile.js:97-99` | Medium | Registered as `COMPETITOR_ID_SENTINEL_PREFIXES`; the audit script and the cascade skip them. The discriminator (`subjectKind`) is open (§5). |
| B3 | `news_articles` are deduped on `sourceUrl` equality at write time only; no natural key. | `marketIntelFunctions.js` | Medium | Open (§5). |
| B4 | `topic_mentions` likewise; `tracked_topics.relatedCompetitorIds` is never written. | `digitalProfileDiscovery.js` | Low | Open (§5); the cascade detaches the array when it is. |
| B5 | **The social tracker writes shells.** `postId` fell back to `` `ig_${Date.now()}_${Math.random()}` `` (and `tw_`, `tt_`, `fb_`, `yt_`, `post_`) — no natural key, no dedupe — and account rows with every count at zero were stored. In DawinOS that was 2,685 synthetic ids and 2,212 zero-follower rows in a 3,000-row sample, mirrored to BigQuery. | `socialTrackerFunctions.js:232-331,358` | High | D-4: natural id or refused; doc id `{platform}_{postId}`; zero-metric rows refused (`lib/socialPostKeys.js`). |
| B6 | **Dead storage.** `profile_snapshots` (writer with no caller), the seven dashboard collections (no rules block, unrouted page), `MarketShareData` / `PricingIntelligence` (types + zod schemas, no collection, no component), `market_signals` ×4 / `market_share_data` ×1 / `competitors.companyId` ×3 indexes on fields no document has, the `executive/market_intelligence/**` gate over four empty files, the global-search `competitor` entry scoped on `organizationId` (no document has it). | `firestore.indexes.json`; `src/executive/market-intelligence`; `navigation.constants.ts:336` | Low | D-5: all retired; 10 indexes dropped; search entry unscoped. |

### C. Type ↔ data drift

| # | Finding | Where | Sev | Closed |
|---|---|---|---|---|
| C1 | `positioning.valuePropositon` (typo) seeded by the client; the type declares both spellings. | `types/competitor.types.ts`; `competitorService.ts` | Medium | Open (§5) — no document carries either yet. |
| C2 | Enrichment stamps `lastEnhancedAt/By` on the server; the type declares `lastEnrichedAt/By`. | `marketIntelFunctions.js`; `competitor.types.ts` | Low | Open (§5). |
| C3 | Dates: the scan's `generatedAt` was a model string (A2); `ai_insights.createdAt` typed `string`, written `serverTimestamp()`; `StoredMarketIntelligenceReport.createdAt` typed `string`, written Timestamp (the callable converts, so the wire is honest). | `types.ts:192`; `marketIntelFunctions.js:470` | Medium | Reports fixed (WP3). Insights: declared as stored (§5 for the rest). |
| C4 | Two `ThreatLevel` enums; the comparison page reads never-stored fields via `as any`. | `constants.ts` vs `constants/competitor.constants.ts`; `pages/CompetitorComparisonPage.tsx` | Medium | Open (§5). |
| C5 | Confidence scales mixed: server writers 0–1, client defaults 0–100. | `competitorService.ts`; `InsightCard.tsx` | Medium | D-7 decided; code open (§5). |
| C6 | Stored but undeclared: `ai_insights.createdBy`, `type: 'risk'` (the model names it; `InsightType` lacked it); `win_loss_records.dawinSubsidiary` vs the renamed `subsidiaryId`. | `marketIntelFunctions.js:454-471` | Low | `createdBy` and `risk` declared; `dawinSubsidiary` → `subsidiaryId` (type, schema, service, filter). |
| C7 | `schemas/competitor.schemas.ts` (zod) is imported by nothing; the scanner still writes the `@deprecated` `isRead` / `isBookmarked`. | `schemas/index.ts`; `marketIntelFunctions.js` | Low | Schemas now carry the brand enum; wiring them into create/update is open (§5). The rules allow a reader to flip exactly `isRead` / `isBookmarked` / `isFlagged`. |

### D. State machines

| # | Finding | Where | Sev | Closed |
|---|---|---|---|---|
| D1 | No transition guard anywhere: `competitive_moves.status`, `ai_insights.status`, `tracked_topics.status`, SWOT `review`/`archived` are all free writes. | hooks / services | Medium | Open (§5, WP7). |
| D2 | `competitors.status` has writers for `active` / `inactive` / `watching` only; `toggleAlerts` repurposes `monitoringFrequency`. Archive now sets `inactive` and the stamp. | `useCompetitors.ts:76-95` | Low | Open (§5). |

### E. Access, rules, tests, operations

| # | Finding | Where | Sev | Closed |
|---|---|---|---|---|
| E1 | **No Cloud Function checks more than `request.auth`.** 12 callables (`marketIntelligenceScan`, `getMarketIntelligenceReports`, `enhanceCompetitorProfile`, `scanMarketNews`, `generateMarketInsights`, `analyzeMarketSector`, `discoverCompetitors`, `discoverDigitalProfiles`, `scanTopicMentions`, `fetchSocialPosts`, `analyzeSocialStrategy`, `triggerSocialSync`) accept the anonymous client-portal identity; the Admin SDK bypasses the rules; eight of them spend Gemini budget. | every `onCall` in `functions/src/intelligence/*.js` and `ai/marketIntelligence.js` | High | WP1: `assertMarketIntelCaller` is the first statement of all 12; a text-scan test fails when one is not. |
| E2 | Rules: every market block was `isAuthenticated()` for read and write (portal identities included); `digital_profiles`, `tracked_topics`, `topic_mentions`, `market_signals`, `intelligence_items` deleted on `isAuthenticated()`; `market_insights` writable by anyone. The strategy aggregator wrapped five reads in one `try`, so one denial blanked the whole market block. | `firestore.rules:936-1008,2170,2805-2965`; `strategyDataAggregator.ts:273-368` | High | WP1 rules; aggregator reads only reports now, through `reportShape`. |
| E3 | Tests: no rules test touched any market collection; zero service tests; the two submodules had none. | `src/testing/rules/` | Medium | 40 functions tests + 3 client suites + `src/testing/rules/market-intel.test.ts` (emulator-only, **not run in this PR** — no Java on the build host). |
| E4 | No market-intelligence record carries a human-readable number, and none should. | — | note | D-8. |
| E5 | `operationalBigQuerySync.js` in the same folder is DawinOS (inventory / sales-order / matflow triggers), not exported, kept only as a model for `marketingBigQuerySync.js`. | `functions/src/intelligence/operationalBigQuerySync.js` | Low | Open (§5). |

### F. Opportunity structure and the hand-off to CRM

The DawinOS audit's theme F (289 scanned tenders, an agent creating `crmDeals` unapproved, a
dangling link, no round trip) **does not exist in ZeusOS**: there is no opportunity scanner, no
`market_opportunities` collection, no opportunity write tool, and the CRM module is `crm_leads`
only (`src/modules/crm/services/lead.service.ts`). D-9 holds by construction — the dispatcher's
draft-only allowlist is `write.draft_message` / `write.create_task` / `write.create_alert` /
`write.acknowledge_alert`, and no agent write handler touches `crm_leads`, `clients`,
`master_jobs` or `competitors` — and `functions/__tests__/market-intel/agentsDraftOnly.test.js`
pins it so a future tool cannot widen the list unnoticed. The ZeusOS-shaped hand-off (an insight
or competitor flag that names a prospect → a `crm_leads` row through the lead service, with the
lead's outcome shown on the insight) is a feature for when the module is adopted, not a repair (§5).

---

## 4. Decisions (owner)

Taken 2026-10-29 for ZeusOS; D-1 to D-12 keep the DawinOS numbering so the two audits read side
by side, D-13 is new.

**D-1 — Market intelligence speaks the canonical `SubsidiaryId`, and only the five brands.**
The DawinOS rule was "the collection decides the spelling" because its index keys and sixteen
readers already used the short form. ZeusOS has no document and no reader that would be
disturbed, and CLAUDE.md names `src/core/settings/types.ts` the single source of truth, so the
market-intelligence vocabulary **is** that list minus the parent: `MARKET_INTEL_SUBSIDIARY_IDS =
zeus-the-agency | zeus-digital | labyrinth | odd-gorilla | house-of-zeus` (= `BRAND_CAPABILITIES`
keys, pinned). The parent never competes. Each brand carries a scan brief
(`SUBSIDIARY_CONTEXT`: what it competes as, industries, discovery keywords) in one registry —
`functions/src/lib/marketIntelVocabulary.js` with the client twin
`src/modules/intelligence/constants/marketIntelVocabulary.ts` — and the MCP enum, the rules and
the canonical list are lockstep-tested against it. Own-account social rows keep marketing's
`subsidiaryId` as provenance, not scope.

**D-2 — No commercial-focus axis.** DawinOS needed `focusAreas[]` because its scanner was told to
look for business lines that were not subsidiaries. ZeusOS has no scanner; a brand's focus is its
capability set (`BRAND_CAPABILITIES`), already registered. Nothing to add until an opportunity
scanner exists.

**D-3 — Competitors: soft archive on the client, cascade on the server.** The UI archives
(`archived`, `archivedAt`, `archivedBy`, `archivedByName`, `archiveReason`, `status: 'inactive'`),
lists filter archived rows in memory (a `!=` query would drop documents without the field), and
`restoreCompetitor` clears the stamp. Hard delete is `isAdmin()` and `onCompetitorDeleted`
(europe-west1) runs `planCompetitorCascade`: child rows in `competitor_swot`, `competitive_moves`,
`win_loss_records`, `digital_profiles`, `social_posts`, `social_metrics` are deleted; the id is
removed from `tracked_topics.relatedCompetitorIds` and `ai_insights.competitorIds`. Sentinels are
never matched.

**D-4 — Social rows carry information or are not written.** A post needs a natural platform id
(`naturalPostId`), is keyed `social_posts/{platform}_{postId}`, and an account row whose every
count is zero is refused. No purge: there is nothing to purge.

**D-5 — Retire.** `src/modules/market-intelligence/` (both submodules, 10.9k lines, unrouted,
unimported), `src/executive/market-intelligence/` (stubs), the seven dashboard collections, the
seven environment-scanning collections, `market_insights`, `market_share_data`,
`pricing_intelligence`, `market_signals`, `market_reports`, `intelligence_items`,
`swot_analyses`, `profile_snapshots`, the `executive/market_intelligence/**` gate, the
`MarketShareData` / `PricingIntelligence` types and schemas, and ten indexes. Kept:
`competitor_swot` (wired, used) and `win_loss_records` (an agency pitches; win/loss against a
named competitor is the record the DawinOS owner never had a user for).

**D-6 — Converge insights on `ai_insights`.** The task-engine module map now names
`['ai_insights', 'competitors']`; `InsightType` gains `risk`; `Insight` declares `createdBy`.

**D-7 — Confidence is stored 0–1 and formatted ×100 in the UI.** Decided; the client defaults
that say otherwise are a §5 item.

**D-8 — No sequential numbering** for any market-intelligence record.

**D-9 — A person creates the commercial record; the agent proposes.** Holds by construction
(§3.F) and is pinned by test.

**D-10 / D-11 / D-12 — Not applicable.** They shape an opportunity record and its CRM round trip,
neither of which ZeusOS has. When an opportunity scanner is built, build it to D-10/D-11/D-12
from day one: one server hand-off through the lead service, the lead owns the outcome, typed
facts (validated deadline, `valueText` + parsed range + ISO currency, deep-link `sourceUrl`).

**D-13 — The module boundary (closes CLAUDE.md's 6.F.6).** Three modules, bounded rather than
merged:
- **`intelligence`** owns the market-intelligence domain: the routed `/market-intel/*` surface
  and the thirteen `MARKET_INTEL_COLLECTIONS`. It also still hosts the Smart Task Core /
  role-profile / grey-area / task-generation services (human-capital side, 6.A) that `hr-central`
  and `intelligence-layer` import — those belong to the intelligence-layer boundary and move in a
  later PR (§5); nothing in them touches a market collection.
- **`intelligence-layer`** owns the event/task engine, agents, daily plan and the admin overview.
  It never reads a market collection directly; the task-engine module map is its only reference.
- **`market-intelligence`** is gone. The strategy module reads `market_intelligence_reports`
  through `utils/reportShape` and nothing else.

---

## 5. Work packages

One PR for the lot in ZeusOS, because there is no data to migrate and the pieces share files.
"Closes" names the finding ids.

| WP | Scope | Closes | Status |
|---|---|---|---|
| **WP0** | `scripts/audit-market-intel-integrity.cjs` — read-only, Admin SDK; the checks live in `scripts/lib/marketIntelIntegrity.cjs` (pure, 4 tests): documents per owned and retired collection, vocabulary per scoped field, orphan / sentinel competitor refs, archive stamps, social shells, report-shape drift; `--json`; `--strict` exits 1 on any defect | measurement | ✅ shipped (not run against the live project — needs application-default credentials; §6 was measured another way) |
| **WP1** | `assertMarketIntelCaller(auth, { need: 'view' \| 'edit' \| 'admin', action })` in `functions/src/lib/marketIntelGate.js`, first statement in all 12 callables; text-scan guard test; rules helpers + one block per owned collection; retired blocks and the `market_insights` hole removed; `src/testing/rules/market-intel.test.ts` | E1, E2, E3 (part) | ✅ shipped (rules test written, needs the emulator) |
| **WP2** | D-1: the vocabulary registry (server + client twin + MCP enum, lockstep-tested); `SUBSIDIARY_OPTIONS` derived; scan defaults; `subsidiariesCompeting[]` / `impactedSubsidiaries[]` / `win_loss_records.subsidiaryId` typed and zod-validated as brand ids | A1 | ✅ shipped |
| **WP3** | One stored report shape (`lib/marketIntelReportShape.js` + `utils/reportShape.ts`, lockstep): the scan stamps `title` / `reportType` / brand `subsidiaryId` / server Timestamp `generatedAt` / `source` / `organizationId`; `getMarketIntelligenceReports` validates the brand and returns `toReportWire`; the MCP tool and the strategy aggregator read through it; reports are server-written in the rules | A2, C3 (reports) | ✅ shipped |
| **WP4** | D-5 + D-6: the two submodules, the stubs, the registry entries, the dead types / schemas / constant, ten indexes, the `market_insights` map entry, the search `scopeField`, the strategy aggregator's five dead reads | A3, A4 (part), B6, E2 (part) | ✅ shipped |
| **WP6** | D-3 + D-4: archive on the client (`utils/competitorArchive.ts`, detail page, both hooks), `onCompetitorDeleted` + `lib/competitorCascade.js`, `lib/socialPostKeys.js` wired into the tracker | B1, B2 (sentinel registry), B5 | ✅ shipped |
| **WP5** | Type ↔ data drift: `valueProposition` spelled right by every writer, `lastEnhancedAt/By`, one `ThreatLevel`, confidence 0–1 + `formatConfidence`, the comparison page's never-stored rows, zod schemas wired into create/update, `isRead` / `isBookmarked` writers | C1, C2, C4, C5, C7 | ⏳ open — small, mechanical, no data dependency |
| **WP6b** | `subjectKind: 'competitor' \| 'own'` on `digital_profiles` / social rows instead of the `OWN_` sentinel; deterministic `news_articles/{sha1(canonicalUrl)}` and `topic_mentions/{…}` ids | B2, B3, B4 | ⏳ open |
| **WP7** | `utils/marketIntelTransitions.ts` ↔ `functions/src/lib/marketIntelTransitions.js` (moves, insights, topics, SWOT, competitor status), `assertTransition` in the status writers | D1, D2 | ⏳ open |
| **WP8** | Run the rules test under the emulator; `createdByName` on competitors via `stampActor`; `useResilientSubscription` on the module's listeners; retire `operationalBigQuerySync.js`; move the Smart Task Core services out of `intelligence` (D-13) | A4, E3 (rest), E5 | ⏳ open |
| **WP9/10** | Opportunity record + lead hand-off | F | not applicable until an opportunity scanner exists |

**Why this shape.** DawinOS ordered its packages around backfills and purges; ZeusOS has
neither, so the only ordering that matters is *gate and vocabulary before the first document*.
Everything that would otherwise have to be migrated later (the DawinOS short form on every scoped
field, the model-typed `generatedAt`, the synthetic post ids, the bare delete) is fixed in the
same PR. What is left open is code quality on an unused surface, listed so it is not forgotten.

---

## 6. Measured 2026-10-29 (read-only)

`listCollectionIds` on `projects/zeusos/databases/(default)/documents` via the Firebase
CLI credentials returned 44 top-level collections:

`advisoryPlatform, agentAuditEntries, agent_alerts, agents, ai_conversations,
asset_library_collections, asset_library_items, budget_holds, change_orders, client_competitors,
client_invoices, clients, companies, complianceDocuments, crm_leads, deadline_monitoring_logs,
domain_events, employees, freelancer_contracts, generatedTasks, generated_tasks, gl_postings,
intercompany_invoices, internal_work_orders, journal_entries, master_jobs, media_plans,
media_supplier_invoices, msas, organizations, presence, production_jobs, purchase_orders, quotes,
rate_cards, role_assignment, role_profile, share_links, sows, supplier_orgs, syncLogs,
talent_invoices, talent_profiles, users`

**None of the 35 collections named by the module is among them** — not `competitors`, not
`market_intelligence_reports`, not a single social, topic, news, insight or environment-scanning
row. The module has never been used against this project. WP0's script reproduces this as
"0 documents, 0 defects" once application-default credentials are available
(`NODE_PATH=<functions node_modules> node scripts/audit-market-intel-integrity.cjs --strict`).

Also noted in passing, outside this audit's scope: `crm_deals` (read by the agent tool
`read.crm_deals` and the finance tools) does not exist either — the CRM has `crm_leads` only.

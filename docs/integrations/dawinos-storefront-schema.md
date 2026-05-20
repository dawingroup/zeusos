# DawinOS → Storefront Data Schema

Draft v1 · 2026-05-17 · for review

## 1. Purpose

This document specifies every data point that flows from **DawinOS** (the
internal operations system) into the **Dawin Finishes Shopify storefront**.
It is the single source of truth for integration work — what each storefront
section needs, where it comes from in DawinOS, how it lands in Shopify, and
the sync cadence.

Storefront sections that consume DawinOS data live under `sections/dawin-*.liquid`;
the Shopify landing targets are products, articles, metafields, and metaobjects.

## 2. System map

```
   ┌──────────────────────────────────────────────┐
   │                  DawinOS                     │
   │  (operations · ops · marketing · workshop)   │
   ├──────────────────────────────────────────────┤
   │  Design module      Marketing module         │
   │  Manufacturing      Strategy module          │
   │  Inventory          Press / PR               │
   │  Finishes library   Customer voices          │
   │  Formulas           Spend plans              │
   │  BoQ                Project funds            │
   └──────────────┬──────────────┬────────────────┘
                  │              │
       Push API   │              │   Pull API / webhook
      (DawinOS →  │              │   (Shopify Admin reads /
        Shopify)  │              │    DawinOS replies on demand)
                  ▼              ▼
   ┌──────────────────────────────────────────────┐
   │              Shopify storefront              │
   │  Products  · Metafields    · Metaobjects     │
   │  Articles  · Blog posts    · Section blocks  │
   │  Pages     · Theme settings · CDN images     │
   └──────────────────────────────────────────────┘
```

## 3. Transport & cadence

| Layer                | Mechanism                                                                                                          | Cadence                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Catalogue (products) | DawinOS publishes products via Shopify Admin GraphQL on create/update                                              | Event-driven (immediately on workshop sign-off)        |
| Metafields           | Same call writes per-product metafields (`finish`, `materials`, `lead_time`, `project_used_in`, `workshop_status`) | Same event as catalogue                                |
| Metaobjects          | DawinOS owns metaobject definitions: `finish`, `material`, `project`, `featured_update`, `voice`, `press_mention`  | Daily reconcile + event-driven                         |
| Article (project)    | DawinOS design module publishes case study to blog `projects` with metafields                                      | On project handover                                    |
| Featured updates     | DawinOS marketing module rotates weekly                                                                            | Weekly cron + manual override                          |
| Stock signals        | DawinOS inventory → Shopify Inventory API                                                                          | Every 15 min for stocked SKUs; immediate for MTO holds |
| Sample order leads   | Shopify form submit → DawinOS marketing inbox (webhook)                                                            | Real-time                                              |
| Custom-quote leads   | Shopify start-project form → DawinOS design intake                                                                 | Real-time                                              |

All writes use a DawinOS service account with a scoped Shopify Admin API token.
Reads from DawinOS use a signed JWT carrying `(tenant_id, scope)`.

## 4. Domain schemas

Each section below lists: **DawinOS source entity** → **Shopify destination** →
**field-level schema**.

---

### 4.1 Products

**Source**: `dawinos.inventory.item` joined with `dawinos.design.item` (for products that originated as designed pieces).
**Destination**: Shopify `product` + custom metafields under namespace `dawin`.

| Field path                       | Type            | Example                                | Required | Notes                                                                  |
| -------------------------------- | --------------- | -------------------------------------- | -------- | ---------------------------------------------------------------------- |
| `title`                          | string          | "Mawanda floor lamp"                   | yes      | Shopify native                                                         |
| `body_html`                      | rich text       | …                                      | yes      | Shopify native                                                         |
| `product_type`                   | enum            | "Lighting"                             | yes      | One of: Furniture, Décor, Fragrance, Fit-out service                   |
| `vendor`                         | string          | "Dawin Finishes — Kyambogo"            | yes      |                                                                        |
| `tags`                           | csv             | "new,brass,linen,handmade"             | yes      | Drives storefront facets                                               |
| `variants[].sku`                 | string          | `DF-LMP-MAW-001`                       | yes      | DawinOS canonical SKU                                                  |
| `variants[].price`               | money           | UGX 1250000.00                         | yes      |                                                                        |
| `variants[].inventory_quantity`  | int             | 3                                      | yes      | From DawinOS stock                                                     |
| `images[]`                       | url             | Shopify CDN                            | yes      | Uploaded from DawinOS; min 1 hero + 3 contextual                       |
| **Metafields** under `dawin.*`   |                 |                                        |          |                                                                        |
| `dawin.finish_id`                | ref             | `gid://shopify/Metaobject/123`         | yes      | Links to the `finish` metaobject (see 4.2)                             |
| `dawin.materials`                | list<ref>       | links to `material` metaobjects        | yes      |                                                                        |
| `dawin.workshop_status`          | enum            | "in-stock" / "made-to-order" / "draft" | yes      | Drives "On the bench" badge                                            |
| `dawin.lead_time_days_min`       | int             | 14                                     | yes if MTO | Drives "2–4 wks" copy                                                  |
| `dawin.lead_time_days_max`       | int             | 28                                     | yes if MTO |                                                                        |
| `dawin.hand_count`               | int             | 4                                      | optional | "04 hands" finish label                                                |
| `dawin.bench_number`             | string          | "Bench 03"                             | optional | Drives Today section + PDP eyebrow                                     |
| `dawin.signed_by`                | string          | "M. Kalu"                              | optional | Workshop lead signature                                                |
| `dawin.batch_id`                 | string          | "B-26-19-003"                          | optional | "Batch 003 · week 19"                                                  |
| `dawin.recipe_id`                | ref             | links to DawinOS formula                | optional | Used internally for reorders + finish library cross-ref                |
| `dawin.dimensions_w_mm`          | int             | 320                                    | yes      | Drives spec table                                                      |
| `dawin.dimensions_h_mm`          | int             | 1650                                   | yes      |                                                                        |
| `dawin.dimensions_d_mm`          | int             | 320                                    | yes      |                                                                        |
| `dawin.weight_kg`                | float           | 6.2                                    | yes      |                                                                        |
| `dawin.care_instructions`        | rich text       | …                                      | yes      | Confidence signal                                                      |
| `dawin.warranty_months`          | int             | 24                                     | yes      | Confidence signal                                                      |
| `dawin.country_of_origin`        | string          | "Uganda"                               | yes      | Confidence signal                                                      |
| `dawin.workshop`                 | enum            | "Kyambogo"                             | yes      |                                                                        |
| `dawin.designer_id`              | ref             | links to person / studio                | optional | "Designed by Joel Kabanda"                                             |
| `dawin.projects_used_in`         | list<ref>       | links to `project` metaobjects          | optional | "Specified for 14 projects" — confidence                               |

#### Image metadata

Each `image` carries DawinOS-attached metadata via Shopify `media.alt` plus a
parallel metafield map keyed by image position:

| Subfield                       | Type   | Example                                          |
| ------------------------------ | ------ | ------------------------------------------------ |
| `alt`                          | string | "Mawanda floor lamp in the Speke Group lounge"   |
| `dawin.image_meta[i].caption`  | string | "Plate 01 · On site at Speke Group"              |
| `dawin.image_meta[i].photographer` | string | "K. Lubowa"                                    |
| `dawin.image_meta[i].project_id`   | ref    | links to project where this shot was taken     |
| `dawin.image_meta[i].lighting`     | enum   | "natural / morning / east"                     |
| `dawin.image_meta[i].crop_focal`   | str    | "0.5,0.4"                                       |

---

### 4.2 Finishes (Finish Library)

**Source**: `dawinos.finishes.library_entry`.
**Destination**: Shopify **metaobject** `finish` plus a public Shopify page
`/pages/finish-library`. Storefront section
[`dawin-home-finish-library.liquid`](../../sections/dawin-home-finish-library.liquid)
consumes the metaobject list.

| Field                  | Type     | Example                                 | Required | Notes                                  |
| ---------------------- | -------- | --------------------------------------- | -------- | -------------------------------------- |
| `handle`               | string   | "kyambogo-bone"                         | yes      | Stable identifier                      |
| `name`                 | string   | "Kyambogo Bone"                         | yes      |                                        |
| `code`                 | string   | "DF·LW·011"                             | yes      | DawinOS recipe code                    |
| `family`               | enum     | "Lime wash" / "Tadelakt" / "Plaster"    | yes      | 8 families                             |
| `color_hex`            | color    | "#bfa382"                               | yes      | Renders chip swatch                    |
| `texture_image`        | image    | 1200×1200 square                        | yes      | Shopify CDN                            |
| `wall_preview_image`   | image    | 16:10                                   | yes      | Stage swatch in section                |
| `recipe_id`            | ref      | dawinos.formula.id                       | yes      | Internal only                          |
| `sheen`                | string   | "Matte · 3°"                            | yes      |                                        |
| `sheen_value`          | int      | 3                                       | yes      | Gloss-units (0–100)                    |
| `hand_count`           | int      | 4                                       | yes      | "04 coats"                             |
| `cure_hours`           | int      | 72                                      | yes      |                                        |
| `cure_temp_c_min`      | int      | 18                                      | yes      |                                        |
| `cure_temp_c_max`      | int      | 28                                      | yes      |                                        |
| `coverage_m2_per_kg`   | float    | 4.5                                     | yes      |                                        |
| `washability`          | enum     | "wet-cleanable" / "dry only"            | yes      | Confidence signal                      |
| `outdoor_use`          | bool     | false                                   | yes      |                                        |
| `sample_sku`           | ref      | `DF-SMP-LW-011`                         | yes      | For sample-order CTA                   |
| `sample_price_ugx`     | money    | 15000                                   | yes      |                                        |
| `sample_lead_days`     | int      | 3                                       | yes      |                                        |
| `projects_used_in`     | list<ref>| links to `project` metaobjects          | optional | Confidence — "used in 17 projects"     |
| `compatible_materials` | list<ref>| brass, lime plaster, etc.               | optional |                                        |
| `description`          | rich text| short blurb                             | yes      |                                        |
| `created_at`           | date     | 2024-08-12                              | yes      |                                        |
| `updated_at`           | date     | 2026-05-15                              | yes      | Drives "Updated · Wk 19" eyebrow       |
| `published`            | bool     | true                                    | yes      | Editor controls visibility             |
| `sort_index`           | int      | 11                                      | optional | Manual ordering                        |

---

### 4.3 Projects (case studies + portfolio)

**Source**: `dawinos.design.project`.
**Destination**: Shopify `blog/projects` `article` + metaobject `project` for
cross-linking. Storefront sections that consume:
[`dawin-projects-portfolio.liquid`](../../sections/dawin-projects-portfolio.liquid),
[`dawin-project-case-study.liquid`](../../sections/dawin-project-case-study.liquid),
[`dawin-home-featured.liquid`](../../sections/dawin-home-featured.liquid).

| Field                     | Type      | Example                                | Required |
| ------------------------- | --------- | -------------------------------------- | -------- |
| `handle`                  | string    | "speke-group-lounge"                   | yes      |
| `title`                   | string    | "Speke Group lounge"                   | yes      |
| `sector`                  | enum      | "Hospitality"                          | yes      |
| `sub_sector`              | string    | "Hotel lounge"                         | optional |
| `client`                  | string    | "Speke Group"                          | yes      |
| `client_logo`             | image     | SVG mono                                | optional | For Press section                      |
| `location_city`           | string    | "Kampala"                              | yes      |
| `location_country`        | string    | "UG"                                   | yes      |
| `year_completed`          | int       | 2025                                   | yes      |
| `month_completed`         | int       | 11                                     | yes      |
| `area_sqm`                | int       | 320                                    | yes      |
| `scope`                   | list<enum>| `["design","fitout","furniture"]`      | yes      |
| `team_lead`               | string    | "M. Kalu"                              | yes      |
| `team_size`               | int       | 14                                     | optional |
| `duration_weeks`          | int       | 22                                     | yes      |
| `budget_band`             | enum      | "M" (S/M/L/XL)                         | optional | Customer-visible bucket, not the figure|
| `quote_text`              | rich text | "We finally have a lobby that…"        | optional | For Voices section                     |
| `quote_attribution`       | string    | "Eric Mukasa, GM Speke Group"          | optional |                                        |
| `hero_image`              | image     | 16:10                                   | yes      |                                        |
| `gallery[]`               | list<image>| 4–12 images                            | yes      |                                        |
| `before_image`            | image     |                                         | optional | For before/after slider                |
| `after_image`             | image     |                                         | optional |                                        |
| `floor_plan_image`        | image     |                                         | optional |                                        |
| `body_long`               | rich text |                                         | yes      | The actual case study copy             |
| `finishes_used[]`         | list<ref> | links to `finish` metaobjects           | yes      | Drives "finishes specified" rail       |
| `materials_used[]`        | list<ref> | links to `material` metaobjects         | yes      |                                        |
| `products_used[]`         | list<ref> | links to Shopify products               | optional | Drives cross-sell                      |
| `press_mentions[]`        | list<ref> | links to `press_mention` metaobjects    | optional |                                        |
| `commissioned_by`         | enum      | "client" / "architect" / "studio"      | optional |                                        |
| `partner_architect`       | string    |                                         | optional |                                        |
| `published`               | bool      | true                                    | yes      |                                        |
| `sort_index`              | int       |                                         | optional | Front-page featured ordering           |
| `bench_log[]`             | list      | timestamped photos + captions           | optional | Drives "On the bench" timeline         |

---

### 4.4 Featured Updates (the "Today in the studio" section)

**Source**: `dawinos.marketing.featured_update`.
**Destination**: Shopify metaobject `featured_update`; storefront section
[`dawin-home-today.liquid`](../../sections/dawin-home-today.liquid) reads the
current set ordered by `live_from desc`.

| Field             | Type      | Example                                   | Required |
| ----------------- | --------- | ----------------------------------------- | -------- |
| `handle`          | string    | "wk-19-walnut-credenza"                   | yes      |
| `headline`        | string    | "Walnut credenza."                        | yes      |
| `subhead`         | string    | "Hand-rubbed oil · day 4 of 7"            | yes      |
| `eyebrow`         | string    | "Bench 03"                                | yes      |
| `image`           | image     | 1:1                                        | yes      |
| `link_url`        | url       | "/products/walnut-credenza"               | optional |
| `link_label`      | string    | "See on the bench ↗"                      | optional |
| `bench_id`        | string    | "B-26-19-003"                             | optional | Cross-references manufacturing order    |
| `project_id`      | ref       | optional project link                       | optional |
| `live_from`       | datetime  |                                            | yes      |
| `live_until`      | datetime  |                                            | optional | Auto-expires                            |
| `priority`        | int       | 1–10                                      | yes      | Sort order                              |
| `category`        | enum      | "bench" / "shipment" / "delivery" / "press"| yes     |
| `tone`            | enum      | "warm" / "cool" / "bold" / "raw"          | optional | Visual tonal mapping                    |
| `published`       | bool      | true                                       | yes      |                                          |

Rotation rule: section shows the 3 most-recent published items with
`live_from <= now < live_until`, ordered by `priority desc, live_from desc`.

---

### 4.5 Manufacturing & Lead Time

**Source**: `dawinos.manufacturing.order` joined to `dawinos.inventory.item`.
**Destination**: per-product metafields (`dawin.lead_time_days_min/max`,
`dawin.workshop_status`), and a section-level field on PDP showing live
bench status if `category == 'manufacturing'`.

| Field                       | Type    | Example                          | Used for                                          |
| --------------------------- | ------- | -------------------------------- | ------------------------------------------------- |
| `mo.product_id`             | ref     |                                  | Resolves which Shopify product to update         |
| `mo.stage`                  | enum    | "queue / build / finish / cure"  | Drives "On the bench" badge wording               |
| `mo.percent_complete`       | int     | 64                               | Progress dot on PDP "Made-to-order" banner       |
| `mo.expected_ship_date`     | date    | 2026-06-08                       | "Ships ~ June 8"                                  |
| `mo.lead_days_remaining`    | int     | 22                               |                                                   |
| `mo.batch_id`               | string  | "B-26-19-003"                    |                                                   |
| `mo.bench_log[]`            | list    | timestamped images + captions    | "Today in the studio" feeder                      |
| `mo.qa_passed`              | bool    |                                  | Gates "ready to ship"                             |

When `mo.stage` transitions to `ship`, `dawin.workshop_status` flips to
`in-stock` on the related product (if a sellable variant exists).

---

### 4.6 Materials & Provenance

**Source**: `dawinos.materials.entry` (a thin wrapper around finishes + raw
inputs).
**Destination**: Shopify metaobject `material`; referenced from products and
finishes.

| Field             | Type    | Example                  | Required |
| ----------------- | ------- | ------------------------ | -------- |
| `handle`          | string  | "kyambogo-lime"          | yes      |
| `name`            | string  | "Kyambogo lime plaster"  | yes      |
| `category`        | enum    | "plaster" / "timber" / "metal" / "fibre" | yes |
| `origin_country`  | string  | "Uganda"                 | yes      |
| `origin_region`   | string  | "Lake Albert"            | optional |
| `supplier`        | string  | "Albert Lime Co."        | optional |
| `is_local`        | bool    | true                     | yes      | Drives "100% locally sourced" badge      |
| `is_sustainable`  | bool    | true                     | yes      | Customer-confidence flag                  |
| `cert_image`      | image   |                          | optional | E.g. FSC for timber                       |
| `description`     | richtext|                          | yes      |                                            |

---

### 4.7 Voices (testimonials)

**Source**: `dawinos.marketing.voice` (curated from project hand-overs +
follow-ups).
**Destination**: Shopify metaobject `voice`; section
[`dawin-home-voices.liquid`](../../sections/dawin-home-voices.liquid) pulls the
5 most-recent with `featured = true`.

| Field           | Type    | Example                            | Required |
| --------------- | ------- | ---------------------------------- | -------- |
| `quote`         | rich text| "We finally have a lobby that…"   | yes      |
| `attribution`   | string  | "Eric Mukasa"                      | yes      |
| `role`          | string  | "GM, Speke Group"                  | yes      |
| `company`       | string  | "Speke Group"                      | yes      |
| `company_logo`  | image   |                                    | optional |
| `project_id`    | ref     |                                    | optional | Source project                            |
| `quote_date`    | date    |                                    | yes      |
| `tone`          | enum    | "warm" / "trade" / "press"         | optional |
| `lead`          | bool    | true                               | yes      | One can be marked the lead at a time      |
| `featured`      | bool    | true                               | yes      |
| `consent_given` | bool    | true                               | yes      | Confidence + GDPR-style check             |

---

### 4.8 Press & Recognition

**Source**: `dawinos.marketing.press_mention`.
**Destination**: Shopify metaobject `press_mention`; section
[`dawin-home-press.liquid`](../../sections/dawin-home-press.liquid).

| Field           | Type    | Example                          | Required |
| --------------- | ------- | -------------------------------- | -------- |
| `publication`   | string  | "Daily Monitor"                  | yes      |
| `publication_logo` | image| SVG mono                          | yes      |
| `title`         | string  | "The studio finishing Kampala"   | yes      |
| `url`           | url     |                                  | optional |
| `date_published`| date    |                                  | yes      |
| `pull_quote`    | string  |                                  | optional |
| `featured`      | bool    | true                             | yes      |

---

### 4.9 Custom-quote triggers

**Source**: incoming `dawinos.design.intake` from storefront form submissions.
**Destination**: webhook from Shopify → DawinOS endpoint.

| Field                      | Type    | Example                                | Required |
| -------------------------- | ------- | -------------------------------------- | -------- |
| `intake_id`                | string  | `DF·PROJ·26W19·001`                    | yes      |
| `submitted_at`             | datetime|                                         | yes      |
| `type`                     | enum    | "residential / commercial / hospitality / exhibition / custom-piece" | yes |
| `scope[]`                  | list    | `["design","fitout","furniture"]`      | yes      |
| `location`                 | string  | "Muyenga, Kampala"                     | yes      |
| `area_sqm`                 | int     | 320                                    | optional |
| `budget_ugx_min`           | money   | 50000000                               | optional |
| `budget_ugx_max`           | money   | 150000000                              | optional |
| `deadline_text`            | string  | "Open for Eid"                         | optional |
| `brief_text`               | rich    |                                         | yes      |
| `vibe_tags[]`              | list    | `["warm","layered","brass"]`           | optional |
| `finishes_picked[]`        | list<ref>| references to `finish` metaobjects     | optional |
| `references`               | rich    | URLs and notes                          | optional |
| `contact_name`             | string  |                                         | yes      |
| `contact_email`            | string  |                                         | yes      |
| `contact_phone`            | string  |                                         | optional |
| `contact_company`          | string  |                                         | optional |
| `referrer`                 | enum    | "google / instagram / friend / repeat" | optional |
| `consent_nda`              | bool    |                                         | optional |
| `consent_visit`            | bool    |                                         | optional |
| `consent_publish`          | bool    |                                         | optional |

---

### 4.10 Sample orders

**Source**: storefront sample CTA → `dawinos.marketing.sample_request`.
**Destination**: real Shopify products (one per finish) OR webhook-only intake.

| Field            | Type    | Example                | Required |
| ---------------- | ------- | ---------------------- | -------- |
| `request_id`     | string  | `SMP·26W19·047`        | yes      |
| `finish_handle`  | string  | "kyambogo-bone"        | yes      |
| `quantity`       | int     | 1                      | yes      |
| `contact_name`   | string  |                        | yes      |
| `contact_phone`  | string  |                        | yes      |
| `delivery_addr`  | string  |                        | yes      |
| `submitted_at`   | datetime|                        | yes      |
| `channel`        | enum    | "web / whatsapp / phone" | yes    |

---

## 5. Shopify landing targets

| DawinOS entity     | Shopify target              | Liquid handle                                            |
| ------------------ | --------------------------- | -------------------------------------------------------- |
| Product            | `product`                   | `product.metafields.dawin.*`                             |
| Finish             | metaobject `finish`         | `shop.metaobjects.finish[handle]`                        |
| Material           | metaobject `material`       | `shop.metaobjects.material[handle]`                      |
| Project            | metaobject `project` + article `blog/projects` | `article.metafields.project.*`        |
| Featured update    | metaobject `featured_update`| `shop.metaobjects.featured_update.values`                |
| Voice              | metaobject `voice`          | `shop.metaobjects.voice.values`                          |
| Press mention      | metaobject `press_mention`  | `shop.metaobjects.press_mention.values`                  |
| Manufacturing flag | per-product metafield        | `product.metafields.dawin.workshop_status`               |

## 6. Identifiers & resolution

* DawinOS canonical IDs are **never** the SKU. They're internal UUIDs that
  resolve to Shopify GIDs via a mapping table inside DawinOS.
* Public-facing handles are Shopify-style kebab-case (`kyambogo-bone`), not
  DawinOS IDs.
* Image filenames embed the DawinOS asset ID in the alt-text suffix
  (`Walnut credenza · DAW-IMG-aef3b2`) so DawinOS can reverse-lookup edits.
* Every metaobject carries `dawin.source_id` (hidden field) for round-trip.

## 7. Customer-confidence layer

The audit calls out that buyers need confidence signals throughout the site.
These fields are repeated across entities deliberately — they exist to be
surfaced. The schema groups them:

| Confidence signal           | Where surfaced                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Workshop provenance         | Today section · PDP "on the bench" · article hero                                                                   |
| Hand-count / process detail | Finish library · PDP "How it's made"                                                                                |
| Lead time precision         | PDP banner · cart drawer per-line · sticky buy-bar                                                                  |
| Material origin / local     | PDP spec table · finish library legend                                                                              |
| Project track record        | PDP "Specified for N projects" · finish library "Used in N projects"                                                |
| Press mentions              | Home press · article footer                                                                                         |
| Customer voices             | Home voices · article footer · PDP after spec table                                                                 |
| Care + warranty             | PDP collapsible "Care" panel · article footer                                                                       |
| Photo provenance            | Image caption underneath gallery — photographer + project + lighting                                                 |
| Sample-order option         | Finish library sticky CTA · PDP "Order a sample first" tile                                                          |

## 8. Implementation phases

### Phase 1 — Inventory + Product enrichment

* Define Shopify metafield definitions for the `dawin.*` namespace.
* DawinOS push API: products + variants + standard metafields. Push hero image
  + alt text only (rest later).
* Test: create one product end-to-end in DawinOS, see it land on Shopify with
  the right tag, metafield, lead time.

### Phase 2 — Finish library + Materials

* Define `finish` and `material` metaobjects in Shopify.
* DawinOS publishes the 64 finishes; the existing
  [home-finish-library section](../../sections/dawin-home-finish-library.liquid)
  swaps from inline blocks to metaobject reads.

### Phase 3 — Projects + voices + press

* Define `project`, `voice`, `press_mention` metaobjects.
* DawinOS publishes 20–30 projects with full case-study data; storefront
  blog gets retrofitted to read those.

### Phase 4 — Live operations (Today + manufacturing status)

* DawinOS rotates the Today section weekly.
* Manufacturing module wires the "On the bench" badge on MTO products.

### Phase 5 — Inbound (start-project, sample-order)

* Shopify form submissions webhook to DawinOS; DawinOS replies with intake
  receipt and ticket ID.
* Sample-order CTA becomes either real Shopify product variants
  (one per finish) or a webhook-only intake (see § 4.10).

## 9. Open questions

1. ~~**Metaobjects vs. metafields** for projects~~ — **Decided 2026-05-17:**
   projects are **metaobjects** with a Shopify metaobject template
   (`templates/metaobject.project.json`). URL-addressable at
   `/metaobjects/project/{handle}` (remappable to `/projects/{handle}` via
   the metaobject definition). Articles are not used. See §10 for the SEO
   + LLM discoverability layer that makes this work.
2. **Image hosting** — if DawinOS originates images, do they live in DawinOS
   storage and stream via signed URLs, or are they uploaded to Shopify CDN
   on publish? Recommend: Shopify CDN on publish, with the original retained
   in DawinOS for re-export.
3. **Sample order** — for now is a webhook (per the storefront audit answer);
   when do we promote to real SKUs? Trigger: when sample volume > N/month.
4. **Multi-language** — Shopify markets supports per-locale fields. Where in
   DawinOS does the Luganda or Swahili translation live?
5. **Stock reconciliation** — DawinOS is source of truth for "in-stock" vs.
   "made-to-order". What's the fallback rule if Shopify Inventory API and
   DawinOS disagree?
6. **Auth model** — service account scopes need pinning. Recommend: one
   write-only token for catalogue, one for marketing, separate rotations.
7. **Press logos & client logos** — DawinOS marketing module needs an asset
   library so the same Speke Group logo isn't re-uploaded for every project.

---

## 10. SEO + LLM-discoverability layer

Metaobjects perform identically to articles in search **iff** the template
emits the right structured data. This section pins the contract.

### 10.1 URL pattern

| Entity        | Default Shopify URL                    | Remapped public URL       |
| ------------- | --------------------------------------- | ------------------------- |
| `project`     | `/metaobjects/project/{handle}`         | `/projects/{handle}`      |
| `finish`      | `/metaobjects/finish/{handle}`          | `/finishes/{handle}`      |
| `material`    | not URL-addressable (referenced inline) | —                         |
| `featured_update` | not URL-addressable                  | —                         |
| `voice`       | not URL-addressable                      | —                         |
| `press_mention` | not URL-addressable                   | —                         |

Remap is configured by setting `"capabilities": { "online_store": { "url_handle": "projects" }}`
in the metaobject definition.

### 10.2 JSON-LD per template

**Every metaobject template that is URL-addressable** emits structured data.
Snippet locations:

| Surface          | Snippet                                                        | Schema.org types                                 |
| ---------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| Home             | [`dawin-jsonld-organization`](../../snippets/dawin-jsonld-organization.liquid) | `Organization`, `Place`, `WebSite` (with SearchAction) |
| Project page     | [`dawin-jsonld-project`](../../snippets/dawin-jsonld-project.liquid)           | `CreativeWork`, `Place`, `Organization`, embedded `Product[]` |
| Finish page      | [`dawin-jsonld-finish`](../../snippets/dawin-jsonld-finish.liquid)             | `Product` (color, brand, offers), embedded `Review[]` |
| Product page     | (Shopify default + custom additions for finish + materials)    | `Product`, `Offer`, embedded `ImageObject[]`     |

### 10.3 Schema.org field mapping

#### `project` → `CreativeWork`

| Schema.org         | Source field                          |
| ------------------ | ------------------------------------- |
| `name`             | `project.title`                       |
| `description`      | `project.body_long` (first 320 chars) |
| `image`            | `project.hero_image` + gallery[]      |
| `dateCreated`      | `project.year_completed`-`month`      |
| `creator`          | `project.team_lead` (Person)          |
| `author`           | Organization: Dawin Finishes          |
| `locationCreated`  | `Place` from `project.location_*`     |
| `keywords`         | `sector`, `finishes_used`, `scope`    |
| `about`            | `Organization` for `project.client`   |
| `mainEntity`       | List of `Product` for `products_used` |

#### `finish` → `Product`

| Schema.org         | Source field                          |
| ------------------ | ------------------------------------- |
| `name`             | `finish.name`                         |
| `sku`              | `finish.code`                         |
| `color`            | `finish.color_hex`                    |
| `material`         | `finish.family`                       |
| `brand`            | "Dawin Finishes"                      |
| `image`            | `finish.wall_preview_image`           |
| `offers`           | `Offer` for sample SKU                |
| `additionalProperty` | `sheen`, `hand_count`, `cure_hours`, `washability` |
| `review`           | linked `voice` entries                |

### 10.4 LLM discoverability

#### `/llms.txt`

Generated from a Liquid template at
[`templates/page.llms-txt.liquid`](../../templates/page.llms-txt.liquid).
Shopify serves it at `/pages/llms-txt`; a URL redirect from `/llms.txt` →
`/pages/llms-txt` is set in Shopify admin.

The file is markdown with one section per content type:

```
# Dawin Finishes
Kampala-based interior design + finishes studio.

## Projects
- [Speke Group lounge](/projects/speke-group-lounge): Hospitality, 320m², 2025, …
- [Muyenga family home](/projects/muyenga-family-home): Residential, …

## Finishes
- [Kyambogo Bone](/finishes/kyambogo-bone): Lime wash, matte 3°, 4 coats, …
- [Lubowa Stone](/finishes/lubowa-stone): Tadelakt, …

## Catalogue
- [Furniture](/collections/furniture)
- [Décor](/collections/home-decor)
- [Fragrances](/collections/home-fragrances)
- [Fit-outs](/pages/fitouts)
```

#### `/llms-full.txt`

Optional second file with the full prose body of every project + finish for
LLM training crawlers. Same template approach; not built in Phase 1.

#### `robots.txt`

Confirm these crawlers are *not* blocked (Shopify default allows all; verify
in `Settings → Apps and sales channels → Online Store → Preferences →
Robots.txt`):

- `GPTBot` (OpenAI)
- `ClaudeBot` (Anthropic)
- `PerplexityBot`
- `Google-Extended` (Gemini training)
- `CCBot` (CommonCrawl — feeds many LLMs)

#### Sitemap

Shopify auto-generates `/sitemap.xml` and includes metaobjects when
`online_store: true`. After metaobject creation, submit to:

- Google Search Console
- Bing Webmaster Tools (also handles IndexNow ping)

### 10.5 Canonical & social

Every metaobject template must include:

- `<link rel="canonical" href="{ canonical_url }">`
- OpenGraph: `og:title`, `og:description`, `og:image`, `og:type=article` for projects, `og:type=product` for finishes
- Twitter Card: `summary_large_image`

Centralized in
[`snippets/dawin-meta-tags`](../../snippets/dawin-meta-tags.liquid) so each
template just calls `{% render 'dawin-meta-tags', entity: project %}`.

### 10.6 Indexing latency

| Surface                 | First-index expected | Re-index trigger                                |
| ----------------------- | -------------------- | ----------------------------------------------- |
| New project metaobject  | 24–72 hrs            | Sitemap update on publish + IndexNow ping       |
| New finish metaobject   | 24–72 hrs            | Same                                            |
| Featured update rotation | n/a (not URL-addressable) | —                                       |
| LLM training crawls     | weeks to months      | One-time prep; ensure /llms.txt + open robots   |

---

*Owner: Studio Engineering. Edits via PR.*

# Shopify → DawinOS CRM: Project Enquiry Intake

This document specifies the contract between **dawinfinishes.com** (Shopify)
and the **DawinOS CRM module** for the project-enquiry form at
`/pages/start-project`.

## Flow

1. Customer submits the enquiry form at `dawinfinishes.com/pages/start-project`.
2. Shopify fires a **Flow** workflow on the *"Customer created"* event (or on
   the *"Contact form submission"* event when available on plan).
3. Flow performs an **HTTP request** to the DawinOS Cloud Function endpoint.
4. The function creates a `CRMDeal` document at stage `lead`, source `website`,
   and logs an `enquiry_received` activity.

The function is `shopifyProjectEnquiry` — deployed as a Firebase HTTPS function.

## Endpoint

```
POST https://<region>-dawinos.cloudfunctions.net/shopifyProjectEnquiry
Content-Type: application/json
X-Dawin-Enquiry-Secret: <secret stored in Firestore systemConfig/shopifyConfig.enquirySecret>
```

The shared secret is **optional** but should be set in production. To configure:

```
firebase firestore:set systemConfig/shopifyConfig --data '{"enquirySecret": "<random-string>"}' --merge
```

## Request payload

| Field                       | Type    | Required | Notes                                                                 |
| --------------------------- | ------- | -------- | --------------------------------------------------------------------- |
| `enquiryId`                 | string  | no       | Idempotency key. Set to a unique value per submission (e.g. order id, ticket id). When present, dedup is exact. |
| `name`                      | string  | no       | Contact full name. Falls back to `email` if absent.                   |
| `email`                     | string  | one of email/phone required | Used for dedup window when no `enquiryId`.                  |
| `phone`                     | string  | one of email/phone required |                                                              |
| `projectType`               | string  | no       | One of `Residential` / `Hospitality` / `Commercial` / `Retail` / `Other`. |
| `projectLocation`           | string  | no       | Free text — city, neighbourhood, full address all accepted.            |
| `scope`                     | string  | no       | One of `Full fit-out` / `Specific finishes only` / `Design consultation` / `Manufacturing only` / `Other`. Drives `probability`. |
| `budget`                    | string  | no       | UGX band, e.g. `10M - 50M`. Parsed into `estimatedValue`.              |
| `timeline`                  | string  | no       | `Within 1 month` / `1-3 months` / `3-6 months` / `6+ months` / `Flexible`. Drives `expectedCloseDate`. |
| `referredProject`           | string  | no       | Title or handle of the case study that inspired the enquiry. Used for attribution. |
| `referencedProjectHandle`   | string  | no       | Shopify page handle of the source case study, if applicable.           |
| `hearAbout`                 | string  | no       | `Showroom` / `Referral` / `Social media` / `Search` / `Past project` / `Other`. |
| `message`                   | string  | no       | Free text — appended to `notes`.                                       |
| `sourcePage`                | string  | no       | Default `/pages/start-project`. Set to the page that originated the form when it differs (e.g. a per-project CTA). |

## Response

| Status | Body                                            | Meaning                                            |
| ------ | ----------------------------------------------- | -------------------------------------------------- |
| 201    | `{ "status": "created", "dealId": "deal_..." }` | New CRM deal created.                              |
| 200    | `{ "status": "duplicate", "dealId": "..." }`    | Existing deal matched by `enquiryId` or recent email. No write performed. |
| 400    | `{ "error": "email or phone is required" }`     | Malformed payload — Flow should not retry.         |
| 401    | `Unauthorized`                                  | Missing or wrong `X-Dawin-Enquiry-Secret`.         |
| 405    | `Method Not Allowed`                            | Only `POST` is accepted.                           |
| 500    | `{ "error": "Internal Server Error" }`          | Transient — Flow may retry.                        |

## CRMDeal write shape

Each enquiry produces one document in `crmDeals` with:

- `stage: 'lead'`
- `source: 'website'`
- `subsidiaryId: 'finishes'`
- `currency: 'UGX'`
- `probability`: derived from `scope`
- `estimatedValue`: derived from `budget` band midpoint × 1,000,000
- `expectedCloseDate`: derived from `timeline`
- `tags`: `['website-enquiry', 'project-form', 'type:<projectType>', 'ref:<referredProject>']`
- `notes`: human-readable summary of all form fields plus the free-text message
- `enquiryId`, `enquirySource`, `referencedProjectHandle`: stored for traceability
- `ownerId: 'unassigned'` — must be reassigned in CRM before progressing past `qualification`

A matching `crmActivities` document with `type: 'enquiry_received'` is also written.

## Shopify Flow setup

1. Admin → **Apps → Shopify Flow → Create workflow**.
2. Trigger: **Customer created** (or **Contact form submitted** if your plan exposes it).
3. Condition: `Customer note contains "projectType"` (or filter on the page handle if available).
4. Action: **Send HTTP request**.
   - URL: production endpoint above.
   - Method: `POST`.
   - Headers: `Content-Type: application/json`, `X-Dawin-Enquiry-Secret: <secret>`.
   - Body: map customer fields and `customer.note` (parsed) into the payload above. For a more reliable mapping, use **Liquid** in the body to extract project fields from `customer.note`.

A simpler alternative if Flow is unavailable: a small Apps Script that polls Shopify Admin API for new customer enquiries and forwards them to the same endpoint.

## Local testing

```sh
curl -X POST https://<region>-dawinos.cloudfunctions.net/shopifyProjectEnquiry \
  -H "Content-Type: application/json" \
  -H "X-Dawin-Enquiry-Secret: <secret>" \
  -d '{
    "enquiryId": "test-001",
    "name": "Test Customer",
    "email": "test@example.com",
    "phone": "+256700000000",
    "projectType": "Residential",
    "projectLocation": "Kampala",
    "scope": "Full fit-out",
    "budget": "50M - 200M",
    "timeline": "1-3 months",
    "referredProject": "Lubowa Residence",
    "referencedProjectHandle": "lubowa-residence",
    "hearAbout": "Past project",
    "message": "We loved the microcement finish in the Lubowa case study.",
    "sourcePage": "/pages/lubowa-residence"
  }'
```

Expect `201 Created` with a deal id, then check the **CRM → Pipeline → Lead** stage in DawinOS.

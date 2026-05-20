# Adobe Integration Quick Start Guide

> **For Claude Code in Windsurf** - Copy-paste ready prompts and checklist

---

## Pre-Implementation Checklist

### 1. Adobe Developer Console Setup

- [ ] Create project at [Adobe Developer Console](https://developer.adobe.com/console/)
- [ ] Add **PDF Services API** to project
- [ ] Add **Adobe Sign API** to project
- [ ] Add **Firefly Services API** to project
- [ ] Generate JWT credentials (PDF Services)
- [ ] Generate OAuth credentials (Adobe Sign)
- [ ] Download private key file
- [ ] Note all Client IDs, secrets, and org IDs

### 2. Environment Variables

Copy to `.env.local`:

```bash
# Adobe PDF Services
VITE_ADOBE_PDF_SERVICES_ENABLED=true
VITE_ADOBE_CLIENT_ID=your_client_id
VITE_ADOBE_ORG_ID=your_org_id
VITE_ADOBE_TECHNICAL_ACCOUNT_ID=your_technical_account_id

# Adobe Sign
VITE_ADOBE_SIGN_ENABLED=true
VITE_ADOBE_SIGN_CLIENT_ID=your_sign_client_id
VITE_ADOBE_SIGN_BASE_URI=https://api.na1.adobesign.com

# Adobe Firefly
VITE_ADOBE_FIREFLY_ENABLED=true
VITE_ADOBE_FIREFLY_CLIENT_ID=your_firefly_client_id

# Creative Cloud Libraries (optional)
VITE_ADOBE_CC_LIBRARIES_ENABLED=false
VITE_ADOBE_CC_API_KEY=
```

Add to Firebase Functions environment (server-side secrets):

```bash
firebase functions:config:set \
  adobe.client_secret="xxx" \
  adobe.private_key="$(cat path/to/private.key)" \
  adobe.sign_client_secret="xxx" \
  adobe.sign_refresh_token="xxx" \
  adobe.firefly_client_secret="xxx"
```

### 3. Package Installation

```bash
npm install @adobe/pdfservices-node-sdk@^4.0.0 jsonwebtoken@^9.0.0 jszip@^3.10.0
```

---

## Implementation Prompts for Claude Code

### Phase 1: Foundation (Day 1-2)

```
@workspace Read docs/ADOBE_INTEGRATION_IMPLEMENTATION_PLAN.md section "Phase 1: Foundation Layer"

Create these files with the exact code from the plan:
1. src/shared/services/adobe/config.ts
2. src/shared/services/adobe/types/common.ts
3. src/shared/services/adobe/types/index.ts
4. src/shared/services/adobe/auth/token-manager.ts
5. src/shared/services/adobe/utils/error-handler.ts
6. src/shared/services/adobe/index.ts

Create empty placeholder directories:
- src/shared/services/adobe/pdf/
- src/shared/services/adobe/document-generation/
- src/shared/services/adobe/sign/
- src/shared/services/adobe/creative/
- src/shared/services/adobe/hooks/
```

### Phase 2: PDF Services (Day 3-7)

```
@workspace Read docs/ADOBE_INTEGRATION_IMPLEMENTATION_PLAN.md section "Phase 2: PDF Services Integration"

Create these files:
1. src/shared/services/adobe/types/pdf-services.types.ts - all PDF types
2. src/shared/services/adobe/pdf/pdf-services-client.ts - main PDF client
3. src/shared/services/adobe/pdf/pdf-extract/extract-client.ts - PDF Extract client
4. src/shared/services/adobe/pdf/pdf-extract/table-parser.ts - BOQ table parsing
5. src/shared/services/adobe/pdf/index.ts - exports
6. src/shared/services/adobe/hooks/useAdobePdfServices.ts - React hook

Update src/shared/services/adobe/index.ts to export PDF services.
```

### Phase 3: Document Generation (Day 8-12)

```
@workspace Read docs/ADOBE_INTEGRATION_IMPLEMENTATION_PLAN.md section "Phase 3: Document Generation"

Create these files:
1. src/shared/services/adobe/types/document-generation.types.ts
2. src/shared/services/adobe/document-generation/doc-gen-client.ts
3. src/shared/services/adobe/document-generation/template-manager.ts
4. src/shared/services/adobe/document-generation/data-mapper.ts
5. src/shared/services/adobe/document-generation/index.ts
6. src/shared/services/adobe/hooks/useAdobeDocGen.ts

Create template configurations:
- src/shared/services/adobe/document-generation/templates/quote-template.ts
- src/shared/services/adobe/document-generation/templates/payroll-template.ts
- src/shared/services/adobe/document-generation/templates/contract-template.ts
```

### Phase 4: Adobe Sign (Day 13-18)

```
@workspace Read docs/ADOBE_INTEGRATION_IMPLEMENTATION_PLAN.md section "Phase 4: Adobe Sign Integration"
Also read docs/ADOBE_FIREBASE_FUNCTIONS.md for webhook implementation

Create client-side:
1. src/shared/services/adobe/types/sign.types.ts
2. src/shared/services/adobe/sign/sign-client.ts
3. src/shared/services/adobe/sign/agreement-service.ts
4. src/shared/services/adobe/sign/workflows/quote-approval.ts
5. src/shared/services/adobe/sign/workflows/contract-signing.ts
6. src/shared/services/adobe/hooks/useAdobeSign.ts

Create server-side (Firebase Functions):
1. functions/src/adobe/token.ts
2. functions/src/adobe/sign-webhooks.ts
3. functions/src/adobe/index.ts
```

### Phase 5: Image Services (Day 19-28)

```
@workspace Read docs/ADOBE_INTEGRATION_IMPLEMENTATION_PLAN.md section "Phase 5: Image Services"

Create Photoshop API:
1. src/shared/services/adobe/types/photoshop.types.ts
2. src/shared/services/adobe/creative/photoshop/photoshop-client.ts
3. src/shared/services/adobe/creative/photoshop/remove-background.ts
4. src/shared/services/adobe/creative/photoshop/batch-processor.ts

Create Firefly API:
1. src/shared/services/adobe/types/firefly.types.ts
2. src/shared/services/adobe/creative/firefly/firefly-client.ts
3. src/shared/services/adobe/creative/firefly/text-to-image.ts
4. src/shared/services/adobe/creative/firefly/generative-fill.ts

Create hooks:
1. src/shared/services/adobe/hooks/useAdobePhotoshop.ts
2. src/shared/services/adobe/hooks/useAdobeFirefly.ts
```

### Migration: Quote PDF Generator

```
@workspace Read docs/ADOBE_INTEGRATION_IMPLEMENTATION_PLAN.md section "11.1 Migrating Quote PDF Generator"

Modify src/modules/design-manager/services/quote-pdf-generator.tsx to:
1. Import Adobe Document Generation service
2. Add mapQuoteToTemplateData() function
3. Update generateQuotePdf() to try Adobe first, fallback to React-PDF
4. Keep all existing React-PDF code as fallback

Test with: npm run test -- quote-pdf
```

### Migration: BOQ Import

```
@workspace Read docs/ADOBE_INTEGRATION_IMPLEMENTATION_PLAN.md section "11.2 Migrating BOQ Import"

Modify src/subsidiaries/advisory/matflow/services/boqParsing.ts to:
1. Import Adobe PDF Extract service
2. Add PDF file type detection
3. Use extractTables() for PDF files
4. Add convertTablesToBOQ() and detectBOQColumns() functions
5. Keep CSV and Excel parsing as-is

Test with: npm run test -- boq-parsing
```

---

## Verification Commands

After each phase, run:

```bash
# Type checking
npm run typecheck

# Lint
npm run lint

# Unit tests
npm run test -- adobe

# Build
npm run build
```

---

## File Structure After Implementation

```
src/shared/services/adobe/
├── index.ts                          ✓ Phase 1
├── config.ts                         ✓ Phase 1
├── types/
│   ├── index.ts                      ✓ Phase 1
│   ├── common.ts                     ✓ Phase 1
│   ├── pdf-services.types.ts         ✓ Phase 2
│   ├── document-generation.types.ts  ✓ Phase 3
│   ├── sign.types.ts                 ✓ Phase 4
│   ├── photoshop.types.ts            ✓ Phase 5
│   └── firefly.types.ts              ✓ Phase 5
├── auth/
│   ├── index.ts                      ✓ Phase 1
│   └── token-manager.ts              ✓ Phase 1
├── utils/
│   ├── index.ts                      ✓ Phase 1
│   └── error-handler.ts              ✓ Phase 1
├── pdf/
│   ├── index.ts                      ✓ Phase 2
│   ├── pdf-services-client.ts        ✓ Phase 2
│   └── pdf-extract/
│       ├── index.ts                  ✓ Phase 2
│       ├── extract-client.ts         ✓ Phase 2
│       └── table-parser.ts           ✓ Phase 2
├── document-generation/
│   ├── index.ts                      ✓ Phase 3
│   ├── doc-gen-client.ts             ✓ Phase 3
│   ├── template-manager.ts           ✓ Phase 3
│   └── templates/
│       ├── quote-template.ts         ✓ Phase 3
│       ├── payroll-template.ts       ✓ Phase 3
│       └── contract-template.ts      ✓ Phase 3
├── sign/
│   ├── index.ts                      ✓ Phase 4
│   ├── sign-client.ts                ✓ Phase 4
│   └── workflows/
│       ├── quote-approval.ts         ✓ Phase 4
│       └── contract-signing.ts       ✓ Phase 4
├── creative/
│   ├── index.ts                      ✓ Phase 5
│   ├── photoshop/
│   │   ├── index.ts                  ✓ Phase 5
│   │   ├── photoshop-client.ts       ✓ Phase 5
│   │   └── remove-background.ts      ✓ Phase 5
│   └── firefly/
│       ├── index.ts                  ✓ Phase 5
│       ├── firefly-client.ts         ✓ Phase 5
│       └── text-to-image.ts          ✓ Phase 5
└── hooks/
    ├── index.ts                      ✓ Phase 2+
    ├── useAdobePdfServices.ts        ✓ Phase 2
    ├── useAdobeDocGen.ts             ✓ Phase 3
    ├── useAdobeSign.ts               ✓ Phase 4
    ├── useAdobePhotoshop.ts          ✓ Phase 5
    └── useAdobeFirefly.ts            ✓ Phase 5

functions/src/adobe/
├── index.ts                          ✓ Phase 4
├── token.ts                          ✓ Phase 4
└── sign-webhooks.ts                  ✓ Phase 4
```

---

## Troubleshooting Quick Reference

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` | Bad credentials | Check env vars, regenerate tokens |
| `Token expired` | JWT/OAuth expired | Token manager should auto-refresh |
| `CORS error` | Direct browser call | Route through Firebase Function |
| `Rate limited` | Too many requests | Add exponential backoff |
| `File too large` | >100MB file | Compress or split before upload |

---

## Support Resources

- [Adobe PDF Services Documentation](https://developer.adobe.com/document-services/docs/overview/)
- [Adobe Sign API Reference](https://secure.na1.adobesign.com/public/docs/restapi/v6)
- [Firefly Services Documentation](https://developer.adobe.com/firefly-services/docs/guides/)
- [DawinOS Architecture](./ARCHITECTURE.md)
- [Full Implementation Plan](./ADOBE_INTEGRATION_IMPLEMENTATION_PLAN.md)
- [Firebase Functions Guide](./ADOBE_FIREBASE_FUNCTIONS.md)

---

**Version:** 1.0.0 | **Last Updated:** 2026-01-25

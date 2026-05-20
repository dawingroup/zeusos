# Prompt 5.3: Production Labels Outline

## Objective
Outline generation of QR-coded labels for parts and sheets on the shop floor.

## Status: OUTLINE ONLY
This prompt provides an outline for future implementation. Not ready for development.

---

## Overview

Production labels help track parts through the manufacturing process:
- Sheet labels for material identification
- Part labels for individual components
- Assembly labels for completed items

## Label Types

### 1. Sheet Label
```
┌─────────────────────────┐
│ [QR CODE]  SHEET #001   │
│ Material: Walnut Ply    │
│ Size: 2440 x 1220 x 18  │
│ Project: PRJ-001        │
│ Parts: 12               │
└─────────────────────────┘
```

### 2. Part Label
```
┌─────────────────────────┐
│ [QR]  P001              │
│ Left Side Panel         │
│ 800 x 600 x 18          │
│ Grain: Length           │
│ Edges: T,B              │
│ PRJ-001 / DI-003        │
└─────────────────────────┘
```

### 3. Assembly Label
```
┌─────────────────────────┐
│ [QR CODE]               │
│ Kitchen Base Cabinet    │
│ Item: DI-003            │
│ Customer: Smith         │
│ Due: 2024-01-15         │
└─────────────────────────┘
```

## QR Code Contents

JSON-encoded data:
```json
{
  "type": "part",
  "id": "part-id",
  "item": "design-item-id",
  "project": "project-id"
}
```

## Printing Options

1. **Browser Print** - CSS @media print
2. **Label Printer API** - Zebra, DYMO
3. **PDF Generation** - Download and print

## Implementation Steps (Future)

1. Label template components
2. QR code generation (qrcode.react)
3. Print stylesheet
4. Batch print functionality
5. Mobile scanning app (PWA)

## Mobile Scanner App

Future PWA for shop floor:
- Scan part QR
- View part details
- Mark as complete
- Report issues

---

*This is an outline for future development.*

---
id: shelf
title: Shelf (Adjustable)
category: components/panels
tags: [panel, shelf, adjustable, interior]
sources: []
related: [side-panel, shelf-pin-5mm]
confidence: high
dkbEntryType: component
dkbComponentCategory: shelf
dkbDimensions:
  width: { min: 200, max: 1200, default: 528, step: 10 }
  depth: { min: 150, max: 600, default: 540, step: 10 }
  height: { min: 16, max: 25, default: 18, step: 1 }
  unit: mm
dkbMaterialRequirements:
  - role: internal
    defaultThicknessMm: 18
    compatibleCategories: [sheet-goods]
    compatibleFinishCategories: [board, laminate, veneer]
dkbHardwareRequirements:
  - hardwareFamily: shelf_support
    quantityPer: 4
dkbEdgeBandingRules:
  - edge: front
    required: true
    defaultType: pvc_04mm
    matchFinish: true
dkbJointTypes:
  - type: butt_joint
    connectsTo: [side-panel]
---

## Summary

Horizontal panel resting on shelf supports within a cabinet carcass. Width is typically carcass internal width minus 2mm clearance per side. Front edge always banded. Adjustable via 5mm shelf pins in System 32 line boring.

## Construction Notes

- Shelf width = internal carcass width - 4mm total clearance
- Shelf depth = carcass depth - 20mm (setback from front)
- Maximum unsupported span: 800mm for 18mm board; add mid-support for wider spans
- Consider 2mm PVC edge banding on front for durability (vs 0.4mm for economy)

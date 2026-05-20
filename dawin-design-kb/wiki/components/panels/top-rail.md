---
id: top-rail
title: Top Rail (Cabinet)
category: components/panels
tags: [panel, carcass, rail, structural]
sources: []
related: [side-panel, cam-lock-15mm]
confidence: high
dkbEntryType: component
dkbComponentCategory: rail
dkbDimensions:
  width: { min: 200, max: 1200, default: 564, step: 10 }
  depth: { min: 60, max: 120, default: 80, step: 10 }
  height: { min: 16, max: 25, default: 18, step: 1 }
  unit: mm
dkbMaterialRequirements:
  - role: carcass
    defaultThicknessMm: 18
    compatibleCategories: [sheet-goods]
    compatibleFinishCategories: [board]
dkbHardwareRequirements:
  - hardwareFamily: connector
    quantityPer: 2
dkbEdgeBandingRules: []
dkbJointTypes:
  - type: cam_lock
    connectsTo: [side-panel]
---

## Summary

Narrow horizontal rail at the top of base cabinet carcasses. Provides structural rigidity and a mounting surface for worktop fixings. Not visible, so no edge banding or finish matching required. Typically 80mm depth, but can be wider for added worktop support.

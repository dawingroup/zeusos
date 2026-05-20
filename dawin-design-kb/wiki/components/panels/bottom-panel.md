---
id: bottom-panel
title: Bottom Panel (Cabinet)
category: components/panels
tags: [panel, carcass, bottom, structural]
sources: []
related: [side-panel, plinth, cam-lock-15mm]
confidence: high
dkbEntryType: component
dkbComponentCategory: panel
dkbDimensions:
  width: { min: 200, max: 1200, default: 564, step: 10 }
  depth: { min: 200, max: 700, default: 540, step: 10 }
  height: { min: 16, max: 25, default: 18, step: 1 }
  unit: mm
dkbMaterialRequirements:
  - role: carcass
    defaultThicknessMm: 18
    compatibleCategories: [sheet-goods]
    compatibleFinishCategories: [board, laminate]
dkbHardwareRequirements:
  - hardwareFamily: connector
    quantityPer: 4
  - hardwareFamily: leg_leveller
    quantityPer: 4
dkbEdgeBandingRules:
  - edge: front
    required: true
    defaultType: pvc_04mm
    matchFinish: true
dkbJointTypes:
  - type: cam_lock
    connectsTo: [side-panel]
---

## Summary

Horizontal panel forming the base of a cabinet carcass. Connected to side panels via cam locks or confirmat screws. Front edge banded to match carcass finish. May include cutouts for plumbing or cable routing in kitchen applications. Leg levellers mounted underneath.

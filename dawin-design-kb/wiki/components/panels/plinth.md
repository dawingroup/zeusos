---
id: plinth
title: Plinth (Kickboard)
category: components/panels
tags: [panel, plinth, kickboard, base]
sources: []
related: [bottom-panel, leg-leveller]
confidence: high
dkbEntryType: component
dkbComponentCategory: plinth
dkbDimensions:
  width: { min: 200, max: 3000, default: 600, step: 10 }
  depth: { min: 16, max: 22, default: 18, step: 1 }
  height: { min: 80, max: 200, default: 150, step: 10 }
  unit: mm
dkbMaterialRequirements:
  - role: carcass
    defaultThicknessMm: 18
    compatibleCategories: [sheet-goods]
    compatibleFinishCategories: [board, laminate]
dkbHardwareRequirements: []
dkbEdgeBandingRules:
  - edge: top
    required: true
    defaultType: pvc_04mm
    matchFinish: true
dkbJointTypes: []
---

## Summary

Vertical panel at the foot of base cabinets, concealing leg levellers and creating a toe-kick space. Standard height 150mm in Uganda (100-200mm range). Clips onto leg levellers or is fixed with plinth clips. Can run continuously across multiple units.

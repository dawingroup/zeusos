---
id: drawer-box
title: Drawer Box
category: components/drawer-systems
tags: [drawer, box, storage, sliding]
sources: []
related: [blum-tandembox, side-panel]
confidence: high
dkbEntryType: component
dkbComponentCategory: drawer_box
dkbDimensions:
  width: { min: 200, max: 1000, default: 500, step: 10 }
  depth: { min: 300, max: 600, default: 500, step: 10 }
  height: { min: 80, max: 200, default: 120, step: 10 }
  unit: mm
dkbMaterialRequirements:
  - role: internal
    defaultThicknessMm: 16
    compatibleCategories: [sheet-goods]
    compatibleFinishCategories: [board]
dkbHardwareRequirements:
  - hardwareFamily: drawer_slide
    quantityPer: 2
dkbEdgeBandingRules:
  - edge: top
    required: true
    defaultType: pvc_04mm
    matchFinish: false
dkbJointTypes:
  - type: dowel
    connectsTo: [drawer-box]
---

## Summary

Four-sided box that slides on drawer runners. Typically 16mm board with dowel joints. Width determined by internal carcass width minus runner clearance (typically 26mm per side for Tandembox). Front panel (drawer face) is a separate component mounted to the box.

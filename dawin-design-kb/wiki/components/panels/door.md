---
id: door
title: Cabinet Door
category: components/panels
tags: [panel, door, front, visible]
sources: []
related: [side-panel, blum-clip-top, handle-128mm]
confidence: high
dkbEntryType: component
dkbComponentCategory: door
dkbDimensions:
  width: { min: 200, max: 600, default: 400, step: 10 }
  depth: { min: 16, max: 22, default: 18, step: 1 }
  height: { min: 300, max: 2400, default: 720, step: 10 }
  unit: mm
dkbMaterialRequirements:
  - role: face
    defaultThicknessMm: 18
    compatibleCategories: [sheet-goods, solid-wood]
    compatibleFinishCategories: [board, laminate, veneer, paint]
dkbHardwareRequirements:
  - hardwareFamily: hinge
    quantityPer: 2
  - hardwareFamily: handle_pull
    quantityPer: 1
dkbEdgeBandingRules:
  - edge: top
    required: true
    defaultType: pvc_2mm
    matchFinish: true
  - edge: bottom
    required: true
    defaultType: pvc_2mm
    matchFinish: true
  - edge: left
    required: true
    defaultType: pvc_2mm
    matchFinish: true
  - edge: right
    required: true
    defaultType: pvc_2mm
    matchFinish: true
dkbJointTypes: []
---

## Summary

Front-facing panel mounted on hinges. All four edges require edge banding (2mm PVC for durability). Door overlay depends on hinge type: full overlay (covers entire carcass side), half overlay (shares a side panel with adjacent unit), or inset (sits flush within carcass opening).

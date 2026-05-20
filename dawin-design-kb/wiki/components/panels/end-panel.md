---
id: end-panel
title: End Panel (Decorative)
category: components/panels
tags: [panel, end, decorative, visible]
sources: []
related: [side-panel, filler]
confidence: high
dkbEntryType: component
dkbComponentCategory: end_panel
dkbDimensions:
  width: { min: 18, max: 25, default: 18, step: 1 }
  depth: { min: 300, max: 700, default: 600, step: 10 }
  height: { min: 300, max: 2400, default: 720, step: 10 }
  unit: mm
dkbMaterialRequirements:
  - role: face
    defaultThicknessMm: 18
    compatibleCategories: [sheet-goods]
    compatibleFinishCategories: [board, laminate, veneer, paint]
dkbHardwareRequirements: []
dkbEdgeBandingRules:
  - edge: front
    required: true
    defaultType: pvc_2mm
    matchFinish: true
  - edge: top
    required: true
    defaultType: pvc_2mm
    matchFinish: true
  - edge: bottom
    required: true
    defaultType: pvc_04mm
    matchFinish: true
dkbJointTypes: []
---

## Summary

Decorative panel applied to the exposed end of a cabinet run. Matches door finish and material. All visible edges banded with 2mm PVC. Applied with adhesive and panel pins to the carcass side panel.

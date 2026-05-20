---
id: filler
title: Filler Strip
category: components/panels
tags: [panel, filler, gap, trim]
sources: []
related: [side-panel, end-panel]
confidence: high
dkbEntryType: component
dkbComponentCategory: filler
dkbDimensions:
  width: { min: 10, max: 100, default: 50, step: 5 }
  depth: { min: 16, max: 22, default: 18, step: 1 }
  height: { min: 300, max: 2400, default: 720, step: 10 }
  unit: mm
dkbMaterialRequirements:
  - role: face
    defaultThicknessMm: 18
    compatibleCategories: [sheet-goods, solid-wood]
    compatibleFinishCategories: [board, laminate, veneer, paint]
dkbHardwareRequirements: []
dkbEdgeBandingRules:
  - edge: front
    required: true
    defaultType: pvc_2mm
    matchFinish: true
dkbJointTypes: []
---

## Summary

Narrow strip used to fill gaps between cabinets and walls, or between cabinets at corners. Width varies based on gap to fill. Matches door finish. Front edge banded. Scribed to wall contour if necessary.

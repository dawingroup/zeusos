---
id: test-side-panel
title: Test Side Panel
category: components/panels
tags: [panel, carcass, structural, test]
sources: []
related: [back-panel, shelf]
confidence: high
dkbEntryType: component
dkbComponentCategory: panel
dkbDimensions:
  width: { min: 16, max: 25, default: 18, step: 1 }
  depth: { min: 300, max: 700, default: 560, step: 10 }
  height: { min: 300, max: 2400, default: 720, step: 10 }
dkbMaterialRequirements:
  - role: carcass
    defaultThicknessMm: 18
    compatibleCategories: [sheet-goods]
    compatibleFinishCategories: [board, laminate]
dkbEdgeBandingRules:
  - edge: front
    required: true
    defaultType: pvc_04mm
    matchFinish: true
dkbJointTypes:
  - type: cam_lock
    connectsTo: [bottom, top_rail]
---

## Summary

Side panel component used in cabinet carcass construction. Provides vertical structural support.

## CadQuery Fragment

```python
result = cq.Workplane("XY").box(thickness, depth, height)
```

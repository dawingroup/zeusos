---
id: side-panel
title: Side Panel (Cabinet)
category: components/panels
tags: [panel, carcass, structural, side]
sources: []
related: [back-panel, shelf, bottom-panel, cam-lock-15mm]
confidence: high
dkbEntryType: component
dkbComponentCategory: panel
dkbDimensions:
  width: { min: 200, max: 1200, default: 560, step: 10 }
  depth: { min: 200, max: 900, default: 560, step: 10 }
  height: { min: 300, max: 2400, default: 720, step: 10 }
  unit: mm
dkbMaterialRequirements:
  - role: carcass
    defaultThicknessMm: 18
    compatibleCategories: [sheet-goods]
    compatibleFinishCategories: [board, laminate, veneer]
dkbHardwareRequirements:
  - hardwareFamily: connector
    quantityPer: 4
    boringSpec:
      diameter: 5
      depth: 12
      offsetFromEdge: 37
      pattern: line_32mm
dkbEdgeBandingRules:
  - edge: front
    required: true
    defaultType: pvc_04mm
    matchFinish: true
  - edge: top
    required: false
    defaultType: pvc_04mm
    matchFinish: true
  - edge: bottom
    required: false
    defaultType: pvc_04mm
    matchFinish: true
dkbJointTypes:
  - type: cam_lock
    connectsTo: [bottom-panel, shelf, top-rail]
  - type: dowel
    connectsTo: [back-panel]
---

## Summary

Vertical structural panel forming the left or right side of a cabinet carcass. The primary load-bearing element that supports shelves, top rail, and bottom panel. Standard 18mm thickness for most cabinetry applications; 16mm acceptable for lightweight wall units.

## Construction Notes

- Grain direction typically runs vertically (height axis)
- System 32 drilling pattern on inner face for shelf supports and cam locks
- Front edge always requires edge banding (visible)
- Top and bottom edges need banding if exposed (e.g. open cabinets)
- For units taller than 1800mm, consider 22mm thickness for rigidity
- Back panel groove (if applicable) is 8mm wide x 10mm deep, 15mm from back edge

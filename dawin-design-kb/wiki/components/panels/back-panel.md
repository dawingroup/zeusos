---
id: back-panel
title: Back Panel
category: components/panels
tags: [panel, carcass, back, structural]
sources: []
related: [side-panel, shelf, bottom-panel]
confidence: high
dkbEntryType: component
dkbComponentCategory: back_panel
dkbDimensions:
  width: { min: 200, max: 1200, default: 564, step: 10 }
  depth: { min: 200, max: 900, default: 564, step: 10 }
  height: { min: 300, max: 2400, default: 684, step: 10 }
  unit: mm
dkbMaterialRequirements:
  - role: back
    defaultThicknessMm: 8
    compatibleCategories: [sheet-goods]
    compatibleFinishCategories: [board]
dkbHardwareRequirements: []
dkbEdgeBandingRules: []
dkbJointTypes:
  - type: rabbet
    connectsTo: [side-panel]
  - type: dado
    connectsTo: [side-panel]
---

## Summary

Rear panel that provides racking resistance and dust sealing. Typically 8mm MDF or HDF set into a groove in the carcass sides, or stapled/screwed to the back edges. Back panels are not visible and do not require edge banding or finish matching.

## Construction Notes

- Standard: 8mm MDF, white or raw
- Set-in method: 8mm x 10mm groove, 15mm from back edge of carcass
- Overlay method: stapled to back edges (faster, less rigid)
- For tall units or heavy shelf loads, consider 12mm back panel for added rigidity
- Back panel dimensions = carcass width + 2 x groove depth - clearance (typically 2mm)

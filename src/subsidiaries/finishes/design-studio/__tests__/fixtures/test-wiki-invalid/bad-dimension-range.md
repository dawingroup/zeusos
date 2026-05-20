---
id: bad-dimension-component
title: Bad Dimension Component
category: components/panels
tags: [test, invalid]
sources: []
related: []
confidence: draft
dkbEntryType: component
dkbComponentCategory: panel
dkbDimensions:
  width: { min: 900, max: 100, default: 500, step: 10 }
  depth: { min: 300, max: 700, default: 560, step: 10 }
  height: { min: 300, max: 2400, default: 720, step: 10 }
dkbMaterialRequirements:
  - role: carcass
    defaultThicknessMm: 18
    compatibleCategories: [sheet-goods]
    compatibleFinishCategories: [board]
---

## Summary

This article has invalid dimensions where min > max for width.

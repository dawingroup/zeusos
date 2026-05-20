---
id: test-base-600
title: Test Kitchen Base 600mm
category: archetypes/kitchen
tags: [kitchen, base, cabinet, test]
sources: []
related: [test-side-panel]
confidence: high
dkbEntryType: product_archetype
dkbProductType: cabinetry
dkbStandardDimensions:
  width: { min: 300, max: 900, default: 600, step: 50 }
  depth: { min: 500, max: 620, default: 560, step: 10 }
  height: { min: 680, max: 780, default: 720, step: 10 }
dkbAssemblyPatternId: kitchen-base-pattern
dkbDefaultFinishCategory: board
dkbTypicalHardware:
  - family: hinge
    quantity: 2
  - family: shelf_support
    quantity: 4
dkbBomEstimate:
  - materialCategory: board_18mm
    quantityExpression: "(2 * height * depth + width * depth) / 1000000"
    unit: m2
dkbSearchTerms: [kitchen, base, cabinet, unit, 600, test]
---

## Summary

Test kitchen base unit archetype for compiler testing.

## Constraints

- condition: "width < 300"
  action: reject
  reason: "Too narrow for single-door configuration"

---
id: dining-table-rect
title: Rectangular Dining Table
category: archetypes/dining
tags: [table, dining, rectangular, loose furniture]
sources: []
related: [leg-leveller]
confidence: high
dkbEntryType: product_archetype
dkbProductType: loose_furniture
dkbStandardDimensions:
  width: { min: 800, max: 2400, default: 1600, step: 100 }
  depth: { min: 700, max: 1200, default: 900, step: 50 }
  height: { min: 720, max: 780, default: 750, step: 10 }
  unit: mm
dkbAssemblyPatternId: dining-table-rect-pattern
dkbDefaultFinishCategory: veneer
dkbTypicalHardware:
  - family: leg_leveller
    quantity: 4
  - family: connector
    quantity: 8
dkbBomEstimate:
  - materialCategory: board_25mm
    quantityExpression: "width * depth / 1000000"
    unit: m2
  - materialCategory: solid_timber
    quantityExpression: "4 * (height - 25) * 0.06 * 0.06"
    unit: m3
  - materialCategory: edge_banding_solid
    quantityExpression: "(2 * width + 2 * depth) / 1000"
    unit: lm
dkbSearchTerms: [dining table, rectangular, table, dining room, kitchen table]
dkbAiPromptContext: >
  Rectangular dining table with solid timber or steel legs. Top is 25mm veneered MDF or
  solid timber slab. Standard height 750mm (ergonomic dining height). Legs can be tapered
  timber, turned timber, steel hairpin, or steel trestle. Seating capacity: 1600mm seats
  6, 2000mm seats 8, 2400mm seats 10. Minimum 600mm per place setting width.
dkbConstraints:
  - id: table-leg-hairpin-max
    condition: "width > 1800 && legStyle === 'hairpin'"
    action: warn
    reason: "Hairpin legs may not provide sufficient stability for tables wider than 1800mm. Consider trestle or pedestal base."
    affectedParameters: [width, legStyle]
    isActive: true
---

## Summary

Rectangular dining table. Top typically 25mm veneered MDF or solid timber. Standard height 750mm. Seating guide: 600mm per place setting. Leg styles include tapered timber, hairpin steel, and trestle.

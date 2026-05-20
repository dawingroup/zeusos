---
id: wardrobe-2door
title: 2-Door Wardrobe
category: archetypes/bedroom
tags: [wardrobe, bedroom, storage, 2-door, cabinetry]
sources: []
related: [side-panel, back-panel, shelf, door, blum-clip-top]
confidence: high
dkbEntryType: product_archetype
dkbProductType: cabinetry
dkbStandardDimensions:
  width: { min: 800, max: 1200, default: 1000, step: 50 }
  depth: { min: 500, max: 650, default: 580, step: 10 }
  height: { min: 1800, max: 2400, default: 2100, step: 50 }
  unit: mm
dkbAssemblyPatternId: wardrobe-2door-pattern
dkbDefaultFinishCategory: board
dkbTypicalHardware:
  - family: hinge
    quantity: 6
  - family: shelf_support
    quantity: 8
  - family: connector
    quantity: 12
  - family: handle_pull
    quantity: 2
dkbBomEstimate:
  - materialCategory: board_18mm
    quantityExpression: "(2 * height * depth + 2 * width * depth + width * 80 + 2 * (width/2) * height) / 1000000"
    unit: m2
  - materialCategory: board_8mm
    quantityExpression: "(width - 4) * (height - 4) / 1000000"
    unit: m2
  - materialCategory: edge_banding_2mm
    quantityExpression: "(4 * height + 4 * (width/2)) / 1000"
    unit: lm
dkbSearchTerms: [wardrobe, 2-door, two door, bedroom, cupboard, closet, armoire]
dkbAiPromptContext: >
  Two-door wardrobe with internal hanging rail and adjustable shelves. Box construction
  from 18mm melamine-faced chipboard. Full-height doors on Blum Clip Top hinges (3 per door
  for stability). Internal layout: one hanging rail at 1600mm height, 2 adjustable shelves
  above. Depth 580mm to accommodate hangers (standard hanger width 450mm + clearance).
---

## Summary

Standard 2-door wardrobe for bedroom use. Internal layout includes a hanging rail at approximately 1600mm and shelving above. Full-height doors require 3 hinges each for adequate support. Standard depth 580mm accommodates coat hangers with clearance.

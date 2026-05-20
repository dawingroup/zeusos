---
id: kitchen-base-600
title: Kitchen Base Unit 600mm
category: archetypes/kitchen
tags: [kitchen, base, cabinet, 600mm, cabinetry]
sources: []
related: [side-panel, back-panel, shelf, bottom-panel, door, plinth, blum-clip-top]
confidence: high
dkbEntryType: product_archetype
dkbProductType: cabinetry
dkbStandardDimensions:
  width: { min: 300, max: 900, default: 600, step: 50 }
  depth: { min: 500, max: 620, default: 560, step: 10 }
  height: { min: 680, max: 780, default: 720, step: 10 }
  unit: mm
dkbAssemblyPatternId: kitchen-base-pattern
dkbDefaultFinishCategory: board
dkbTypicalHardware:
  - family: hinge
    quantity: 2
  - family: shelf_support
    quantity: 4
  - family: connector
    quantity: 8
  - family: leg_leveller
    quantity: 4
  - family: handle_pull
    quantity: 1
dkbBomEstimate:
  - materialCategory: board_18mm
    quantityExpression: "(2 * height * depth + width * depth + width * 80) / 1000000"
    unit: m2
  - materialCategory: board_8mm
    quantityExpression: "(width - 4) * (height - 4) / 1000000"
    unit: m2
  - materialCategory: edge_banding_04mm
    quantityExpression: "(2 * height + 2 * width + depth) / 1000"
    unit: lm
  - materialCategory: edge_banding_2mm
    quantityExpression: "(2 * height + 2 * width) * 2 / 1000"
    unit: lm
dkbSearchTerms: [kitchen, base, cabinet, unit, 600, standard, carcass, cupboard]
dkbAiPromptContext: >
  Standard kitchen base unit with single door and one adjustable shelf. Box construction
  from 18mm melamine-faced chipboard with 8mm MDF back panel. Full overlay door on
  Blum Clip Top 110-degree hinges. Plinth-mounted on 150mm adjustable leg levellers.
  Carcass is cam-lock assembled. System 32 line boring for shelf adjustability.
  Uganda standard worktop height 870mm (720mm carcass + 150mm legs).
dkbConstraints:
  - id: base-width-min
    condition: "width < 300"
    action: reject
    reason: "Base units narrower than 300mm are not practical for single-door configuration"
    affectedParameters: [width]
    isActive: true
  - id: base-depth-worktop
    condition: "depth > 600"
    action: warn
    reason: "Depth exceeds standard 560mm — ensure worktop overhang is acceptable"
    affectedParameters: [depth]
    isActive: true
---

## Summary

Standard kitchen base unit with single door and adjustable shelf. The most common unit in Ugandan kitchen installations. 600mm is the standard module width, though units range from 300mm to 900mm. Height 720mm + 150mm legs = 870mm worktop height (Uganda standard).

## BOM Structure

1. 2x Side panels (18mm, height x depth)
2. 1x Bottom panel (18mm, width x depth)
3. 1x Top rail (18mm, width x 80mm)
4. 1x Back panel (8mm, width x height)
5. 1x Shelf (18mm, width x depth-20mm)
6. 1x Door (18mm, width x height)
7. Hardware: 2 hinges, 4 shelf pins, 8 cam locks, 4 legs, 1 handle
8. Edge banding: 0.4mm on carcass fronts, 2mm on all door edges

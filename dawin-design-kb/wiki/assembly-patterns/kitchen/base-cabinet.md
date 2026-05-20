---
id: kitchen-base-pattern
title: Kitchen Base Cabinet Assembly Pattern
category: assembly-patterns/kitchen
tags: [kitchen, base, cabinet, assembly, pattern]
sources: []
related: [side-panel, bottom-panel, back-panel, shelf, door, plinth, top-rail]
confidence: high
dkbEntryType: assembly_pattern
---

## Summary

Standard kitchen base cabinet assembly pattern. Box construction from six primary components assembled with cam-lock connectors and dowels. Back panel captured in rebates. Door hung on 110-degree clip hinges. Plinth-mounted on adjustable leg levellers.

## Components

| Role | Component | Quantity | Optional | Condition |
|------|-----------|----------|----------|-----------|
| left_side | side-panel | 1 | No | — |
| right_side | side-panel | 1 | No | — |
| bottom | bottom-panel | 1 | No | — |
| top_rail | top-rail | 1 | No | — |
| back | back-panel | 1 | No | — |
| shelf | shelf | 1 | Yes | hasShelf == true |
| door | door | 1 | No | doorCount == 1 |
| door_left | door | 1 | Yes | doorCount == 2 |
| door_right | door | 1 | Yes | doorCount == 2 |

## Connections

- left_side → bottom: cam_lock (×2 per joint)
- right_side → bottom: cam_lock (×2 per joint)
- left_side → top_rail: cam_lock (×1)
- right_side → top_rail: cam_lock (×1)
- back → left_side: staple or screw into rebate
- back → right_side: staple or screw into rebate
- back → bottom: staple or screw into rebate
- door → left_side: hinge (×2, Blum Clip Top 110°)

## Assembly Sequence

1. Prepare panels: drill cam-lock holes, edge-band visible edges
2. Assemble carcass box: bottom → sides → top rail
3. Square the carcass, fit back panel
4. Install shelf supports (System 32 line boring)
5. Mount leg levellers to bottom panel
6. Hang door on hinges, adjust
7. Fit handle/pull

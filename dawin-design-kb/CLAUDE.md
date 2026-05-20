# Dawin Design Knowledge Base — LLM Governance

## Purpose
This wiki is the authoritative design knowledge base for Dawin Finishes. It serves two roles:
1. **Authoring layer**: Rich markdown articles with structured YAML frontmatter
2. **Serving layer**: Articles with `dkbEntryType` compile to Firestore for runtime use

## Rules for AI Authors
- Always include proper YAML frontmatter between `---` delimiters
- Use kebab-case for article `id` fields
- Reference `raw/` source documents in `sources` field when data comes from catalogs
- Link related articles using `related` field (use article IDs, not paths)
- Set `confidence` honestly: `high` for verified data, `medium` for reasonable estimates, `draft` for initial work
- All dimensions in millimeters
- All weights in kilograms
- Currency in UGX unless specified otherwise
- When adding `dkb*` fields, ensure all required fields for that entry type are present
- Do not modify articles in `raw/` — those are untouched source documents

## Article Structure
```markdown
---
id: article-id
title: Human Readable Title
category: components/panels
tags: [panel, carcass]
sources: []
related: [other-article-id]
confidence: high
dkbEntryType: component  # Only if this compiles to Firestore
dkbComponentCategory: panel  # Entry-type-specific fields
---

## Summary
One paragraph description (becomes `description` field in Firestore).

## Details
Narrative content, workshop notes, construction techniques...

## CadQuery Fragment
```python
# Reusable CadQuery code (becomes `cadQuerySnippet` if component)
```

## Constraints
- condition: "parameters.width > 1200"
  action: warn
  reason: "Side panels wider than 1200mm may bow..."
```

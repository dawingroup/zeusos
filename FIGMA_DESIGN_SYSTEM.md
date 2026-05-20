# Dawin Finishes - Figma Design System & UX/UI Handoff

## Overview
This document provides comprehensive design specifications for two interconnected manufacturing tools:
1. **Design Manager Module** - Traffic light design process management
2. **Cutlist Processor Module** - Panel cutting optimization

---

## Brand Identity

### Color Palette

#### Primary Brand Colors
| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Boysenberry** | `#872E5C` | rgb(135, 46, 92) | Primary brand, headers, CTAs, selected states |
| **Boysenberry Light** | `#a34573` | rgb(163, 69, 115) | Hover states |
| **Boysenberry Dark** | `#6a2449` | rgb(106, 36, 73) | Active/pressed states |
| **Golden Bell** | `#E18425` | rgb(225, 132, 37) | Secondary accent, warnings, highlights |
| **Teal** | `#0A7C8E` | rgb(10, 124, 142) | Interactive elements, links, buttons |
| **Teal Light** | `#0d9bb2` | rgb(13, 155, 178) | Hover state for teal |

#### Supporting Colors
| Name | Hex | Usage |
|------|-----|-------|
| **Cashmere** | `#E2CAA9` | Warm backgrounds, cards |
| **Pesto** | `#8A7D4B` | Muted accents, icons |
| **Seafoam** | `#7ABDCD` | Info states, secondary highlights |

#### RAG Status Colors (Traffic Light System)
| Status | Hex | Tailwind | Usage |
|--------|-----|----------|-------|
| **Red** | `#EF4444` | `red-500` | Not ready, blockers, errors |
| **Amber** | `#F59E0B` | `amber-500` | In progress, warnings |
| **Green** | `#22C55E` | `green-500` | Complete, success |
| **N/A** | `#9CA3AF` | `gray-400` | Not applicable |

#### Priority Badge Colors
| Priority | Background | Text |
|----------|------------|------|
| Low | `#F3F4F6` (gray-100) | `#4B5563` (gray-600) |
| Medium | `#DBEAFE` (blue-100) | `#2563EB` (blue-600) |
| High | `#FFEDD5` (orange-100) | `#EA580C` (orange-600) |
| Urgent | `#FEE2E2` (red-100) | `#DC2626` (red-600) |

---

### Typography

#### Font Family
```css
font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

#### Type Scale
| Element | Size | Weight | Line Height | Letter Spacing |
|---------|------|--------|-------------|----------------|
| H1 (Page Title) | 24px (1.5rem) | 700 (Bold) | 1.2 | -0.02em |
| H2 (Section) | 20px (1.25rem) | 600 (Semibold) | 1.3 | -0.01em |
| H3 (Card Title) | 16px (1rem) | 500 (Medium) | 1.4 | 0 |
| Body | 14px (0.875rem) | 400 (Regular) | 1.5 | 0 |
| Small/Caption | 12px (0.75rem) | 400 (Regular) | 1.4 | 0.01em |
| Tiny (Badges) | 10px (0.625rem) | 500 (Medium) | 1.2 | 0.02em |

---

### Spacing System (8px Grid)

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight inline spacing |
| `space-2` | 8px | Default gap, icon margins |
| `space-3` | 12px | Card padding, button padding-y |
| `space-4` | 16px | Section padding, card padding |
| `space-5` | 20px | Card gaps |
| `space-6` | 24px | Section gaps |
| `space-8` | 32px | Large section margins |

---

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-sm` | 4px | Small badges, pills |
| `rounded` | 6px | Buttons, inputs |
| `rounded-lg` | 8px | Cards, panels |
| `rounded-xl` | 12px | Modals, dialogs |
| `rounded-full` | 50% | Avatars, RAG indicators |

---

### Shadows

```css
/* Card shadow */
box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);

/* Hover shadow */
box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);

/* Modal shadow */
box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
```

---

## Design Manager Module

### Module Purpose
Track design projects through 5 manufacturing-readiness stages using a traffic light (RAG) status system. Goal: "Perfect handoff to manufacturing" with zero clarification requests.

### Design Stages (Pipeline)
| Stage | Icon | Color Badge | Description |
|-------|------|-------------|-------------|
| Concept | 💡 | Gray | Initial concept development |
| Preliminary | 📐 | Blue | Preliminary design work |
| Technical | ⚙️ | Purple | Technical specifications |
| Pre-Production | 🔧 | Orange | Validation before production |
| Production Ready | ✅ | Green | Ready for manufacturing |

---

### Component Specifications

#### 1. Dashboard Stats Cards
```
┌─────────────────────────────┐
│ [Icon]                      │
│ 12                          │  ← Large number (24px, bold)
│ Active Projects             │  ← Label (12px, gray-600)
└─────────────────────────────┘

Dimensions: min-width 180px, height 88px
Padding: 16px
Background: white
Border: 1px solid #E5E7EB (gray-200)
Border-radius: 8px
Icon container: 40px circle with colored background
```

#### 2. RAG Indicator (Traffic Light)
```
Sizes:
- xs: 8px × 8px
- sm: 12px × 12px
- md: 16px × 16px
- lg: 24px × 24px

Shape: Perfect circle (border-radius: 50%)
Colors: See RAG Status Colors above
Red status: animate-pulse (1s infinite)

Hover state (when clickable):
- ring: 2px
- ring-offset: 1px
- ring-color: gray-300
```

#### 3. RAG Status Panel (19 Aspects)
```
┌─────────────────────────────────────────────────────────┐
│ ▼ Design Completeness (9 aspects)          [●●●●●●●●●] │
├─────────────────────────────────────────────────────────┤
│   Overall Dimensions        [●] Green    [Edit]        │
│   3D Model                  [●] Amber    [Edit]        │
│   Production Drawings       [●] Red      [Edit]        │
│   Material Specs            [●] Green    [Edit]        │
│   Hardware Specs            [●] Amber    [Edit]        │
│   Finish Specs              [●] Green    [Edit]        │
│   Joinery Details           [●] Red      [Edit]        │
│   Tolerances                [●] N/A      [Edit]        │
│   Assembly Instructions     [●] Amber    [Edit]        │
├─────────────────────────────────────────────────────────┤
│ ▼ Manufacturing Readiness (6 aspects)      [●●●●●●]    │
├─────────────────────────────────────────────────────────┤
│   Material Availability     [●] Green    [Edit]        │
│   Hardware Availability     [●] Amber    [Edit]        │
│   Tooling Readiness         [●] Green    [Edit]        │
│   Process Documentation     [●] Red      [Edit]        │
│   Quality Criteria          [●] Amber    [Edit]        │
│   Cost Validation           [●] Green    [Edit]        │
├─────────────────────────────────────────────────────────┤
│ ▼ Quality Gates (4 aspects)                [●●●●]      │
├─────────────────────────────────────────────────────────┤
│   Internal Design Review    [●] Green    [Edit]        │
│   Manufacturing Review      [●] Amber    [Edit]        │
│   Client Approval           [●] Green    [Edit]        │
│   Prototype Validation      [●] N/A      [Edit]        │
└─────────────────────────────────────────────────────────┘

Section header: 14px semibold, gray-900
Row height: 40px
Indicator size: 12px (sm)
Edit button: ghost button, teal text
Collapsible sections with chevron icons
```

#### 4. Readiness Gauge (Circular Progress)
```
┌───────────┐
│   ╭───╮   │
│  │ 75%│   │  ← Percentage in center
│   ╰───╯   │
└───────────┘

Sizes:
- sm: 40px diameter, 4px stroke
- md: 64px diameter, 6px stroke
- lg: 96px diameter, 8px stroke

Track color: #E5E7EB (gray-200)
Progress color: Gradient based on value
  - 0-40%: red-500
  - 40-70%: amber-500
  - 70-100%: green-500

Text: Bold, centered
```

#### 5. Design Item Card
```
┌─────────────────────────────────────────┐
│ Reception Desk               [◐ 72%]   │  ← Name + Gauge
│ DF-2024-042-001                         │  ← Item code (gray-500)
├─────────────────────────────────────────┤
│ [Casework] [Technical ⚙️]               │  ← Category + Stage badges
├─────────────────────────────────────────┤
│ [●] 8✓ 4● 2●                            │  ← RAG summary
├─────────────────────────────────────────┤
│ [High] [📅 Jan 15]      🕐 2h ago       │  ← Priority, Due, Updated
└─────────────────────────────────────────┘

Dimensions: 280px width (grid), 100% (list)
Padding: 16px
Border: 1px solid gray-200
Border-radius: 8px
Background: white

Selected state:
- Border: 1px solid #872E5C
- Ring: 1px #872E5C

Hover state:
- Shadow: md
- Border: gray-300
```

#### 6. Stage Badge
```
┌──────────────────┐
│ ⚙️ Technical     │
└──────────────────┘

Padding: 4px 8px (sm), 6px 12px (md)
Border-radius: 4px
Font-size: 12px (sm), 14px (md)
Font-weight: 500

Stage colors:
- concept: bg-gray-100, text-gray-700
- preliminary: bg-blue-100, text-blue-700
- technical: bg-purple-100, text-purple-700
- pre-production: bg-orange-100, text-orange-700
- production-ready: bg-green-100, text-green-700
```

#### 7. Stage Gate Check Modal
```
┌─────────────────────────────────────────────────────────┐
│ Gate Check: Preliminary → Technical                     │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ MUST MEET CRITERIA                                  │ │
│ │ ✅ Overall Dimensions is Green                      │ │
│ │ ✅ 3D Model is Green                                │ │
│ │ ❌ Client Approval is Green (currently: Amber)      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ SHOULD MEET CRITERIA                                │ │
│ │ ⚠️ Production Drawings at least Amber               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Minimum Readiness: 60%    Current: 58%                  │
│                                                         │
│ [Cancel]                    [Override with Note] [Proceed]│
└─────────────────────────────────────────────────────────┘

Width: 480px
Padding: 24px
Border-radius: 12px
Shadow: xl
```

#### 8. Approval Workflow Card
```
┌─────────────────────────────────────────────────────────┐
│ 📋 Design Review                          [Pending]     │
│                                                         │
│ Requested by: john@dawin.com                            │
│ Assigned to: manager@dawin.com                          │
│ Requested: Dec 20, 2024                                 │
│                                                         │
│ Notes: Please review the updated cabinet dimensions     │
│                                                         │
│ [Approve]  [Request Revision]  [Reject]                 │
└─────────────────────────────────────────────────────────┘

Status badges:
- pending: bg-yellow-100, text-yellow-800
- approved: bg-green-100, text-green-800
- rejected: bg-red-100, text-red-800
- revision-requested: bg-orange-100, text-orange-800
```

#### 9. Deliverables File Card
```
┌─────────────────────────────────────────────────────────┐
│ 📄 Cabinet_Assembly_v2.pdf              [Draft ▼]       │
│                                                         │
│ Type: Shop Drawing                                      │
│ Size: 2.4 MB                                            │
│ Uploaded: Dec 22, 2024 by designer@dawin.com            │
│ Version: 2                                              │
│                                                         │
│ [👁 Preview]  [⬇ Download]  [🗑 Delete]                 │
└─────────────────────────────────────────────────────────┘

File type icons:
- PDF: red icon
- SKP (SketchUp): blue icon
- DXF/DWG: purple icon
- Image: green icon
```

---

## Cutlist Processor Module

### Module Purpose
Upload CSV cutlists, optimize cutting patterns on stock sheets, and generate workshop outputs (labels, cutting diagrams).

### Key Workflow Tabs
| Tab | Icon | Description |
|-----|------|-------------|
| Import | Upload | Upload CSV, view parts list |
| Configure | Settings | Map materials, set stock sheets |
| Optimize | Calculator | Run optimization, view layouts |
| Export | Download | Generate PDF, labels |

---

### Component Specifications

#### 1. Tab Navigation
```
┌─────────────────────────────────────────────────────────┐
│ [📤 Import] [⚙️ Configure] [📊 Optimize] [📥 Export]   │
└─────────────────────────────────────────────────────────┘

Tab button:
- Padding: 12px 16px
- Font-size: 14px
- Font-weight: 500

Active state:
- Border-bottom: 2px solid #0A7C8E
- Color: #0A7C8E

Inactive state:
- Color: gray-600
- Hover: gray-900
```

#### 2. Parts Table
```
┌──────────────────────────────────────────────────────────────────┐
│ Cabinet       │ Label    │ Material  │ L    │ W   │ Qty │ Grain │
├──────────────────────────────────────────────────────────────────┤
│ TV Cabinet    │ Top_1    │ Blockboard│ 1746 │ 100 │ 1   │ ─     │
│ TV Cabinet    │ Top_2    │ Blockboard│ 1746 │ 100 │ 1   │ ─     │
│ TV Cabinet    │ Bottom   │ Blockboard│ 1746 │ 380 │ 1   │ ─     │
│ Shelf Unit    │ Back     │ PG Bison  │ 2374 │ 674 │ 1   │ │     │
└──────────────────────────────────────────────────────────────────┘

Header row:
- Background: gray-50
- Font-weight: 600
- Font-size: 12px
- Text-transform: uppercase
- Color: gray-600

Data row:
- Height: 44px
- Border-bottom: 1px solid gray-100
- Font-size: 14px

Hover row:
- Background: gray-50

Alternating rows: Optional subtle gray-25
```

#### 3. Cutting Diagram (Sheet Layout)
```
┌─────────────────────────────────────────────────────────┐
│ Sheet 1 of 3 - Blockboard (2440 × 1220 mm)             │
│ Yield: 78.4%                                            │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────┬───────────┬─────────┐              │
│ │                 │           │         │              │
│ │   Top_1         │  Side_L   │ Shelf_1 │              │
│ │   1746×100      │  264×380  │ 664×232 │              │
│ │                 │           │         │              │
│ ├─────────────────┼───────────┼─────────┤              │
│ │                 │           │ Shelf_2 │              │
│ │   Bottom        │  Side_R   │ 664×232 │              │
│ │   1746×380      │  264×380  │         │              │
│ │                 │           │         │              │
│ └─────────────────┴───────────┴─────────┘              │
│                                 [WASTE]                 │
└─────────────────────────────────────────────────────────┘

Container:
- Border: 2px solid gray-300
- Border-radius: 4px
- Background: white

Part rectangles:
- Border: 1px solid gray-400
- Background: Color-coded by cabinet/group
- Label: Centered, 10px font
- Dimensions: Bottom-right, 9px font, gray-500

Waste area:
- Background: Diagonal stripe pattern (gray-100)
- Or solid: #FEE2E2 (red-100)

Grain direction indicator:
- Arrow or line pattern showing grain

Zoom controls:
- [+] [-] [Fit] buttons
- Zoom range: 25% - 200%
```

#### 4. Material Mapping Panel
```
┌─────────────────────────────────────────────────────────┐
│ Material Mapping                                        │
├─────────────────────────────────────────────────────────┤
│ CSV Material      →    Stock Material                   │
├─────────────────────────────────────────────────────────┤
│ Generic 0180      →    [Blockboard Light Brown ▼]       │
│ OSB3              →    [PG Bison White ▼]               │
│ Generic 0031      →    [PG Bison Backer ▼]              │
│                                                         │
│ [+ Add Mapping]                                         │
└─────────────────────────────────────────────────────────┘

Arrow: gray-400, margin 0 12px
Dropdown: 200px width
```

#### 5. Stock Sheet Configuration
```
┌─────────────────────────────────────────────────────────┐
│ Stock Sheet Sizes                                       │
├─────────────────────────────────────────────────────────┤
│ Material              │ Length │ Width  │ Thickness     │
├─────────────────────────────────────────────────────────┤
│ Blockboard Light Brown│ 2440   │ 1220   │ 18           │
│ PG Bison White        │ 2750   │ 1830   │ 18           │
│ PG Bison Backer       │ 2750   │ 1830   │ 3            │
├─────────────────────────────────────────────────────────┤
│ Blade Kerf: [4] mm                                      │
└─────────────────────────────────────────────────────────┘

Input fields: 80px width, right-aligned numbers
Units: mm suffix, gray-400
```

#### 6. Optimization Statistics Card
```
┌─────────────────────────────────────────────────────────┐
│ 📊 Optimization Results                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Total Sheets: 12          Avg Yield: 76.3%            │
│  Total Parts: 87           Waste: 8.2 m²               │
│                                                         │
│  ┌────────────────────────────────────────────┐        │
│  │ Blockboard    │████████████░░░│ 78.4%     │        │
│  │ PG Bison      │██████████░░░░░│ 71.2%     │        │
│  │ MDF           │█████████████░░│ 82.1%     │        │
│  └────────────────────────────────────────────┘        │
│                                                         │
└─────────────────────────────────────────────────────────┘

Progress bars:
- Height: 8px
- Border-radius: 4px
- Track: gray-200
- Fill: teal-500 or color-coded by yield
  - <60%: red-500
  - 60-75%: amber-500
  - >75%: green-500
```

#### 7. File Upload Zone
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│              ┌───────────────────┐                      │
│              │   📤              │                      │
│              │   Upload CSV      │                      │
│              │                   │                      │
│              │ Drag & drop or    │                      │
│              │ click to browse   │                      │
│              └───────────────────┘                      │
│                                                         │
│              Supported: .csv, .xlsx                     │
│                                                         │
└─────────────────────────────────────────────────────────┘

Border: 2px dashed gray-300
Border-radius: 8px
Background: gray-50

Drag-over state:
- Border: 2px dashed #0A7C8E
- Background: teal-50

Icon: 48px, gray-400
```

---

## Shared Components

### Buttons

#### Primary Button
```css
background: #0A7C8E;
color: white;
padding: 8px 16px;
border-radius: 6px;
font-weight: 500;
font-size: 14px;

/* Hover */
background: #086a7a;

/* Active */
background: #065a68;

/* Disabled */
background: #9CA3AF;
cursor: not-allowed;
```

#### Secondary Button
```css
background: white;
color: #374151;
border: 1px solid #D1D5DB;
padding: 8px 16px;
border-radius: 6px;

/* Hover */
background: #F9FAFB;
```

#### Ghost Button
```css
background: transparent;
color: #0A7C8E;
padding: 8px 16px;

/* Hover */
background: rgba(10, 124, 142, 0.1);
```

#### Danger Button
```css
background: #EF4444;
color: white;

/* Hover */
background: #DC2626;
```

### Input Fields
```css
height: 40px;
padding: 8px 12px;
border: 1px solid #D1D5DB;
border-radius: 6px;
font-size: 14px;

/* Focus */
border-color: #0A7C8E;
box-shadow: 0 0 0 3px rgba(10, 124, 142, 0.1);
outline: none;

/* Error */
border-color: #EF4444;
```

### Modal/Dialog
```css
max-width: 480px; /* sm: 400px, lg: 640px, xl: 800px */
padding: 24px;
border-radius: 12px;
background: white;
box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);

/* Overlay */
background: rgba(0, 0, 0, 0.5);
backdrop-filter: blur(4px);
```

### Toast Notifications
```css
/* Success */
background: #ECFDF5;
border-left: 4px solid #22C55E;

/* Error */
background: #FEF2F2;
border-left: 4px solid #EF4444;

/* Warning */
background: #FFFBEB;
border-left: 4px solid #F59E0B;

/* Info */
background: #EFF6FF;
border-left: 4px solid #3B82F6;

padding: 12px 16px;
border-radius: 6px;
```

### Loading States
```css
/* Spinner */
width: 32px;
height: 32px;
border: 3px solid #E5E7EB;
border-top-color: #0A7C8E;
border-radius: 50%;
animation: spin 1s linear infinite;

/* Skeleton */
background: linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%);
background-size: 200% 100%;
animation: shimmer 1.5s infinite;
border-radius: 4px;
```

---

## Responsive Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablets |
| `lg` | 1024px | Small laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large screens |

---

## Accessibility Guidelines

1. **Color Contrast**: Minimum 4.5:1 for text, 3:1 for UI elements
2. **Focus States**: Visible focus ring on all interactive elements
3. **Touch Targets**: Minimum 44×44px for mobile
4. **Alt Text**: All icons have aria-labels
5. **Keyboard Navigation**: Full keyboard support for all workflows

---

## Animation Tokens

```css
/* Transitions */
--transition-fast: 150ms ease;
--transition-normal: 200ms ease;
--transition-slow: 300ms ease;

/* Hover lift */
transform: translateY(-2px);
transition: transform 200ms ease, box-shadow 200ms ease;

/* Pulse (for red RAG status) */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
animation: pulse 2s ease-in-out infinite;
```

---

## Icon Library

Using **Lucide React** icons (24×24px default, stroke-width: 2)

### Common Icons
| Icon | Usage |
|------|-------|
| `Plus` | Add new item |
| `Trash2` | Delete |
| `Edit2` | Edit |
| `Check` | Confirm, success |
| `X` | Close, cancel |
| `AlertCircle` | Error, warning |
| `Upload` | File upload |
| `Download` | Export |
| `Settings` | Configuration |
| `FolderOpen` | Projects |
| `FileText` | Documents |
| `Calendar` | Dates |
| `Clock` | Time/updates |
| `ChevronDown/Right` | Expand/collapse |

---

## Figma Component Checklist

### Design Manager
- [ ] Dashboard stats cards
- [ ] Project list/grid view
- [ ] Design item card (grid + list variants)
- [ ] RAG indicator (all sizes + states)
- [ ] RAG status panel (collapsed + expanded)
- [ ] Readiness gauge (sm, md, lg)
- [ ] Stage badge (all 5 stages)
- [ ] Stage gate check modal
- [ ] Approval workflow card
- [ ] Deliverable file card
- [ ] Parameters editor form
- [ ] Stage kanban board

### Cutlist Processor
- [ ] Tab navigation
- [ ] File upload dropzone
- [ ] Parts data table
- [ ] Material mapping panel
- [ ] Stock sheet configuration
- [ ] Cutting diagram visualization
- [ ] Optimization statistics
- [ ] Export options panel
- [ ] Part label preview

### Shared
- [ ] Button variants (primary, secondary, ghost, danger)
- [ ] Input fields (text, number, select, textarea)
- [ ] Modal/dialog
- [ ] Toast notifications
- [ ] Loading spinner
- [ ] Skeleton loaders
- [ ] Empty states
- [ ] Error states

---

*Document Version: 1.0*
*Last Updated: December 2024*
*For: Dawin Finishes Manufacturing Tools*
# Test Checklist - Optimization System

**Date:** December 27, 2025  
**Version:** 1.0.0

---

## Pre-Test Setup

- [ ] Application running locally (`npm run dev`)
- [ ] Firebase emulators running OR connected to dev environment
- [ ] At least one test project with design items exists
- [ ] Design items have parts with materials defined

---

## 1. Material Palette System

### 1.1 Material Harvesting
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 1.1.1 | Open project → Estimate Tab → Material section | Material palette table visible | ⬜ |
| 1.1.2 | Click "Rescan" button | Materials harvested from all design items | ⬜ |
| 1.1.3 | Add new design item with new material → Rescan | New material appears in palette | ⬜ |
| 1.1.4 | Remove design item → Rescan | Removed material disappears from palette | ⬜ |

### 1.2 Material Mapping
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 1.2.1 | Click "Map" on unmapped material | Mapping modal opens | ⬜ |
| 1.2.2 | Select inventory item | Material mapped, green badge shows | ⬜ |
| 1.2.3 | Click "Unmap" on mapped material | Material unmapped, amber badge shows | ⬜ |
| 1.2.4 | Remap material to different inventory | Previous mapping replaced | ⬜ |

### 1.3 Palette Statistics
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 1.3.1 | View palette with mixed mapped/unmapped | Correct counts displayed | ⬜ |
| 1.3.2 | All materials mapped | "Ready for Katana export" message | ⬜ |
| 1.3.3 | Some unmapped | Warning about unmapped count | ⬜ |

---

## 2. Nesting Studio - Estimation Mode

### 2.1 Basic Functionality
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 2.1.1 | Open Estimate Tab → Show Nesting Studio | NestingStudio component renders | ⬜ |
| 2.1.2 | Click settings toggle | Configuration panel expands/collapses | ⬜ |
| 2.1.3 | Modify kerf value | Value updates in config | ⬜ |
| 2.1.4 | Toggle grain matching | Checkbox state changes | ⬜ |

### 2.2 Running Estimation
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 2.2.1 | Click "Run Estimation" (no prior run) | Loading state shown, then results | ⬜ |
| 2.2.2 | Results display | Sheet summary table with materials | ⬜ |
| 2.2.3 | Results display | Total sheets count visible | ⬜ |
| 2.2.4 | Results display | Waste % and rough cost visible | ⬜ |
| 2.2.5 | Click when results current | Button shows "Results Current" ✅ | ⬜ |

### 2.3 Invalidation
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 2.3.1 | Modify design item parts → Return to Estimate | Invalidation warning shown | ⬜ |
| 2.3.2 | Button shows "Re-optimize" | Amber warning state | ⬜ |
| 2.3.3 | Click "Re-optimize" | New results generated | ⬜ |

---

## 3. Nesting Studio - Production Mode

### 3.1 Stage Gate
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 3.1.1 | Open Production Tab at "concept" stage | Stage gate message shown | ⬜ |
| 3.1.2 | Open Production Tab at "pre-production" stage | NestingStudio visible | ⬜ |
| 3.1.3 | Open Production Tab at "production-ready" stage | NestingStudio visible | ⬜ |

### 3.2 Running Production
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 3.2.1 | Click "Run Production" (estimation exists) | Loading state, then results | ⬜ |
| 3.2.2 | Click "Run Production" (no estimation) | Error: run estimation first | ⬜ |
| 3.2.3 | Results display | Nesting sheets grid visible | ⬜ |
| 3.2.4 | Results display | Optimized yield % shown | ⬜ |
| 3.2.5 | Results display | Cut operations count shown | ⬜ |

### 3.3 Sheet Visualization
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 3.3.1 | Click on nesting sheet card | Sheet detail panel opens | ⬜ |
| 3.3.2 | Sheet detail shows | Visual layout with part placements | ⬜ |
| 3.3.3 | Sheet detail shows | Parts list with dimensions | ⬜ |
| 3.3.4 | Click "Close" | Detail panel closes | ⬜ |

---

## 4. Production Tab Components

### 4.1 Shop Traveler Section
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 4.1.1 | No production results | "Run production first" warning | ⬜ |
| 4.1.2 | Production results exist | "Generate PDF" button enabled | ⬜ |
| 4.1.3 | Click "Generate PDF" | Loading state (placeholder) | ⬜ |

### 4.2 Katana Export Section
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 4.2.1 | No production results | Production check fails ⚠️ | ⬜ |
| 4.2.2 | Production exists, materials unmapped | Materials check fails ⚠️ | ⬜ |
| 4.2.3 | Production exists, all mapped | Both checks pass ✅ | ⬜ |
| 4.2.4 | Export button enabled | "Export to Katana" clickable | ⬜ |
| 4.2.5 | After successful export | "Exported" badge shown | ⬜ |
| 4.2.6 | Production invalidated after export | "Outdated" badge, "Re-export" button | ⬜ |

---

## 5. Project View Integration

### 5.1 Tab Navigation
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 5.1.1 | Four tabs visible | Items, Cutlist, Estimate, Production | ⬜ |
| 5.1.2 | Click each tab | Tab content switches correctly | ⬜ |
| 5.1.3 | Production tab with invalidated state | Amber dot indicator on tab | ⬜ |

### 5.2 Cross-Tab Consistency
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 5.2.1 | Run estimation in Estimate tab | Results saved to project | ⬜ |
| 5.2.2 | Switch to Production tab | Estimation results accessible | ⬜ |
| 5.2.3 | Modify parts in Items tab | Both estimation & production invalidated | ⬜ |

---

## 6. Invalidation Detection

### 6.1 Trigger Events
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 6.1.1 | Add part to design item | Estimation invalidated | ⬜ |
| 6.1.2 | Remove part from design item | Estimation invalidated | ⬜ |
| 6.1.3 | Change part dimensions | Estimation invalidated | ⬜ |
| 6.1.4 | Change part material | Estimation invalidated | ⬜ |
| 6.1.5 | Add new design item | Estimation invalidated | ⬜ |
| 6.1.6 | Delete design item | Estimation invalidated | ⬜ |

### 6.2 Cascade Effects
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 6.2.1 | Invalidate estimation | Production also invalidated | ⬜ |
| 6.2.2 | Remap material (production exists) | Katana BOM invalidated | ⬜ |
| 6.2.3 | Unmap material | Katana BOM invalidated | ⬜ |

---

## 7. Error Handling

### 7.1 Optimization Errors
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 7.1.1 | Run optimization with no parts | Error message displayed | ⬜ |
| 7.1.2 | Run production without estimation | Error message displayed | ⬜ |
| 7.1.3 | Network error during optimization | Error message, can retry | ⬜ |

### 7.2 Material Errors
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 7.2.1 | Harvest with no design items | Empty palette message | ⬜ |
| 7.2.2 | Map to invalid inventory ID | Error handled gracefully | ⬜ |

---

## 8. Performance

### 8.1 Large Datasets
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 8.1.1 | Project with 50+ design items | Harvesting completes < 5s | ⬜ |
| 8.1.2 | 500+ parts estimation | Optimization completes < 10s | ⬜ |
| 8.1.3 | Nesting visualization | Sheets render smoothly | ⬜ |

---

## Test Summary

| Section | Total | Passed | Failed | Blocked |
|---------|-------|--------|--------|---------|
| 1. Material Palette | 11 | ⬜ | ⬜ | ⬜ |
| 2. Estimation Mode | 11 | ⬜ | ⬜ | ⬜ |
| 3. Production Mode | 10 | ⬜ | ⬜ | ⬜ |
| 4. Production Tab | 6 | ⬜ | ⬜ | ⬜ |
| 5. Project View | 5 | ⬜ | ⬜ | ⬜ |
| 6. Invalidation | 9 | ⬜ | ⬜ | ⬜ |
| 7. Error Handling | 5 | ⬜ | ⬜ | ⬜ |
| 8. Performance | 3 | ⬜ | ⬜ | ⬜ |
| **TOTAL** | **60** | ⬜ | ⬜ | ⬜ |

---

## Notes

**Tester:**  
**Date Tested:**  
**Environment:**  
**Browser:**  

### Issues Found:



### Recommendations:



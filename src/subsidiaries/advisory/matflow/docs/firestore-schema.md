# MatFlow Firestore Schema

## Collection Hierarchy

```
/matflow/                                  # Global MatFlow namespace
├── /formulas/{formulaId}                  # Standard calculation formulas
│   ├── code: string
│   ├── name: string
│   ├── description: string
│   ├── category: MaterialCategory
│   ├── outputUnit: MeasurementUnit
│   ├── components: FormulaComponent[]
│   ├── keywords: string[]
│   ├── isActive: boolean
│   ├── usageCount: number
│   ├── version: number
│   └── timestamps...
│
├── /material_rates/{rateId}               # Current material prices
│   ├── materialId: string
│   ├── name: string
│   ├── unit: MeasurementUnit
│   ├── unitPrice: number
│   ├── currency: string
│   ├── isActive: boolean
│   └── timestamps...
│
└── /roles/{roleId}                        # Role capability definitions
    ├── name: string
    ├── description: string
    ├── capabilities: string[]
    └── isSystem: boolean

/organizations/{orgId}/                    # Organization scope
└── /matflow_projects/{projectId}          # MatFlow projects
    ├── code: string
    ├── name: string
    ├── customerId: string
    ├── customerName: string
    ├── status: ProjectStatus
    ├── boqStatus: BOQStatus
    ├── location: Location
    ├── settings: ProjectSettings
    ├── members: ProjectMember[]
    ├── stages: ProjectStage[]
    ├── totalBOQItems: number
    ├── totalPlannedCost: number
    ├── totalActualCost: number
    └── timestamps...
    │
    ├── /boq_items/{itemId}                # Bill of Quantities items
    │   ├── itemCode: string
    │   ├── description: string
    │   ├── unit: MeasurementUnit
    │   ├── quantityContract: number
    │   ├── quantityExecuted: number
    │   ├── rate: number
    │   ├── amount: number
    │   ├── stage: ConstructionStage
    │   ├── formulaId?: string
    │   ├── materialRequirements: MaterialRequirement[]
    │   ├── aiConfidence?: number
    │   ├── isVerified: boolean
    │   ├── source: BOQItemSource
    │   └── timestamps...
    │
    ├── /procurement_entries/{entryId}     # Material deliveries/purchases
    │   ├── type: ProcurementType
    │   ├── status: ProcurementStatus
    │   ├── referenceNumber: string
    │   ├── materialId: string
    │   ├── materialName: string
    │   ├── quantities...
    │   ├── pricing...
    │   ├── supplier...
    │   ├── delivery...
    │   ├── boqItemIds: string[]
    │   ├── syncStatus: string
    │   └── timestamps...
    │
    └── /parsing_jobs/{jobId}              # AI BOQ parsing jobs
        ├── fileName: string
        ├── fileUrl: string
        ├── status: string
        ├── progress: number
        ├── parsedItems?: ParsedBOQItem[]
        ├── errorMessage?: string
        └── timestamps...
```

## Security Model

### Global Collections
- **Formulas, Material Rates, Roles**: Read by all authenticated users, write by admins only

### Organization-Scoped Collections
- **MatFlow Projects**: Org members can list, project members can read/write based on capabilities
- **BOQ Items**: Role-based CRUD via `boq:*` capabilities
- **Procurement Entries**: Role-based CRUD via `procurement:*` capabilities
- **Parsing Jobs**: Created by users with `boq:import` capability

## Notes

1. **Optimistic Locking:** The `version` field prevents concurrent update conflicts
2. **Soft Delete:** Documents use `isDeleted` flag instead of physical deletion
3. **Audit Trail:** All documents have `createdAt/By` and `updatedAt/By` fields
4. **Offline Support:** `syncStatus` field tracks offline-created entries

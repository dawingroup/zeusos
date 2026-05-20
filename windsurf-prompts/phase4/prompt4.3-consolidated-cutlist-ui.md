# Prompt 4.3: Consolidated Cutlist UI

## Objective
Create UI components to view, regenerate, and export the consolidated cutlist at project level.

## Prerequisites
- Completed Prompts 4.1-4.2

## Requirements

### 1. CutlistTab Component

Add to ProjectView as a new tab showing:

```typescript
// src/modules/design-manager/components/project/CutlistTab.tsx

export function CutlistTab({ project, customerId }: CutlistTabProps) {
  const cutlist = project.consolidatedCutlist;
  const { regenerate, loading } = useCutlistAggregation(customerId, project.id);
  const { user } = useAuth();

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      {cutlist?.isStale && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span className="text-sm text-amber-800">
              Cutlist is outdated: {cutlist.staleReason}
            </span>
          </div>
          <button onClick={() => regenerate(user?.email!)} className="...">
            Regenerate
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Parts" value={cutlist?.totalParts || 0} />
        <StatCard label="Materials" value={cutlist?.totalMaterials || 0} />
        <StatCard label="Total Area" value={`${cutlist?.totalArea?.toFixed(2) || 0} m²`} />
        <StatCard label="Est. Sheets" value={cutlist?.estimatedTotalSheets || 0} />
      </div>

      {/* Toolbar */}
      <div className="flex gap-2">
        <button onClick={() => regenerate(user?.email!)} disabled={loading}>
          {loading ? 'Generating...' : 'Regenerate Cutlist'}
        </button>
        <button onClick={handleExportCSV}>Export CSV</button>
        <button onClick={handleExportPDF}>Export PDF</button>
      </div>

      {/* Material Groups */}
      {cutlist?.materialGroups.map((group) => (
        <MaterialGroupCard key={group.materialCode} group={group} />
      ))}
    </div>
  );
}
```

### 2. MaterialGroupCard Component

Collapsible card showing parts for each material:

```typescript
function MaterialGroupCard({ group }: { group: MaterialGroup }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <button onClick={() => setExpanded(!expanded)} className="w-full p-4 flex justify-between">
        <div>
          <h3 className="font-semibold">{group.materialName}</h3>
          <p className="text-sm text-gray-500">{group.thickness}mm • {group.totalParts} parts</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">{group.totalArea.toFixed(2)} m²</p>
          <p className="text-sm text-gray-500">~{group.estimatedSheets} sheets</p>
        </div>
      </button>
      
      {expanded && (
        <div className="border-t border-gray-200 p-4">
          <table className="w-full text-sm">
            {/* Parts table */}
          </table>
        </div>
      )}
    </div>
  );
}
```

### 3. Export Functions

- CSV: Download file with all parts
- PDF: Generate formatted cutlist with material summary
- OptiCut format: Export for nesting software

## Validation Checklist

- [ ] Cutlist tab shows in ProjectView
- [ ] Stale warning appears when parts changed
- [ ] Regenerate updates cutlist
- [ ] Export downloads correct file

## Next Steps
Proceed to **Prompt 4.4**: Consolidated Estimate

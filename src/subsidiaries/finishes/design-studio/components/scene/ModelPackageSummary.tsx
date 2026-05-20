/**
 * ModelPackageSummary — Detail card for a saved ModelPackage
 *
 * Shows source, confidence, material mappings, renders, BOM, and processing metadata.
 */
import type { ModelPackage } from '../../types/modelPackage.types';

interface ModelPackageSummaryProps {
  modelPackage: ModelPackage;
}

function formatDate(ts: unknown): string {
  if (!ts) return '';
  const t = ts as { toDate?: () => Date; seconds?: number };
  const date = t.toDate ? t.toDate() : (t.seconds ? new Date(t.seconds * 1000) : new Date(ts as string));
  return date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function ModelPackageSummary({ modelPackage: pkg }: ModelPackageSummaryProps) {
  const pct = Math.round(pkg.grouping.confidence * 100);
  const errors = pkg.metadata?.errors ?? [];

  return (
    <div className="rounded-lg border border-gray-200 p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-700">Package v{pkg.version}</h4>
        <span className="text-[10px] text-gray-400">{formatDate(pkg.metadata?.processedAt)}</span>
      </div>

      {/* Grouping */}
      <section>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Grouping</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Source:</span>
            <span className="font-medium capitalize">{pkg.grouping.source}</span>
            <span className="text-gray-400">· {pkg.grouping.model}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Confidence:</span>
            <span className="font-medium">{pct}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Assemblies:</span>
            <span className="font-medium">{pkg.grouping.assemblies.length}</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500">Parts:</span>
            <span className="font-medium">{pkg.grouping.parts.length}</span>
          </div>
          {pkg.grouping.unmapped.length > 0 && (
            <div className="text-amber-600">
              {pkg.grouping.unmapped.length} unmapped mesh{pkg.grouping.unmapped.length === 1 ? '' : 'es'}
            </div>
          )}
        </div>
      </section>

      {/* Materials */}
      <section>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Materials</p>
        <div className="flex items-center gap-3">
          <span className="text-gray-700">{pkg.materials.mappings.length} mapped</span>
          {pkg.materials.unresolved.length > 0 && (
            <span className="text-amber-600">{pkg.materials.unresolved.length} unresolved</span>
          )}
        </div>
      </section>

      {/* Renders */}
      <section>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Renders</p>
        <div className="flex gap-2">
          {pkg.renders.thumbnail && (
            <div className="flex flex-col items-center gap-0.5">
              <img src={pkg.renders.thumbnail} alt="Thumbnail" className="w-12 h-12 rounded border" />
              <span className="text-[9px] text-gray-400">Thumbnail</span>
            </div>
          )}
          {pkg.renders.productCatalog && (
            <div className="flex flex-col items-center gap-0.5">
              <img src={pkg.renders.productCatalog} alt="Product catalog" className="w-16 h-12 rounded border object-cover" />
              <span className="text-[9px] text-gray-400">Catalog</span>
            </div>
          )}
          {!pkg.renders.thumbnail && !pkg.renders.productCatalog && (
            <span className="text-gray-400">No renders generated</span>
          )}
        </div>
      </section>

      {/* BOM */}
      <section>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">BOM</p>
        <div className="flex items-center gap-3">
          <span className="text-gray-700">{pkg.bom?.length ?? 0} lines</span>
          {pkg.pricing?.total && (
            <span className="text-gray-700 font-medium">
              {pkg.pricing.currency} {pkg.pricing.total.toLocaleString()}
            </span>
          )}
        </div>
      </section>

      {/* Errors */}
      {errors.length > 0 && (
        <section>
          <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mb-1">
            Errors ({errors.length})
          </p>
          <ul className="space-y-0.5">
            {errors.slice(0, 3).map((err, i) => (
              <li key={i} className="text-[10px] text-red-600">· {err}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Processing metadata */}
      <section className="pt-2 border-t">
        <div className="flex items-center justify-between text-[10px] text-gray-400">
          <span>Processed in {Math.round((pkg.metadata?.processingDurationMs ?? 0) / 1000)}s</span>
          {pkg.metadata?.aiTokensUsed && (
            <span>{pkg.metadata.aiTokensUsed.toLocaleString()} tokens</span>
          )}
        </div>
      </section>
    </div>
  );
}

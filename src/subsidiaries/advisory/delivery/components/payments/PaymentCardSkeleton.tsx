/**
 * PaymentCardSkeleton
 *
 * Loading placeholder that mirrors the dimensions and layout of a payment card.
 * Uses Tailwind's animate-pulse for the shimmer effect.
 */

export function PaymentCardSkeleton() {
  return (
    <div className="rounded-xl border bg-white shadow-sm animate-pulse">
      {/* ── Header skeleton ── */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="h-4 w-4 rounded bg-gray-200" />
        <div className="h-4 w-16 rounded bg-gray-200" />
        <div className="h-4 w-24 rounded bg-gray-200" />
        <div className="ml-auto h-5 w-20 rounded-full bg-gray-200" />
      </div>

      {/* ── Body skeleton ── */}
      <div className="space-y-3 px-4 py-3">
        {/* Text lines */}
        <div className="flex gap-6">
          <div className="h-3 w-36 rounded bg-gray-200" />
          <div className="h-3 w-44 rounded bg-gray-200" />
        </div>

        {/* Three column metrics */}
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1.5">
            <div className="h-3 w-16 rounded bg-gray-100" />
            <div className="h-4 w-24 rounded bg-gray-200" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-20 rounded bg-gray-100" />
            <div className="h-4 w-24 rounded bg-gray-200" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-14 rounded bg-gray-100" />
            <div className="h-4 w-20 rounded bg-gray-200" />
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="h-3 w-14 rounded bg-gray-100" />
            <div className="h-3 w-10 rounded bg-gray-100" />
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200" />
        </div>
      </div>

      {/* ── Amounts strip skeleton ── */}
      <div className="border-t px-4 py-3">
        <div className="flex items-center gap-5">
          <div className="h-3 w-24 rounded bg-gray-200" />
          <div className="h-3 w-28 rounded bg-gray-200" />
          <div className="h-3 w-20 rounded bg-gray-200" />
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-4 w-28 rounded bg-gray-100" />
          <div className="h-5 w-24 rounded-full bg-gray-100" />
        </div>
      </div>

      {/* ── Footer skeleton ── */}
      <div className="flex items-center justify-between border-t px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-gray-200" />
          <div className="h-2.5 w-2.5 rounded-full bg-gray-200" />
          <div className="h-2.5 w-2.5 rounded-full bg-gray-200" />
          <div className="h-2.5 w-2.5 rounded-full bg-gray-200" />
        </div>
        <div className="h-3 w-20 rounded bg-gray-200" />
      </div>
    </div>
  );
}

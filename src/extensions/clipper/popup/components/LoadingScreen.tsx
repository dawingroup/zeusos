import { Loader2 } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="w-[400px] h-[500px] bg-[var(--bg-sunken)] flex flex-col items-center justify-center">
      <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  );
}

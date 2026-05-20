import { Loader2 } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="w-[400px] h-[500px] bg-gray-50 flex flex-col items-center justify-center">
      <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
      <p className="text-sm text-gray-500">Loading...</p>
    </div>
  );
}

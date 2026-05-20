import { Scissors, Cloud, Sparkles, Image, Loader2 } from 'lucide-react';

interface SignInScreenProps {
  onSignIn: () => void;
  isSigningIn?: boolean;
  error?: string | null;
}

export default function SignInScreen({ onSignIn, isSigningIn = false, error }: SignInScreenProps) {
  return (
    <div className="w-[400px] h-[500px] bg-gradient-to-b from-[#872E5C] via-[#6B2549] to-[#4A1A33] flex flex-col items-center justify-center p-8">
      {/* Logo */}
      <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-6 ring-4 ring-white/20 shadow-2xl">
        <span className="text-white font-bold text-3xl">D</span>
      </div>

      <h1 className="text-2xl font-bold text-white mb-2">Dawin Clipper</h1>
      <p className="text-sm text-white/70 text-center mb-8 max-w-[280px]">
        Clip furniture, millwork & design inspiration directly to your projects
      </p>

      {/* Features */}
      <div className="grid grid-cols-2 gap-3 mb-8 w-full max-w-[300px]">
        <div className="flex items-center gap-2 text-white/80 text-xs bg-white/10 rounded-lg px-3 py-2">
          <Scissors className="w-4 h-4 text-white/60" />
          <span>One-click clip</span>
        </div>
        <div className="flex items-center gap-2 text-white/80 text-xs bg-white/10 rounded-lg px-3 py-2">
          <Cloud className="w-4 h-4 text-white/60" />
          <span>Cloud sync</span>
        </div>
        <div className="flex items-center gap-2 text-white/80 text-xs bg-white/10 rounded-lg px-3 py-2">
          <Sparkles className="w-4 h-4 text-white/60" />
          <span>AI analysis</span>
        </div>
        <div className="flex items-center gap-2 text-white/80 text-xs bg-white/10 rounded-lg px-3 py-2">
          <Image className="w-4 h-4 text-white/60" />
          <span>Price detection</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-500/20 border border-red-400/30 rounded-lg">
          <p className="text-xs text-red-200 text-center">{error}</p>
        </div>
      )}

      <button
        onClick={onSignIn}
        disabled={isSigningIn}
        className="flex items-center gap-3 bg-white rounded-xl px-6 py-3.5 hover:bg-gray-50 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {isSigningIn ? (
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        )}
        <span className="text-sm font-semibold text-gray-700">
          {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
        </span>
      </button>

      <p className="text-[11px] text-white/40 mt-6 text-center">
        By signing in, you agree to our Terms & Privacy Policy
      </p>
    </div>
  );
}

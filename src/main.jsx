// Polyfill Node.js Buffer + `global` for browser libs (e.g., @react-pdf/renderer).
// `globalThis.global` is set at runtime here rather than via Vite `define` —
// the define approach text-replaces inside import paths and breaks builds
// (see motion-utils/./global-config.mjs incident).
import { Buffer } from 'buffer'
globalThis.Buffer = Buffer
if (typeof globalThis.global === 'undefined') globalThis.global = globalThis

// Suppress recharts ResponsiveContainer dimension warning (fires on first render
// before ResizeObserver can measure; harmless, charts re-render correctly)
const _origWarn = console.warn
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('should be greater than 0')) return
  _origWarn.apply(console, args)
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { ConfigProvider } from './contexts/ConfigContext.jsx'
import { OffcutProvider } from './contexts/OffcutContext.jsx'
import { WorkInstanceProvider } from './contexts/WorkInstanceContext.jsx'
import { SubsidiaryProvider } from './contexts/SubsidiaryContext'
import { GlobalProvider } from './integration/store'
import { AlertTriangle } from 'lucide-react'
import { AppRouter } from './router'
import { ThemeSync } from './shared/hooks/useThemeSync'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

// PWA initialization removed in Phase 1.C — the original initPWA wired up the
// matflow construction-domain service worker. Phase 4 will re-add a generic
// service-worker registration once the marketing-agency PWA scope is defined.

/**
 * Error Boundary to catch and display runtime errors
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle className="w-8 h-8" />
              <h1 className="text-xl font-bold">Something went wrong</h1>
            </div>
            <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
              <p className="text-sm font-mono text-red-800 break-all">
                {this.state.error?.message || 'Unknown error'}
              </p>
            </div>
            <details className="text-xs text-gray-600 mb-4">
              <summary className="cursor-pointer font-medium">Stack trace</summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-48 text-xs">
                {this.state.error?.stack}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-[#872E5C] text-white rounded-md hover:bg-[#6a2449]"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Main Application with unified AppRouter
 */
function MainApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <ThemeSync />
        <AuthProvider>
          <GlobalProvider>
            <SubsidiaryProvider>
              <ConfigProvider>
                <OffcutProvider>
                  <WorkInstanceProvider>
                    <AppRouter />
                  </WorkInstanceProvider>
                </OffcutProvider>
              </ConfigProvider>
            </SubsidiaryProvider>
          </GlobalProvider>
        </AuthProvider>
      </HelmetProvider>
    </QueryClientProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  </React.StrictMode>,
)

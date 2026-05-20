/**
 * AppLayout Component
 * Main app shell with header navigation
 * Updated: Removed sidebar, using header module switcher
 */

import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';

export interface AppLayoutProps {
  children?: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex flex-col">
      {/* Header with Module Switcher */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children || <Outlet />}
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default AppLayout;

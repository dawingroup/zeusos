# UI/UX Implementation Report

**Version:** 1.0.0  
**Report Date:** December 26, 2024  
**Application:** Dawin Cutlist Processor  
**URL:** https://dawin-cutlist-processor.web.app

---

## Executive Summary

This report documents the current state of UI/UX implementation in the Dawin Cutlist Processor application. It includes detailed file contents, design system specifications, and component patterns.

---

## 1. File Structure Overview

### Requested Files Status

| Requested Path | Status | Actual Path |
|----------------|--------|-------------|
| `/src/styles/theme.css` | ❌ Not found | `/src/index.css` |
| `/src/app/App.tsx` | ✅ Found | `/src/app/App.tsx` |
| `/src/app/AppRouter.tsx` | ❌ Not found | Routes in `/src/app/routes/` |
| `/src/app/design-manager/page.tsx` | ❌ Not found | Module in `/src/modules/design-manager/` |

### Actual Style Files

```
src/
├── index.css                 # Main styles with CSS variables (300 lines)
├── styles/
│   └── index.css             # Placeholder for additional styles (8 lines)
└── tailwind.config.js        # Tailwind configuration (127 lines)
```

---

## 2. Main Stylesheet

### File: `/src/index.css`

This is the primary stylesheet containing the complete design system with CSS variables.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ============================================
   Figma Design System - Complete CSS Variables
   Apple-inspired black theme (#1d1d1f)
   ============================================ */

:root {
  --font-size: 16px;
  --background: #ffffff;
  --foreground: #1d1d1f;
  --card: #ffffff;
  --card-foreground: #1d1d1f;
  --popover: #ffffff;
  --popover-foreground: #1d1d1f;
  --primary: #1d1d1f;
  --primary-foreground: #ffffff;
  --secondary: #f4f4f5;
  --secondary-foreground: #030213;
  --muted: #ececf0;
  --muted-foreground: #717182;
  --accent: #e9ebef;
  --accent-foreground: #030213;
  --destructive: #d4183d;
  --destructive-foreground: #ffffff;
  --border: rgba(0, 0, 0, 0.1);
  --input: transparent;
  --input-background: #f3f3f5;
  --switch-background: #cbced4;
  --font-weight-medium: 500;
  --font-weight-normal: 400;
  --ring: #71717a;
  --radius: 0.375rem;
  
  /* Sidebar */
  --sidebar: #fafafa;
  --sidebar-foreground: #1d1d1f;
  --sidebar-primary: #030213;
  --sidebar-primary-foreground: #fafafa;
  --sidebar-accent: #f5f5f5;
  --sidebar-accent-foreground: #333333;
  --sidebar-border: #e5e5e5;
  --sidebar-ring: #71717a;
  
  /* Dawin brand colors */
  --boysenberry: #872E5C;
  --boysenberry-light: #a34573;
  --boysenberry-dark: #6a2449;
  --golden-bell: #E18425;
  --cashmere: #E2CAA9;
  --pesto: #8A7D4B;
  --seafoam: #7ABDCD;
  --teal: #1d1d1f;
  --teal-light: #424245;
  --teal-dark: #000000;
  
  /* RAG Status Colors */
  --rag-red: #EF4444;
  --rag-amber: #F59E0B;
  --rag-green: #22C55E;
  --rag-na: #9CA3AF;
  
  /* Typography Scale */
  --text-h1: 1.5rem;
  --text-h2: 1.25rem;
  --text-h3: 1rem;
  --text-body: 0.875rem;
  --text-small: 0.75rem;
  --text-tiny: 0.625rem;
  
  /* Spacing System (8px grid) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  
  /* Shadows */
  --shadow-card: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
  --shadow-hover: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
  --shadow-modal: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  
  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
}

.dark {
  --background: #1d1d1f;
  --foreground: #fafafa;
  --card: #1d1d1f;
  --card-foreground: #fafafa;
  --popover: #1d1d1f;
  --popover-foreground: #fafafa;
  --primary: #fafafa;
  --primary-foreground: #1d1d1f;
  --secondary: #2d2d2f;
  --secondary-foreground: #fafafa;
  --muted: #2d2d2f;
  --muted-foreground: #a1a1a1;
  --accent: #2d2d2f;
  --accent-foreground: #fafafa;
  --destructive: #7f1d1d;
  --destructive-foreground: #fecaca;
  --border: #2d2d2f;
  --input: #2d2d2f;
  --ring: #525252;
  --sidebar: #1a1a1a;
  --sidebar-foreground: #fafafa;
  --sidebar-primary: #3b82f6;
  --sidebar-primary-foreground: #fafafa;
  --sidebar-accent: #2d2d2f;
  --sidebar-accent-foreground: #fafafa;
  --sidebar-border: #2d2d2f;
  --sidebar-ring: #525252;
}

@layer base {
  * {
    border-color: var(--border);
  }

  html {
    font-size: var(--font-size);
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }

  body {
    background-color: var(--background);
    color: var(--foreground);
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }

  h1 {
    font-size: var(--text-h1);
    font-weight: 600;
    line-height: 1.5;
  }

  h2 {
    font-size: var(--text-h2);
    font-weight: 600;
    line-height: 1.5;
  }

  h3 {
    font-size: var(--text-h3);
    font-weight: 600;
    line-height: 1.5;
  }

  h4 {
    font-size: var(--text-body);
    font-weight: 600;
    line-height: 1.5;
  }

  label {
    font-size: var(--text-body);
    font-weight: 500;
    line-height: 1.5;
  }

  button {
    font-size: var(--text-body);
    font-weight: 500;
    line-height: 1.5;
  }

  input {
    font-size: var(--text-body);
    font-weight: 400;
    line-height: 1.5;
  }

  p {
    font-weight: 400;
  }
}

/* Brand color utilities */
.text-brand-primary { color: var(--boysenberry); }
.bg-brand-primary { background-color: var(--boysenberry); }
.border-brand-primary { border-color: var(--boysenberry); }
.text-brand-secondary { color: var(--golden-bell); }
.bg-brand-secondary { background-color: var(--golden-bell); }
.border-brand-secondary { border-color: var(--golden-bell); }

/* Primary button styles - Apple black */
.btn-primary {
  background-color: var(--primary);
  color: var(--primary-foreground);
  border-radius: var(--radius);
  transition: background-color var(--transition-normal);
}
.btn-primary:hover {
  background-color: var(--teal-light);
}

/* Secondary button */
.btn-secondary {
  background-color: var(--secondary);
  color: var(--secondary-foreground);
  border-radius: var(--radius);
  transition: background-color var(--transition-normal);
}
.btn-secondary:hover {
  background-color: var(--accent);
}

/* Ghost button */
.btn-ghost {
  background-color: transparent;
  color: var(--foreground);
  border-radius: var(--radius);
  transition: background-color var(--transition-normal);
}
.btn-ghost:hover {
  background-color: var(--accent);
}

/* Destructive button */
.btn-destructive {
  background-color: var(--destructive);
  color: var(--destructive-foreground);
  border-radius: var(--radius);
  transition: background-color var(--transition-normal);
}

/* RAG status utilities */
.rag-red { background-color: var(--rag-red); }
.rag-amber { background-color: var(--rag-amber); }
.rag-green { background-color: var(--rag-green); }
.rag-na { background-color: var(--rag-na); }

/* Card styles */
.card {
  background-color: var(--card);
  color: var(--card-foreground);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}
.card:hover {
  box-shadow: var(--shadow-hover);
}

/* Input styles */
.input {
  background-color: var(--input-background);
  border-radius: var(--radius);
  border: 1px solid var(--border);
}
.input:focus {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/* Mobile touch targets - minimum 44px */
@media (max-width: 640px) {
  .touch-target {
    min-height: 44px;
    min-width: 44px;
  }
}

/* Print styles for cutting diagrams */
@media print {
  .no-print {
    display: none !important;
  }
  
  .print-break {
    page-break-after: always;
  }
}

/* Custom scrollbar for tables */
.overflow-x-auto::-webkit-scrollbar {
  height: 8px;
}

.overflow-x-auto::-webkit-scrollbar-track {
  background: var(--muted);
  border-radius: 4px;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
  background: var(--muted-foreground);
  border-radius: 4px;
}

.overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background: var(--foreground);
}
```

---

## 3. Tailwind Configuration

### File: `/tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // CSS Variable-based colors for theme consistency
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        // Sidebar colors
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
        // Dawin Finishes brand colors
        boysenberry: {
          DEFAULT: 'var(--boysenberry)',
          light: 'var(--boysenberry-light)',
          dark: 'var(--boysenberry-dark)',
        },
        goldenBell: {
          DEFAULT: 'var(--golden-bell)',
        },
        cashmere: {
          DEFAULT: 'var(--cashmere)',
        },
        pesto: {
          DEFAULT: 'var(--pesto)',
        },
        seafoam: {
          DEFAULT: 'var(--seafoam)',
        },
        teal: {
          DEFAULT: 'var(--teal)',
          light: 'var(--teal-light)',
          dark: 'var(--teal-dark)',
        },
        // RAG Status Colors
        rag: {
          red: 'var(--rag-red)',
          amber: 'var(--rag-amber)',
          green: 'var(--rag-green)',
          na: 'var(--rag-na)',
        },
      },
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
      },
      fontSize: {
        h1: 'var(--text-h1)',
        h2: 'var(--text-h2)',
        h3: 'var(--text-h3)',
        body: 'var(--text-body)',
        small: 'var(--text-small)',
        tiny: 'var(--text-tiny)',
      },
      spacing: {
        'space-1': 'var(--space-1)',
        'space-2': 'var(--space-2)',
        'space-3': 'var(--space-3)',
        'space-4': 'var(--space-4)',
        'space-5': 'var(--space-5)',
        'space-6': 'var(--space-6)',
        'space-8': 'var(--space-8)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 4px)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        hover: 'var(--shadow-hover)',
        modal: 'var(--shadow-modal)',
      },
      transitionDuration: {
        fast: '150ms',
        normal: '200ms',
        slow: '300ms',
      },
    },
  },
  plugins: [],
}
```

---

## 4. Application Entry Point

### File: `/src/app/App.tsx`

```tsx
/**
 * App Component
 * Main application entry point with routing
 */

import { RouterProvider } from 'react-router-dom';
import { router } from './routes/index';
import { AuthProvider } from '@/contexts/AuthContext';

/**
 * Error Boundary fallback
 */
function ErrorFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
        <p className="text-gray-600 mb-4">Please refresh the page to try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-[#872E5C] text-white rounded-md hover:bg-[#6a2449]"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}

/**
 * Main App Component
 */
export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
```

---

## 5. Layout Components

### File: `/src/shared/components/layout/AppLayout.tsx`

```tsx
/**
 * AppLayout Component
 * Main app shell with header navigation
 * Updated: Removed sidebar, using header module switcher
 */

import { Outlet } from 'react-router-dom';
import { Header } from './Header';

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
    </div>
  );
}

export default AppLayout;
```

### File: `/src/shared/components/layout/Header.tsx`

```tsx
/**
 * Header Component
 * Top header with module switcher, branding, and user menu
 * Updated with Apple-inspired black theme (#1d1d1f)
 */

import { useAuth } from '@/shared/hooks';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogOut, User, Scissors, FolderOpen } from 'lucide-react';

export interface HeaderProps {
  title?: string;
}

export function Header({ title = 'Dawin Finishes' }: HeaderProps) {
  const { user, isAuthenticated, signInWithGoogle, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const currentModule = location.pathname.startsWith('/design') ? 'design' : 'cutlist';

  return (
    <header className="sticky top-0 z-50 h-14 border-b border-gray-200 bg-white/95 backdrop-blur px-4 sm:px-6 lg:px-8 flex items-center justify-between">
      {/* Left: Logo and Brand */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#872E5C] to-[#E18425]">
          {currentModule === 'cutlist' ? (
            <Scissors className="h-5 w-5 text-white" />
          ) : (
            <FolderOpen className="h-5 w-5 text-white" />
          )}
        </div>
        <div className="hidden sm:block">
          <h1 className="text-sm font-semibold text-gray-900">{title}</h1>
          <p className="text-[10px] text-gray-500">Manufacturing Tools</p>
        </div>
      </div>

      {/* Center: Module Switcher */}
      <div className="flex items-center gap-1 border rounded-lg p-1 bg-gray-50">
        <button
          onClick={() => navigate('/cutlist')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-[36px] sm:min-h-auto ${
            currentModule === 'cutlist'
              ? 'bg-[#1d1d1f] text-white'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Scissors className="h-4 w-4" />
          <span className="hidden sm:inline">Cutlist Processor</span>
          <span className="sm:hidden">Cutlist</span>
        </button>
        <button
          onClick={() => navigate('/design')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-[36px] sm:min-h-auto ${
            currentModule === 'design'
              ? 'bg-[#1d1d1f] text-white'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <FolderOpen className="h-4 w-4" />
          <span className="hidden sm:inline">Design Manager</span>
          <span className="sm:hidden">Designs</span>
        </button>
      </div>

      {/* Right: User Menu */}
      <div className="flex items-center gap-3">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'User'} 
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-gray-600" />
                </div>
              )}
              <span className="text-sm text-gray-700 hidden md:block">
                {user.displayName || user.email}
              </span>
            </div>
            <button
              onClick={() => signOut()}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors min-h-[44px] min-w-[44px] sm:min-h-auto sm:min-w-auto flex items-center justify-center"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => signInWithGoogle()}
            className="flex items-center gap-2 px-4 py-2 bg-[#1d1d1f] text-white rounded-md text-sm font-medium hover:bg-[#424245] transition-colors min-h-[44px] sm:min-h-auto"
          >
            <User className="h-4 w-4 sm:hidden" />
            <span className="hidden sm:inline">Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
```

---

## 6. Design Manager Dashboard

### File: `/src/modules/design-manager/components/dashboard/DesignManagerPageNew.tsx` (excerpt)

```tsx
/**
 * DesignManagerPage Component (New Figma Design)
 * Main page for the Design Manager module with view modes
 * Connected to real Firestore data and existing components
 */

import { useState, useEffect, useMemo } from 'react';
import { Package, LayoutGrid, List, Plus, Search, Filter, FolderOpen, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui';
import { useAuth } from '@/shared/hooks';
import { subscribeToProjects, subscribeToDesignItems } from '../../services/firestore';
import type { DesignProject, DesignItem } from '../../types';
import { DesignItemCard } from '../design-item/DesignItemCard';
import { StageKanban } from './StageKanban';
import { ProjectDialog } from '../project/ProjectDialog';
import { ProjectDashboardCard } from '../project/ProjectDashboardCard';

export default function DesignManagerPageNew() {
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'kanban'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<DesignProject | null>(null);
  const [selectedProject, setSelectedProject] = useState<DesignProject | null>(null);
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // ... state management and Firestore subscriptions ...

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Design Manager</h1>
          <p className="text-muted-foreground">Track designs through manufacturing stages</p>
        </div>
        <Button onClick={handleNewProject} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Dashboard Stats - 5 Column Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 border-l-4 border-l-primary">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium text-gray-600">Projects</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{projects.length}</p>
          <p className="text-xs text-gray-500">Active projects</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-500" />
            <p className="text-sm font-medium text-gray-600">Total Designs</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500">Design items</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-medium text-gray-600">In Progress</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
          <p className="text-xs text-gray-500">Across all stages</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 border-l-4 border-l-green-500">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <p className="text-sm font-medium text-gray-600">Production Ready</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.productionReady}</p>
          <p className="text-xs text-gray-500">Ready to manufacture</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 border-l-4 border-l-red-500">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <p className="text-sm font-medium text-gray-600">Needs Attention</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.needsAttention}</p>
          <p className="text-xs text-gray-500">Critical items</p>
        </div>
      </div>

      {/* Projects Section */}
      {projects.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Projects</h2>
            <span className="text-xs text-gray-500">{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setSelectedProject(selectedProject?.id === project.id ? null : project)}
                className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm transition-colors ${
                  selectedProject?.id === project.id
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                <span className="font-medium">{project.name}</span>
                <span className="text-xs opacity-70">({project.code})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected Project Dashboard Card */}
      {selectedProject && (
        <ProjectDashboardCard
          project={selectedProject}
          items={allDesignItems}
          onEdit={() => handleEditProject(selectedProject)}
          onClose={() => setSelectedProject(null)}
          onViewItem={handleItemClick}
        />
      )}

      {/* Filters and View Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 w-full sm:w-auto flex gap-2">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search designs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            {/* Filter button */}
          </div>
          {/* View mode toggle */}
        </div>
      </div>

      {/* Design Items Grid/List/Kanban */}
      {/* ... */}

      {/* Dialogs */}
      <ProjectDialog
        open={showProjectDialog}
        onClose={handleCloseDialog}
        userId={user?.email || ''}
        project={editingProject || undefined}
      />
    </div>
  );
}
```

---

## 7. Color Palette Reference

### Brand Colors

| Name | Hex | Usage |
|------|-----|-------|
| Boysenberry | `#872E5C` | Brand primary, logo gradient |
| Boysenberry Light | `#a34573` | Hover states |
| Boysenberry Dark | `#6a2449` | Pressed states |
| Golden Bell | `#E18425` | Brand secondary, logo gradient |
| Cashmere | `#E2CAA9` | Accent |
| Pesto | `#8A7D4B` | Accent |
| Seafoam | `#7ABDCD` | Accent |

### UI Colors

| Name | Hex | Usage |
|------|-----|-------|
| Primary | `#1d1d1f` | Apple black, buttons, active states |
| Primary Light | `#424245` | Hover states |
| Background | `#ffffff` | Page background |
| Foreground | `#1d1d1f` | Text color |
| Muted | `#ececf0` | Disabled backgrounds |
| Muted Foreground | `#717182` | Secondary text |
| Border | `rgba(0,0,0,0.1)` | Borders, dividers |
| Destructive | `#d4183d` | Delete, error states |

### RAG Status Colors

| Status | Hex | Usage |
|--------|-----|-------|
| Red | `#EF4444` | Critical, blocked |
| Amber | `#F59E0B` | Warning, in progress |
| Green | `#22C55E` | Complete, approved |
| N/A | `#9CA3AF` | Not applicable |

---

## 8. Component Patterns

### Stats Card

```html
<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 border-l-4 border-l-{color}">
  <div class="flex items-center gap-2">
    <Icon class="h-4 w-4 text-{color}" />
    <p class="text-sm font-medium text-gray-600">{Label}</p>
  </div>
  <p class="text-2xl font-bold text-gray-900">{Value}</p>
  <p class="text-xs text-gray-500">{Subtitle}</p>
</div>
```

### Primary Button

```html
<button class="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
  <Icon class="h-4 w-4" />
  {Label}
</button>
```

### Search Input

```html
<div class="relative">
  <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
  <input
    type="text"
    placeholder="Search..."
    class="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
  />
</div>
```

### Selection Chip/Pill

```html
<!-- Unselected -->
<button class="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors">
  <Icon class="h-3.5 w-3.5" />
  {Label}
</button>

<!-- Selected -->
<button class="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary rounded-lg text-sm text-primary transition-colors">
  <Icon class="h-3.5 w-3.5" />
  {Label}
</button>
```

---

## 9. Responsive Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| `sm` | 640px | Mobile landscape, tablet portrait |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Large desktop |

### Mobile Considerations

- Minimum touch target: 44px × 44px
- Text hidden on mobile, icons only
- Single column layouts on mobile
- Full-width inputs and buttons

---

## 10. Summary of UI/UX Improvements

### Implemented ✅

1. **Complete Design System** with CSS variables
2. **Apple-inspired Primary Color** (`#1d1d1f`)
3. **Brand Color Integration** (Boysenberry, Golden Bell)
4. **RAG Status Color System**
5. **Typography Scale** (h1 → tiny)
6. **8px Spacing Grid**
7. **Shadow System** (card, hover, modal)
8. **Dark Mode Support** (CSS variables)
9. **Global Header** with module switcher
10. **Stats Dashboard Cards** with colored accents
11. **Project Selection UI** with chips/pills
12. **Search Input Pattern** with icon
13. **Button Variants** (primary, secondary, ghost, destructive)
14. **Mobile Touch Targets** (44px minimum)
15. **Print Styles** for exports

### Pending 🔄

1. Dark mode toggle UI
2. Advanced filtering UI
3. Mobile navigation drawer
4. Skeleton loading states
5. Toast notification system

---

*Report generated for Dawin Group internal development reference.*

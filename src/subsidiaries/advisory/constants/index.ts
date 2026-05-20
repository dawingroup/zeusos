/**
 * Advisory Module Constants
 * DawinOS v2.0 - Dawin Advisory
 */

export const MODULE_COLOR = '#f59e0b'; // amber-500

export const ADVISORY_MODULES = [
  {
    id: 'investment',
    name: 'Investment',
    description: 'Deal pipeline & portfolio management',
    icon: 'Briefcase',
    path: '/advisory/investment',
    color: '#10b981', // emerald-500
  },
  {
    id: 'matflow',
    name: 'MatFlow',
    description: 'Material flow & project tracking',
    icon: 'HardHat',
    path: '/advisory/matflow',
    color: '#f59e0b', // amber-500
  },
  {
    id: 'delivery',
    name: 'Delivery',
    description: 'Infrastructure delivery management',
    icon: 'Building2',
    path: '/advisory/delivery',
    color: '#3b82f6', // blue-500
  },
] as const;

export const ENGAGEMENT_STATUSES = {
  prospect: { label: 'Prospect', color: '#94a3b8' },
  active: { label: 'Active', color: '#10b981' },
  on_hold: { label: 'On Hold', color: '#f59e0b' },
  completed: { label: 'Completed', color: '#3b82f6' },
  cancelled: { label: 'Cancelled', color: '#ef4444' },
} as const;

export const SECTORS = [
  { id: 'infrastructure', label: 'Infrastructure', color: '#3b82f6' },
  { id: 'healthcare', label: 'Healthcare', color: '#10b981' },
  { id: 'energy', label: 'Energy', color: '#f59e0b' },
  { id: 'transport', label: 'Transport', color: '#8b5cf6' },
  { id: 'water', label: 'Water & Sanitation', color: '#06b6d4' },
  { id: 'digital', label: 'Digital Infrastructure', color: '#ec4899' },
  { id: 'education', label: 'Education', color: '#14b8a6' },
  { id: 'housing', label: 'Housing', color: '#f97316' },
] as const;

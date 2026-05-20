# Conditioning Prompt - Dawin Cutlist Processor

## Project Overview

You are working on the **Dawin Cutlist Processor**, a manufacturing management application for Dawin Finishes, a millwork and custom furniture company. The application manages the design-to-production workflow for custom woodworking projects.

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **React Router DOM 6** for routing
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Zustand** for state management (where needed)

### Backend
- **Firebase Authentication** (Google OAuth)
- **Cloud Firestore** for database
- **Firebase Storage** for file uploads
- **Cloud Functions** for server-side logic and external integrations

### External Integrations
- **Katana MRP** - Manufacturing resource planning
- **QuickBooks Online** - Accounting and invoicing
- **Google Drive API** - Project folder management

## Project Structure

```
src/
├── app/                           # App entry and routing
│   ├── App.tsx
│   └── routes/
├── modules/                       # Feature modules
│   ├── cutlist-processor/         # Legacy cutlist module
│   └── design-manager/            # Design workflow module
│       ├── components/
│       │   ├── ai/               # AI analysis components
│       │   ├── approvals/        # Approval workflow
│       │   ├── common/           # Shared components
│       │   ├── dashboard/        # Dashboard views
│       │   ├── design-item/      # Design item components
│       │   ├── project/          # Project components
│       │   ├── stage-gate/       # Stage transitions
│       │   └── traffic-light/    # RAG status components
│       ├── hooks/                # Module-specific hooks
│       ├── services/             # Firestore & Storage services
│       ├── types/                # TypeScript interfaces
│       └── utils/                # Utilities
├── shared/                        # Shared across modules
│   ├── components/
│   │   ├── layout/              # AppLayout, Header
│   │   └── ui/                  # Button, Card, Input, Tabs
│   ├── hooks/                   # useAuth, etc.
│   ├── services/                # Shared services
│   └── types/                   # Shared types
├── contexts/                      # React contexts
├── firebase/                      # Firebase config
└── services/                      # Legacy services
```

## Coding Conventions

### File Naming
- Components: `PascalCase.tsx` (e.g., `CustomerList.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useCustomer.ts`)
- Services: `camelCase.ts` (e.g., `customerService.ts`)
- Types: `index.ts` in `types/` directory

### Component Pattern
```tsx
/**
 * ComponentName
 * Brief description of what this component does
 */

import { useState } from 'react';
import { SomeIcon } from 'lucide-react';
import { Button } from '@/shared/components/ui';

interface ComponentNameProps {
  prop1: string;
  onAction?: () => void;
}

export function ComponentName({ prop1, onAction }: ComponentNameProps) {
  const [state, setState] = useState('');

  return (
    <div className="...">
      {/* Component content */}
    </div>
  );
}

export default ComponentName;
```

### Hook Pattern
```tsx
/**
 * useHookName
 * Brief description of what this hook does
 */

import { useState, useEffect } from 'react';
import { subscribeToCollection } from '../services/firestore';

export function useHookName(param: string) {
  const [data, setData] = useState<DataType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToCollection(param, (items) => {
      setData(items);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [param]);

  return { data, loading, error };
}
```

### Firestore Service Pattern
```tsx
import { 
  collection, doc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot,
  serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db } from '@/firebase/config';

// Collection reference
const collectionRef = collection(db, 'collectionName');

// Subscribe to documents
export function subscribeToDocuments(
  callback: (docs: DocType[]) => void
): () => void {
  const q = query(collectionRef, orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as DocType[];
    callback(docs);
  });
}

// Create document
export async function createDocument(
  data: Omit<DocType, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<string> {
  const docRef = await addDoc(collectionRef, {
    ...data,
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
  return docRef.id;
}
```

## Styling Conventions

### CSS Variables (from index.css)
```css
--primary: #1d1d1f;           /* Apple black - primary actions */
--primary-foreground: #ffffff;
--destructive: #d4183d;       /* Delete/error actions */
--muted-foreground: #717182;  /* Secondary text */
--border: rgba(0, 0, 0, 0.1); /* Borders */
--boysenberry: #872E5C;       /* Brand color */
--golden-bell: #E18425;       /* Brand accent */
```

### Common Tailwind Patterns
```tsx
// Card
<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">

// Stats card with accent
<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 border-l-4 border-l-blue-500">

// Primary button
<button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">

// Input field
<input className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />

// Selection chip (unselected)
<button className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-100">

// Selection chip (selected)
<button className="px-3 py-1.5 bg-primary/10 border border-primary rounded-lg text-sm text-primary">
```

## Data Model Overview

### Current Hierarchy
```
designProjects/
├── {projectId}
│   ├── code, name, description, customerName, status
│   ├── startDate, dueDate
│   └── designItems/ (subcollection)
│       └── {itemId}
│           ├── itemCode, name, category, currentStage
│           ├── ragStatus: { designCompleteness, manufacturingReadiness, qualityGates }
│           ├── overallReadiness, parameters
│           ├── deliverables/ (subcollection)
│           └── approvals/ (subcollection)
```

### Target Hierarchy (after Phase 1-4)
```
customers/
├── {customerId}
│   ├── name, email, phone, address
│   ├── katanaId, quickbooksId, driveFolderId
│   └── projects/ (subcollection)
│       └── {projectId}
│           ├── code, name, status, phase
│           ├── developmentFolderId, confirmedFolderId
│           ├── consolidatedCutlist, consolidatedEstimate
│           └── designItems/ (subcollection)
│               └── {itemId}
│                   ├── (existing fields)
│                   └── parts: PartEntry[]
```

## Important Notes

1. **Preserve Existing Functionality** - Don't break existing design manager features
2. **Use Existing Components** - Leverage shared UI components from `@/shared/components/ui`
3. **Follow Module Pattern** - Create new modules in `src/modules/` if needed
4. **Real-time Updates** - Use Firestore subscriptions for live data
5. **Error Handling** - Always handle loading and error states
6. **TypeScript Strict** - Proper types for all data structures
7. **Mobile Responsive** - Consider touch targets and responsive layouts

## External API Credentials

Environment variables (in `.env` or Firebase config):
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=dawin-cutlist-processor
VITE_FIREBASE_STORAGE_BUCKET=...

# For Cloud Functions
KATANA_API_KEY=...
QUICKBOOKS_CLIENT_ID=...
QUICKBOOKS_CLIENT_SECRET=...
GOOGLE_SERVICE_ACCOUNT_KEY=... (base64 encoded)
```

## Getting Help

If you need to understand existing code:
1. Check `APP_ARCHITECTURE_REPORT.md` for system overview
2. Check `UI_UX_IMPLEMENTATION_REPORT.md` for styling details
3. Check `FIGMA_DESIGN_SYSTEM.md` for design specifications
4. Browse existing components in `src/modules/design-manager/components/`

Ready to implement! Start with Phase 1, Prompt 1.1.

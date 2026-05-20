import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';
import { app } from '@/shared/services/firebase/config';
import { db } from '@/shared/services/firebase/firestore';

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Google Auth Provider with required scopes
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive'); // Full Drive access for writing to any folder

// Initialize Firebase Functions
export const functions = getFunctions(app);

// Re-export the shared Firestore instance (initialized with persistent cache)
export { db };

export default app;

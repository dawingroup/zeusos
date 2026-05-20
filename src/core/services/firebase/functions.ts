/**
 * Firebase Functions
 * Cloud Functions client for calling backend functions
 */

import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { app } from './config';

// Initialize Functions with us-central1 region
export const functions = getFunctions(app, 'us-central1');

// Connect to emulator in development
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

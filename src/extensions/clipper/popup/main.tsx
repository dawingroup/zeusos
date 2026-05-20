import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} else {
  document.body.innerHTML = `
    <div style="width:400px;height:500px;display:flex;align-items:center;justify-content:center;font-family:system-ui;">
      <p style="color:red;">Failed to find root element</p>
    </div>
  `;
}

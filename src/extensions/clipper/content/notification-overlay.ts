/**
 * Cross-platform notification overlay for content scripts
 * 
 * Safari doesn't support chrome.notifications, so we use
 * an injected DOM overlay instead. This works on all platforms.
 */

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface NotificationOptions {
  message: string;
  type?: NotificationType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const NOTIFICATION_STYLES = `
  .dawin-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: dawin-slide-in 0.3s ease-out;
  }

  @keyframes dawin-slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes dawin-slide-out {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }

  .dawin-notification-content {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    border-radius: 12px;
    background: #ffffff;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
    max-width: 360px;
    backdrop-filter: blur(10px);
  }

  .dawin-notification-content.success {
    border-left: 4px solid #10b981;
  }

  .dawin-notification-content.error {
    border-left: 4px solid #ef4444;
  }

  .dawin-notification-content.info {
    border-left: 4px solid #3b82f6;
  }

  .dawin-notification-content.warning {
    border-left: 4px solid #f59e0b;
  }

  .dawin-notification-icon {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
  }

  .dawin-notification-icon.success { color: #10b981; }
  .dawin-notification-icon.error { color: #ef4444; }
  .dawin-notification-icon.info { color: #3b82f6; }
  .dawin-notification-icon.warning { color: #f59e0b; }

  .dawin-notification-text {
    flex: 1;
    font-size: 14px;
    line-height: 1.4;
    color: #1f2937;
  }

  .dawin-notification-close {
    flex-shrink: 0;
    padding: 4px;
    background: none;
    border: none;
    cursor: pointer;
    color: #9ca3af;
    border-radius: 4px;
    transition: all 0.15s;
  }

  .dawin-notification-close:hover {
    background: #f3f4f6;
    color: #6b7280;
  }

  .dawin-notification-action {
    margin-top: 8px;
    padding: 6px 12px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .dawin-notification-action:hover {
    background: #2563eb;
  }

  @media (prefers-color-scheme: dark) {
    .dawin-notification-content {
      background: #1f2937;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }
    .dawin-notification-text {
      color: #f3f4f6;
    }
    .dawin-notification-close:hover {
      background: #374151;
      color: #d1d5db;
    }
  }
`;

const ICONS: Record<NotificationType, string> = {
  success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
};

let styleInjected = false;

function injectStyles(): void {
  if (styleInjected) return;
  
  const style = document.createElement('style');
  style.id = 'dawin-notification-styles';
  style.textContent = NOTIFICATION_STYLES;
  document.head.appendChild(style);
  styleInjected = true;
}

/**
 * Show a notification overlay
 */
export function showNotification(options: NotificationOptions | string): void {
  const opts: NotificationOptions = typeof options === 'string' 
    ? { message: options } 
    : options;
  
  const { message, type = 'success', duration = 4000, action } = opts;
  
  injectStyles();
  
  // Remove existing notification
  removeNotification();
  
  const notification = document.createElement('div');
  notification.className = 'dawin-notification';
  notification.id = 'dawin-notification';
  
  notification.innerHTML = `
    <div class="dawin-notification-content ${type}">
      <div class="dawin-notification-icon ${type}">
        ${ICONS[type]}
      </div>
      <div>
        <div class="dawin-notification-text">${escapeHtml(message)}</div>
        ${action ? `<button class="dawin-notification-action">${escapeHtml(action.label)}</button>` : ''}
      </div>
      <button class="dawin-notification-close" aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Event listeners
  const closeBtn = notification.querySelector('.dawin-notification-close');
  closeBtn?.addEventListener('click', () => removeNotification());
  
  if (action) {
    const actionBtn = notification.querySelector('.dawin-notification-action');
    actionBtn?.addEventListener('click', () => {
      action.onClick();
      removeNotification();
    });
  }
  
  // Auto-dismiss
  if (duration > 0) {
    setTimeout(() => removeNotification(), duration);
  }
}

/**
 * Remove the notification with animation
 */
export function removeNotification(): void {
  const notification = document.getElementById('dawin-notification');
  if (!notification) return;
  
  notification.style.animation = 'dawin-slide-out 0.2s ease-in forwards';
  setTimeout(() => notification.remove(), 200);
}

/**
 * Show a success notification
 */
export function showSuccess(message: string): void {
  showNotification({ message, type: 'success' });
}

/**
 * Show an error notification
 */
export function showError(message: string): void {
  showNotification({ message, type: 'error', duration: 6000 });
}

/**
 * Show an info notification
 */
export function showInfo(message: string): void {
  showNotification({ message, type: 'info' });
}

/**
 * Show clip saved notification with view action
 */
export function showClipSaved(clipCount: number = 1): void {
  showNotification({
    message: clipCount === 1 
      ? 'Image clipped successfully!' 
      : `${clipCount} images clipped!`,
    type: 'success',
    action: {
      label: 'View in DawinOS',
      onClick: () => {
        window.open('https://dawinos.web.app/clipper', '_blank');
      },
    },
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

# Cross-Platform Dawin Clipper Architecture

## Overview

This document outlines the strategy for enabling the Dawin Design Clipper to work across:
- **Chrome** (current - working)
- **Safari macOS** (via conversion)
- **Safari iOS/iPadOS** (via conversion + Swift auth)
- **PWA fallback** (for other browsers)

## Current State

The existing Chrome extension at `src/extensions/clipper/` uses:
- Manifest V3
- React + Vite build
- IndexedDB (Dexie) for local storage
- Firebase for cloud sync
- Google OAuth via `chrome.identity`

---

## Implementation Plan

### Phase 1: Safari Extension Conversion

#### Prerequisites
- Xcode 15+ installed
- Apple Developer account ($99/year)
- Code signing certificates configured

#### Step 1: Build Chrome Extension
```bash
cd src/extensions/clipper
npm install
npm run build
```

#### Step 2: Convert to Safari
```bash
xcrun safari-web-extension-converter ./dist \
  --project-location ../clipper-safari \
  --app-name "Dawin Clipper" \
  --bundle-identifier com.dawingroup.clipper \
  --swift
```

This generates:
```
clipper-safari/
├── Dawin Clipper/           # macOS app container
├── Dawin Clipper Extension/ # Shared extension code
├── iOS (App)/               # iOS app container
├── iOS (Extension)/         # iOS extension
└── Dawin Clipper.xcodeproj
```

#### Step 3: Fix Safari Incompatibilities

**3a. Replace `chrome.identity` with Safari-compatible auth**

Create `src/extensions/clipper/lib/safari-auth.ts`:
```typescript
// Safari uses ASWebAuthenticationSession via native bridge
export async function safariAuthenticate(): Promise<string | null> {
  return new Promise((resolve) => {
    // Send message to native app to trigger ASWebAuthenticationSession
    browser.runtime.sendNativeMessage(
      'com.dawingroup.clipper',
      { action: 'authenticate' },
      (response) => {
        resolve(response?.token || null);
      }
    );
  });
}
```

**3b. Add Swift authentication handler in iOS app**

```swift
// In iOS (App)/SafariWebExtensionHandler.swift
import AuthenticationServices

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems.first as? NSExtensionItem
        
        guard let message = item?.userInfo?[SFExtensionMessageKey] as? [String: Any],
              let action = message["action"] as? String else {
            context.completeRequest(returningItems: nil)
            return
        }
        
        if action == "authenticate" {
            performGoogleAuth { token in
                let response = NSExtensionItem()
                response.userInfo = [SFExtensionMessageKey: ["token": token ?? ""]]
                context.completeRequest(returningItems: [response])
            }
        }
    }
    
    private func performGoogleAuth(completion: @escaping (String?) -> Void) {
        let authURL = URL(string: "https://accounts.google.com/o/oauth2/v2/auth?...")!
        let callbackScheme = "com.dawingroup.clipper"
        
        let session = ASWebAuthenticationSession(
            url: authURL,
            callbackURLScheme: callbackScheme
        ) { callbackURL, error in
            guard let url = callbackURL,
                  let token = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                    .queryItems?.first(where: { $0.name == "token" })?.value else {
                completion(nil)
                return
            }
            completion(token)
        }
        
        session.presentationContextProvider = self
        session.start()
    }
}
```

**3c. Replace notifications with content script overlay**

Update `src/extensions/clipper/content/notification-overlay.ts`:
```typescript
export function showNotification(message: string, type: 'success' | 'error' = 'success') {
  // Remove existing notification
  document.querySelector('.dawin-notification')?.remove();
  
  const notification = document.createElement('div');
  notification.className = 'dawin-notification';
  notification.innerHTML = `
    <div class="dawin-notification-content ${type}">
      <span>${message}</span>
      <button onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.remove(), 3000);
}
```

#### Step 4: Create Platform Detection

Add `src/extensions/clipper/lib/platform.ts`:
```typescript
export type Platform = 'chrome' | 'safari-macos' | 'safari-ios' | 'firefox';

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  
  if (typeof browser !== 'undefined' && browser.runtime?.getBrowserInfo) {
    return 'firefox';
  }
  
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
    return /iPad|iPhone|iPod/.test(ua) ? 'safari-ios' : 'safari-macos';
  }
  
  return 'chrome';
}

export function isSafari(): boolean {
  const platform = detectPlatform();
  return platform === 'safari-macos' || platform === 'safari-ios';
}
```

Update auth service to use platform detection:
```typescript
import { detectPlatform, isSafari } from './platform';
import { safariAuthenticate } from './safari-auth';

export async function authenticate(): Promise<User | null> {
  if (isSafari()) {
    const token = await safariAuthenticate();
    if (token) {
      // Exchange token for Firebase credential
      return signInWithCustomToken(auth, token);
    }
    return null;
  }
  
  // Chrome identity flow
  return chromeIdentityAuth();
}
```

---

### Phase 2: iPad-Specific Optimizations

#### Touch-Friendly Image Selector

Update `src/extensions/clipper/content/image-selector.ts`:
```typescript
export class ImageSelector {
  private touchStartTime = 0;
  
  initialize() {
    // Support both click and long-press for image selection
    document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
    document.addEventListener('touchend', this.handleTouchEnd.bind(this));
    document.addEventListener('click', this.handleClick.bind(this));
  }
  
  private handleTouchStart(e: TouchEvent) {
    this.touchStartTime = Date.now();
  }
  
  private handleTouchEnd(e: TouchEvent) {
    const touchDuration = Date.now() - this.touchStartTime;
    const isLongPress = touchDuration > 500;
    
    if (isLongPress) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') {
        e.preventDefault();
        this.selectImage(target as HTMLImageElement);
      }
    }
  }
  
  private selectImage(img: HTMLImageElement) {
    // Show clip confirmation UI
    this.showClipOverlay(img);
  }
}
```

#### Responsive Popup UI

The popup should adapt to iPad screen sizes:
```css
/* src/extensions/clipper/popup/styles.css */
@media (min-width: 768px) {
  .popup-container {
    width: 400px;
    max-height: 600px;
  }
  
  .clip-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@supports (-webkit-touch-callout: none) {
  /* iOS-specific styles */
  .popup-container {
    padding-bottom: env(safe-area-inset-bottom);
  }
  
  button {
    min-height: 44px; /* Apple HIG touch target */
  }
}
```

---

### Phase 3: PWA Fallback (Bookmarklet)

For browsers without extension support, provide a bookmarklet:

```javascript
// Bookmarklet code (minified for bookmark URL)
javascript:(function(){
  const s=document.createElement('script');
  s.src='https://dawinos.web.app/clipper/bookmarklet.js';
  document.body.appendChild(s);
})();
```

Create `public/clipper/bookmarklet.js`:
```javascript
(function() {
  // Inject clipper UI into page
  const frame = document.createElement('iframe');
  frame.src = 'https://dawinos.web.app/clipper/embed?url=' + encodeURIComponent(location.href);
  frame.style.cssText = 'position:fixed;top:0;right:0;width:350px;height:100%;border:none;z-index:999999;box-shadow:-4px 0 20px rgba(0,0,0,0.2)';
  document.body.appendChild(frame);
  
  // Listen for clip events from iframe
  window.addEventListener('message', (e) => {
    if (e.origin !== 'https://dawinos.web.app') return;
    if (e.data.action === 'close') frame.remove();
    if (e.data.action === 'getImages') {
      const images = Array.from(document.images)
        .filter(img => img.naturalWidth > 200 && img.naturalHeight > 200)
        .map(img => ({ src: img.src, alt: img.alt }));
      frame.contentWindow.postMessage({ images }, 'https://dawinos.web.app');
    }
  });
})();
```

---

### Phase 4: iOS Shortcuts Integration

Create a Siri Shortcut that users can install:

**Shortcut Actions:**
1. Get URL from Safari
2. Open URL: `dawinos://clip?url=[Safari URL]`

Register custom URL scheme in iOS app:
```swift
// In iOS app Info.plist
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>dawinos</string>
    </array>
  </dict>
</array>
```

Handle in SceneDelegate:
```swift
func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url,
          url.scheme == "dawinos",
          url.host == "clip",
          let pageURL = url.queryParameters?["url"] else { return }
    
    // Open Safari extension with pre-filled URL
    SFSafariViewController.openPage(url: pageURL)
}
```

---

## Distribution

### Chrome Web Store
- Already configured in `manifest.json`
- Build: `npm run build`
- Upload `dist/` folder

### App Store (Safari Extension)
1. Archive in Xcode: Product → Archive
2. Distribute to App Store Connect
3. Submit for review (requires privacy policy URL)

**App Store Requirements:**
- Privacy policy URL
- App icons (all sizes)
- Screenshots for iPhone, iPad, Mac
- Description mentioning extension functionality

### TestFlight (Beta Testing)
1. Archive and upload to App Store Connect
2. Add internal/external testers
3. Distribute via TestFlight

---

## File Structure After Implementation

```
src/extensions/
├── clipper/                    # Chrome extension (current)
│   ├── lib/
│   │   ├── platform.ts         # NEW: Platform detection
│   │   ├── safari-auth.ts      # NEW: Safari auth bridge
│   │   └── ...
│   ├── content/
│   │   ├── notification-overlay.ts  # NEW: Cross-platform notifications
│   │   └── ...
│   └── ...
│
├── clipper-safari/             # Generated Safari project
│   ├── Dawin Clipper/
│   ├── iOS (App)/
│   │   └── SafariWebExtensionHandler.swift
│   └── ...
│
└── clipper-shared/             # Shared utilities (future)
    ├── parsers/
    ├── types/
    └── utils/
```

---

## Testing Matrix

| Platform | Browser | Auth Method | Status |
|----------|---------|-------------|--------|
| macOS | Chrome | chrome.identity | ✅ Working |
| macOS | Safari | ASWebAuthenticationSession | 🔧 To implement |
| iOS | Safari | ASWebAuthenticationSession | 🔧 To implement |
| iPadOS | Safari | ASWebAuthenticationSession | 🔧 To implement |
| Any | PWA | Firebase Auth popup | 🔧 Fallback |

---

## Timeline Estimate

| Phase | Effort | Description |
|-------|--------|-------------|
| Phase 1 | 2-3 days | Safari conversion + auth fix |
| Phase 2 | 1 day | iPad touch optimizations |
| Phase 3 | 0.5 day | Bookmarklet fallback |
| Phase 4 | 0.5 day | iOS Shortcuts integration |
| Testing | 1-2 days | Cross-platform QA |
| App Store | 1-2 weeks | Review process |

**Total: ~1 week development + App Store review time**

---

## Quick Start (Immediate iPad Solution)

While the full Safari extension is in development, users can:

1. **Use the PWA:** Visit `https://dawinos.web.app`, tap Share → Add to Home Screen
2. **Copy URL method:** Copy page URL → Open DawinOS → Paste in Clipper
3. **Bookmarklet:** Add the bookmarklet to Safari bookmarks

---

## References

- [Apple Safari Web Extensions Docs](https://developer.apple.com/documentation/safariservices/safari-web-extensions)
- [Converting Chrome Extensions to Safari](https://developer.apple.com/documentation/safariservices/safari_web_extensions/converting_a_web_extension_for_safari)
- [ASWebAuthenticationSession](https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession)
- [Evil Martians Safari Conversion Guide](https://evilmartians.com/chronicles/how-to-quickly-and-weightlessly-convert-chrome-extensions-to-safari)

# DawinOS v2.0 - Intelligent Enterprise Operating System

## Overview

DawinOS v2.0 is a comprehensive enterprise operating system designed for Dawin Group, featuring AI-powered task generation, multi-subsidiary management, and integrated business modules for HR, Strategy, Finance, Performance, Capital, and Market Intelligence.

## Key Features

### 🧠 Intelligence Layer
- AI-powered business event detection
- Automatic task generation from events
- Grey area identification for unclear scenarios
- Role-based task routing

### 👥 HR Central
- Complete employee lifecycle management
- Uganda-compliant payroll processing (PAYE, NSSF, LST)
- Leave management with approval workflows
- Organization structure and reporting

### 🎯 CEO Strategy Command
- Strategy document management
- OKR hierarchy (Company → Department → Team → Individual)
- KPI tracking with automated dashboards
- Executive decision support

### 💰 Financial Management
- Chart of accounts management
- Budget planning and tracking
- Expense management with approvals
- Financial reporting (P&L, Balance Sheet, Cash Flow)

### 📈 Staff Performance
- Goal setting and cascading
- Performance review cycles
- Competency framework
- Succession planning

### 💼 Capital Hub
- Deal pipeline management
- Portfolio tracking
- Investor CRM
- Capital allocation

### 🌍 Market Intelligence
- Competitor analysis
- Market research tracking
- Environment scanning (PESTLE)
- Intelligence reporting

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Firebase (Firestore, Auth, Functions, Storage)
- **AI**: Google Gemini via Firebase Genkit
- **Testing**: Vitest, Playwright
- **CI/CD**: GitHub Actions

## Quick Start

```bash
# Clone the repository
git clone https://github.com/dawin-group/dawinos.git
cd dawinos

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your Firebase config

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Project Structure

```
dawinos/
├── src/
│   ├── core/              # Global state, services, components
│   │   ├── components/    # Shared UI components
│   │   ├── hooks/         # Custom React hooks
│   │   └── services/      # Cross-module services
│   ├── modules/           # Feature modules (placeholder for future)
│   ├── integration/       # Cross-module integration
│   │   ├── store/         # Global state management
│   │   └── constants/     # Module configurations
│   ├── subsidiaries/      # Subsidiary-specific modules
│   │   └── finishes/      # Dawin Finishes modules
│   ├── lib/               # Firebase, utilities
│   └── testing/           # Test utilities and factories
├── firebase/              # Firebase config & rules
├── e2e/                   # End-to-end tests
├── docs/                  # Documentation
└── .github/               # CI/CD workflows
```

## Documentation

- [Architecture Guide](./ARCHITECTURE.md)
- [API Reference](./API.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Security Guide](./SECURITY.md)
- [Module Documentation](./modules/)

## Uganda-Specific Features

DawinOS is built with Uganda-specific business requirements:

- **Currency**: Uganda Shillings (UGX)
- **Tax Compliance**: PAYE brackets, NSSF (5%/10%), LST
- **Timezone**: Africa/Kampala (UTC+3)
- **Public Holidays**: Uganda bank holidays
- **Locale**: en-UG formatting

## Environment Variables

See `.env.example` for all available environment variables:

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_*` | Firebase configuration |
| `VITE_FEATURE_*` | Feature flags for modules |
| `VITE_DEFAULT_CURRENCY` | Default currency (UGX) |
| `VITE_DEFAULT_TIMEZONE` | Default timezone |

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run test` | Run all tests |
| `npm run test:unit` | Run unit tests |
| `npm run test:e2e` | Run E2E tests |
| `npm run deploy` | Deploy to Firebase |

## Subsidiaries

DawinOS supports multiple Dawin Group subsidiaries:

| Subsidiary | Code | Type |
|------------|------|------|
| Dawin Group | DG | Holding |
| Dawin Finishes | DF | Manufacturing |
| Dawin Advisory | DA | Services |
| Dawin Capital | DC | Investment |
| Dawin Technology | DT | Technology |

## License

Copyright © 2026 Dawin Group. All rights reserved.

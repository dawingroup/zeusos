// ============================================================================
// CUSTOM RENDER
// ZeusOS v2.0 - Testing Strategy
// Custom render function with providers
// ============================================================================

import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import type { CustomRenderOptions } from '../types/test.types';
import { TEST_USERS, TEST_SUBSIDIARIES } from '../constants/test.constants';

// =============================================================================
// MOCK CONTEXTS
// =============================================================================

interface MockAuthContextValue {
  user: (typeof TEST_USERS)[keyof typeof TEST_USERS] | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<MockAuthContextValue>({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  login: vi.fn(),
  logout: vi.fn(),
});

interface MockSubsidiaryContextValue {
  subsidiary: (typeof TEST_SUBSIDIARIES)[keyof typeof TEST_SUBSIDIARIES] | null;
  setSubsidiary: (id: string) => void;
  subsidiaries: (typeof TEST_SUBSIDIARIES)[keyof typeof TEST_SUBSIDIARIES][];
}

const SubsidiaryContext = React.createContext<MockSubsidiaryContextValue>({
  subsidiary: null,
  setSubsidiary: vi.fn(),
  subsidiaries: Object.values(TEST_SUBSIDIARIES),
});

// =============================================================================
// PROVIDER WRAPPER
// =============================================================================

interface AllProvidersProps {
  children: ReactNode;
  options?: CustomRenderOptions;
}

function AllProviders({ children, options }: AllProvidersProps): ReactElement {
  const authValue: MockAuthContextValue = {
    user: (options?.user ?? null) as any,
    isLoading: false,
    isAuthenticated: !!options?.user,
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
  };

  const subsidiaryValue: MockSubsidiaryContextValue = {
    subsidiary: (options?.subsidiary ?? TEST_SUBSIDIARIES.DAWIN_GROUP) as any,
    setSubsidiary: vi.fn(),
    subsidiaries: Object.values(TEST_SUBSIDIARIES),
  };

  const routerProps = options?.initialRoute ? { initialEntries: [options.initialRoute] } : {};

  return (
    <AuthContext.Provider value={authValue}>
      <SubsidiaryContext.Provider value={subsidiaryValue}>
        <MemoryRouter {...routerProps}>{children}</MemoryRouter>
      </SubsidiaryContext.Provider>
    </AuthContext.Provider>
  );
}

// =============================================================================
// CUSTOM RENDER
// =============================================================================

function customRender(ui: ReactElement, options?: CustomRenderOptions & RenderOptions) {
  const user = userEvent.setup();

  const renderResult = render(ui, {
    wrapper: ({ children }) => <AllProviders options={options}>{children}</AllProviders>,
    ...options,
  });

  return {
    user,
    ...renderResult,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export * from '@testing-library/react';
export { customRender as render };
export { userEvent };
export { AuthContext, SubsidiaryContext };

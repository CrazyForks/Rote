import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock sonner toast to avoid console noise in tests
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

// Mock react-dom/client createRoot
vi.mock('react-dom/client', () => ({
  createRoot: () => ({
    render: vi.fn(),
    unmount: vi.fn(),
  }),
}));

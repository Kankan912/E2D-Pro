import "@testing-library/jest-dom/vitest";
import { vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class MockIO {
  observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn();
  takeRecords = vi.fn(); root = null; rootMargin = ""; thresholds: number[] = [];
}
Object.defineProperty(window, "IntersectionObserver", { writable: true, configurable: true, value: MockIO });
Object.defineProperty(globalThis, "ResizeObserver", { writable: true, configurable: true, value: MockIO });

vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-anon-key");


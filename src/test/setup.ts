import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

export const media = { prefersDark: false }

Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: (query: string) => ({
		matches: query.includes('prefers-color-scheme: dark') ? media.prefersDark : false,
		media: query,
		onchange: null,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	}),
})

afterEach(() => {
	media.prefersDark = false
	cleanup()
})
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

if (!HTMLDialogElement.prototype.showModal) {
	HTMLDialogElement.prototype.show = function () {
		this.open = true
	}
	HTMLDialogElement.prototype.showModal = function () {
		this.open = true
	}
	HTMLDialogElement.prototype.close = function () {
		this.open = false
		this.dispatchEvent(new Event('close'))
	}
}

afterEach(() => {
	media.prefersDark = false
	cleanup()
})
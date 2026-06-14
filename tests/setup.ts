/**
 * Global test setup for Mainsail CNC
 * 
 * This file is loaded before each test file and sets up:
 * - Global mocks for browser APIs (WebSocket, localStorage, etc.)
 * - Mock implementations for external dependencies
 */

import { vi } from 'vitest'

// Mock window.location
Object.defineProperty(window, 'location', {
    value: {
        hostname: 'localhost',
        port: '8080',
        protocol: 'http:',
        href: 'http://localhost:8080/',
        pathname: '/',
        search: '',
        hash: '',
    },
    writable: true,
})

// Mock document.location
Object.defineProperty(document, 'location', {
    value: {
        protocol: 'http:',
    },
    writable: true,
})

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key]
        }),
        clear: vi.fn(() => {
            store = {}
        }),
        get length() {
            return Object.keys(store).length
        },
        key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    }
})()

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
})

// Mock sessionStorage
const sessionStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key]
        }),
        clear: vi.fn(() => {
            store = {}
        }),
        get length() {
            return Object.keys(store).length
        },
        key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    }
})()

Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock,
})

// Mock WebSocket
class MockWebSocket {
    static CONNECTING = 0
    static OPEN = 1
    static CLOSING = 2
    static CLOSED = 3

    readyState = MockWebSocket.CONNECTING
    url: string
    onopen: ((event: Event) => void) | null = null
    onclose: ((event: CloseEvent) => void) | null = null
    onmessage: ((event: MessageEvent) => void) | null = null
    onerror: ((event: Event) => void) | null = null

    constructor(url: string) {
        this.url = url
    }

    send = vi.fn()
    close = vi.fn()
    addEventListener = vi.fn()
    removeEventListener = vi.fn()
    dispatchEvent = vi.fn()
}

Object.defineProperty(window, 'WebSocket', {
    value: MockWebSocket,
    writable: true,
})

// Mock navigator
Object.defineProperty(navigator, 'language', {
    value: 'en-US',
    writable: true,
})

Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Test)',
    writable: true,
})

Object.defineProperty(navigator, 'maxTouchPoints', {
    value: 0,
    writable: true,
})

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
})

// Mock ResizeObserver
class MockResizeObserver {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
}

Object.defineProperty(window, 'ResizeObserver', {
    value: MockResizeObserver,
})

// Mock IntersectionObserver
class MockIntersectionObserver {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
}

Object.defineProperty(window, 'IntersectionObserver', {
    value: MockIntersectionObserver,
})

// Mock fetch
global.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
    })
)

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error
console.error = vi.fn((...args) => {
    // Only show errors that don't match common patterns
    const message = args.join(' ')
    if (
        message.includes('[Vue warn]') ||
        message.includes('file not found in filetree')
    ) {
        return
    }
    originalConsoleError(...args)
})

// Mock import.meta.env
vi.stubEnv('VUE_APP_HOSTNAME', 'localhost')
vi.stubEnv('VUE_APP_PORT', '8080')
vi.stubEnv('VUE_APP_PATH', '')
vi.stubEnv('VUE_APP_RECONNECT_INTERVAL', '2000')

// Reset mocks before each test
beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    sessionStorageMock.clear()
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import WebrtcGo2rtc from '@/components/webcams/streamers/WebrtcGo2rtc.vue'

const mockWebcamFunctions = vi.hoisted(() => ({
    convertUrl: vi.fn((streamUrl: string) => streamUrl),
    getWrapperStyle: vi.fn(() => ({})),
    generateTransform: vi.fn(() => 'none'),
    updateAspectRatioFromVideo: vi.fn(() => null),
}))

const mockStore = vi.hoisted(() => ({
    state: {
        socket: {
            protocol: 'ws',
        },
    },
    getters: {
        'gui/getPanelExpand': vi.fn(() => false),
    },
}))

vi.mock('@/composables/useWebcam', () => ({
    useWebcam: () => ({
        convertUrl: mockWebcamFunctions.convertUrl,
        getWrapperStyle: mockWebcamFunctions.getWrapperStyle,
        generateTransform: mockWebcamFunctions.generateTransform,
        updateAspectRatioFromVideo: mockWebcamFunctions.updateAspectRatioFromVideo,
        viewport: 'lg',
    }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('vuex', () => ({
    useStore: () => mockStore,
}))

vi.mock('vuetify/components', () => ({
    VApp: { name: 'VApp', template: '<div><slot /></div>' },
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
    VProgressCircular: { name: 'VProgressCircular', template: '<span class="v-progress-circular" />' },
}))

const vuetifyStubs: Record<string, any> = {
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
    VProgressCircular: { name: 'VProgressCircular', template: '<span class="v-progress-circular" />' },
}

function createCamSettings(overrides: Record<string, any> = {}) {
    return {
        name: 'Test Cam',
        service: 'webrtc-go2rtc' as const,
        enabled: true,
        icon: 'mdiWebcam',
        target_fps: 15,
        stream_url: 'ws://camera.local/stream',
        snapshot_url: 'http://camera.local/snapshot',
        flip_horizontal: false,
        flip_vertical: false,
        rotation: 0,
        ...overrides,
    }
}

function createMountOptions(overrides: Record<string, any> = {}) {
    return {
        props: {
            camSettings: createCamSettings(),
            ...overrides,
        },
        global: {
            stubs: vuetifyStubs,
        },
    }
}

describe('WebrtcGo2rtc.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const wrapper = mount(WebrtcGo2rtc, createMountOptions())

        expect(wrapper.exists()).toBe(true)
    })

    it('renders a video element', () => {
        const wrapper = mount(WebrtcGo2rtc, createMountOptions())

        const video = wrapper.find('video')
        expect(video.exists()).toBe(true)
    })

    it('has webcamBackground class', () => {
        const wrapper = mount(WebrtcGo2rtc, createMountOptions())

        expect(wrapper.find('.webcamBackground').exists()).toBe(true)
    })
})

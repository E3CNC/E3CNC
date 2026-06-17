import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import WebrtcCameraStreamer from '@/components/webcams/streamers/WebrtcCameraStreamer.vue'

const mockWebcamFunctions = vi.hoisted(() => ({
    convertUrl: vi.fn((streamUrl: string) => streamUrl),
    getWrapperStyle: vi.fn(() => ({})),
    generateTransform: vi.fn(() => 'none'),
    updateAspectRatioFromVideo: vi.fn(() => null),
    viewport: { value: 'desktop' },
}))

vi.mock('@/composables/useWebcam', () => ({
    useWebcam: () => ({
        convertUrl: mockWebcamFunctions.convertUrl,
        getWrapperStyle: mockWebcamFunctions.getWrapperStyle,
        generateTransform: mockWebcamFunctions.generateTransform,
        updateAspectRatioFromVideo: mockWebcamFunctions.updateAspectRatioFromVideo,
        viewport: mockWebcamFunctions.viewport,
    }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('vuex', () => ({
    useStore: () => ({
        getters: {
            'gui/getPanelExpand': () => true,
        },
        state: {
            server: {
                config: {
                    config: {},
                },
            },
        },
    }),
}))

vi.mock('vuetify/components', () => ({
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
    VProgressCircular: { name: 'VProgressCircular', template: '<span class="v-progress-circular" />' },
}))

function createCamSettings(overrides: Record<string, any> = {}) {
    return {
        name: 'Test WebRTC Camera',
        service: 'webrtc_camerastreamer',
        enabled: true,
        icon: 'mdiWebcam',
        target_fps: 15,
        stream_url: 'http://camera.local/webrtc',
        snapshot_url: 'http://camera.local/snapshot',
        flip_horizontal: false,
        flip_vertical: false,
        rotation: 0,
        ...overrides,
    }
}

describe('WebrtcCameraStreamer.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const wrapper = mount(WebrtcCameraStreamer, {
            props: {
                camSettings: createCamSettings(),
            },
            global: {
                stubs: {
                    'v-row': { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
                    'v-col': { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
                    'v-progress-circular': {
                        name: 'VProgressCircular',
                        template: '<span class="v-progress-circular" />',
                    },
                    'webcam-nozzle-crosshair': {
                        name: 'WebcamNozzleCrosshair',
                        template: '<div class="webcam-nozzle-crosshair-stub" />',
                    },
                },
            },
        })

        expect(wrapper.exists()).toBe(true)
    })

    it('renders a video element', () => {
        const wrapper = mount(WebrtcCameraStreamer, {
            props: {
                camSettings: createCamSettings(),
            },
            global: {
                stubs: {
                    'v-row': { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
                    'v-col': { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
                    'v-progress-circular': {
                        name: 'VProgressCircular',
                        template: '<span class="v-progress-circular" />',
                    },
                    'webcam-nozzle-crosshair': {
                        name: 'WebcamNozzleCrosshair',
                        template: '<div class="webcam-nozzle-crosshair-stub" />',
                    },
                },
            },
        })

        const video = wrapper.find('video')
        expect(video.exists()).toBe(true)
    })

    it('video is muted and has autoplay', () => {
        const wrapper = mount(WebrtcCameraStreamer, {
            props: {
                camSettings: createCamSettings(),
            },
            global: {
                stubs: {
                    'v-row': { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
                    'v-col': { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
                    'v-progress-circular': {
                        name: 'VProgressCircular',
                        template: '<span class="v-progress-circular" />',
                    },
                    'webcam-nozzle-crosshair': {
                        name: 'WebcamNozzleCrosshair',
                        template: '<div class="webcam-nozzle-crosshair-stub" />',
                    },
                },
            },
        })

        const video = wrapper.find('video')
        expect(video.attributes('muted')).toBeDefined()
        expect(video.attributes('autoplay')).toBeDefined()
    })
})

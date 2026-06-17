import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import JMuxerStream from '@/components/webcams/streamers/JMuxerStream.vue'

const mockWebcamFunctions = vi.hoisted(() => ({
    convertUrl: vi.fn((streamUrl: string) => streamUrl),
    getWrapperStyle: vi.fn(() => ({})),
    generateTransform: vi.fn(() => 'none'),
    updateAspectRatioFromVideo: vi.fn(() => null),
}))

const mockJmuxerInstance = vi.hoisted(() => ({
    destroy: vi.fn(),
    feed: vi.fn(),
}))

const mockJmuxerConstructor = vi.hoisted(() => vi.fn(() => mockJmuxerInstance))

vi.mock('jmuxer', () => ({
    default: mockJmuxerConstructor,
}))

vi.mock('@/composables/useWebcam', () => ({
    useWebcam: () => ({
        convertUrl: mockWebcamFunctions.convertUrl,
        getWrapperStyle: mockWebcamFunctions.getWrapperStyle,
        generateTransform: mockWebcamFunctions.generateTransform,
        updateAspectRatioFromVideo: mockWebcamFunctions.updateAspectRatioFromVideo,
    }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('vuetify/components', () => ({
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
    VProgressCircular: { name: 'VProgressCircular', template: '<span class="v-progress-circular" />' },
}))

function createCamSettings(overrides: Record<string, any> = {}) {
    return {
        name: 'Test JMuxer Cam',
        service: 'jmuxer',
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

describe('JMuxerStream.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const wrapper = mount(JMuxerStream, {
            props: {
                camSettings: createCamSettings(),
            },
            global: {
                stubs: {
                    'v-row': { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
                    'v-col': { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
                    'v-progress-circular': { name: 'VProgressCircular', template: '<span class="v-progress-circular" />' },
                },
            },
        })

        expect(wrapper.exists()).toBe(true)
    })

    it('renders a video element', () => {
        const wrapper = mount(JMuxerStream, {
            props: {
                camSettings: createCamSettings(),
            },
            global: {
                stubs: {
                    'v-row': { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
                    'v-col': { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
                    'v-progress-circular': { name: 'VProgressCircular', template: '<span class="v-progress-circular" />' },
                },
            },
        })

        const video = wrapper.find('video')
        expect(video.exists()).toBe(true)
    })

    it('has webcamBackground class', () => {
        const wrapper = mount(JMuxerStream, {
            props: {
                camSettings: createCamSettings(),
            },
            global: {
                stubs: {
                    'v-row': { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
                    'v-col': { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
                    'v-progress-circular': { name: 'VProgressCircular', template: '<span class="v-progress-circular" />' },
                },
            },
        })

        expect(wrapper.find('.webcamBackground').exists()).toBe(true)
    })
})

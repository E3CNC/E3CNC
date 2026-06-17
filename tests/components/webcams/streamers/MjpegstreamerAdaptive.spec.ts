import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MjpegstreamerAdaptive from '@/components/webcams/streamers/MjpegstreamerAdaptive.vue'

const mockWebcamFunctions = vi.hoisted(() => ({
    convertUrl: vi.fn((snapshotUrl: string) => snapshotUrl),
    getWrapperStyle: vi.fn(() => ({})),
    generateTransform: vi.fn(() => 'none'),
    updateAspectRatioFromImage: vi.fn(() => null),
}))

vi.mock('@/composables/useWebcam', () => ({
    useWebcam: () => ({
        convertUrl: mockWebcamFunctions.convertUrl,
        getWrapperStyle: mockWebcamFunctions.getWrapperStyle,
        generateTransform: mockWebcamFunctions.generateTransform,
        updateAspectRatioFromImage: mockWebcamFunctions.updateAspectRatioFromImage,
    }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('vue-observe-visibility', () => ({
    default: {
        mounted: vi.fn(),
        unmounted: vi.fn(),
    },
}))

vi.mock('vuetify/components', () => ({
    VRow: { name: 'VRow', template: '<div><slot /></div>' },
    VCol: { name: 'VCol', template: '<div><slot /></div>' },
    VProgressCircular: { name: 'VProgressCircular', template: '<span class="v-progress-circular" />' },
}))

function createCamSettings(overrides: Record<string, any> = {}) {
    return {
        name: 'Test MJPG Camera',
        service: 'mjpegstreamer-adaptive',
        enabled: true,
        icon: 'mdiWebcam',
        target_fps: 15,
        stream_url: 'http://camera.local/webcam?action=stream',
        snapshot_url: 'http://camera.local/snapshot',
        flip_horizontal: false,
        flip_vertical: false,
        rotation: 0,
        ...overrides,
    }
}

describe('MjpegstreamerAdaptive.vue', () => {
    it('renders without crashing', () => {
        const wrapper = mount(MjpegstreamerAdaptive, {
            props: {
                camSettings: createCamSettings(),
            },
            global: {
                directives: {
                    'observe-visibility': {},
                },
                stubs: {
                    WebcamNozzleCrosshair: true,
                },
            },
        })

        expect(wrapper.exists()).toBe(true)
    })

    it('renders an img element', () => {
        const wrapper = mount(MjpegstreamerAdaptive, {
            props: {
                camSettings: createCamSettings(),
            },
            global: {
                directives: {
                    'observe-visibility': {},
                },
                stubs: {
                    WebcamNozzleCrosshair: true,
                },
            },
        })

        const img = wrapper.find('img')
        expect(img.exists()).toBe(true)
        expect(img.attributes('alt')).toBe('Test MJPG Camera')
    })

    it('shows connecting status initially', () => {
        const wrapper = mount(MjpegstreamerAdaptive, {
            props: {
                camSettings: createCamSettings(),
            },
            global: {
                directives: {
                    'observe-visibility': {},
                },
                stubs: {
                    WebcamNozzleCrosshair: true,
                },
            },
        })

        // VProgressCircular is shown when status is 'connecting'
        expect(wrapper.find('.v-progress-circular').exists()).toBe(true)
        // The statusMessage starts empty until startStream() is called (requires viewport visibility)
    })

    it('has webcamBackground class', () => {
        const wrapper = mount(MjpegstreamerAdaptive, {
            props: {
                camSettings: createCamSettings(),
            },
            global: {
                directives: {
                    'observe-visibility': {},
                },
                stubs: {
                    WebcamNozzleCrosshair: true,
                },
            },
        })

        expect(wrapper.find('.webcamBackground').exists()).toBe(true)
    })

    it('shows FPS counter when showFps is true', async () => {
        const wrapper = mount(MjpegstreamerAdaptive, {
            props: {
                camSettings: createCamSettings(),
                showFps: true,
            },
            global: {
                directives: {
                    'observe-visibility': {},
                },
                stubs: {
                    WebcamNozzleCrosshair: true,
                },
                mocks: {
                    $t: (key: string) => key,
                },
            },
        })

        // Initially status is 'connecting', so FPS counter is hidden
        expect(wrapper.find('.webcamFpsOutput').exists()).toBe(false)

        // Trigger the image load event to transition status to 'connected'
        const img = wrapper.find('img')
        await img.trigger('load')

        // Now the FPS counter should appear
        expect(wrapper.find('.webcamFpsOutput').exists()).toBe(true)

        // The counter displays "FPS: --" when no FPS data is available yet
        expect(wrapper.text()).toContain('Panels.WebcamPanel.FPS')
    })
})

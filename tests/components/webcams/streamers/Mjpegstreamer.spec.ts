import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Mjpegstreamer from '@/components/webcams/streamers/Mjpegstreamer.vue'

const mockWebcamFunctions = vi.hoisted(() => ({
    convertUrl: vi.fn((streamUrl: string) => streamUrl),
    getWrapperStyle: vi.fn(() => ({})),
    generateTransform: vi.fn(() => 'none'),
    updateAspectRatioFromImage: vi.fn(() => null),
    viewport: { value: 'desktop' },
}))

vi.mock('@/composables/useWebcam', () => ({
    useWebcam: () => ({
        convertUrl: mockWebcamFunctions.convertUrl,
        getWrapperStyle: mockWebcamFunctions.getWrapperStyle,
        generateTransform: mockWebcamFunctions.generateTransform,
        updateAspectRatioFromImage: mockWebcamFunctions.updateAspectRatioFromImage,
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
        name: 'Test MJPG Camera',
        service: 'mjpegstreamer',
        enabled: true,
        icon: 'mdiWebcam',
        target_fps: 15,
        stream_url: 'http://camera.local/webcam',
        snapshot_url: 'http://camera.local/snapshot',
        flip_horizontal: false,
        flip_vertical: false,
        rotation: 0,
        ...overrides,
    }
}

function createWrapper(overrides: {
    props?: Record<string, any>
    stubs?: Record<string, any>
} = {}) {
    const { props = {}, stubs = {} } = overrides
    return mount(Mjpegstreamer, {
        props: {
            camSettings: createCamSettings(),
            ...props,
        },
        global: {
            stubs: {
                'v-row': { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
                'v-col': { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
                'v-progress-circular': { name: 'VProgressCircular', template: '<span class="v-progress-circular" />' },
                'webcam-nozzle-crosshair': { name: 'WebcamNozzleCrosshair', template: '<div class="webcam-nozzle-crosshair-stub" />' },
                ...stubs,
            },
        },
    })
}

describe('Mjpegstreamer.vue', () => {
    it('renders without crashing', () => {
        const wrapper = createWrapper()

        expect(wrapper.exists()).toBe(true)
    })

    it('renders an img element', () => {
        const wrapper = createWrapper()

        const img = wrapper.find('img')
        expect(img.exists()).toBe(true)
    })

    it('shows connecting status initially', () => {
        const wrapper = createWrapper()

        // The component starts with status === 'connecting',
        // which renders the indicator and the connecting message.
        const connectingText = wrapper.text()
        expect(connectingText).toContain('Panels.WebcamPanel.ConnectingTo')
    })

    it('has webcamBackground class', () => {
        const wrapper = createWrapper()

        const bg = wrapper.find('.webcamBackground')
        expect(bg.exists()).toBe(true)
    })

    it('renders without FPS output when status is connecting (showFps=true)', () => {
        const wrapper = createWrapper({
            props: { showFps: true },
        })

        // The FPS counter uses v-if="showFpsCounter && status === 'connected'",
        // and the component starts in 'connecting' state, so no FPS text
        // appears in the DOM. Verify the component still mounts cleanly.
        expect(wrapper.exists()).toBe(true)
        expect(wrapper.text()).not.toContain('Panels.WebcamPanel.FPS')
    })

    it('renders without FPS output when showFps is false', () => {
        const wrapper = createWrapper({
            props: { showFps: false },
        })

        expect(wrapper.exists()).toBe(true)
        expect(wrapper.text()).not.toContain('Panels.WebcamPanel.FPS')
    })

    it('renders without FPS output when hideFps is set via extra_data', () => {
        const wrapper = mount(Mjpegstreamer, {
            props: {
                camSettings: createCamSettings({
                    extra_data: { hideFps: true },
                }),
                showFps: true,
            },
            global: {
                stubs: {
                    'v-row': { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
                    'v-col': { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
                    'v-progress-circular': { name: 'VProgressCircular', template: '<span class="v-progress-circular" />' },
                    'webcam-nozzle-crosshair': { name: 'WebcamNozzleCrosshair', template: '<div class="webcam-nozzle-crosshair-stub" />' },
                },
            },
        })

        expect(wrapper.exists()).toBe(true)
        expect(wrapper.text()).not.toContain('Panels.WebcamPanel.FPS')
    })
})

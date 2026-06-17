import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Uv4lMjpeg from '@/components/webcams/streamers/Uv4lMjpeg.vue'

const mockWebcamFunctions = vi.hoisted(() => ({
    convertUrl: vi.fn((streamUrl: string) => streamUrl),
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

function createCamSettings(overrides: Record<string, any> = {}) {
    return {
        name: 'Test MJPG Camera',
        service: 'uv4l-mjpeg',
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

describe('Uv4lMjpeg.vue', () => {
    it('renders without crashing', () => {
        const wrapper = mount(Uv4lMjpeg, {
            props: {
                camSettings: createCamSettings(),
            },
            global: {
                directives: {
                    'observe-visibility': {},
                },
            },
        })

        expect(wrapper.exists()).toBe(true)
    })

    it('renders an img element', () => {
        const wrapper = mount(Uv4lMjpeg, {
            props: {
                camSettings: createCamSettings(),
            },
            global: {
                directives: {
                    'observe-visibility': {},
                },
            },
        })

        const img = wrapper.find('img')
        expect(img.exists()).toBe(true)
    })

    it('has webcamBackground and webcamImage classes', () => {
        const wrapper = mount(Uv4lMjpeg, {
            props: {
                camSettings: createCamSettings(),
            },
            global: {
                directives: {
                    'observe-visibility': {},
                },
            },
        })

        expect(wrapper.find('.webcamBackground').exists()).toBe(true)
        expect(wrapper.find('.webcamImage').exists()).toBe(true)
    })

    it('img has correct alt text from camSettings.name', () => {
        const camName = 'My Uv4l Camera'
        const wrapper = mount(Uv4lMjpeg, {
            props: {
                camSettings: createCamSettings({ name: camName }),
            },
            global: {
                directives: {
                    'observe-visibility': {},
                },
            },
        })

        const img = wrapper.find('img')
        expect(img.attributes('alt')).toBe(camName)
    })
})

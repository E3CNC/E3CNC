import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Hlsstreamer from '@/components/webcams/streamers/Hlsstreamer.vue'

const mockWebcamFunctions = vi.hoisted(() => ({
    convertUrl: vi.fn((streamUrl: string) => streamUrl),
    getWrapperStyle: vi.fn(() => ({})),
    generateTransform: vi.fn(() => 'none'),
    updateAspectRatioFromVideo: vi.fn(() => null),
}))

const mockHlsInstance = vi.hoisted(() => ({
    loadSource: vi.fn(),
    attachMedia: vi.fn(),
    on: vi.fn(),
    destroy: vi.fn(),
}))

const mockHls = vi.hoisted(() => {
    const HlsMock: any = vi.fn(() => mockHlsInstance)
    HlsMock.isSupported = vi.fn(() => true)
    HlsMock.Events = {
        MANIFEST_PARSED: 'hlsManifestParsed',
    }
    return HlsMock
})

vi.mock('hls.js', () => ({
    default: mockHls,
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

vi.mock('vue-observe-visibility', () => ({
    default: {
        mounted: vi.fn(),
        unmounted: vi.fn(),
    },
}))

function createCamSettings(overrides: Record<string, any> = {}) {
    return {
        name: 'Test Cam',
        service: 'hls' as const,
        enabled: true,
        icon: 'mdiWebcam',
        target_fps: 15,
        stream_url: 'http://camera.local/stream.m3u8',
        snapshot_url: 'http://camera.local/snapshot',
        flip_horizontal: false,
        flip_vertical: false,
        rotation: 0,
        ...overrides,
    }
}

describe('Hlsstreamer.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const wrapper = mount(Hlsstreamer, {
            props: {
                camSettings: createCamSettings(),
            },
        })

        expect(wrapper.exists()).toBe(true)
    })

    it('renders a video element', () => {
        const wrapper = mount(Hlsstreamer, {
            props: {
                camSettings: createCamSettings(),
            },
        })

        const video = wrapper.find('video')
        expect(video.exists()).toBe(true)
    })

    it('has webcamBackground and webcamImage classes', () => {
        const wrapper = mount(Hlsstreamer, {
            props: {
                camSettings: createCamSettings(),
            },
        })

        expect(wrapper.find('.webcamBackground').exists()).toBe(true)
        expect(wrapper.find('.webcamImage').exists()).toBe(true)
    })

    it('video is muted and has autoplay', () => {
        const wrapper = mount(Hlsstreamer, {
            props: {
                camSettings: createCamSettings(),
            },
        })

        const video = wrapper.find('video')
        expect(video.attributes('muted')).toBeDefined()
        expect(video.attributes('autoplay')).toBeDefined()
    })

    it('initializes HLS.js when HLS is supported', () => {
        mount(Hlsstreamer, {
            props: {
                camSettings: createCamSettings(),
            },
        })

        expect(mockHls.isSupported).toHaveBeenCalled()
        expect(mockHls).toHaveBeenCalledWith({
            enableWorker: true,
            lowLatencyMode: true,
            maxLiveSyncPlaybackRate: 2,
            liveSyncDuration: 0.5,
            liveMaxLatencyDuration: 2,
            backBufferLength: 5,
        })
    })

    it('converts the stream URL with convertUrl', () => {
        const streamUrl = 'http://camera.local/stream.m3u8'
        mount(Hlsstreamer, {
            props: {
                camSettings: createCamSettings({ stream_url: streamUrl }),
            },
        })

        expect(mockWebcamFunctions.convertUrl).toHaveBeenCalledWith(streamUrl, null)
    })

    it('calls hlsInstance.loadSource and attachMedia on mount', () => {
        mount(Hlsstreamer, {
            props: {
                camSettings: createCamSettings(),
            },
        })

        expect(mockHlsInstance.loadSource).toHaveBeenCalled()
        expect(mockHlsInstance.attachMedia).toHaveBeenCalled()
    })

    it('registers MANIFEST_PARSED event handler', () => {
        mount(Hlsstreamer, {
            props: {
                camSettings: createCamSettings(),
            },
        })

        expect(mockHlsInstance.on).toHaveBeenCalledWith('hlsManifestParsed', expect.any(Function))
    })

    it('destroys HLS instance on unmount', () => {
        const wrapper = mount(Hlsstreamer, {
            props: {
                camSettings: createCamSettings(),
            },
        })

        wrapper.unmount()

        expect(mockHlsInstance.destroy).toHaveBeenCalled()
    })

    it('composes wrapperStyle based on camSettings', () => {
        mount(Hlsstreamer, {
            props: {
                camSettings: createCamSettings({ rotation: 90 }),
            },
        })

        expect(mockWebcamFunctions.getWrapperStyle).toHaveBeenCalled()
        expect(mockWebcamFunctions.generateTransform).toHaveBeenCalled()
    })
})

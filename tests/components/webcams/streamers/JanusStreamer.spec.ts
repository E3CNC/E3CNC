import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import JanusStreamer from '@/components/webcams/streamers/JanusStreamer.vue'

const mocks = vi.hoisted(() => {
    const getWrapperStyle = vi.fn(() => ({}))
    const generateTransform = vi.fn(() => 'none')
    const updateAspectRatioFromVideo = vi.fn(() => null)
    const hostUrl = { value: 'http://localhost' }

    const attachMediaStream = vi.fn()
    const onMessageSubscribe = vi.fn()
    const onRemoteTrackSubscribe = vi.fn()
    const onIceStateSubscribe = vi.fn()
    const onErrorSubscribe = vi.fn()
    const createAnswer = vi.fn()
    const send = vi.fn()
    const destroy = vi.fn()

    const mockHandle = {
        onMessage: { subscribe: onMessageSubscribe },
        onRemoteTrack: { subscribe: onRemoteTrackSubscribe },
        onIceState: { subscribe: onIceStateSubscribe },
        onError: { subscribe: onErrorSubscribe },
        createAnswer,
        send,
        destroy: vi.fn(),
    }

    const mockSession = {
        attach: vi.fn(() => Promise.resolve(mockHandle)),
        destroy,
    }

    const mockJanusJs: any = vi.fn(() => ({
        init: vi.fn(),
        createSession: vi.fn(() => Promise.resolve(mockSession)),
    }))
    mockJanusJs.attachMediaStream = attachMediaStream

    return {
        mockWebcam: { getWrapperStyle, generateTransform, updateAspectRatioFromVideo },
        hostUrl,
        janus: { mockJanusJs, attachMediaStream, destroy },
    }
})

vi.mock('@/composables/useWebcam', () => ({
    useWebcam: () => ({
        getWrapperStyle: mocks.mockWebcam.getWrapperStyle,
        generateTransform: mocks.mockWebcam.generateTransform,
        updateAspectRatioFromVideo: mocks.mockWebcam.updateAspectRatioFromVideo,
    }),
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        hostUrl: mocks.hostUrl,
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

vi.mock('typed_janus_js', () => ({
    JanusJs: mocks.janus.mockJanusJs,
    JanusSession: class {},
    JanusStreamingPlugin: class {},
}))

function createCamSettings(overrides: Record<string, any> = {}) {
    return {
        name: 'Test Janus Camera',
        service: 'janus',
        enabled: true,
        icon: 'mdiWebcam',
        target_fps: 15,
        stream_url: 'http://camera.local/janus/stream/123',
        snapshot_url: 'http://camera.local/snapshot',
        flip_horizontal: false,
        flip_vertical: false,
        rotation: 0,
        ...overrides,
    }
}

describe('JanusStreamer.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const wrapper = mount(JanusStreamer, {
            props: {
                camSettings: createCamSettings(),
            },
        })

        expect(wrapper.exists()).toBe(true)
    })

    it('renders a video element', () => {
        const wrapper = mount(JanusStreamer, {
            props: {
                camSettings: createCamSettings(),
            },
        })

        const video = wrapper.find('video')
        expect(video.exists()).toBe(true)
    })

    it('has webcamBackground class', () => {
        const wrapper = mount(JanusStreamer, {
            props: {
                camSettings: createCamSettings(),
            },
        })

        const bg = wrapper.find('.webcamBackground')
        expect(bg.exists()).toBe(true)
    })
})

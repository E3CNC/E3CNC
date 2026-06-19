import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WebcamWrapperItem from '@/components/webcams/WebcamWrapperItem.vue'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

function mountWrapper(service: string) {
    return mount(WebcamWrapperItem, {
        props: {
            webcam: { name: 'TestCam', service, icon: 'mdiWebcam' },
            showFps: true,
            page: undefined,
        },
        global: {
            stubs: {
                MjpegstreamerAsync: { template: '<div class="streamer-mjpegstreamer" />' },
                MjpegstreamerAdaptiveAsync: { template: '<div class="streamer-mjpegstreamer-adaptive" />' },
                Uv4lMjpegAsync: { template: '<div class="streamer-uv4l-mjpeg" />' },
                HtmlIframeAsync: { template: '<div class="streamer-iframe" />' },
                HtmlVideoAsync: { template: '<div class="streamer-html-video" />' },
                HlsstreamerAsync: { template: '<div class="streamer-hlsstream" />' },
                JMuxerStreamAsync: { template: '<div class="streamer-jmuxer-stream" />' },
                WebrtcCameraStreamerAsync: { template: '<div class="streamer-webrtc-camerastreamer" />' },
                JanusStreamerAsync: { template: '<div class="streamer-webrtc-janus" />' },
                WebrtcMediaMTXAsync: { template: '<div class="streamer-webrtc-mediamtx" />' },
                WebrtcGo2rtcAsync: { template: '<div class="streamer-webrtc-go2rtc" />' },
            },
        },
    })
}

describe('WebcamWrapperItem.vue', () => {
    it('renders mjpegstreamer for mjpegstreamer service', () => {
        const wrapper = mountWrapper('mjpegstreamer')
        expect(wrapper.find('.streamer-mjpegstreamer').exists()).toBe(true)
    })

    it('renders mjpegstreamer-adaptive for mjpegstreamer-adaptive service', () => {
        const wrapper = mountWrapper('mjpegstreamer-adaptive')
        expect(wrapper.find('.streamer-mjpegstreamer-adaptive').exists()).toBe(true)
    })

    it('renders uv4l-mjpeg for uv4l-mjpeg service', () => {
        const wrapper = mountWrapper('uv4l-mjpeg')
        expect(wrapper.find('.streamer-uv4l-mjpeg').exists()).toBe(true)
    })

    it('renders iframe for iframe service', () => {
        const wrapper = mountWrapper('iframe')
        expect(wrapper.find('.streamer-iframe').exists()).toBe(true)
    })

    it('renders html-video for html-video service', () => {
        const wrapper = mountWrapper('html-video')
        expect(wrapper.find('.streamer-html-video').exists()).toBe(true)
    })

    it('renders hlsstream for hlsstream service', () => {
        const wrapper = mountWrapper('hlsstream')
        expect(wrapper.find('.streamer-hlsstream').exists()).toBe(true)
    })

    it('renders jmuxer-stream for jmuxer-stream service', () => {
        const wrapper = mountWrapper('jmuxer-stream')
        expect(wrapper.find('.streamer-jmuxer-stream').exists()).toBe(true)
    })

    it('renders webrtc-camerastreamer for webrtc-camerastreamer service', () => {
        const wrapper = mountWrapper('webrtc-camerastreamer')
        expect(wrapper.find('.streamer-webrtc-camerastreamer').exists()).toBe(true)
    })

    it('renders webrtc-janus for webrtc-janus service', () => {
        const wrapper = mountWrapper('webrtc-janus')
        expect(wrapper.find('.streamer-webrtc-janus').exists()).toBe(true)
    })

    it('renders webrtc-mediamtx for webrtc-mediamtx service', () => {
        const wrapper = mountWrapper('webrtc-mediamtx')
        expect(wrapper.find('.streamer-webrtc-mediamtx').exists()).toBe(true)
    })

    it('renders webrtc-go2rtc for webrtc-go2rtc service', () => {
        const wrapper = mountWrapper('webrtc-go2rtc')
        expect(wrapper.find('.streamer-webrtc-go2rtc').exists()).toBe(true)
    })

    it('shows unknown service text for unrecognized service', () => {
        const wrapper = mount(WebcamWrapperItem, {
            props: { webcam: { name: 'TestCam', service: 'unknown-service', icon: 'mdiWebcam' } },
            global: {
                mocks: { $t: (key: string) => key },
                stubs: {},
            },
        })
        expect(wrapper.text()).toContain('Panels.WebcamPanel.UnknownWebcamService')
    })

    it('passes showFps prop to mjpegstreamer', () => {
        const wrapper = mount(WebcamWrapperItem, {
            props: { webcam: { name: 'TestCam', service: 'mjpegstreamer' }, showFps: true },
            global: { stubs: { MjpegstreamerAsync: { template: '<div class="streamer-mjpegstreamer" />' } } },
        })
        expect(wrapper.find('.streamer-mjpegstreamer').exists()).toBe(true)
    })
})

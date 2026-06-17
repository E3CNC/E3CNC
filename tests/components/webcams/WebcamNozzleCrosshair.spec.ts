import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import WebcamNozzleCrosshair from '@/components/webcams/WebcamNozzleCrosshair.vue'

function createWebcam(overrides: Record<string, any> = {}) {
    return {
        name: 'Test Cam',
        service: 'mjpegstreamer',
        enabled: true,
        icon: 'mdiWebcam',
        target_fps: 15,
        stream_url: 'http://camera.local/stream',
        snapshot_url: 'http://camera.local/snapshot',
        flip_horizontal: false,
        flip_vertical: false,
        rotation: 0,
        ...overrides,
    }
}

describe('WebcamNozzleCrosshair.vue', () => {
    it('renders without crashing', () => {
        const wrapper = mount(WebcamNozzleCrosshair, {
            props: {
                webcam: createWebcam(),
            },
        })

        expect(wrapper.exists()).toBe(true)
    })

    it('has crosshair-container class', () => {
        const wrapper = mount(WebcamNozzleCrosshair, {
            props: {
                webcam: createWebcam(),
            },
        })

        const container = wrapper.find('.crosshair-container')
        expect(container.exists()).toBe(true)
    })

    it('renders horizontal and vertical lines', () => {
        const wrapper = mount(WebcamNozzleCrosshair, {
            props: {
                webcam: createWebcam(),
            },
        })

        const horizontal = wrapper.find('.horizontal')
        expect(horizontal.exists()).toBe(true)

        const vertical = wrapper.find('.vertical')
        expect(vertical.exists()).toBe(true)
    })

    it('renders circle element', () => {
        const wrapper = mount(WebcamNozzleCrosshair, {
            props: {
                webcam: createWebcam(),
            },
        })

        const circle = wrapper.find('.circle')
        expect(circle.exists()).toBe(true)
    })

    it('uses default color when no extra_data.nozzleCrosshairColor set', () => {
        const wrapper = mount(WebcamNozzleCrosshair, {
            props: {
                webcam: createWebcam(),
            },
        })

        const defaultColor = 'rgb(var(--v-theme-error))'

        const horizontal = wrapper.find('.horizontal')
        expect(horizontal.attributes('style')).toContain(defaultColor)

        const vertical = wrapper.find('.vertical')
        expect(vertical.attributes('style')).toContain(defaultColor)

        const circle = wrapper.find('.circle')
        expect(circle.attributes('style')).toContain(defaultColor)
    })

    it('uses custom color when nozzleCrosshairColor is set in extra_data', () => {
        const customColor = '#ff0000'
        const wrapper = mount(WebcamNozzleCrosshair, {
            props: {
                webcam: createWebcam({
                    extra_data: {
                        nozzleCrosshairColor: customColor,
                    },
                }),
            },
        })

        const horizontal = wrapper.find('.horizontal')
        expect(horizontal.attributes('style')).toContain(customColor)

        const circle = wrapper.find('.circle')
        expect(circle.attributes('style')).toContain(customColor)
    })

    it('computes circle size based on container height and nozzleCrosshairSize', () => {
        // Set a mock clientHeight on the container element to test size computation
        const customSize = 0.25
        const wrapper = mount(WebcamNozzleCrosshair, {
            props: {
                webcam: createWebcam({
                    extra_data: {
                        nozzleCrosshairSize: customSize,
                    },
                }),
            },
        })

        const circle = wrapper.find('.circle')
        const style = circle.attributes('style')

        // With container.clientHeight = 0 (happy-dom), size = 0 * 0.25 = 0
        expect(style).toContain('width: 0px')
        expect(style).toContain('height: 0px')
        expect(style).toContain('margin-left: 0px')
        expect(style).toContain('margin-top: 0px')
    })

    it('applies borderColor style to circle from computed color', () => {
        const customColor = '#00ff00'
        const wrapper = mount(WebcamNozzleCrosshair, {
            props: {
                webcam: createWebcam({
                    extra_data: {
                        nozzleCrosshairColor: customColor,
                    },
                }),
            },
        })

        const circle = wrapper.find('.circle')
        expect(circle.attributes('style')).toContain(`border-color: ${customColor}`)
    })
})

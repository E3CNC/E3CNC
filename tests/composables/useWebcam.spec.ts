import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { useWebcam } from '@/composables/useWebcam'

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        hostUrl: computed(() => 'http://localhost/'),
        hostPort: computed(() => 8080),
    }),
}))

function mountComposable(storeOverrides: Record<string, any> = {}) {
    const store = createStore({
        state: {
            server: {
                config: {
                    config: {
                        server: {
                            port: 7125,
                            ssl_port: 7130,
                        },
                    },
                },
            },
            ...storeOverrides,
        },
        getters: {},
    })

    let result: any
    const TestComponent = defineComponent({
        setup() {
            result = useWebcam()
            return () => h('div')
        },
    })

    mount(TestComponent, {
        global: { plugins: [store] },
    })

    return result
}

describe('useWebcam', () => {
    it('converts webcam URLs using the current host port', () => {
        const webcam = mountComposable()
        expect(webcam.convertUrl('/webcam/?action=stream', null)).toBe('http://localhost:8080/webcam/?action=stream')
        expect(webcam.convertUrl('/webcam/?action=snapshot', null)).toBe('http://localhost:8080/webcam/?action=snapshot')
    })

    it('converts webcam URLs with printer URL', () => {
        const webcam = mountComposable()
        // printer URL is used as base, but /webcam path still gets port appended
        const result = webcam.convertUrl('/webcam/?action=stream', 'http://printer.local')
        expect(result).toContain('printer.local')
        expect(result).toContain('/webcam/?action=stream')
    })

    it('converts absolute http URLs without modification', () => {
        const webcam = mountComposable()
        const result = webcam.convertUrl('http://external.cam/stream', null)
        expect(result).toContain('external.cam')
        expect(result).toContain('/stream')
    })

    it('generates transforms', () => {
        const webcam = mountComposable()
        expect(webcam.generateTransform(false, false, 0)).toBe('none')
        expect(webcam.generateTransform(true, false, 0)).toBe('scaleX(-1)')
        expect(webcam.generateTransform(false, true, 0)).toBe('scaleY(-1)')
        expect(webcam.generateTransform(true, true, 0)).toBe('scaleX(-1) scaleY(-1)')
        expect(webcam.generateTransform(false, false, 90)).toBe('rotate(90deg)')
        expect(webcam.generateTransform(true, true, 90, 2)).toBe('scaleX(-1) scaleY(-1) rotate(90deg) scale(0.5)')
        expect(webcam.generateTransform(false, false, 180)).toBe('rotate(180deg)')
        expect(webcam.generateTransform(false, false, 270)).toBe('rotate(270deg)')
    })

    it('generates wrapper styles for various aspect ratios and rotations', () => {
        const webcam = mountComposable()
        // null aspect ratio returns empty
        expect(webcam.getWrapperStyle(null, 90)).toEqual({})
        // aspect ratio 1 returns empty
        expect(webcam.getWrapperStyle(1, 90)).toEqual({})
        // rotation 0 returns empty
        expect(webcam.getWrapperStyle(2, 0)).toEqual({})
        // rotation 180 returns empty
        expect(webcam.getWrapperStyle(2, 180)).toEqual({})
        // aspect < 1 with 90/270 rotation
        expect(webcam.getWrapperStyle(0.5, 90)).toEqual({ aspectRatio: 2 })
        expect(webcam.getWrapperStyle(0.5, 270)).toEqual({ aspectRatio: 2 })
        // aspect > 1 with 90/270 rotation
        expect(webcam.getWrapperStyle(2, 90)).toEqual({ aspectRatio: 2 })
        expect(webcam.getWrapperStyle(2, 270)).toEqual({ aspectRatio: 2 })
    })

    it('updates aspect ratio from video element', () => {
        const webcam = mountComposable()
        expect(webcam.updateAspectRatioFromVideo({ videoWidth: 1920, videoHeight: 1080 } as any)).toBeCloseTo(1.778, 3)
        // null/undefined returns null
        expect(webcam.updateAspectRatioFromVideo(null)).toBeNull()
        expect(webcam.updateAspectRatioFromVideo(undefined)).toBeNull()
        // missing dimensions returns null
        expect(webcam.updateAspectRatioFromVideo({} as any)).toBeNull()
    })

    it('updates aspect ratio from image element', () => {
        const webcam = mountComposable()
        expect(webcam.updateAspectRatioFromImage({ naturalWidth: 800, naturalHeight: 600 } as any)).toBeCloseTo(1.333, 3)
        expect(webcam.updateAspectRatioFromImage(null)).toBeNull()
        expect(webcam.updateAspectRatioFromImage(undefined)).toBeNull()
        expect(webcam.updateAspectRatioFromImage({} as any)).toBeNull()
    })

    it('converts webcam icons', () => {
        const webcam = mountComposable()
        expect(webcam.convertWebcamIcon('mdiAlbum')).toBeTruthy()
        expect(webcam.convertWebcamIcon('mdiCampfire')).toBeTruthy()
        expect(webcam.convertWebcamIcon('mdiDoor')).toBeTruthy()
        expect(webcam.convertWebcamIcon('mdiRadiatorDisabled')).toBeTruthy()
        expect(webcam.convertWebcamIcon('mdiPrinter3d')).toBeTruthy()
        expect(webcam.convertWebcamIcon('mdiPrinter3dNozzle')).toBeTruthy()
        expect(webcam.convertWebcamIcon('mdiRaspberryPi')).toBeTruthy()
        expect(webcam.convertWebcamIcon('unknown')).toBeTruthy()
    })
})

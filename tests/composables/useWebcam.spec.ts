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
function mountComposable() {
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
    it('generates transforms and wrapper styles', () => {
        const webcam = mountComposable()
        expect(webcam.generateTransform(false, false, 0)).toBe('none')
        expect(webcam.generateTransform(true, true, 90, 2)).toBe('scaleX(-1) scaleY(-1) rotate(90deg) scale(0.5)')
        expect(webcam.getWrapperStyle(0.5, 90)).toEqual({ aspectRatio: 2 })
        expect(webcam.updateAspectRatioFromVideo({ videoWidth: 1920, videoHeight: 1080 } as any)).toBeCloseTo(1.778, 3)
        expect(webcam.updateAspectRatioFromImage({ naturalWidth: 800, naturalHeight: 600 } as any)).toBeCloseTo(1.333, 3)
    })

    it('converts webcam icons', () => {
        const webcam = mountComposable()
        expect(webcam.convertWebcamIcon('mdiAlbum')).toBeTruthy()
        expect(webcam.convertWebcamIcon('unknown')).toBeTruthy()
    })
})

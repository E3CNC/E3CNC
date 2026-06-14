import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { useServices } from '@/composables/useServices'

describe('useServices', () => {
    let store: any

    beforeEach(() => {
        store = createStore({
            state: {
                gui: {
                    uiSettings: {
                        hideOtherInstances: true,
                    },
                },
                server: {
                    system_info: {
                        instance_ids: {
                            klipper: 'klippy',
                            moonraker: 'moon',
                        },
                    },
                },
            },
            getters: {},
        })
    })

    function mountComposable() {
        let result: any
        const TestComponent = defineComponent({
            setup() {
                result = useServices()
                return () => h('div')
            },
        })

        mount(TestComponent, {
            global: { plugins: [store] },
        })

        return result
    }

    it('exposes service flags and instance ids', () => {
        const services = mountComposable()
        expect(services.hideOtherInstances.value).toBe(true)
        expect(services.instance_ids.value).toEqual({ klipper: 'klippy', moonraker: 'moon' })
        expect(services.klipperInstance.value).toBe('klippy')
        expect(services.moonrakerInstance.value).toBe('moon')
    })
})

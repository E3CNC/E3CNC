import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { useMiscellaneous } from '@/composables/useMiscellaneous'

describe('useMiscellaneous', () => {
    it('finds supported lights', () => {
        const store = createStore({
            state: {
                printer: {
                    'led front': {},
                    'neopixel _hidden': {},
                    'fan toolhead': {},
                },
            },
            getters: {},
        })

        let result: any
        const TestComponent = defineComponent({
            setup() {
                result = useMiscellaneous()
                return () => h('div')
            },
        })

        mount(TestComponent, {
            global: { plugins: [store] },
        })

        expect(result.lights.value).toEqual([{ type: 'led', name: 'front' }])
    })
})

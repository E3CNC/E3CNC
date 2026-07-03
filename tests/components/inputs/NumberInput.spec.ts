// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createStore } from 'vuex'

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({}),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string, params?: Record<string, any>) => {
            const translations: Record<string, string> = {
                'App.NumberInput.GreaterOrEqualError': 'Must be ≥ {min}',
                'App.NumberInput.MustBeBetweenError': 'Must be between {min} and {max}',
            }
            let msg = translations[key] ?? key
            if (params) {
                Object.entries(params).forEach(([k, v]) => {
                    msg = msg.replace(`{${k}}`, String(v))
                })
            }
            return msg
        },
    }),
}))

vi.mock('@mdi/js', () => ({
    mdiRestart: 'mdiRestart',
    mdiChevronUp: 'mdiChevronUp',
    mdiChevronDown: 'mdiChevronDown',
}))

import NumberInput from '@/components/inputs/NumberInput.vue'

describe('NumberInput.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const defaultProps = {
        label: 'Speed',
        param: 'speed',
        target: 100,
        min: 0,
        max: 500,
        dec: 0,
        defaultValue: null,
    }

    function mountComponent(props = {}, stubs: Record<string, any> = {}) {
        const mergedProps = { ...defaultProps, ...props }
        return shallowMount(NumberInput, {
            props: mergedProps,
            global: {
                stubs: {
                    'v-text-field': {
                        name: 'VTextField',
                        props: [
                            'modelValue',
                            'label',
                            'suffix',
                            'error',
                            'errorMessages',
                            'disabled',
                            'step',
                            'min',
                            'max',
                        ],
                        template: `
                            <div class="v-text-field-stub">
                                <slot name="append" />
                                <slot name="append-outer" />
                                {{ label }}: {{ modelValue }} {{ suffix }}
                            </div>
                        `,
                    },
                    'v-icon': {
                        name: 'VIcon',
                        template: '<i class="v-icon-stub"><slot /></i>',
                    },
                    'v-btn': {
                        name: 'VBtn',
                        props: ['disabled', 'icon', 'size', 'variant'],
                        template: '<button class="v-btn-stub" :disabled="disabled"><slot /></button>',
                    },
                    form: {
                        name: 'Form',
                        template: '<form><slot /></form>',
                    },
                    ...stubs,
                },
            },
        })
    }

    it('renders label and target value', () => {
        const wrapper: any = mountComponent()
        expect(wrapper.text()).toContain('Speed')
        expect(wrapper.text()).toContain('100')
    })

    it('shows suffix when unit is provided', () => {
        const wrapper: any = mountComponent({ unit: 'mm/s' })
        expect(wrapper.text()).toContain('mm/s')
    })

    it('shows spinner buttons when hasSpinner is true', () => {
        const wrapper: any = mountComponent({ hasSpinner: true })
        const btns = wrapper.findAll('.v-btn-stub')
        expect(btns.length).toBeGreaterThanOrEqual(2)
    })

    it('does not show spinner buttons when hasSpinner is false', () => {
        const wrapper: any = mountComponent({ hasSpinner: false })
        const btns = wrapper.findAll('.v-btn-stub')
        // Only the reset button in append slot
        expect(btns.length).toBe(0)
    })

    it('resets to default value when reset icon is clicked', async () => {
        const wrapper: any = mountComponent({ defaultValue: 50, hasSpinner: false })
        expect((wrapper.vm as any).value)
            .toBe('100')
            (wrapper.vm as any)
            .resetToDefault()
        await wrapper.vm.$nextTick()

        // After reset, value should be 50 (the default)
        expect((wrapper.vm as any).value).toBe('50')
    })

    it('emits submit when resetToDefault is called', async () => {
        const wrapper: any = mountComponent({ defaultValue: 50 })(wrapper.vm as any).resetToDefault()
        await wrapper.vm.$nextTick()

        expect(wrapper.emitted('submit')).toBeTruthy()
        expect(wrapper.emitted('submit')![0]).toEqual([{ name: 'speed', value: 50 }])
    })

    it('increments value when increment is called', async () => {
        const wrapper: any = mountComponent({ hasSpinner: true })(wrapper.vm as any).incrementValue()
        await wrapper.vm.$nextTick()

        expect(wrapper.emitted('submit')).toBeTruthy()
        expect((wrapper.vm as any).value).toBe('101')
    })

    it('does not increment beyond max', async () => {
        const wrapper: any = mountComponent({ target: 499, max: 500, hasSpinner: true })(
            wrapper.vm as any
        ).incrementValue()
        await wrapper.vm.$nextTick()

        expect((wrapper.vm as any).value)
            .toBe('500')
            (
                // Try incrementing again
                wrapper.vm as any
            )
            .incrementValue()
        await wrapper.vm.$nextTick()

        expect((wrapper.vm as any).value).toBe('500')
    })

    it('decrements value when decrement is called', async () => {
        const wrapper: any = mountComponent({ hasSpinner: true })(wrapper.vm as any).decrementValue()
        await wrapper.vm.$nextTick()

        expect((wrapper.vm as any).value).toBe('99')
    })

    it('does not decrement below min', async () => {
        const wrapper: any = mountComponent({ target: 1, min: 0, hasSpinner: true })(wrapper.vm as any).decrementValue()
        await wrapper.vm.$nextTick()

        expect((wrapper.vm as any).value)
            .toBe('0')
            (
                // Try decrementing again
                wrapper.vm as any
            )
            .decrementValue()
        await wrapper.vm.$nextTick()

        expect((wrapper.vm as any).value).toBe('0')
    })

    it('handles decimal precision correctly', async () => {
        const wrapper: any = mountComponent({
            target: 10.5,
            dec: 1,
            step: 0.5,
            hasSpinner: true,
        })(wrapper.vm as any).incrementValue()
        await wrapper.vm.$nextTick()

        expect((wrapper.vm as any).value).toBe('11')
    })

    it('supports spinnerFactor for larger increments', async () => {
        const wrapper: any = mountComponent({
            hasSpinner: true,
            spinnerFactor: 10,
            step: 1,
        })(wrapper.vm as any).incrementValue()
        await wrapper.vm.$nextTick()

        // 100 + 1 * 10 = 110
        expect((wrapper.vm as any).value).toBe('110')
    })

    it('clamps increment when near max with spinnerFactor', async () => {
        const wrapper: any = mountComponent({
            target: 495,
            max: 500,
            hasSpinner: true,
            spinnerFactor: 10,
        })(wrapper.vm as any).incrementValue()
        await wrapper.vm.$nextTick()

        expect((wrapper.vm as any).value).toBe('500')
    })

    it('clamps decrement when near min', async () => {
        const wrapper: any = mountComponent({
            target: 3,
            min: 0,
            hasSpinner: true,
            spinnerFactor: 10,
        })(wrapper.vm as any).decrementValue()
        await wrapper.vm.$nextTick()

        expect((wrapper.vm as any).value).toBe('0')
    })

    it('provides error messages when outputErrorMsg is true and value is out of range', () => {
        // Value below min
        const wrapper: any = mountComponent({
            target: -5,
            min: 0,
            max: 100,
            outputErrorMsg: true,
        })

        expect((wrapper.vm as any).inputErrors.length).toBeGreaterThan(0)
        expect((wrapper.vm as any).invalidInput).toBe(true)
    })

    it('provides error messages when value exceeds max', () => {
        const wrapper: any = mountComponent({
            target: 150,
            min: 0,
            max: 100,
            outputErrorMsg: true,
        })

        expect((wrapper.vm as any).inputErrors.length).toBeGreaterThan(0)
        expect((wrapper.vm as any).inputErrors[0]).toContain('100')
    })

    it('does not provide error messages when outputErrorMsg is false even if out of range', () => {
        const wrapper: any = mountComponent({
            target: -5,
            min: 0,
            max: 100,
            outputErrorMsg: false,
        })

        expect((wrapper.vm as any).inputErrors).toEqual([])
        expect((wrapper.vm as any).invalidInput).toBe(false)
    })

    it('blocks invalid characters on keydown', () => {
        const wrapper: any = mountComponent()
        const event = new KeyboardEvent('keydown', { key: 'e' })
        const preventDefaultSpy = vi
            .spyOn(
                event,
                'preventDefault'
            )
            (wrapper.vm as any)
            .checkInvalidChars(event)

        expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('blocks minus sign when min >= 0', () => {
        const wrapper: any = mountComponent({ min: 0 })
        const event = new KeyboardEvent('keydown', { key: '-' })
        const preventDefaultSpy = vi
            .spyOn(
                event,
                'preventDefault'
            )
            (wrapper.vm as any)
            .checkInvalidChars(event)

        expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('allows minus sign when min < 0', () => {
        const wrapper: any = mountComponent({ min: -100 })
        const event = new KeyboardEvent('keydown', { key: '-' })
        const preventDefaultSpy = vi
            .spyOn(
                event,
                'preventDefault'
            )
            (wrapper.vm as any)
            .checkInvalidChars(event)

        expect(preventDefaultSpy).not.toHaveBeenCalled()
    })

    it('does not emit submit when value is invalid with outputErrorMsg', () => {
        const wrapper: any = mountComponent({ target: -5, min: 0, max: 100, outputErrorMsg: true })(
            wrapper.vm as any
        ).submit()
        // invalidInput should be true when value is below min and outputErrorMsg is on
        expect(wrapper.emitted('submit')).toBeFalsy()
    })

    it('tracks target prop changes', async () => {
        const wrapper: any = mountComponent({ target: 100 })
        expect((wrapper.vm as any).value).toBe('100')

        await wrapper.setProps({ target: 200 })
        await wrapper.vm.$nextTick()

        expect((wrapper.vm as any).value).toBe('200')
    })

    it('resets value to default when defaultValue is null', () => {
        const wrapper: any = (mountComponent({ defaultValue: null })(wrapper.vm as any).value = '999')

        // Not null default = no reset icon shown
        expect((wrapper.vm as any).value).toBe('999')
    })
})

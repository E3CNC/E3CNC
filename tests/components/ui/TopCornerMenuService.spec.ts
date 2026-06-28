/**
 * Tests for TopCornerMenuService.vue — covers all service buttons and dialogs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { ref } from 'vue'
import TopCornerMenuService from '@/components/ui/TopCornerMenuService.vue'

const mockSocketEmit = vi.fn()
const mockPrinterIsPrinting = ref(false)
const mockHideOtherInstances = ref(false)
const mockKlipperInstance = ref('klipper')
const mockMoonrakerInstance = ref('moonraker')

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        printerIsPrinting: mockPrinterIsPrinting,
    }),
}))

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mockSocketEmit }),
}))

vi.mock('@/composables/useServices', () => ({
    useServices: () => ({
        hideOtherInstances: mockHideOtherInstances,
        klipperInstance: mockKlipperInstance,
        moonrakerInstance: mockMoonrakerInstance,
    }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => {
            const map: Record<string, string> = {
                'App.TopCornerMenu.ConfirmationDialog.Title.KlipperRestart': 'Restart Klipper?',
                'App.TopCornerMenu.ConfirmationDialog.Description.KlipperRestart': 'This will restart Klipper.',
                'App.TopCornerMenu.ConfirmationDialog.Title.ServiceRestart': 'Restart Service?',
                'App.TopCornerMenu.ConfirmationDialog.Description.ServiceRestart': 'This will restart the service.',
                'App.TopCornerMenu.ConfirmationDialog.Title.ServiceStop': 'Stop Service?',
                'App.TopCornerMenu.ConfirmationDialog.Description.KlipperStop': 'This will stop Klipper.',
                'App.TopCornerMenu.ConfirmationDialog.Description.ServiceStop': 'This will stop the service.',
                'App.TopCornerMenu.Restart': 'Restart',
                'App.TopCornerMenu.Stop': 'Stop',
            }
            return map[key] ?? key
        },
    }),
}))

vi.mock('@/components/dialogs/ConfirmationDialog.vue', () => ({
    default: {
        name: 'ConfirmationDialog',
        props: { modelValue: Boolean, title: String, text: String, actionButtonText: String },
        template:
            '<div class="confirmation-dialog" v-if="modelValue"><button class="action-btn" @click="$emit(\'action\')" /><button class="close-btn" @click="$emit(\'update:modelValue\', false)" /></div>',
    },
}))

vi.mock('vuetify/components', () => ({
    VListItem: {
        name: 'VListItem',
        template: '<div class="v-list-item"><slot name="title" /><slot name="append" /></div>',
    },
    VTooltip: {
        name: 'VTooltip',
        props: { location: String },
        template: '<div><slot name="activator" :props="{}" /></div>',
    },
    VBtn: {
        name: 'VBtn',
        props: { icon: Boolean, size: String, disabled: Boolean },
        template: '<button :disabled="disabled" @click="$attrs.onClick || $emit(\'click\')"><slot /></button>',
    },
    VIcon: { name: 'VIcon', props: { size: String }, template: '<i><slot /></i>' },
}))

vi.mock('@/plugins/helpers', () => ({
    capitalize: (s: string) => s.charAt(0).toUpperCase() + s.slice(1),
}))

function makeStore(serviceState: string = 'active') {
    return createStore({
        state: {
            server: {
                system_info: {
                    service_state: {
                        klipper: { active_state: serviceState, sub_state: 'running' },
                        moonraker: { active_state: serviceState, sub_state: 'running' },
                    },
                },
            },
        },
    })
}

describe('TopCornerMenuService.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockPrinterIsPrinting.value = false
        mockHideOtherInstances.value = false
    })

    it('renders capitalized service name', () => {
        const wrapper = mount(TopCornerMenuService, {
            props: { service: 'klipper' },
            global: { plugins: [makeStore()] },
        })
        expect(wrapper.text()).toContain('Klipper')
    })

    it('emits restart when clicking main button on active service', async () => {
        const wrapper = mount(TopCornerMenuService, {
            props: { service: 'klipper' },
            global: { plugins: [makeStore('active')] },
        })
        const buttons = wrapper.findAllComponents({ name: 'VBtn' })
        expect(buttons.length).toBeGreaterThanOrEqual(2)
        await buttons[0].trigger('click')
        expect(mockSocketEmit).toHaveBeenCalledWith('machine.services.restart', { service: 'klipper' })
    })

    it('emits start when inactive service button is clicked', async () => {
        const wrapper = mount(TopCornerMenuService, {
            props: { service: 'klipper' },
            global: { plugins: [makeStore('inactive')] },
        })
        const buttons = wrapper.findAllComponents({ name: 'VBtn' })
        await buttons[0].trigger('click')
        expect(mockSocketEmit).toHaveBeenCalledWith('machine.services.start', { service: 'klipper' })
    })

    it('emits stop when stop button is clicked and not printing', async () => {
        const wrapper = mount(TopCornerMenuService, {
            props: { service: 'klipper' },
            global: { plugins: [makeStore()] },
        })
        const buttons = wrapper.findAllComponents({ name: 'VBtn' })
        const stopBtn = buttons[buttons.length - 1]
        await stopBtn.trigger('click')
        expect(mockSocketEmit).toHaveBeenCalledWith('machine.services.stop', { service: 'klipper' })
    })
})

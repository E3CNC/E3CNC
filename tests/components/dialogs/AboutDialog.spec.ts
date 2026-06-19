import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { mdiHelpCircleOutline, mdiMoonWaningCrescent } from '@mdi/js'

// --- Mock vuex useStore ---
vi.mock('vuex', () => ({
    useStore: () => ({
        state: {
            packageVersion: '2.14.0',
            server: {
                moonraker_version: 'v0.9.0-1234',
            },
            printer: {
                software_version: 'v0.12.0-567',
            },
        },
    }),
}))

// --- Mock vuetify/components: VTooltip, VIcon, VContainer ---
vi.mock('vuetify/components', () => ({
    VTooltip: {
        name: 'VTooltip',
        template: '<div class="v-tooltip"><slot name="activator" :props="{}" /><slot /></div>',
    },
    VIcon: {
        name: 'VIcon',
        template: '<span class="v-icon"><slot /></span>',
    },
    VContainer: {
        name: 'VContainer',
        template: '<div class="v-container"><slot /></div>',
    },
}))

import AboutDialog from '@/components/dialogs/AboutDialog.vue'

describe('AboutDialog.vue', () => {
    it('renders without crashing', () => {
        const wrapper = mount(AboutDialog, {
            global: {
                stubs: {
                    'v-tooltip': {
                        name: 'VTooltip',
                        template: '<div class="v-tooltip"><slot name="activator" :props="{}" /><slot /></div>',
                    },
                    'v-icon': {
                        name: 'VIcon',
                        template: '<span class="v-icon"><slot /></span>',
                    },
                    'v-container': {
                        name: 'VContainer',
                        template: '<div class="v-container"><slot /></div>',
                    },
                },
            },
        })

        expect(wrapper.exists()).toBe(true)
    })

    it('shows mainsail version from store', () => {
        const wrapper = mount(AboutDialog, {
            global: {
                stubs: {
                    'v-tooltip': {
                        name: 'VTooltip',
                        template: '<div class="v-tooltip"><slot name="activator" :props="{}" /><slot /></div>',
                    },
                    'v-icon': {
                        name: 'VIcon',
                        template: '<span class="v-icon"><slot /></span>',
                    },
                    'v-container': {
                        name: 'VContainer',
                        template: '<div class="v-container"><slot /></div>',
                    },
                },
            },
        })

        expect(wrapper.text()).toContain('v2.14.0')
    })

    it('shows klipper version from store', () => {
        const wrapper = mount(AboutDialog, {
            global: {
                stubs: {
                    'v-tooltip': {
                        name: 'VTooltip',
                        template: '<div class="v-tooltip"><slot name="activator" :props="{}" /><slot /></div>',
                    },
                    'v-icon': {
                        name: 'VIcon',
                        template: '<span class="v-icon"><slot /></span>',
                    },
                    'v-container': {
                        name: 'VContainer',
                        template: '<div class="v-container"><slot /></div>',
                    },
                },
            },
        })

        expect(wrapper.text()).toContain('v0.12.0-567')
    })

    it('shows moonraker version from store', () => {
        const wrapper = mount(AboutDialog, {
            global: {
                stubs: {
                    'v-tooltip': {
                        name: 'VTooltip',
                        template: '<div class="v-tooltip"><slot name="activator" :props="{}" /><slot /></div>',
                    },
                    'v-icon': {
                        name: 'VIcon',
                        template: '<span class="v-icon"><slot /></span>',
                    },
                    'v-container': {
                        name: 'VContainer',
                        template: '<div class="v-container"><slot /></div>',
                    },
                },
            },
        })

        expect(wrapper.text()).toContain('v0.9.0-1234')
    })

    it('renders the help icon', () => {
        const wrapper = mount(AboutDialog, {
            global: {
                stubs: {
                    'v-tooltip': {
                        name: 'VTooltip',
                        template: '<div class="v-tooltip"><slot name="activator" :props="{}" /><slot /></div>',
                    },
                    'v-icon': {
                        name: 'VIcon',
                        template: '<span class="v-icon"><slot /></span>',
                    },
                    'v-container': {
                        name: 'VContainer',
                        template: '<div class="v-container"><slot /></div>',
                    },
                },
            },
        })

        expect(wrapper.find('.v-icon').exists()).toBe(true)
        expect(wrapper.text()).toContain(mdiHelpCircleOutline)
    })
})

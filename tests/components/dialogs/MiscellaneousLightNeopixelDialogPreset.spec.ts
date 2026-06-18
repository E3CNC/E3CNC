import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vuetify/components', () => ({
    VTooltip: { name: 'VTooltip', props: ['top'], template: '<div><slot name="activator" :props="{}" /><slot /></div>' },
}))

import MiscellaneousLightNeopixelDialogPreset from '@/components/dialogs/MiscellaneousLightNeopixelDialogPreset.vue'

describe('MiscellaneousLightNeopixelDialogPreset.vue', () => {
    it('renders without crashing', () => {
        const wrapper = mount(MiscellaneousLightNeopixelDialogPreset, {
            props: { preset: { name: 'Red', red: 255, green: 0, blue: 0, white: 0 } },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('emits update-color on preset click', async () => {
        const wrapper = mount(MiscellaneousLightNeopixelDialogPreset, {
            props: { preset: { name: 'Red', red: 255, green: 0, blue: 0, white: 0 } },
        })
        // The preset div is rendered with v-bind="props" from the activator slot
        // The VTooltip stub renders activator slot content directly
        const divs = wrapper.findAll('div')
        // Find the preset-style div (inner div, not the tooltip wrapper)
        const presetDiv = divs[divs.length - 1]
        await presetDiv.trigger('click')
        expect(wrapper.emitted('update-color')).toBeTruthy()
    })
})

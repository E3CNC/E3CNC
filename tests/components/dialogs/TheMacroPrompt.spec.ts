import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createI18n } from 'vue-i18n'
import TheMacroPrompt from '@/components/dialogs/TheMacroPrompt.vue'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

vi.mock('@/composables/useBase', () => ({ useBase: () => ({ isMobile: { value: false } }) }))
vi.mock('@/composables/useSocket', () => ({ useSocket: () => ({ emit: vi.fn() }) }))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: { icon: String, title: String, marginBottom: Boolean, cardClass: String, height: [String, Number] },
        template:
            '<div class="panel"><slot name="buttons" /><slot /><span class="panel-title">{{ title }}</span></div>',
    },
}))

vi.mock('@/components/dialogs/MacroPromptText.vue', () => ({
    default: {
        name: 'MacroPromptText',
        props: ['event'],
        template: '<div class="macro-text">{{ event.message }}</div>',
    },
}))

vi.mock('@/components/dialogs/MacroPromptButtonGroup.vue', () => ({
    default: {
        name: 'MacroPromptButtonGroup',
        props: ['groupIndex', 'children'],
        template: '<div class="macro-btn-group" />',
    },
}))

vi.mock('@/components/dialogs/MacroPromptFooterButton.vue', () => ({
    default: { name: 'MacroPromptFooterButton', props: ['event'], template: '<div class="macro-footer-btn" />' },
}))

vi.mock('vuetify/components', () => ({
    VDialog: {
        name: 'VDialog',
        props: { modelValue: Boolean, width: [String, Number], persistent: Boolean, fullscreen: Boolean },
        template: '<div class="v-dialog" v-if="modelValue"><slot /></div>',
    },
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VCardActions: { name: 'VCardActions', template: '<div class="v-card-actions"><slot /></div>' },
    VBtn: {
        name: 'VBtn',
        props: { icon: [String, Boolean] },
        template: '<button @click="$emit(\'click\')"><slot /></button>',
    },
    VIcon: { name: 'VIcon', props: { icon: String }, template: '<i><slot /></i>' },
    VSpacer: { name: 'VSpacer', template: '<span />' },
}))

function makeStore(events: any[] = []) {
    return createStore({
        state: {
            server: { events, klippy_connected: true, klippy_state: 'ready' },
        },
        actions: {
            'server/addEvent': vi.fn(),
        },
    })
}

function makeEvent(date: Date, message: string, type = 'action'): any {
    return { date, message, type }
}

describe('TheMacroPrompt.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('mounts without crashing', () => {
        const wrapper = mount(TheMacroPrompt, { global: { plugins: [makeStore(), i18n] } })
        expect(wrapper.exists()).toBe(true)
    })

    it('dialog is hidden when no prompt events', () => {
        const wrapper = mount(TheMacroPrompt, { global: { plugins: [makeStore([]), i18n] } })
        expect(wrapper.find('.v-dialog').exists()).toBe(false)
    })

    it('dialog is hidden with non-prompt events', () => {
        const events = [makeEvent(new Date(), 'some other message')]
        const wrapper = mount(TheMacroPrompt, { global: { plugins: [makeStore(events), i18n] } })
        expect(wrapper.find('.v-dialog').exists()).toBe(false)
    })

    it('shows dialog when prompt begin+text+show events exist', () => {
        const now = new Date()
        const events = [
            makeEvent(new Date(now.getTime() - 3000), '// action:prompt_begin Test prompt'),
            makeEvent(new Date(now.getTime() - 2000), '// action:prompt_text Some content'),
            makeEvent(new Date(now.getTime() - 1000), '// action:prompt_show'),
        ]
        const wrapper = mount(TheMacroPrompt, { global: { plugins: [makeStore(events), i18n] } })
        // activePromptContent filters to only (text, button, button_group_*)
        // With a 'text' event between begin and show, the dialog should appear
        expect(wrapper.find('.v-dialog').exists()).toBe(true)
    })

    it('shows prompt headline in dialog', () => {
        const now = new Date()
        const events = [
            makeEvent(new Date(now.getTime() - 3000), '// action:prompt_begin Test headline'),
            makeEvent(new Date(now.getTime() - 2000), '// action:prompt_text Some content'),
            makeEvent(new Date(now.getTime() - 1000), '// action:prompt_show'),
        ]
        const wrapper = mount(TheMacroPrompt, { global: { plugins: [makeStore(events), i18n] } })
        expect(wrapper.text()).toContain('Test headline')
    })

    it('hides dialog when prompt_end event is after prompt_show', () => {
        const now = new Date()
        const events = [
            makeEvent(new Date(now.getTime() - 4000), '// action:prompt_begin Test'),
            makeEvent(new Date(now.getTime() - 3000), '// action:prompt_text Some content'),
            makeEvent(new Date(now.getTime() - 2000), '// action:prompt_show'),
            makeEvent(new Date(now.getTime() - 1000), '// action:prompt_end'),
        ]
        const wrapper = mount(TheMacroPrompt, { global: { plugins: [makeStore(events), i18n] } })
        expect(wrapper.find('.v-dialog').exists()).toBe(false)
    })

    it('renders macro-text component for text events', () => {
        const now = new Date()
        const events = [
            makeEvent(new Date(now.getTime() - 3000), '// action:prompt_begin Test'),
            makeEvent(new Date(now.getTime() - 2000), '// action:prompt_text Some info text'),
            makeEvent(new Date(now.getTime() - 1000), '// action:prompt_show'),
        ]
        const wrapper = mount(TheMacroPrompt, { global: { plugins: [makeStore(events), i18n] } })
        expect(wrapper.find('.v-dialog').exists()).toBe(true)
        expect(wrapper.find('.macro-text').exists()).toBe(true)
        expect(wrapper.text()).toContain('Some info text')
    })

    it('renders macro-btn-group for button_group events', () => {
        const now = new Date()
        const events = [
            makeEvent(new Date(now.getTime() - 5000), '// action:prompt_begin Test'),
            makeEvent(new Date(now.getTime() - 4000), '// action:prompt_button_group_start'),
            makeEvent(new Date(now.getTime() - 3000), '// action:prompt_button Yes'),
            makeEvent(new Date(now.getTime() - 2000), '// action:prompt_button_group_end'),
            makeEvent(new Date(now.getTime() - 1000), '// action:prompt_show'),
        ]
        const wrapper = mount(TheMacroPrompt, { global: { plugins: [makeStore(events), i18n] } })
        expect(wrapper.find('.macro-btn-group').exists()).toBe(true)
    })

    it('renders footer buttons', () => {
        const now = new Date()
        const events = [
            makeEvent(new Date(now.getTime() - 4000), '// action:prompt_begin Test'),
            makeEvent(new Date(now.getTime() - 3000), '// action:prompt_text Info'),
            makeEvent(new Date(now.getTime() - 2000), '// action:prompt_footer_button Cancel'),
            makeEvent(new Date(now.getTime() - 1000), '// action:prompt_show'),
        ]
        const wrapper = mount(TheMacroPrompt, { global: { plugins: [makeStore(events), i18n] } })
        expect(wrapper.find('.macro-footer-btn').exists()).toBe(true)
    })

    it('calls closePrompt and dispatches server/addEvent on close', async () => {
        const dispatchSpy = vi.fn()
        const now = new Date()
        const events = [
            makeEvent(new Date(now.getTime() - 3000), '// action:prompt_begin Test'),
            makeEvent(new Date(now.getTime() - 2000), '// action:prompt_text Info'),
            makeEvent(new Date(now.getTime() - 1000), '// action:prompt_show'),
        ]
        const store = createStore({
            state: { server: { events, klippy_connected: true, klippy_state: 'ready' } },
            actions: { 'server/addEvent': dispatchSpy },
        })
        const wrapper = mount(TheMacroPrompt, { global: { plugins: [store, i18n] } })
        expect(wrapper.find('.v-dialog').exists()).toBe(true)
        const closeBtn = wrapper.find('button')
        await closeBtn.trigger('click')
        expect(dispatchSpy).toHaveBeenCalled()
    })
})

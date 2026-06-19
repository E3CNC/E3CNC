import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { ref } from 'vue'
import CommandHelpModal from '@/components/console/CommandHelpModal.vue'

// ── Mock @mdi/js icons ──
vi.mock('@mdi/js', () => ({
    mdiHelp: 'mdiHelp',
    mdiCloseThick: 'mdiCloseThick',
}))

// ── Mock useBase (for isMobile) ──
const mockIsMobile = ref(false)

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        isMobile: mockIsMobile,
    }),
}))

// ── Stub child components (avoid TypeScript compilation issues) ──
vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: ['title', 'icon', 'cardClass', 'marginBottom'],
        template: '<div class="panel-stub"><slot name="buttons" /><slot /></div>',
    },
}))

vi.mock('@/components/console/CommandHelpModalEntry.vue', () => ({
    default: {
        name: 'CommandHelpModalEntry',
        props: ['command'],
        template: '<div class="command-help-entry-stub" @click="$emit(\'click-on-command\', command)">{{ command }}</div>',
        emits: ['click-on-command'],
    },
}))

vi.mock('overlayscrollbars-vue', () => ({
    OverlayScrollbarsComponent: {
        name: 'OverlayScrollbarsComponent',
        template: '<div class="os-stub"><slot /></div>',
    },
}))

// ── Helper: create store ──
function createStoreWithState(commands: Record<string, any> = {}) {
    return createStore({
        state: {
            printer: {
                gcode: {
                    commands,
                },
            } as any,
        },
    })
}

// ── Tests ──
describe('CommandHelpModal.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockIsMobile.value = false
    })

    // ── Rendering ──
    it('renders activator button when inToolbar is true', () => {
        const store = createStoreWithState()
        const wrapper = shallowMount(CommandHelpModal, {
            props: { inToolbar: true },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-btn': {
                        name: 'VBtn',
                        template: '<button class="v-btn-stub"><slot /></button>',
                    },
                    'v-dialog': {
                        name: 'VDialog',
                        props: ['modelValue'],
                        template: '<div class="v-dialog-stub"><slot name="activator" /><slot v-if="modelValue" /></div>',
                    },
                },
            },
        })

        const btn = wrapper.find('.v-btn-stub')
        expect(btn.exists()).toBe(true)
    })

    it('renders activator button when inToolbar is false', () => {
        const store = createStoreWithState()
        const wrapper = shallowMount(CommandHelpModal, {
            props: { inToolbar: false },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-btn': {
                        name: 'VBtn',
                        template: '<button class="v-btn-stub"><slot /></button>',
                    },
                    'v-dialog': {
                        name: 'VDialog',
                        props: ['modelValue'],
                        template: '<div class="v-dialog-stub"><slot name="activator" /><slot v-if="modelValue" /></div>',
                    },
                },
            },
        })

        const btn = wrapper.find('.v-btn-stub')
        expect(btn.exists()).toBe(true)
    })

    it('renders activator button when no toolbar/isMini props', () => {
        const store = createStoreWithState()
        const wrapper = shallowMount(CommandHelpModal, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-btn': {
                        name: 'VBtn',
                        template: '<button class="v-btn-stub"><slot /></button>',
                    },
                    'v-dialog': {
                        name: 'VDialog',
                        props: ['modelValue'],
                        template: '<div class="v-dialog-stub"><slot name="activator" /><slot v-if="modelValue" /></div>',
                    },
                },
            },
        })

        const btn = wrapper.find('.v-btn-stub')
        expect(btn.exists()).toBe(true)
    })

    // ── Command list filtering ──
    it('shows all commands when search is empty', () => {
        const store = createStoreWithState({
            G28: { help: 'Home all axes' },
            M106: { help: 'Set fan speed' },
            M107: { help: 'Fan off' },
        })
        const wrapper = shallowMount(CommandHelpModal, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-dialog': {
                        name: 'VDialog',
                        template: '<div class="v-dialog-stub"><slot name="activator" /><slot v-if="modelValue" /></div>',
                    },
                },
            },
        })

        // Open the dialog
        wrapper.vm.isOpen = true
        wrapper.vm.$forceUpdate()
        wrapper.vm.$nextTick()

        // Check computed property directly
        const helplistFiltered = wrapper.vm.helplistFiltered
        expect(helplistFiltered).toHaveLength(3)
        expect(helplistFiltered).toContain('G28')
        expect(helplistFiltered).toContain('M106')
        expect(helplistFiltered).toContain('M107')
    })

    it('filters commands based on search text', async () => {
        const store = createStoreWithState({
            G28: { help: 'Home all axes' },
            M106: { help: 'Set fan speed' },
            M107: { help: 'Fan off' },
        })
        const wrapper = shallowMount(CommandHelpModal, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-dialog': {
                        name: 'VDialog',
                        template: '<div class="v-dialog-stub"><slot name="activator" /><slot v-if="modelValue" /></div>',
                    },
                },
            },
        })

        wrapper.vm.isOpen = true
        wrapper.vm.cmdListSearch = 'M1'
        await wrapper.vm.$nextTick()

        const filtered = wrapper.vm.helplistFiltered
        expect(filtered).toHaveLength(2)
        expect(filtered).toEqual(['M106', 'M107'])
    })

    it('filters commands case-insensitively', async () => {
        const store = createStoreWithState({
            G28: { help: 'Home all axes' },
            M106: { help: 'Set fan speed' },
        })
        const wrapper = shallowMount(CommandHelpModal, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-dialog': {
                        name: 'VDialog',
                        template: '<div class="v-dialog-stub"><slot name="activator" /><slot v-if="modelValue" /></div>',
                    },
                },
            },
        })

        wrapper.vm.isOpen = true
        wrapper.vm.cmdListSearch = 'g28'
        await wrapper.vm.$nextTick()

        const filtered = wrapper.vm.helplistFiltered
        expect(filtered).toHaveLength(1)
        expect(filtered).toContain('G28')
    })

    it('shows empty list when no commands match filter', async () => {
        const store = createStoreWithState({
            G28: { help: 'Home all axes' },
        })
        const wrapper = shallowMount(CommandHelpModal, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-dialog': {
                        name: 'VDialog',
                        template: '<div class="v-dialog-stub"><slot name="activator" /><slot v-if="modelValue" /></div>',
                    },
                },
            },
        })

        wrapper.vm.isOpen = true
        wrapper.vm.cmdListSearch = 'ZZZ_NEVER'
        await wrapper.vm.$nextTick()

        expect(wrapper.vm.helplistFiltered).toHaveLength(0)
    })

    it('sorts commands alphabetically', () => {
        const store = createStoreWithState({
            M107: { help: 'Fan off' },
            G28: { help: 'Home all axes' },
            M106: { help: 'Set fan speed' },
        })
        const wrapper = shallowMount(CommandHelpModal, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-dialog': {
                        name: 'VDialog',
                        template: '<div class="v-dialog-stub"><slot name="activator" /><slot v-if="modelValue" /></div>',
                    },
                },
            },
        })

        wrapper.vm.isOpen = true
        wrapper.vm.$nextTick()

        const filtered = wrapper.vm.helplistFiltered
        expect(filtered[0]).toBe('G28')
        expect(filtered[1]).toBe('M106')
        expect(filtered[2]).toBe('M107')
    })

    // ── Search clear on close ──
    it('clears search text when dialog is closed', async () => {
        const store = createStoreWithState({ G28: { help: 'Home' } })
        const wrapper = shallowMount(CommandHelpModal, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-dialog': {
                        name: 'VDialog',
                        template: '<div class="v-dialog-stub"><slot name="activator" /><slot v-if="modelValue" /></div>',
                    },
                },
            },
        })

        wrapper.vm.isOpen = true
        wrapper.vm.cmdListSearch = 'G28'
        await wrapper.vm.$nextTick()

        // Close
        wrapper.vm.isOpen = false
        await wrapper.vm.$nextTick()

        expect(wrapper.vm.cmdListSearch).toBe('')
    })

    it('does not clear search when dialog is opened (only on close)', async () => {
        const store = createStoreWithState({ G28: { help: 'Home' } })
        const wrapper = shallowMount(CommandHelpModal, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-dialog': {
                        name: 'VDialog',
                        template: '<div class="v-dialog-stub"><slot name="activator" /><slot v-if="modelValue" /></div>',
                    },
                },
            },
        })

        wrapper.vm.isOpen = true
        wrapper.vm.cmdListSearch = 'G28'
        await wrapper.vm.$nextTick()

        // Setting isOpen to true again should NOT clear search
        wrapper.vm.isOpen = true
        await wrapper.vm.$nextTick()

        expect(wrapper.vm.cmdListSearch).toBe('G28')
    })

    // ── onCommand emit ──
    it('emits onCommand and closes dialog when a command is clicked', async () => {
        const store = createStoreWithState({ G28: { help: 'Home' } })
        const wrapper = shallowMount(CommandHelpModal, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-dialog': {
                        name: 'VDialog',
                        template: '<div class="v-dialog-stub"><slot name="activator" /><slot v-if="modelValue" /></div>',
                    },
                },
            },
        })

        wrapper.vm.isOpen = true
        await wrapper.vm.$nextTick()

        // Call onCommand directly
        wrapper.vm.onCommand('G28')
        await wrapper.vm.$nextTick()

        expect(wrapper.emitted('onCommand')).toBeTruthy()
        expect(wrapper.emitted('onCommand')![0]).toEqual(['G28'])
        expect(wrapper.vm.isOpen).toBe(false)
    })

    // ── Mobile fullscreen ──
    it('passes fullscreen prop when isMobile is true', () => {
        mockIsMobile.value = true

        const store = createStoreWithState()
        const wrapper = shallowMount(CommandHelpModal, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-dialog': {
                        name: 'VDialog',
                        props: ['modelValue', 'fullscreen'],
                        template: '<div class="v-dialog-stub" :data-fullscreen="fullscreen"><slot name="activator" /><slot v-if="modelValue" /></div>',
                    },
                    'v-btn': {
                        name: 'VBtn',
                        template: '<button class="v-btn-stub"><slot /></button>',
                    },
                },
            },
        })

        const dialog = wrapper.find('.v-dialog-stub')
        expect(dialog.attributes('data-fullscreen')).toBe('true')
    })

    // ── Edge cases ──
    it('handles empty commands object gracefully', () => {
        const store = createStoreWithState({})
        const wrapper = shallowMount(CommandHelpModal, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-dialog': {
                        name: 'VDialog',
                        template: '<div class="v-dialog-stub"><slot name="activator" /><slot v-if="modelValue" /></div>',
                    },
                },
            },
        })

        wrapper.vm.isOpen = true
        expect(wrapper.vm.helplistFiltered).toHaveLength(0)
    })

    it('handles null commands gracefully', () => {
        const store = createStoreWithState(null as any)
        const wrapper = shallowMount(CommandHelpModal, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-dialog': {
                        name: 'VDialog',
                        template: '<div class="v-dialog-stub"><slot name="activator" /><slot v-if="modelValue" /></div>',
                    },
                },
            },
        })

        wrapper.vm.isOpen = true
        expect(wrapper.vm.helplistFiltered).toHaveLength(0)
    })

    it('does not crash when printer.gcode is undefined', () => {
        const store = createStore({
            state: {
                printer: {} as any,
            },
        })
        const wrapper = shallowMount(CommandHelpModal, {
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
                stubs: {
                    'v-dialog': {
                        name: 'VDialog',
                        template: '<div class="v-dialog-stub"><slot name="activator" /><slot v-if="modelValue" /></div>',
                    },
                },
            },
        })

        wrapper.vm.isOpen = true
        expect(wrapper.vm.helplistFiltered).toHaveLength(0)
    })
})

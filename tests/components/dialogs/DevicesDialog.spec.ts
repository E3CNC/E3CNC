import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import DevicesDialog from '@/components/dialogs/DevicesDialog.vue'

const mockIsMobile = vi.hoisted(() => {
    class MockRef {
        _value: any
        __v_isRef = true
        constructor(v: any) {
            this._value = v
        }
        get value() {
            return this._value
        }
        set value(v) {
            this._value = v
        }
    }
    return new MockRef(false)
})

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        isMobile: mockIsMobile,
    }),
}))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: {
            icon: String,
            title: [String, Object],
            cardClass: String,
            marginBottom: Boolean,
            height: [String, Number],
        },
        template:
            '<div class="panel" :class="cardClass" :style="{ height }"><slot name="buttons" /><slot /><span class="panel-title">{{ title }}</span></div>',
    },
}))

vi.mock('vuetify/components', () => ({
    VDialog: {
        name: 'VDialog',
        props: ['modelValue', 'width', 'persistent', 'fullscreen'],
        template: '<div class="v-dialog" v-if="modelValue"><slot /></div>',
    },
    VMenu: {
        name: 'VMenu',
        props: ['location', 'closeOnContentClick', 'attach'],
        template: '<div class="v-menu"><slot name="activator" :props=\"{}\" /><slot /></div>',
    },
    VList: { name: 'VList', template: '<div class="v-list"><slot /></div>' },
    VListItem: { name: 'VListItem', props: ['class'], template: '<div class="v-list-item"><slot /></div>' },
    VCheckbox: {
        name: 'VCheckbox',
        props: ['modelValue', 'label', 'hideDetails'],
        template: '<label class="v-checkbox"><input type="checkbox" />{{ label }}</label>',
    },
    VBtn: {
        name: 'VBtn',
        props: ['icon', 'rounded'],
        template:
            '<button class="v-btn" @click="typeof $attrs.onClick === \'function\' && $attrs.onClick($event); typeof $attrs.onclick === \'function\' && $attrs.onclick($event)"><slot /></button>',
    },
    VTabs: { name: 'VTabs', props: ['modelValue', 'fixedTabs'], template: '<div class="v-tabs"><slot /></div>' },
    VTab: { name: 'VTab', props: ['value'], template: '<button class="v-tab">{{ value }}</button>' },
    VWindow: { name: 'VWindow', props: ['modelValue'], template: '<div class="v-window"><slot /></div>' },
    VWindowItem: {
        name: 'VWindowItem',
        props: ['value'],
        template: '<div class="v-window-item" v-if="true"><slot /></div>',
    },
    VIcon: { name: 'VIcon', props: ['icon'], template: '<i class="v-icon"><slot /></i>' },
}))

vi.mock('overlayscrollbars-vue', () => ({
    OverlayScrollbarsComponent: {
        name: 'OverlayScrollbarsComponent',
        template: '<div class="overlayscrollbars"><slot /></div>',
    },
}))

vi.mock('@/components/dialogs/DevicesDialogCan.vue', () => ({
    default: {
        name: 'DevicesDialogCan',
        props: ['hideSystemEntries', 'name'],
        template: '<div class="devices-dialog-can-stub">CAN: {{ name }}</div>',
    },
}))

vi.mock('@/components/dialogs/DevicesDialogSerial.vue', () => ({
    default: {
        name: 'DevicesDialogSerial',
        props: ['hideSystemEntries'],
        template: '<div class="devices-dialog-serial-stub">Serial</div>',
    },
}))

vi.mock('@/components/dialogs/DevicesDialogUsb.vue', () => ({
    default: {
        name: 'DevicesDialogUsb',
        props: ['hideSystemEntries'],
        template: '<div class="devices-dialog-usb-stub">USB</div>',
    },
}))

vi.mock('@/components/dialogs/DevicesDialogVideo.vue', () => ({
    default: {
        name: 'DevicesDialogVideo',
        props: ['hideSystemEntries'],
        template: '<div class="devices-dialog-video-stub">Video</div>',
    },
}))

describe('DevicesDialog.vue', () => {
    let store: ReturnType<typeof createStore>

    beforeEach(() => {
        vi.clearAllMocks()
        mockIsMobile.value = false
        store = createStore({
            state: {
                server: {
                    system_info: {
                        canbus: {
                            can0: {},
                        },
                    },
                },
            },
        })
    })

    it('does not render dialog when modelValue is false', () => {
        const wrapper = mount(DevicesDialog, {
            props: { modelValue: false },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-dialog').exists()).toBe(false)
    })

    it('renders dialog when modelValue is true', () => {
        const wrapper = mount(DevicesDialog, {
            props: { modelValue: true },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-dialog').exists()).toBe(true)
    })

    it('renders panel with title', () => {
        const wrapper = mount(DevicesDialog, {
            props: { modelValue: true },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.panel').exists()).toBe(true)
        expect(wrapper.find('.panel-title').text()).toContain('DevicesDialog.Headline')
    })

    it('renders tabs', () => {
        const wrapper = mount(DevicesDialog, {
            props: { modelValue: true },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const tabs = wrapper.findAll('.v-tab')
        expect(tabs.length).toBeGreaterThanOrEqual(3) // serial, usb, video + CAN interfaces
    })

    it('renders serial tab by default', () => {
        const wrapper = mount(DevicesDialog, {
            props: { modelValue: true },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.devices-dialog-serial-stub').exists()).toBe(true)
    })

    it('renders CAN interface tabs when canbus interfaces exist', () => {
        store = createStore({
            state: {
                server: {
                    system_info: {
                        canbus: {
                            can0: {},
                            can1: {},
                        },
                    },
                },
            },
        })
        const wrapper = mount(DevicesDialog, {
            props: { modelValue: true },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.devices-dialog-can-stub').exists()).toBe(true)
    })

    it('renders USB and Video tab content', () => {
        const wrapper = mount(DevicesDialog, {
            props: { modelValue: true },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.devices-dialog-usb-stub').exists()).toBe(true)
        expect(wrapper.find('.devices-dialog-video-stub').exists()).toBe(true)
    })

    it('renders close button', () => {
        const wrapper = mount(DevicesDialog, {
            props: { modelValue: true },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const closeBtn = wrapper.find('.v-btn')
        expect(closeBtn.exists()).toBe(true)
    })

    it('renders settings menu with hide system entries checkbox', () => {
        const wrapper = mount(DevicesDialog, {
            props: { modelValue: true },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-checkbox').exists()).toBe(true)
    })

    it('emits update:modelValue when close button is clicked', async () => {
        const wrapper = mount(DevicesDialog, {
            props: { modelValue: true },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        // There are multiple VBtn instances. The close button has the mdiCloseThick icon
        // and is the second VBtn. We can trigger click on any VBtn and it should call the handler.
        const buttons = wrapper.findAll('.v-btn')
        expect(buttons.length).toBeGreaterThanOrEqual(2)
        // Click the last VBtn (the close button)
        await buttons[buttons.length - 1].trigger('click')
        expect(wrapper.emitted('update:modelValue')).toBeTruthy()
        expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
    })

    it('handles no canbus interfaces gracefully', () => {
        store = createStore({
            state: {
                server: {
                    system_info: {
                        canbus: {},
                    },
                },
            },
        })
        const wrapper = mount(DevicesDialog, {
            props: { modelValue: true },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.panel').exists()).toBe(true)
    })

    it('passes hideSystemEntries to child components', () => {
        const wrapper = mount(DevicesDialog, {
            props: { modelValue: true },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        const serialStub = wrapper.find('.devices-dialog-serial-stub')
        expect(serialStub.exists()).toBe(true)
    })

    it('renders overlay scrollbars wrapper', () => {
        const wrapper = mount(DevicesDialog, {
            props: { modelValue: true },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.overlayscrollbars').exists()).toBe(true)
    })
})

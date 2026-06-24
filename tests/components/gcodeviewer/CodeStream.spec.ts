import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CodeStream from '@/components/gcodeviewer/CodeStream.vue'

// Use vi.hoisted for code that must execute before vi.mock factories
const mockDispatch = vi.hoisted(() => vi.fn())
const mockLineAt = vi.hoisted(() => vi.fn())
const mockContentDOM = vi.hoisted(() => ({ blur: vi.fn() }))
const mockEditorViewFactory = vi.hoisted(() =>
    vi.fn().mockImplementation(() => ({
        state: {
            doc: {
                lineAt: mockLineAt,
                length: 0,
            },
            selection: {
                ranges: [{ from: 0 }],
            },
        },
        dispatch: mockDispatch,
        contentDOM: mockContentDOM,
        destroy: vi.fn(),
    }))
)

vi.mock('codemirror', () => ({
    EditorView: mockEditorViewFactory,
    basicSetup: {},
}))

vi.mock('@codemirror/state', () => ({
    EditorState: {
        readOnly: { of: vi.fn() },
    },
}))

describe('CodeStream.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crashing', () => {
        const wrapper = mount(CodeStream, {
            props: {
                document: 'G1 X0 Y0\nG1 X100 Y100',
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders the codeview div container', () => {
        const wrapper = mount(CodeStream, {
            props: {
                document: 'G1 X0 Y0',
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.codeview').exists()).toBe(true)
    })

    it('renders with empty document', () => {
        const wrapper = mount(CodeStream, {
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders with shown prop', () => {
        const wrapper = mount(CodeStream, {
            props: {
                document: 'G1 X0 Y0',
                shown: true,
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders with isSimulating prop', () => {
        const wrapper = mount(CodeStream, {
            props: {
                document: 'G1 X0 Y0',
                isSimulating: true,
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders with currentline prop', () => {
        const wrapper = mount(CodeStream, {
            props: {
                document: 'G1 X0 Y0\nG1 X100 Y100',
                currentline: 5,
            },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.exists()).toBe(true)
    })
})

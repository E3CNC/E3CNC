import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { useTheme } from '@/composables/useTheme'

let isDark = true

vi.mock('vuetify', () => ({
    useTheme: () => ({
        global: {
            current: computed(() => ({ dark: isDark })),
        },
    }),
}))

describe('useTheme', () => {
    let store: ReturnType<typeof createStore>

    beforeEach(() => {
        isDark = true
        store = createStore({
            state: {
                gui: {
                    uiSettings: {
                        mode: 'dark',
                    },
                },
                files: {},
            },
            getters: {
                'gui/theme': () => 'mainsail',
                'gui/getTheme': () => ({
                    sidebarBackground: { show: true, light: true },
                    logo: { show: true, light: true },
                    mainBackground: { show: true, light: true },
                    css: true,
                }),
                'files/getSidebarLogo': () => '',
                'files/getMainBackground': () => '',
            },
        })
    })

    function mountComposable() {
        let result: any
        const TestComponent = defineComponent({
            setup() {
                result = useTheme()
                return () => h('div')
            },
        })

        mount(TestComponent, {
            global: { plugins: [store] },
        })

        return result
    }

    it('returns dark foreground and background colors', () => {
        const theme = mountComposable()
        expect(theme.fgColor()).toBe('rgba(255, 255, 255, 1)')
        expect(theme.bgColor()).toBe('rgba(0, 0, 0, 1)')
    })

    it('returns light colors when theme is light', () => {
        isDark = false
        const theme = mountComposable()
        expect(theme.fgColor(0.5)).toBe('rgba(0, 0, 0, 0.5)')
        expect(theme.bgColor(0.5)).toBe('rgba(255, 255, 255, 0.5)')
    })

    it('derives theme-related computed values', () => {
        const theme = mountComposable()
        expect(theme.themeName.value).toBe('mainsail')
        expect(theme.themeMode.value).toBe('dark')
        expect(theme.machineButtonCol.value).toBe('#424242')
        expect(theme.progressBarColor.value).toBe('white')
        expect(theme.sidebarBgImage.value).toContain('/img/themes/sidebarBackground-mainsail.png')
        expect(theme.sidebarLogo.value).toBe('')
        expect(theme.mainBgImage.value).toBe('')
        expect(theme.themeCss.value).toBe('/css/themes/mainsail.css')
    })

    it('returns fallback images when theme assets are disabled', () => {
        store = createStore({
            state: {
                gui: {
                    uiSettings: {
                        mode: 'light',
                    },
                },
            },
            getters: {
                'gui/theme': () => 'other',
                'gui/getTheme': () => ({
                    sidebarBackground: { show: false },
                    logo: { show: false },
                    mainBackground: { show: false },
                    css: false,
                }),
                'files/getSidebarLogo': () => '',
                'files/getMainBackground': () => null,
            },
        })

        const theme = mountComposable()
        expect(theme.sidebarBgImage.value).toBe('/img/sidebar-background.svg')
        expect(theme.sidebarLogo.value).toBe('')
        expect(theme.mainBgImage.value).toBeNull()
        expect(theme.themeCss.value).toBeNull()
    })
})

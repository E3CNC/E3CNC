import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { useSettingsDatabase } from '@/composables/useSettingsDatabase'

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        apiUrl: computed(() => 'http://localhost:8080'),
    }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

describe('useSettingsDatabase', () => {
    let store: any

    beforeEach(() => {
        store = createStore({
            state: {
                socket: {},
            },
            getters: {},
        })
    })

    function mountComposable() {
        let result: any
        const TestComponent = defineComponent({
            setup() {
                result = useSettingsDatabase()
                return () => h('div')
            },
        })

        mount(TestComponent, {
            global: { plugins: [store] },
        })

        return result
    }

    it('returns available settings namespaces', () => {
        const db = mountComposable()
        expect(db.availableKeys.value.map((entry: any) => entry.value)).toContain('general')
        expect(db.availableKeys.value.map((entry: any) => entry.value)).toContain('timelapse')
    })

    it('sorts namespaces with general first', () => {
        const db = mountComposable()
        const sorted = [
            { value: 'timelapse', label: 'Timelapse' },
            { value: 'general', label: 'General' },
        ].sort(db.sortNamespaces)

        expect(sorted[0].value).toBe('general')
    })

    it('sortNamespaces places general first even when it is second arg', () => {
        const db = mountComposable()
        const sorted = [
            { value: 'general', label: 'General' },
            { value: 'webcams', label: 'Webcams' },
        ].sort(db.sortNamespaces)

        expect(sorted[0].value).toBe('general')
    })

    it('sortNamespaces returns 0 for equal labels', () => {
        const db = mountComposable()
        const result = db.sortNamespaces({ value: 'a', label: 'test' }, { value: 'b', label: 'test' })
        expect(result).toBe(0)
    })

    it('sortNamespaces returns -1 when a < b', () => {
        const db = mountComposable()
        const result = db.sortNamespaces({ value: 'a', label: 'apple' }, { value: 'b', label: 'banana' })
        expect(result).toBe(-1)
    })

    it('loads backupable namespaces from the API', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                json: async () => ({ result: { namespaces: ['mainsail', 'maintenance', 'webcams'] } }),
            })
            .mockResolvedValueOnce({
                json: async () => ({ result: { value: { general: {}, timelapse: {}, initVersion: {} } } }),
            })

        global.fetch = fetchMock

        const db = mountComposable()
        const namespaces = await db.loadBackupableNamespaces()

        expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/server/database/list')
        expect(namespaces.map((entry: any) => entry.value)).toEqual(['general', 'timelapse', 'maintenance', 'webcams'])
    })
})

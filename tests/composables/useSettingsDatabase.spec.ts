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

    it('loads backupable namespaces from the API', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ json: async () => ({ result: { namespaces: ['mainsail', 'maintenance', 'webcams'] } }) })
            .mockResolvedValueOnce({ json: async () => ({ result: { value: { general: {}, timelapse: {}, initVersion: {} } } }) })

        // @ts-expect-error test override
        global.fetch = fetchMock

        const db = mountComposable()
        const namespaces = await db.loadBackupableNamespaces()

        expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/server/database/list')
        expect(namespaces.map((entry: any) => entry.value)).toEqual(['general', 'timelapse', 'maintenance', 'webcams'])
    })
})

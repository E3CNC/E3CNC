import { beforeEach, describe, expect, it } from 'vitest'
import { computed, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { useHistory } from '@/composables/useHistory'

describe('useHistory', () => {
    let store: ReturnType<typeof createStore>

    beforeEach(() => {
        store = createStore({
            state: {
                server: {
                    history: {
                        jobs: [
                            { job_id: '1', status: 'completed', type: 'job' },
                            { job_id: '2', status: 'failed', type: 'job' },
                            { job_id: 'm1', status: 'done', type: 'maintenance' },
                        ],
                    },
                    config: {
                        config: {
                            'sensor test': {
                                history_field_temp: {
                                    desc: 'Temp',
                                    units: 'C',
                                    parameter: 'temperature',
                                },
                            },
                        },
                    },
                },
                gui: {
                    view: {
                        history: {
                            hidePrintStatus: ['failed'],
                            selectedJobs: [
                                { job_id: '1', type: 'job', status: 'completed' },
                                { job_id: 'x', type: 'maintenance', status: 'done' },
                            ],
                        },
                    },
                },
            },
            getters: {},
        })
    })

    function mountComposable() {
        let result: any
        const TestComponent = defineComponent({
            setup() {
                result = useHistory()
                return () => h('div')
            },
        })

        mount(TestComponent, {
            global: { plugins: [store] },
        })

        return result
    }

    it('exposes filtered jobs and history fields', () => {
        const history = mountComposable()

        expect(history.hidePrintStatus.value).toEqual(['failed'])
        expect(history.allJobs.value).toHaveLength(3)
        expect(history.jobs.value).toHaveLength(2)
        expect(history.selectedJobs.value).toHaveLength(1)
        expect(history.moonrakerHistoryFields.value).toEqual([
            {
                desc: 'Temp',
                unit: 'C',
                provider: 'sensor test',
                parameter: 'temperature',
                name: 'history_field_temp',
            },
        ])
    })
})

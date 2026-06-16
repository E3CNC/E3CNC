import { describe, it, expect, vi } from 'vitest'
import { useTimelapse } from '@/composables/useTimelapse'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'

function mountComposable(timelapseState: Record<string, any> = {}) {
    const store = createStore({
        state: {
            server: {
                timelapse: {
                    settings: {
                        variable_fps: false,
                        variable_fps_min: 5,
                        variable_fps_max: 60,
                        targetlength: 10,
                        output_framerate: 30,
                        duplicatelastframe: 0,
                    },
                    lastFrame: { count: 0 },
                    ...timelapseState,
                },
            },
        },
    })
    vi.spyOn(store, 'dispatch')

    let result: any
    const TestComponent = {
        template: '<div></div>',
        setup() {
            result = useTimelapse()
            return {}
        },
    }
    mount(TestComponent, { global: { plugins: [store] } })
    return { composable: result, store }
}

describe('useTimelapse', () => {
    it('returns variable_fps from settings', () => {
        const { composable: c } = mountComposable()
        expect(c.variable_fps.value).toBe(false)
    })

    it('setVariable_fps dispatches saveSetting', () => {
        const { composable: c, store } = mountComposable()
        c.setVariable_fps(true)
        expect(store.dispatch).toHaveBeenCalledWith('server/timelapse/saveSetting', { variable_fps: true })
    })

    it('returns variable_fps_min with default 5', () => {
        const { composable: c } = mountComposable({ settings: {} })
        expect(c.variable_fps_min.value).toBe(5)
    })

    it('setVariable_fps_min dispatches saveSetting', () => {
        const { composable: c, store } = mountComposable()
        c.setVariable_fps_min(10)
        expect(store.dispatch).toHaveBeenCalledWith('server/timelapse/saveSetting', { variable_fps_min: 10 })
    })

    it('returns variable_fps_max with default 60', () => {
        const { composable: c } = mountComposable({ settings: {} })
        expect(c.variable_fps_max.value).toBe(60)
    })

    it('setVariable_fps_max dispatches saveSetting', () => {
        const { composable: c, store } = mountComposable()
        c.setVariable_fps_max(30)
        expect(store.dispatch).toHaveBeenCalledWith('server/timelapse/saveSetting', { variable_fps_max: 30 })
    })

    it('returns targetlength with default 10', () => {
        const { composable: c } = mountComposable({ settings: {} })
        expect(c.targetlength.value).toBe(10)
    })

    it('setTargetlength dispatches saveSetting', () => {
        const { composable: c, store } = mountComposable()
        c.setTargetlength(30)
        expect(store.dispatch).toHaveBeenCalledWith('server/timelapse/saveSetting', { targetlength: 30 })
    })

    it('returns output_framerate with default 30', () => {
        const { composable: c } = mountComposable({ settings: {} })
        expect(c.output_framerate.value).toBe(30)
    })

    it('setOutput_framerate dispatches saveSetting', () => {
        const { composable: c, store } = mountComposable()
        c.setOutput_framerate(15)
        expect(store.dispatch).toHaveBeenCalledWith('server/timelapse/saveSetting', { output_framerate: 15 })
    })

    it('returns duplicatelastframe with default 0', () => {
        const { composable: c } = mountComposable({ settings: {} })
        expect(c.duplicatelastframe.value).toBe(0)
    })

    it('setDuplicatelastframe dispatches saveSetting', () => {
        const { composable: c, store } = mountComposable()
        c.setDuplicatelastframe(5)
        expect(store.dispatch).toHaveBeenCalledWith('server/timelapse/saveSetting', { duplicatelastframe: 5 })
    })

    it('framesCount returns lastFrame.count', () => {
        const { composable: c } = mountComposable({ lastFrame: { count: 42 } })
        expect(c.framesCount.value).toBe(42)
    })

    it('framesCount defaults to 0', () => {
        const { composable: c } = mountComposable({ lastFrame: {} })
        expect(c.framesCount.value).toBe(0)
    })

    it('variableTargetFps computes target fps', () => {
        const { composable: c } = mountComposable({
            settings: { variable_fps_min: 10, variable_fps_max: 30, targetlength: 5 },
            lastFrame: { count: 100 },
        })
        expect(c.variableTargetFps.value).toBe(20)
    })

    it('variableTargetFps clamps to min', () => {
        const { composable: c } = mountComposable({
            settings: { variable_fps_min: 50, variable_fps_max: 60, targetlength: 10 },
            lastFrame: { count: 10 },
        })
        expect(c.variableTargetFps.value).toBe(50)
    })

    it('variableTargetFps clamps to max', () => {
        const { composable: c } = mountComposable({
            settings: { variable_fps_min: 5, variable_fps_max: 10, targetlength: 1 },
            lastFrame: { count: 1000 },
        })
        expect(c.variableTargetFps.value).toBe(10)
    })

    it('estimatedVideoLength returns seconds when not variable_fps', () => {
        const { composable: c } = mountComposable({
            settings: { variable_fps: false, output_framerate: 30, duplicatelastframe: 0 },
            lastFrame: { count: 90 },
        })
        expect(c.estimatedVideoLength.value).toBe('3s')
    })

    it('estimatedVideoLength returns minutes when not variable_fps', () => {
        const { composable: c } = mountComposable({
            settings: { variable_fps: false, output_framerate: 30, duplicatelastframe: 0 },
            lastFrame: { count: 3600 },
        })
        expect(c.estimatedVideoLength.value).toBe('2m 0s')
    })

    it('estimatedVideoLength uses variableTargetFps when variable_fps enabled', () => {
        const { composable: c } = mountComposable({
            settings: { variable_fps: true, variable_fps_min: 5, variable_fps_max: 60, targetlength: 10, output_framerate: 30, duplicatelastframe: 0 },
            lastFrame: { count: 300 },
        })
        expect(c.estimatedVideoLength.value).toBe('10s')
    })

    it('estimatedVideoLength uses targetlength floor when variable_fps result is shorter', () => {
        const { composable: c } = mountComposable({
            settings: { variable_fps: true, variable_fps_min: 5, variable_fps_max: 60, targetlength: 20, output_framerate: 30, duplicatelastframe: 0 },
            lastFrame: { count: 10 },
        })
        expect(c.estimatedVideoLength.value).toBe('20s')
    })
})

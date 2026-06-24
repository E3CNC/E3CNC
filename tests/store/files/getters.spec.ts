import { describe, it, expect, vi } from 'vitest'
import { getters } from '@/store/files/getters'

vi.mock('@/store/variables', () => ({
    themeDir: '.theme',
    thumbnailBigMin: 256,
    thumbnailSmallMax: 128,
    thumbnailSmallMin: 32,
    validGcodeExtensions: ['.gcode', '.g', '.gco', '.ufp', '.nc'],
}))

vi.mock('@/plugins/helpers', () => ({
    escapePath: (path: string) => path,
}))

const makeFile = (filename: string, overrides: Record<string, any> = {}): any => ({
    isDirectory: false,
    filename,
    modified: new Date('2024-01-01'),
    size: 1000,
    permissions: 'rw',
    ...overrides,
})

const makeDir = (filename: string, childrens: any[] = [], overrides: Record<string, any> = {}): any => ({
    isDirectory: true,
    filename,
    childrens,
    ...overrides,
})

describe('files getters', () => {
    const baseState = (): any => ({
        filetree: [
            makeDir('gcodes', [
                makeFile('test.gcode', { first_layer_bed_temp: 60 }),
                makeFile('other.gcode'),
                makeDir('subdir', [makeFile('nested.gcode')]),
                makeDir('thumbs'),
                makeFile('.hidden.gcode'),
                makeFile('not-a-gcode.txt'),
            ]),
            makeDir('config', [makeDir('.theme', [makeFile('sidebar-logo.svg')])]),
        ],
        upload: {
            show: false,
            filename: '',
            currentNumber: 0,
            maxNumber: 0,
            cancelTokenSource: null,
            percent: 0,
            speed: 0,
        },
    })

    const rootState = {
        printer: {
            software_version: 'v0.12.0',
            gcode: { commands: {} },
            print_stats: {},
        },
    }

    describe('getDirectory', () => {
        it('finds a directory by path', () => {
            const state = baseState()
            const result = (getters as any).getDirectory(state)('gcodes')
            expect(result.filename).toBe('gcodes')
            expect(result.isDirectory).toBe(true)
        })

        it('finds nested directories', () => {
            const state = baseState()
            const result = (getters as any).getDirectory(state)('gcodes/subdir')
            expect(result.filename).toBe('subdir')
            expect(result.isDirectory).toBe(true)
        })

        it('returns null for non-existent directory', () => {
            const state = baseState()
            const result = (getters as any).getDirectory(state)('nonexistent')
            expect(result).toBeNull()
        })

        it('handles leading/trailing slashes', () => {
            const state = baseState()
            const result = (getters as any).getDirectory(state)('/gcodes/')
            expect(result.filename).toBe('gcodes')
        })
    })

    describe('getFile', () => {
        it('finds a file by full path', () => {
            const state = baseState()
            const getDirectory = (getters as any).getDirectory(state)
            const result = (getters as any).getFile(state, { getDirectory })('gcodes/test.gcode')
            expect(result.filename).toBe('test.gcode')
        })

        it('returns undefined for non-existent file', () => {
            const state = baseState()
            const getDirectory = (getters as any).getDirectory(state)
            const result = (getters as any).getFile(state, { getDirectory })('gcodes/missing.gcode')
            expect(result).toBeUndefined()
        })
    })

    describe('getGcodeFiles', () => {
        const rootGetters = {
            'socket/getUrl': () => '//localhost:8080',
            'server/history/getPrintJobsForGcodes': () => [],
        }

        it('returns all gcode files in flat mode', () => {
            const state = baseState()
            const getDirectory = (getters as any).getDirectory(state)
            const result = (getters as any).getGcodeFiles(
                state,
                { getDirectory },
                rootState,
                rootGetters
            )(null, false, true)
            expect(result.length).toBeGreaterThanOrEqual(2)
            expect(result.some((f: any) => f.filename === 'test.gcode')).toBe(true)
        })

        it('filters out non-gcode and hidden files', () => {
            const state = baseState()
            const getDirectory = (getters as any).getDirectory(state)
            const result = (getters as any).getGcodeFiles(
                state,
                { getDirectory },
                rootState,
                rootGetters
            )(null, false, true)
            expect(result.some((f: any) => f.filename === 'not-a-gcode.txt')).toBe(false)
            expect(result.some((f: any) => f.filename === '.hidden.gcode')).toBe(false)
        })

        it('includes hidden files when boolShowHiddenFiles is true', () => {
            const state = baseState()
            const getDirectory = (getters as any).getDirectory(state)
            const result = (getters as any).getGcodeFiles(
                state,
                { getDirectory },
                rootState,
                rootGetters
            )(null, true, true)
            expect(result.some((f: any) => f.filename === '.hidden.gcode')).toBe(true)
        })
    })

    describe('getThemeFileUrl', () => {
        const rootGetters = {
            'socket/getUrl': () => '//localhost:8080',
        }

        it('returns URL for matching theme file', () => {
            const state = baseState()
            const getDirectory = (getters as any).getDirectory(state)
            const result = (getters as any).getThemeFileUrl(
                state,
                { getDirectory },
                rootState,
                rootGetters
            )('sidebar-logo', ['svg'])
            expect(result).toContain('sidebar-logo.svg')
            expect(result).toContain('/server/files/config/')
        })

        it('returns null for non-existent theme file', () => {
            const state = baseState()
            const getDirectory = (getters as any).getDirectory(state)
            const result = (getters as any).getThemeFileUrl(
                state,
                { getDirectory },
                rootState,
                rootGetters
            )('nonexistent', ['svg'])
            expect(result).toBeNull()
        })
    })

    describe('getSidebarLogo', () => {
        it('returns URL for sidebar logo', () => {
            const state = baseState()
            const getDirectory = (getters as any).getDirectory(state)
            const rootGetters = { 'socket/getUrl': () => '//localhost:8080' }
            const getThemeFileUrl = (getters as any).getThemeFileUrl(state, { getDirectory }, rootState, rootGetters)
            const result = (getters as any).getSidebarLogo(state, { getThemeFileUrl, getDirectory })
            expect(result).toContain('sidebar-logo.svg')
        })
    })

    describe('getDiskUsage', () => {
        it('returns disk usage for a root directory', () => {
            const state = baseState()
            state.filetree = [makeDir('gcodes', [], { disk_usage: { total: 100, used: 50, free: 50 } })]
            const result = (getters as any).getDiskUsage(state)('gcodes')
            expect(result).toEqual({ total: 100, used: 50, free: 50 })
        })

        it('returns null when no disk usage data', () => {
            const state = baseState()
            const result = (getters as any).getDiskUsage(state)('gcodes')
            expect(result).toBeNull()
        })
    })

    describe('checkConfigFile', () => {
        it('returns true when config file exists', () => {
            const state = baseState()
            state.filetree = [makeDir('config', [makeFile('printer.cfg')])]
            const getDirectory = (getters as any).getDirectory(state)
            const result = (getters as any).checkConfigFile(state, { getDirectory })('printer.cfg')
            expect(result).toBe(true)
        })

        it('returns false when config file does not exist', () => {
            const state = baseState()
            state.filetree = [makeDir('config', [])]
            const getDirectory = (getters as any).getDirectory(state)
            const result = (getters as any).checkConfigFile(state, { getDirectory })('missing.cfg')
            expect(result).toBe(false)
        })
    })

    it('getGcodeFiles returns an empty array when the gcodes root is missing', () => {
        const state = { ...baseState(), filetree: [makeDir('config', [])] }
        const getDirectory = (getters as any).getDirectory(state)
        const result = (getters as any).getGcodeFiles(state, { getDirectory }, rootState, {
            'server/history/getPrintJobsForGcodes': () => [],
        })(null, false, true)
        expect(result).toEqual([])
    })

    it('getGcodeFiles builds preheat commands and completed-job metadata', () => {
        const state = baseState()
        const getDirectory = (getters as any).getDirectory(state)
        const result = (getters as any).getGcodeFiles(
            state,
            { getDirectory },
            {
                printer: {
                    gcode: { commands: { M104: true, M140: true } },
                    print_stats: {},
                },
            },
            {
                'server/history/getPrintJobsForGcodes': () => [
                    {
                        status: 'completed',
                        start_time: 20,
                        end_time: 40,
                        filament_used: 12,
                        print_duration: 8,
                        total_duration: 10,
                    },
                    {
                        status: 'printing',
                        start_time: 10,
                        end_time: 0,
                        filament_used: 0,
                        print_duration: 0,
                        total_duration: 0,
                    },
                ],
            }
        )(null, false, true)

        const file = result.find((entry: any) => entry.filename === 'test.gcode')
        expect(file.preheat_gcode).toBe('M140 S60')
        expect(file.count_printed).toBe(1)
        expect(file.last_status).toBe('completed')
        expect(file.last_filament_used).toBe(12)
    })

    it('getGcodeFiles can hide completed files', () => {
        const state = baseState()
        const getDirectory = (getters as any).getDirectory(state)
        const result = (getters as any).getGcodeFiles(
            state,
            { getDirectory },
            rootState,
            {
                'server/history/getPrintJobsForGcodes': (name: string) =>
                    name === 'test.gcode' ? [{ status: 'completed', start_time: 20, end_time: 30 }] : [],
            }
        )(null, false, false)

        expect(result.some((file: any) => file.filename === 'test.gcode')).toBe(false)
        expect(result.some((file: any) => file.filename === 'other.gcode')).toBe(true)
    })

    it('getAllGcodes delegates to getGcodeFiles', () => {
        const result = (getters as any).getAllGcodes({}, {
            getGcodeFiles: vi.fn(() => ['a.gcode', 'b.gcode']),
        })
        expect(result).toEqual(['a.gcode', 'b.gcode'])
    })

    it('theme asset getters reuse getThemeFileUrl with the expected filenames', () => {
        const getThemeFileUrl = vi.fn((name: string) => `${name}.url`)

        expect((getters as any).getCustomSidebarBackground({}, { getThemeFileUrl })).toBe('sidebar-background.url')
        expect((getters as any).getMainBackground({}, { getThemeFileUrl })).toBe('main-background.url')
        expect((getters as any).getCustomStylesheet({}, { getThemeFileUrl })).toBe('custom.url')
        expect((getters as any).getCustomNaviPoints({}, { getThemeFileUrl })).toBe('navi.url')
    })

    it('getCustomFavicons duplicates a single available favicon and returns null when none exist', () => {
        const only16 = vi.fn((name: string) => (name === 'favicon-32x32' ? 'icon.png' : null))
        expect((getters as any).getCustomFavicons({}, { getThemeFileUrl: only16 })).toEqual(['icon.png', 'icon.png'])

        const none = vi.fn(() => null)
        expect((getters as any).getCustomFavicons({}, { getThemeFileUrl: none })).toBeNull()
    })

    it('getDiskUsage normalizes leading slashes and nested paths', () => {
        const state = baseState()
        state.filetree = [makeDir('gcodes', [], { disk_usage: { total: 100, used: 50, free: 50 } })]
        expect((getters as any).getDiskUsage(state)('/gcodes/folder/file.gcode')).toEqual({ total: 100, used: 50, free: 50 })
    })

    it('getSmallThumbnail and getBigThumbnail build thumbnail URLs when matching sizes exist', () => {
        const item = makeFile('part.gcode', {
            thumbnails: [
                { width: 64, height: 64, relative_path: 'thumb-small.png' },
                { width: 300, height: 300, relative_path: 'thumb-big.png' },
            ],
        })
        const rootGetters = { 'socket/getUrl': () => 'http://moonraker' }

        const small = (getters as any).getSmallThumbnail({}, {}, {}, rootGetters)(item, 'gcodes/folder')
        const big = (getters as any).getBigThumbnail({}, {}, {}, rootGetters)(item, 'gcodes/folder')

        expect(small).toContain('thumb-small.png')
        expect(big).toContain('thumb-big.png')
    })

    it('getSmallThumbnail and getBigThumbnail return empty strings when no matching thumbnail exists', () => {
        const item = makeFile('part.gcode', { thumbnails: [{ width: 10, height: 10, relative_path: 'tiny.png' }] })
        const rootGetters = { 'socket/getUrl': () => 'http://moonraker' }

        expect((getters as any).getSmallThumbnail({}, {}, {}, rootGetters)(item, 'gcodes')).toBe('')
        expect((getters as any).getBigThumbnail({}, {}, {}, rootGetters)(item, 'gcodes')).toBe('')
    })
})

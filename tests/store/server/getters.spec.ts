/**
 * Tests for src/store/server/getters.ts
 *
 * Covers all getter branches including console events, host stats,
 * config lookup, CPU usage, network interfaces, and throttled state flags.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getters } from '@/store/server/getters'

vi.mock('@/plugins/helpers', () => ({
    formatConsoleMessage: (message: string) => `formatted: ${message}`,
    formatFilesize: (bytes: number) => {
        if (bytes === 0) return '0 B'
        if (bytes < 1024) return `${bytes} B`
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    },
}))

describe('server getters', () => {
    let state: any

    beforeEach(() => {
        state = {
            events: [],
            config: null,
            system_info: null,
            cpu_temp: 0,
            throttled_state: { flags: [] },
            network_stats: {},
            system_cpu_usage: {},
            console_cleared_this_session: false,
        }
    })

    describe('getConsoleEvents', () => {
        it('returns help message (only) when no events', () => {
            const result = (getters as any).getConsoleEvents(state)()
            // Even with empty events, the help message is added (events.length < 20)
            expect(result).toHaveLength(1)
            expect(result[0].message).toContain('HELP')
        })

        it('returns events in reverse order by default, with help message prepended', () => {
            state.events = [
                { date: new Date(100), message: 'first', type: 'response' },
                { date: new Date(200), message: 'second', type: 'response' },
            ]
            const result = (getters as any).getConsoleEvents(state)()
            // 2 events + 1 help message (length < 20)
            expect(result).toHaveLength(3)
            // reversed: second comes first (help message is unshifted, so ends up last after reverse)
            expect(result[0].message).toBe('second')
            expect(result[1].message).toBe('first')
            expect(result[2].message).toContain('HELP')
        })

        it('returns events in forward order when reverse=false, with help message', () => {
            state.events = [
                { date: new Date(100), message: 'first', type: 'response' },
                { date: new Date(200), message: 'second', type: 'response' },
            ]
            const result = (getters as any).getConsoleEvents(state)(false)
            // 2 events + 1 help message, not reversed
            expect(result).toHaveLength(3)
            expect(result[0].message).toContain('HELP') // help message is first (unshifted)
            expect(result[1].message).toBe('first')
            expect(result[2].message).toBe('second')
        })

        it('adds help message when fewer than 20 events and not cleared', () => {
            state.events = [
                { date: new Date(100), message: 'test', type: 'response' },
            ]
            const result = (getters as any).getConsoleEvents(state)()
            expect(result).toHaveLength(2)
            // Help message is unshifted (reversed, so it ends up last)
            expect(result[1].message).toContain('HELP')
        })

        it('does not add help message when console was cleared this session', () => {
            state.events = [
                { date: new Date(100), message: 'test', type: 'response' },
            ]
            state.console_cleared_this_session = true
            const result = (getters as any).getConsoleEvents(state)()
            expect(result).toHaveLength(1)
            expect(result[0].message).toBe('test')
        })

        it('does not add help message when 20+ events', () => {
            state.events = Array.from({ length: 20 }, (_, i) => ({
                date: new Date(i * 100),
                message: `event ${i}`,
                type: 'response',
            }))
            const result = (getters as any).getConsoleEvents(state)()
            expect(result).toHaveLength(20)
            expect(result[0].message).not.toContain('HELP')
        })

        it('adds help message with current date when events array is empty', () => {
            const result = (getters as any).getConsoleEvents(state)()
            expect(result).toHaveLength(1)
            expect(result[0].message).toContain('HELP')
        })

        it('limits events to specified limit', () => {
            state.events = Array.from({ length: 100 }, (_, i) => ({
                date: new Date(i * 100),
                message: `event ${i}`,
                type: 'response',
            }))
            // limit = 10
            const result = (getters as any).getConsoleEvents(state)(true, 10)
            expect(result).toHaveLength(11) // 10 events + 1 help message
            expect(result[0].message).toBe('event 99') // reversed, newest first
        })
    })

    describe('getConfig', () => {
        it('returns config value when section and attribute exist', () => {
            state.config = { config: { server: { host: '0.0.0.0', port: 7125 } } }
            const result = (getters as any).getConfig(state)('server', 'host')
            expect(result).toBe('0.0.0.0')
        })

        it('returns null when section does not exist', () => {
            state.config = { config: { server: { host: '0.0.0.0' } } }
            const result = (getters as any).getConfig(state)('nonexistent', 'host')
            expect(result).toBeNull()
        })

        it('returns null when attribute does not exist in section', () => {
            state.config = { config: { server: { host: '0.0.0.0' } } }
            const result = (getters as any).getConfig(state)('server', 'port')
            expect(result).toBeNull()
        })

        it('returns null when config is null', () => {
            state.config = null
            const result = (getters as any).getConfig(state)('server', 'host')
            expect(result).toBeNull()
        })

        it('returns null when config object has no config key', () => {
            state.config = {}
            const result = (getters as any).getConfig(state)('server', 'host')
            expect(result).toBeNull()
        })
    })

    describe('getHostStats', () => {
        it('returns null when system_info is not in state', () => {
            // Delete system_info key entirely so 'system_info' in state is false
            const stateWithoutSystemInfo = { ...state }
            delete stateWithoutSystemInfo.system_info
            const result = (getters as any).getHostStats(stateWithoutSystemInfo, {}, {}, {})
            expect(result).toBeNull()
        })

        it('returns host stats with system_info present', () => {
            state.system_info = {
                cpu_info: { processor: 'ARM', cpu_desc: 'Cortex A72', bits: '64', cpu_count: 4, total_memory: 4000000 },
                python: { version_string: '3.9.2 (default)' },
                distribution: { name: 'Debian', release_info: { name: 'bullseye', version_id: '11', id: 'debian' } },
            }
            const rootState = {
                printer: {
                    software_version: 'v0.12.0-123-abc-def',
                    system_stats: { sysload: 1.5, memavail: 2000000 },
                },
            }
            const rootGetters = { 'printer/getHostTempSensor': null }

            const result = (getters as any).getHostStats(state, {}, rootState, rootGetters)
            expect(result).not.toBeNull()
            expect(result!.cpuName).toBe('ARM')
            expect(result!.cpuDesc).toBe('Cortex A72')
            expect(result!.bits).toBe('64')
            expect(result!.version).toBe('v0.12.0-123-abc-def')
            expect(result!.os).toBe('Debian')
            expect(result!.release_info).toEqual({ name: 'bullseye', version_id: '11', id: 'debian' })
            expect(result!.load).toBe(1.5)
            expect(result!.loadPercent).toBe(38) // 1.5/4 * 100 = 37.5 -> 38
        })

        it('includes app_name in version when present', () => {
            state.system_info = {
                cpu_info: { processor: 'ARM', cpu_desc: '', bits: '64', cpu_count: 2, total_memory: 2000000 },
                python: { version_string: '3.9' },
                distribution: null,
            }
            const rootState = {
                printer: {
                    software_version: 'v0.12.0',
                    app_name: 'Mainsail',
                    system_stats: { sysload: 0.5, memavail: 1000000 },
                },
            }
            const rootGetters = { 'printer/getHostTempSensor': null }

            const result = (getters as any).getHostStats(state, {}, rootState, rootGetters)
            expect(result!.version).toBe('Mainsail v0.12.0')
        })

        it('handles python version without space (returns empty string)', () => {
            state.system_info = {
                cpu_info: { processor: 'ARM', cpu_desc: '', bits: '64', cpu_count: 2, total_memory: 2000000 },
                python: { version_string: '3.9' }, // No space in version string
                distribution: null,
            }
            const rootState = {
                printer: { system_stats: { sysload: 0.5, memavail: 1000000 } },
            }
            const rootGetters = { 'printer/getHostTempSensor': null }

            const result = (getters as any).getHostStats(state, {}, rootState, rootGetters)
            // indexOf(' ') returns -1, slice(0, 0) = ''
            expect(result!.pythonVersion).toBe('')
        })

        it('sets load progress colors correctly', () => {
            state.system_info = {
                cpu_info: { processor: 'ARM', cpu_desc: '', bits: '64', cpu_count: 1, total_memory: 2000000 },
                python: { version_string: '3.9' },
                distribution: null,
            }
            const rootState = {
                printer: { system_stats: { sysload: 0.96, memavail: 1000000 } },
            }
            const rootGetters = { 'printer/getHostTempSensor': null }

            // load = 0.96, cpuCount = 1, loadPercent = 96 -> error
            const result = (getters as any).getHostStats(state, {}, rootState, rootGetters)
            expect(result!.loadProgressColor).toBe('error')
        })

        it('sets warning load color between 80-95', () => {
            state.system_info = {
                cpu_info: { processor: 'ARM', cpu_desc: '', bits: '64', cpu_count: 1, total_memory: 2000000 },
                python: { version_string: '3.9' },
                distribution: null,
            }
            const rootState = {
                printer: { system_stats: { sysload: 0.85, memavail: 1000000 } },
            }
            const rootGetters = { 'printer/getHostTempSensor': null }

            const result = (getters as any).getHostStats(state, {}, rootState, rootGetters)
            expect(result!.loadProgressColor).toBe('warning')
        })

        it('uses cpu_temp when getHostTempSensor returns null', () => {
            state.system_info = {
                cpu_info: { processor: 'ARM', cpu_desc: '', bits: '64', cpu_count: 2, total_memory: 2000000 },
                python: { version_string: '3.9' },
                distribution: null,
            }
            state.cpu_temp = 55.5
            const rootState = {
                printer: { system_stats: { sysload: 0.5, memavail: 1000000 } },
            }
            const rootGetters = { 'printer/getHostTempSensor': null }

            const result = (getters as any).getHostStats(state, {}, rootState, rootGetters)
            expect(result!.tempSensor.temperature).toBe('56')
            expect(result!.tempSensor.measured_min_temp).toBeNull()
            expect(result!.tempSensor.measured_max_temp).toBeNull()
        })

        it('uses printer getHostTempSensor when available', () => {
            state.system_info = {
                cpu_info: { processor: 'ARM', cpu_desc: '', bits: '64', cpu_count: 2, total_memory: 2000000 },
                python: { version_string: '3.9' },
                distribution: null,
            }
            state.cpu_temp = 55.5
            const rootState = {
                printer: { system_stats: { sysload: 0.5, memavail: 1000000 } },
            }
            const rootGetters = {
                'printer/getHostTempSensor': { temperature: 45, measured_min_temp: 40, measured_max_temp: 50 },
            }

            const result = (getters as any).getHostStats(state, {}, rootState, rootGetters)
            // Should use printer's temp sensor, not cpu_temp
            expect(result!.tempSensor.temperature).toBe(45)
        })

        describe('memory formatting', () => {
            it('formats memory when both avail and total are present', () => {
                state.system_info = {
                    cpu_info: { processor: 'ARM', cpu_desc: '', bits: '64', cpu_count: 2, total_memory: 4000 }, // 4000 KB = ~4 MB
                    python: { version_string: '3.9' },
                    distribution: null,
                }
                const rootState = {
                    printer: { system_stats: { sysload: 0.5, memavail: 2000 } }, // 2000 KB available
                }
                const rootGetters = { 'printer/getHostTempSensor': null }

                const result = (getters as any).getHostStats(state, {}, rootState, rootGetters)
                // memAvail in bytes = 2000 * 1024 = 2048000
                // memTotal in bytes = 4000 * 1024 = 4096000
                // Used = 4096000 - 2048000 = 2048000
                expect(result!.memoryFormat).toContain('MB')
                expect(result!.memUsage).toBeGreaterThan(0)
            })

            it('formats memory when memAvail is 0 but memTotal > 0', () => {
                state.system_info = {
                    cpu_info: { processor: 'ARM', cpu_desc: '', bits: '64', cpu_count: 2, total_memory: 4000 },
                    python: { version_string: '3.9' },
                    distribution: null,
                }
                const rootState = {
                    printer: { system_stats: { sysload: 0.5, memavail: 0 } },
                }
                const rootGetters = { 'printer/getHostTempSensor': null }

                const result = (getters as any).getHostStats(state, {}, rootState, rootGetters)
                // memAvail = 0, so the first branch is skipped (memAvail > 0 is false)
                // Falls to else if (memTotal) -> memTotal = 4000 * 1024 > 0
                expect(result!.memoryFormat).toContain('MB')
                expect(result!.memUsage).toBeNull()
            })

            it('does not set memoryFormat when both are zero', () => {
                state.system_info = {
                    cpu_info: { processor: 'ARM', cpu_desc: '', bits: '64', cpu_count: 2, total_memory: 0 },
                    python: { version_string: '3.9' },
                    distribution: null,
                }
                const rootState = {
                    printer: { system_stats: { sysload: 0.5, memavail: 0 } },
                }
                const rootGetters = { 'printer/getHostTempSensor': null }

                const result = (getters as any).getHostStats(state, {}, rootState, rootGetters)
                expect(result!.memoryFormat).toBeNull()
            })
        })
    })

    describe('getCpuUsage', () => {
        it('returns rounded cpu value when cpu is in system_cpu_usage', () => {
            state.system_cpu_usage = { cpu: 75.6, cpu0: 80.0 }
            const result = (getters as any).getCpuUsage(state)
            expect(result).toBe(76)
        })

        it('returns null when cpu is not in system_cpu_usage', () => {
            state.system_cpu_usage = { cpu0: 80.0 }
            const result = (getters as any).getCpuUsage(state)
            expect(result).toBeNull()
        })

        it('returns null when system_cpu_usage is empty', () => {
            const result = (getters as any).getCpuUsage(state)
            expect(result).toBeNull()
        })
    })

    describe('getNetworkInterfaces', () => {
        it('returns network interfaces excluding loopback', () => {
            state.network_stats = {
                lo: { rx: 0, tx: 0 },
                eth0: { rx: 1000, tx: 500 },
                wlan0: { rx: 2000, tx: 1000 },
            }
            state.system_info = {
                network: {
                    eth0: { mac: 'aa:bb:cc:dd:ee:ff' },
                    wlan0: { mac: '11:22:33:44:55:66' },
                },
            }

            const result = (getters as any).getNetworkInterfaces(state)
            expect(Object.keys(result)).toEqual(['eth0', 'wlan0'])
            expect(result.eth0.details).toEqual({ mac: 'aa:bb:cc:dd:ee:ff' })
        })

        it('includes can interfaces even without network info', () => {
            state.network_stats = {
                can0: { rx: 100, tx: 50 },
            }
            state.system_info = null

            const result = (getters as any).getNetworkInterfaces(state)
            expect(Object.keys(result)).toEqual(['can0'])
        })

        it('excludes interfaces not in system_info.network (non-can)', () => {
            state.network_stats = {
                lo: { rx: 0, tx: 0 },
                docker0: { rx: 100, tx: 50 },
            }
            state.system_info = {
                network: { eth0: {} },
            }

            const result = (getters as any).getNetworkInterfaces(state)
            // docker0 is not in system_info.network, so excluded
            expect(Object.keys(result)).toHaveLength(0)
        })

        it('returns empty object when no network_stats', () => {
            state.network_stats = {}
            const result = (getters as any).getNetworkInterfaces(state)
            expect(result).toEqual({})
        })
    })

    describe('getThrottledStateFlags', () => {
        it('filters out ? flag and normalizes', () => {
            state.throttled_state = {
                flags: ['?', 'Under-Voltage Detected', 'Previously Frequency Capped'],
            }
            const result = (getters as any).getThrottledStateFlags(state)
            expect(result).toEqual(['UnderVoltageDetected', 'PreviouslyFrequencyCapped'])
            // '?' removed, spaces removed, hyphens removed, first letter uppercase
        })

        it('returns empty when no flags', () => {
            state.throttled_state = { flags: [] }
            const result = (getters as any).getThrottledStateFlags(state)
            expect(result).toEqual([])
        })

        it('returns empty when all flags are ?', () => {
            state.throttled_state = { flags: ['?', '?'] }
            const result = (getters as any).getThrottledStateFlags(state)
            expect(result).toEqual([])
        })
    })
})

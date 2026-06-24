/**
 * Tests for src/store/gui/notifications/getters.ts
 *
 * Covers notification aggregation, dismiss filtering, and TMC overheat detection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getters } from '@/store/gui/notifications/getters'
import type { GuiNotificationState } from '@/store/gui/notifications/types'

vi.mock('@/store/variables', () => ({
    minBrowserVersions: [{ name: 'Chrome', version: '90.0.0' }],
}))

vi.mock('@/plugins/i18n', () => ({
    default: {
        global: {
            t: (key: string, params?: Record<string, unknown>) => {
                const map: Record<string, string> = {
                    'App.Notifications.TmcOtFlag': 'TMC Overtemperature',
                    'App.Notifications.TmcOtFlagText': `TMC ${(params as any)?.name} overtemp`,
                    'App.Notifications.TmcOtpwFlag': 'TMC Pre-warning',
                    'App.Notifications.TmcOtpwFlagText': `TMC ${(params as any)?.name} pre-warning`,
                    'App.Notifications.BrowserWarnings.Headline': 'Browser outdated',
                    'App.Notifications.BrowserWarnings.Description': 'Update {name} to {minVersion}',
                    DependencyName: '{name} dependency',
                    DependencyDescription: '{name} v{installedVersion} needs {neededVersion}',
                    'App.Notifications.MoonrakerWarnings.MoonrakerWarning': 'Moonraker Warning',
                    'App.Notifications.MoonrakerWarnings.UnparsedConfigOption': (params: any) => `Unparsed option ${params.option} in [${params.section}]`,
                    'App.Notifications.MoonrakerWarnings.UnparsedConfigSection': (params: any) => `Unparsed section [${params.section}]`,
                    'App.Notifications.KlipperWarnings.KlipperWarning': 'Klipper Warning',
                    'App.Notifications.KlipperWarnings.DeprecatedOptionHeadline': 'Deprecated Option',
                    'App.Notifications.KlipperWarnings.DeprecatedValueHeadline': 'Deprecated Value',
                    'App.Notifications.KlipperWarnings.KlipperRuntimeWarning': 'Runtime Warning',
                    'App.Notifications.KlipperWarnings.DeprecatedOption': (params: any) => `Option ${params.option} is deprecated`,
                    'App.Notifications.KlipperWarnings.DeprecatedValue': (params: any) => `Value ${params.value} is deprecated`,
                    'App.ThrottledStates.TitleUndervoltage': 'Undervoltage Detected',
                    'App.ThrottledStates.DescriptionUndervoltage': 'Voltage issue',
                    'App.ThrottledStates.TitlePreviously frequency capped': 'Frequency Capped Previously',
                    'App.ThrottledStates.DescriptionPreviously frequency capped': 'CPU was throttled',
                    'App.Notifications.MaintenanceReminder': 'Maintenance due',
                    'App.Notifications.MaintenanceReminderText': '{name} is overdue',
                }
                const entry = map[key]
                if (typeof entry === 'function') return entry(params)
                return entry ?? key
            },
        },
    },
}))

describe('gui notification getters', () => {
    const defaultState = (overrides: Partial<GuiNotificationState> = {}): any => ({
        dismiss: [],
        ...overrides,
    })

    it('getDismiss filters out expired time-based dismisses', () => {
        const state = defaultState({
            dismiss: [
                { id: 'd1', category: 'update', type: 'ever', date: 9999999999999 },
                { id: 'd2', category: 'reboot', type: 'reboot', date: 1 }, // expired (boot time > date)
                { id: 'd3', category: 'flag', type: 'time', date: 1 }, // expired (current time > date)
            ],
        })
        const rootState = { server: { system_boot_at: new Date(5000) } }

        const result = (getters as any).getDismiss(state, {}, rootState)
        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('d1')
    })

    it('getDismiss keeps reboot dismisses that are still in the future', () => {
        const farFuture = new Date().getTime() + 100000
        const state = defaultState({
            dismiss: [
                { id: 'd1', category: 'update', type: 'reboot', date: farFuture },
            ],
        })
        const rootState = { server: { system_boot_at: new Date(1000) } }

        const result = (getters as any).getDismiss(state, {}, rootState)
        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('d1')
    })

    it('getDismissByCategory filters by category', () => {
        const state = defaultState({
            dismiss: [
                { id: 'd1', category: 'update', type: 'ever', date: 999999 },
                { id: 'd2', category: 'flag', type: 'ever', date: 999999 },
                { id: 'd3', category: 'update', type: 'ever', date: 999999 },
            ],
        })
        const rootState = { server: { system_boot_at: new Date(1000) } }

        const categoryFn = (getters as any).getDismissByCategory(state, {
            getDismiss: (getters as any).getDismiss(state, {}, rootState),
        })
        const updates = categoryFn('update')
        expect(updates).toHaveLength(2)

        const flags = categoryFn('flag')
        expect(flags).toHaveLength(1)
    })

    it('getNotifications aggregates sub-getters and sorts by priority then date descending', () => {
        const subNotifications = [
            { id: 'n1', priority: 'normal', title: 'normal', description: '', date: new Date(200), dismissed: false },
            { id: 'n2', priority: 'critical', title: 'critical', description: '', date: new Date(100), dismissed: false },
            { id: 'n3', priority: 'high', title: 'high', description: '', date: new Date(300), dismissed: false },
        ]

        const mockGetters = {
            getNotificationsAnnouncements: [],
            getNotificationsFlags: [],
            getNotificationsDependencies: [],
            getNotificationsMoonrakerWarnings: [],
            getNotificationsMoonrakerFailedComponents: [],
            getNotificationsMoonrakerFailedInitComponents: [],
            getNotificationsKlipperWarnings: [],
            getNotificationsOverdueMaintenance: [],
            getNotificationsBrowserWarnings: [],
            getNotificationsOverheatDrivers: [subNotifications[1], subNotifications[2]],
        }

        const result = (getters as any).getNotifications({}, mockGetters)
        expect(result).toHaveLength(2)
        // critical comes first, then high
        expect(result[0].priority).toBe('critical')
        expect(result[1].priority).toBe('high')
    })

    it('getNotificationsOverheatDrivers detects TMC overtemp and pre-warning flags', () => {
        const rootState = {
            printer: {
                'tmc2208 stepper_x': {
                    drv_status: { ot: 1, otpw: 0 },
                },
                'tmc2209 stepper_y': {
                    drv_status: { ot: 0, otpw: 1 },
                },
                'tmc5160 stepper_z': {
                    drv_status: { ot: 0, otpw: 0 },
                },
            },
            server: { system_boot_at: new Date(1000) },
        }

        const state = defaultState()
        const result = (getters as any).getNotificationsOverheatDrivers(
            state,
            { getDismissByCategory: () => [] },
            rootState
        )

        expect(result).toHaveLength(2)
        expect(result[0].id).toBe('tmcwarning/tmc2208 stepper_x-ot')
        expect(result[0].priority).toBe('critical')
        expect(result[1].id).toBe('tmcwarning/tmc2209 stepper_y-otpw')
        expect(result[1].priority).toBe('high')
    })

    it('getNotificationsOverheatDrivers filters already-dismissed TMC warnings', () => {
        const rootState = {
            printer: {
                'tmc2208 stepper_x': {
                    drv_status: { ot: 1, otpw: 0 },
                },
            },
            server: { system_boot_at: new Date(1000) },
        }

        const state = defaultState()
        const result = (getters as any).getNotificationsOverheatDrivers(
            state,
            { getDismissByCategory: () => [{ id: 'tmc2208 stepper_x-ot' }] },
            rootState
        )

        expect(result).toHaveLength(0)
    })

    it('getNotificationsOverheatDrivers returns empty when no TMC objects', () => {
        const rootState = {
            printer: { toolhead: { position: [0, 0, 0] } },
            server: { system_boot_at: new Date(1000) },
        }

        const result = (getters as any).getNotificationsOverheatDrivers(
            defaultState(),
            { getDismissByCategory: () => [] },
            rootState
        )
        expect(result).toEqual([])
    })

    it('getNotificationsFlags returns throttle flags not yet dismissed', () => {
        const rootState = { server: { system_boot_at: new Date(1000) } }
        const rootGetters = {
            'server/getThrottledStateFlags': ['Undervoltage', 'Previously frequency capped'],
            'gui/notifications/getDismissByCategory': (cat: string) => {
                if (cat === 'flag') return [{ id: 'Undervoltage' }]
                return []
            },
        }

        const result = (getters as any).getNotificationsFlags(
            defaultState(),
            {},
            rootState,
            rootGetters
        )

        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('flag/Previously frequency capped')
        expect(result[0].priority).toBe('high') // starts with 'Previously'
    })

    it('getNotificationsMoonrakerWarnings parses unparsed config option warnings', () => {
        const rootState = {
            server: {
                system_boot_at: new Date(1000),
                warnings: [
                    'Unparsed config option \'pause_on_errors: something\' in section [responder]',
                    'Unparsed config section [some_section]',
                    'Unknown warning without translation',
                ],
            },
        }
        const rootGetters = { 'gui/notifications/getDismissByCategory': () => [] }

        const result = (getters as any).getNotificationsMoonrakerWarnings(
            defaultState(),
            { 'gui/notifications/getDismissByCategory': () => [] },
            rootState,
            rootGetters
        )

        expect(result).toHaveLength(3)
        // First has description containing the parsed option
        expect(result[0].description).toContain('pause_on_errors')
        // Second has description containing the parsed section
        expect(result[1].description).toContain('some_section')
        // Third preserves the raw message
        expect(result[2].description).toBe('Unknown warning without translation')
    })

    it('getNotificationsOverdueMaintenance includes overdue maintenance entries not yet dismissed', () => {
        const rootState = { server: { system_boot_at: new Date(1000) } }
        const rootGetters = {
            'gui/maintenance/getOverdueEntries': [
                { id: 'e1', name: 'Oil change' },
                { id: 'e2', name: 'Belt tension' },
            ],
            'gui/notifications/getDismissByCategory': () => [{ id: 'e1' }],
        }

        const result = (getters as any).getNotificationsOverdueMaintenance(
            defaultState(),
            { 'gui/notifications/getDismissByCategory': () => [{ id: 'e1' }] },
            rootState,
            rootGetters
        )

        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('maintenance/e2')
    })

    it('getNotificationsOverdueMaintenance returns empty when no overdue entries', () => {
        const rootState = { server: { system_boot_at: new Date(1000) } }
        const rootGetters = {
            'gui/maintenance/getOverdueEntries': [],
        }

        const result = (getters as any).getNotificationsOverdueMaintenance(
            defaultState(),
            {},
            rootState,
            rootGetters
        )

        expect(result).toEqual([])
    })

    it('getNotificationsAnnouncements maps announcements to notifications', () => {
        const rootGetters = {
            'server/announcements/getAnnouncements': [
                { entry_id: 'a1', priority: 'high', title: 'Update', description: 'New version', date: new Date(100), dismissed: false, url: null },
            ],
        }

        const result = (getters as any).getNotificationsAnnouncements(
            defaultState(),
            {},
            {},
            rootGetters
        )

        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('announcement/a1')
        expect(result[0].priority).toBe('high')
        expect(result[0].title).toBe('Update')
    })

    it('getNotificationsAnnouncements returns empty when no announcements', () => {
        const rootGetters = { 'server/announcements/getAnnouncements': [] }
        const result = (getters as any).getNotificationsAnnouncements({}, {}, {}, rootGetters)
        expect(result).toEqual([])
    })

    it('getNotificationsKlipperWarnings handles deprecated_option and deprecated_value types', () => {
        const rootState = {
            printer: {
                configfile: {
                    warnings: [
                        {
                            type: 'deprecated_option',
                            message: 'Option `gcode_arcs` is deprecated',
                            option: 'default_parameter_X',
                            value: null,
                        },
                        {
                            type: 'deprecated_value',
                            message: 'Value `on` is deprecated',
                            option: 'some_option',
                            value: 'old_value',
                        },
                        {
                            type: 'runtime_warning',
                            message: 'Heater not reaching target',
                            option: '',
                            value: null,
                        },
                    ],
                },
            },
            server: { system_boot_at: new Date(1000) },
        }
        const rootGetters = { 'gui/notifications/getDismissByCategory': () => [] }

        const result = (getters as any).getNotificationsKlipperWarnings(
            defaultState(),
            { 'gui/notifications/getDismissByCategory': () => [] },
            rootState,
            rootGetters
        )

        expect(result).toHaveLength(3)
        expect(result[0].id).toContain('klipperWarning')
        expect(result[0].url).toContain('#default_parameter')
        expect(result[0].title).toBe('Deprecated Option')

        expect(result[1].url).toContain('#old_value')
        expect(result[1].title).toBe('Deprecated Value')

        expect(result[2].title).toBe('Runtime Warning')
    })
})

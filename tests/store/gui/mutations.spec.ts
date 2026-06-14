/**
 * Tests for src/store/gui/mutations.ts
 * 
 * Tests the GUI store mutations which manage UI settings,
 * dashboard layout, and view preferences.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { mutations } from '@/store/gui/mutations'
import { getDefaultState } from '@/store/gui/index'
import type { GuiState } from '@/store/gui/types'

describe('gui mutations', () => {
    let state: GuiState

    beforeEach(() => {
        state = getDefaultState()
    })

    describe('reset', () => {
        it('resets state to defaults', () => {
            state.general.printername = 'Modified'
            mutations.reset(state)
            expect(state.general.printername).toBe('')
        })
    })

    describe('setData', () => {
        it('deep merges data into state', () => {
            mutations.setData(state, {
                general: { printername: 'My CNC' },
            })
            expect(state.general.printername).toBe('My CNC')
            // Other properties should remain
            expect(state.general.language).toBe('en')
        })
    })

    describe('saveSetting', () => {
        it('saves nested setting by dot-notation path', () => {
            mutations.saveSetting(state, {
                name: 'general.printername',
                value: 'Test Printer',
            })
            expect(state.general.printername).toBe('Test Printer')
        })

        it('saves deeply nested setting', () => {
            mutations.saveSetting(state, {
                name: 'control.feedrateXY',
                value: 200,
            })
            expect(state.control.feedrateXY).toBe(200)
        })
    })

    describe('setHeaterChartVisibility', () => {
        it('adds heater to hidden list when hidden=true', () => {
            mutations.setHeaterChartVisibility(state, {
                name: 'extruder',
                hidden: true,
            })
            expect(state.view.tempchart.hiddenDataset).toContain('EXTRUDER')
        })

        it('removes heater from hidden list when hidden=false', () => {
            state.view.tempchart.hiddenDataset = ['EXTRUDER']
            mutations.setHeaterChartVisibility(state, {
                name: 'extruder',
                hidden: false,
            })
            expect(state.view.tempchart.hiddenDataset).not.toContain('EXTRUDER')
        })

        it('does not duplicate entries', () => {
            mutations.setHeaterChartVisibility(state, {
                name: 'extruder',
                hidden: true,
            })
            mutations.setHeaterChartVisibility(state, {
                name: 'extruder',
                hidden: true,
            })
            expect(
                state.view.tempchart.hiddenDataset.filter((h) => h === 'EXTRUDER').length
            ).toBe(1)
        })
    })

    describe('setGcodefilesMetadata', () => {
        it('hides column when value=false', () => {
            mutations.setGcodefilesMetadata(state, {
                name: 'filament_weight',
                value: false,
            })
            expect(state.view.gcodefiles.hideMetadataColumns).toContain('filament_weight')
        })

        it('shows column when value=true', () => {
            state.view.gcodefiles.hideMetadataColumns = ['filament_weight']
            mutations.setGcodefilesMetadata(state, {
                name: 'filament_weight',
                value: true,
            })
            expect(state.view.gcodefiles.hideMetadataColumns).not.toContain('filament_weight')
        })
    })

    describe('setGcodefilesShowHiddenFiles', () => {
        it('sets showHiddenFiles flag', () => {
            mutations.setGcodefilesShowHiddenFiles(state, true)
            expect(state.view.gcodefiles.showHiddenFiles).toBe(true)

            mutations.setGcodefilesShowHiddenFiles(state, false)
            expect(state.view.gcodefiles.showHiddenFiles).toBe(false)
        })
    })

    describe('setCurrentWebcam', () => {
        it('sets current webcam for a page', () => {
            mutations.setCurrentWebcam(state, {
                page: 'dashboard',
                value: 'webcam1',
            })
            expect(state.view.webcam.currentCam['dashboard']).toBe('webcam1')
        })
    })

    describe('setHistoryColumns', () => {
        it('hides column when value=false', () => {
            mutations.setHistoryColumns(state, {
                name: 'filament',
                value: false,
            })
            expect(state.view.history.hideColums).toContain('filament')
        })

        it('shows column when value=true', () => {
            state.view.history.hideColums = ['filament']
            mutations.setHistoryColumns(state, {
                name: 'filament',
                value: true,
            })
            expect(state.view.history.hideColums).not.toContain('filament')
        })
    })

    describe('setHistoryHidePrintStatus', () => {
        it('sets hidePrintStatus flag', () => {
            mutations.setHistoryHidePrintStatus(state, true)
            expect(state.view.history.hidePrintStatus).toBe(true)
        })
    })

    describe('addClosePanel / removeClosePanel', () => {
        it('adds panel to non-expand list', () => {
            mutations.addClosePanel(state, {
                viewport: 'desktop',
                name: 'temperature',
            })
            expect(state.dashboard.nonExpandPanels['desktop']).toContain('temperature')
        })

        it('does not duplicate panels', () => {
            mutations.addClosePanel(state, {
                viewport: 'desktop',
                name: 'temperature',
            })
            mutations.addClosePanel(state, {
                viewport: 'desktop',
                name: 'temperature',
            })
            expect(
                state.dashboard.nonExpandPanels['desktop'].filter((p) => p === 'temperature')
                    .length
            ).toBe(1)
        })

        it('removes panel from non-expand list', () => {
            state.dashboard.nonExpandPanels['desktop'] = ['temperature', 'status']
            mutations.removeClosePanel(state, {
                viewport: 'desktop',
                name: 'temperature',
            })
            expect(state.dashboard.nonExpandPanels['desktop']).not.toContain('temperature')
        })
    })

    describe('setChartDatasetStatus', () => {
        it('creates new dataset settings entry', () => {
            mutations.setChartDatasetStatus(state, {
                objectName: 'extruder',
                dataset: 'temperature',
                value: true,
            })
            expect(state.view.tempchart.datasetSettings['extruder']).toEqual({
                temperature: true,
            })
        })

        it('updates existing dataset settings', () => {
            state.view.tempchart.datasetSettings['extruder'] = { temperature: true }
            mutations.setChartDatasetStatus(state, {
                objectName: 'extruder',
                dataset: 'target',
                value: false,
            })
            expect(state.view.tempchart.datasetSettings['extruder']).toEqual({
                temperature: true,
                target: false,
            })
        })
    })

    describe('setDatasetAdditionalSensorStatus', () => {
        it('creates new entry with additionalSensors', () => {
            mutations.setDatasetAdditionalSensorStatus(state, {
                objectName: 'extruder',
                dataset: 'power',
                value: true,
            })
            expect(state.view.tempchart.datasetSettings['extruder'].additionalSensors).toEqual({
                power: true,
            })
        })

        it('adds to existing additionalSensors', () => {
            state.view.tempchart.datasetSettings['extruder'] = {
                additionalSensors: { power: true },
            }
            mutations.setDatasetAdditionalSensorStatus(state, {
                objectName: 'extruder',
                dataset: 'speed',
                value: false,
            })
            expect(state.view.tempchart.datasetSettings['extruder'].additionalSensors).toEqual({
                power: true,
                speed: false,
            })
        })
    })
})

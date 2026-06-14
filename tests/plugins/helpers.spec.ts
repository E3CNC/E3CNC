/**
 * Tests for src/plugins/helpers.ts
 * 
 * These are pure utility functions with no dependencies, making them
 * ideal candidates for unit testing.
 */

import { describe, it, expect } from 'vitest'
import {
    parseNumber,
    isRecord,
    setDataDeep,
    findDirectory,
    caseInsensitiveSort,
    capitalize,
    camelize,
    formatConsoleMessage,
    convertName,
    formatFilesize,
    formatFrequency,
    formatPrintTime,
    strLongestEqual,
    escapePath,
    toBoolean,
    filamentWeightFormat,
    convertStringToArray,
    convertHexToRgb,
    filamentTextColor,
    convertPrintStatusIcon,
    convertPrintStatusIconColor,
    sortResolutions,
} from '@/plugins/helpers'

describe('parseNumber', () => {
    it('parses numeric strings', () => {
        expect(parseNumber('250', 0)).toBe(250)
        expect(parseNumber('0.400', 0)).toBe(0.4)
        expect(parseNumber('3.14', 0)).toBeCloseTo(3.14)
    })

    it('returns fallback for non-numeric strings', () => {
        expect(parseNumber('abc', 170)).toBe(170)
        // Note: Number('') === 0 which is finite, so it returns 0
        expect(parseNumber('', 42)).toBe(0)
    })

    it('handles numbers directly', () => {
        expect(parseNumber(42, 0)).toBe(42)
        expect(parseNumber(0, 99)).toBe(0)
    })

    it('returns fallback for Infinity', () => {
        expect(parseNumber(Infinity, 0)).toBe(0)
        expect(parseNumber(-Infinity, 0)).toBe(0)
    })

    it('returns fallback for NaN', () => {
        expect(parseNumber(NaN, 5)).toBe(5)
    })

    it('handles null and undefined', () => {
        // Note: Number(null) === 0 which is finite, so it returns 0
        expect(parseNumber(null, 10)).toBe(0)
        expect(parseNumber(undefined, 10)).toBe(10)
    })
})

describe('isRecord', () => {
    it('returns true for plain objects', () => {
        expect(isRecord({})).toBe(true)
        expect(isRecord({ a: 1 })).toBe(true)
    })

    it('returns false for arrays', () => {
        expect(isRecord([])).toBe(false)
        expect(isRecord([1, 2])).toBe(false)
    })

    it('returns false for null', () => {
        expect(isRecord(null)).toBe(false)
    })

    it('returns false for primitives', () => {
        expect(isRecord('string')).toBe(false)
        expect(isRecord(42)).toBe(false)
        expect(isRecord(true)).toBe(false)
        expect(isRecord(undefined)).toBe(false)
    })
})

describe('setDataDeep', () => {
    it('merges nested objects', () => {
        const state = { a: { b: 1, c: 2 }, d: 3 }
        setDataDeep(state, { a: { b: 10 } })
        expect(state).toEqual({ a: { b: 10, c: 2 }, d: 3 })
    })

    it('adds new keys', () => {
        const state: Record<string, any> = { a: 1 }
        setDataDeep(state, { b: 2 })
        expect(state).toEqual({ a: 1, b: 2 })
    })

    it('handles deeply nested objects', () => {
        const state = { a: { b: { c: 1 } } }
        setDataDeep(state, { a: { b: { c: 2, d: 3 } } })
        expect(state).toEqual({ a: { b: { c: 2, d: 3 } } })
    })

    it('does nothing for non-record inputs', () => {
        const state = 'not an object'
        setDataDeep(state, { a: 1 })
        expect(state).toBe('not an object')
    })
})

describe('findDirectory', () => {
    const filetree = [
        {
            isDirectory: true,
            filename: 'gcodes',
            childrens: [
                {
                    isDirectory: true,
                    filename: 'subdir',
                    childrens: [
                        { isDirectory: false, filename: 'test.gcode' },
                    ],
                },
                { isDirectory: false, filename: 'file.gcode' },
            ],
        },
    ] as any[]

    it('finds files in root directory', () => {
        const result = findDirectory(filetree, ['gcodes'])
        expect(result).toBeTruthy()
        expect(result!.length).toBe(2)
    })

    it('finds files in nested directory', () => {
        const result = findDirectory(filetree, ['gcodes', 'subdir'])
        expect(result).toBeTruthy()
        expect(result!.length).toBe(1)
        expect(result![0].filename).toBe('test.gcode')
    })

    it('returns original folder for non-existent directory', () => {
        // Note: findDirectory returns the original folder when directory not found
        const result = findDirectory(filetree, ['nonexistent'])
        expect(result).toEqual(filetree)
    })

    it('returns null for empty dirArray', () => {
        const result = findDirectory(filetree, [])
        expect(result).toBeNull()
    })
})

describe('caseInsensitiveSort', () => {
    it('sorts strings case-insensitively', () => {
        const items = [
            { name: 'Banana' },
            { name: 'apple' },
            { name: 'Cherry' },
        ]
        const result = caseInsensitiveSort(items, 'name')
        expect(result.map((i) => i.name)).toEqual(['apple', 'Banana', 'Cherry'])
    })

    it('sorts with numeric awareness', () => {
        const items = [
            { name: 'file10' },
            { name: 'file2' },
            { name: 'file1' },
        ]
        const result = caseInsensitiveSort(items, 'name')
        expect(result.map((i) => i.name)).toEqual(['file1', 'file2', 'file10'])
    })
})

describe('capitalize', () => {
    it('capitalizes first letter', () => {
        expect(capitalize('hello')).toBe('Hello')
        expect(capitalize('world')).toBe('World')
    })

    it('handles empty string', () => {
        expect(capitalize('')).toBe('')
    })

    it('handles already capitalized', () => {
        expect(capitalize('Hello')).toBe('Hello')
    })
})

describe('camelize', () => {
    it('converts underscores to camelCase', () => {
        expect(camelize('hello_world')).toBe('helloWorld')
        expect(camelize('my_variable_name')).toBe('myVariableName')
    })

    it('handles single word', () => {
        expect(camelize('hello')).toBe('hello')
    })
})

describe('formatConsoleMessage', () => {
    it('removes !! prefix', () => {
        expect(formatConsoleMessage('!! Error occurred')).toBe('Error occurred')
    })

    it('removes // prefix', () => {
        expect(formatConsoleMessage('// Info message')).toBe('Info message')
    })

    it('removes echo: prefix', () => {
        expect(formatConsoleMessage('echo: Hello')).toBe('Hello')
    })

    it('removes debug: prefix', () => {
        expect(formatConsoleMessage('debug: test')).toBe('test')
    })

    it('replaces newlines with <br>', () => {
        expect(formatConsoleMessage('line1\nline2')).toBe('line1<br>line2')
    })

    it('trims whitespace', () => {
        expect(formatConsoleMessage('  hello  ')).toBe('hello')
    })
})

describe('convertName', () => {
    it('converts underscored names to title case', () => {
        expect(convertName('hello_world')).toBe('Hello World')
        expect(convertName('my_printer_name')).toBe('My Printer Name')
    })

    it('handles single word', () => {
        expect(convertName('hello')).toBe('Hello')
    })
})

describe('formatFilesize', () => {
    it('formats bytes to kB', () => {
        expect(formatFilesize(1024)).toBe('1.0 kB')
        expect(formatFilesize(2048)).toBe('2.0 kB')
    })

    it('formats to MB', () => {
        // Note: formatFilesize divides by 1024 until <= 1024
        // 1048576 bytes = 1024 kB (stays at kB because 1024 is not > 1024)
        expect(formatFilesize(1048576)).toBe('1024.0 kB')
        // To get MB, need > 1024 * 1024
        expect(formatFilesize(1048577)).toBe('1.0 MB')
    })

    it('formats to GB', () => {
        // Note: formatFilesize divides by 1024 until <= 1024
        // 1073741824 bytes = 1024 MB (stays at MB because 1024 is not > 1024)
        expect(formatFilesize(1073741824)).toBe('1024.0 MB')
        // To get GB, need > 1024 * 1024 * 1024
        expect(formatFilesize(1073741825)).toBe('1.0 GB')
    })

    it('handles small values', () => {
        expect(formatFilesize(100)).toBe('0.1 kB')
    })
})

describe('formatFrequency', () => {
    it('formats to kHz', () => {
        expect(formatFrequency(1000)).toBe('1 kHz')
        expect(formatFrequency(5000)).toBe('5 kHz')
    })

    it('formats to MHz', () => {
        // Note: formatFrequency divides by 1000 until <= 1000
        // 1000000 Hz = 1000 kHz (stays at kHz because 1000 is not > 1000)
        expect(formatFrequency(1000000)).toBe('1000 kHz')
        // To get MHz, need > 1000 * 1000
        expect(formatFrequency(1000001)).toBe('1 MHz')
    })

    it('formats to GHz', () => {
        // Note: formatFrequency divides by 1000 until <= 1000
        // 1000000000 Hz = 1000 MHz (stays at MHz because 1000 is not > 1000)
        expect(formatFrequency(1000000000)).toBe('1000 MHz')
        // To get GHz, need > 1000 * 1000 * 1000
        expect(formatFrequency(1000000001)).toBe('1 GHz')
    })
})

describe('formatPrintTime', () => {
    it('returns -- for zero', () => {
        expect(formatPrintTime(0)).toBe('--')
    })

    it('formats seconds only', () => {
        expect(formatPrintTime(45)).toBe('45s')
    })

    it('formats minutes and seconds', () => {
        expect(formatPrintTime(125)).toBe('2m 5s')
    })

    it('formats hours, minutes, and seconds', () => {
        expect(formatPrintTime(3661)).toBe('1h 1m 1s')
    })

    it('formats days', () => {
        expect(formatPrintTime(90061)).toBe('1d 1h 1m 1s')
    })

    it('can skip days', () => {
        expect(formatPrintTime(90061, false)).toBe('25h 1m 1s')
    })
})

describe('strLongestEqual', () => {
    it('finds common prefix', () => {
        expect(strLongestEqual('hello', 'help')).toBe('hel')
        expect(strLongestEqual('abc', 'abd')).toBe('ab')
    })

    it('returns empty for no common prefix', () => {
        expect(strLongestEqual('abc', 'xyz')).toBe('')
    })

    it('returns full string if identical', () => {
        expect(strLongestEqual('hello', 'hello')).toBe('hello')
    })
})

describe('escapePath', () => {
    it('encodes path segments', () => {
        expect(escapePath('path/to/file')).toBe('path/to/file')
        expect(escapePath('path/with space/file')).toBe('path/with%20space/file')
    })

    it('encodes special characters', () => {
        expect(escapePath('path/with#hash/file')).toBe('path/with%23hash/file')
    })
})

describe('toBoolean', () => {
    it('handles booleans', () => {
        expect(toBoolean(true)).toBe(true)
        expect(toBoolean(false)).toBe(false)
    })

    it('handles numbers', () => {
        expect(toBoolean(1)).toBe(true)
        expect(toBoolean(0)).toBe(false)
        expect(toBoolean(42)).toBe(true)
    })

    it('handles strings', () => {
        expect(toBoolean('true')).toBe(true)
        expect(toBoolean('false')).toBe(false)
        expect(toBoolean('1')).toBe(true)
        expect(toBoolean('0')).toBe(false)
        expect(toBoolean('yes')).toBe(true)
        expect(toBoolean('no')).toBe(false)
        expect(toBoolean('y')).toBe(true)
        expect(toBoolean('n')).toBe(false)
    })

    it('handles case insensitivity', () => {
        expect(toBoolean('TRUE')).toBe(true)
        expect(toBoolean('False')).toBe(false)
        expect(toBoolean('YES')).toBe(true)
    })
})

describe('filamentWeightFormat', () => {
    it('formats grams for small weights', () => {
        expect(filamentWeightFormat(50)).toBe('50 g')
        expect(filamentWeightFormat(15.5)).toBe('15.5 g')
    })

    it('formats rounded grams for medium weights', () => {
        expect(filamentWeightFormat(150)).toBe('150 g')
    })

    it('formats kilograms for large weights', () => {
        expect(filamentWeightFormat(1500)).toBe('1.5 kg')
    })
})

describe('convertStringToArray', () => {
    it('splits by separator', () => {
        expect(convertStringToArray('a;b;c')).toEqual(['a', 'b', 'c'])
    })

    it('parses JSON array', () => {
        expect(convertStringToArray('["a", "b", "c"]')).toEqual(['a', 'b', 'c'])
    })

    it('returns empty array for empty string', () => {
        expect(convertStringToArray('')).toEqual([])
    })

    it('handles custom separator', () => {
        expect(convertStringToArray('a,b,c', ',')).toEqual(['a', 'b', 'c'])
    })

    it('strips quotes', () => {
        expect(convertStringToArray('"a";"b"')).toEqual(['a', 'b'])
    })
})

describe('convertHexToRgb', () => {
    it('parses 6-digit hex', () => {
        expect(convertHexToRgb('#FF5500')).toEqual({ r: 255, g: 85, b: 0 })
        expect(convertHexToRgb('FF5500')).toEqual({ r: 255, g: 85, b: 0 })
    })

    it('parses 3-digit hex', () => {
        expect(convertHexToRgb('#F50')).toEqual({ r: 255, g: 85, b: 0 })
    })

    it('parses 8-digit hex (ignores alpha)', () => {
        expect(convertHexToRgb('#FF5500AA')).toEqual({ r: 255, g: 85, b: 0 })
    })

    it('returns null for invalid input', () => {
        expect(convertHexToRgb('invalid')).toBeNull()
        expect(convertHexToRgb('#GG0000')).toBeNull()
    })
})

describe('filamentTextColor', () => {
    it('returns dark text for light colors', () => {
        expect(filamentTextColor('#FFFFFF')).toBe('#222')
        expect(filamentTextColor('#FFFF00')).toBe('#222')
    })

    it('returns light text for dark colors', () => {
        expect(filamentTextColor('#000000')).toBe('#fff')
        expect(filamentTextColor('#333333')).toBe('#fff')
    })

    it('returns white for invalid input', () => {
        expect(filamentTextColor('invalid')).toBe('#ffffff')
    })
})

describe('convertPrintStatusIcon', () => {
    it('returns correct icon for status', () => {
        expect(convertPrintStatusIcon('in_progress')).toBeTruthy()
        expect(convertPrintStatusIcon('completed')).toBeTruthy()
        expect(convertPrintStatusIcon('cancelled')).toBeTruthy()
    })

    it('returns alert icon for unknown status', () => {
        expect(convertPrintStatusIcon('unknown')).toBeTruthy()
    })
})

describe('convertPrintStatusIconColor', () => {
    it('returns correct color for status', () => {
        expect(convertPrintStatusIconColor('in_progress')).toBe('#2979ff')
        expect(convertPrintStatusIconColor('completed')).toBe('green')
        expect(convertPrintStatusIconColor('cancelled')).toBe('red')
    })

    it('returns orange for unknown status', () => {
        expect(convertPrintStatusIconColor('unknown')).toBe('orange')
    })
})

describe('sortResolutions', () => {
    it('sorts resolutions by width', () => {
        const resolutions = ['1920x1080', '640x480', '1280x720']
        const sorted = resolutions.sort(sortResolutions)
        expect(sorted).toEqual(['640x480', '1280x720', '1920x1080'])
    })
})

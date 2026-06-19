/**
 * Mock composables for testing
 *
 * Provides mock implementations of composables used throughout the app
 */

import { vi } from 'vitest'
import { ref, computed } from 'vue'

/**
 * Creates a mock useBase composable
 */
export function createMockUseBase(overrides: Record<string, any> = {}) {
    return {
        apiUrl: computed(() => '//localhost:8080'),
        hostUrl: computed(() => 'http://localhost/'),
        hostPort: computed(() => 8080),
        instancesDB: computed(() => 'moonraker'),
        socketIsConnected: computed(() => false),
        guiIsReady: computed(() => false),
        klippyIsConnected: computed(() => true),
        klipperState: computed(() => 'ready'),
        klipperReadyForGui: computed(() => true),
        klipperAppName: computed(() => 'Klipper'),
        printerIsPrinting: computed(() => false),
        printerIsPrintingOnly: computed(() => false),
        printerPowerDevice: computed(() => 'printer'),
        isPrinterPowerOff: computed(() => false),
        loadings: computed(() => []),
        printer_state: computed(() => 'ready'),
        isMobile: computed(() => false),
        isTablet: computed(() => false),
        isDesktop: computed(() => true),
        isWidescreen: computed(() => false),
        viewport: computed(() => 'desktop'),
        isTouchDevice: computed(() => false),
        isIOS: computed(() => false),
        moonrakerComponents: computed(() => ['history', 'power']),
        existGcodesRootDirectory: computed(() => true),
        spoolManagerUrl: computed(() => undefined),
        formatTimeOptions: computed(() => ({ timeStyle: 'short' })),
        formatTimeWithSecondsOptions: computed(() => ({ timeStyle: 'short' })),
        browserLocale: computed(() => 'en-US'),
        hours12Format: computed(() => false),
        formatDate: vi.fn((value: Date) => value.toLocaleDateString()),
        formatTime: vi.fn((value: Date) => value.toLocaleTimeString()),
        formatDateTime: vi.fn((value: number) => new Date(value).toLocaleString()),
        ...overrides,
    }
}

/**
 * Creates a mock useSocket composable
 */
export function createMockUseSocket(overrides: Record<string, any> = {}) {
    return {
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        close: vi.fn(),
        connect: vi.fn(),
        ...overrides,
    }
}

/**
 * Creates a mock useNavigation composable
 */
export function createMockUseNavigation(overrides: Record<string, any> = {}) {
    return {
        ...createMockUseBase(),
        countPrinters: computed(() => 0),
        routesNaviPoints: computed(() => []),
        naviPoints: computed(() => []),
        visibleNaviPoints: computed(() => []),
        uiSettings: computed(() => []),
        klippy_state: computed(() => 'ready'),
        boolNaviWebcam: computed(() => false),
        moonrakerComponents: computed(() => []),
        registeredDirectories: computed(() => []),
        klipperConfigfileSettings: computed(() => ({})),
        sidebarNaviFile: computed(() => null),
        webcamCount: computed(() => 0),
        showInNavi: vi.fn(() => true),
        getUiSettings: vi.fn(() => [999, true]),
        ...overrides,
    }
}

/**
 * Creates a mock useControl composable
 */
export function createMockUseControl(overrides: Record<string, any> = {}) {
    return {
        absolute_coordinates: computed(() => true),
        enableXYHoming: computed(() => false),
        feedrateXY: computed(() => 100),
        feedrateZ: computed(() => 25),
        existsQGL: computed(() => false),
        existsZtilt: computed(() => false),
        existsDeltaCalibrate: computed(() => false),
        existsScrewsTilt: computed(() => false),
        existsFirmwareRetraction: computed(() => false),
        colorQuadGantryLevel: computed(() => 'primary'),
        colorZTilt: computed(() => 'primary'),
        defaultActionButton: computed(() => 'homeAll'),
        actionButton: computed(() => 'homeAll'),
        homedAxes: computed(() => 'xyz'),
        xAxisHomed: computed(() => true),
        yAxisHomed: computed(() => true),
        zAxisHomed: computed(() => true),
        macros: computed(() => []),
        toolchangeMacros: computed(() => []),
        existsClientLinearMoveMacro: computed(() => false),
        doHome: vi.fn(),
        doHomeX: vi.fn(),
        doHomeY: vi.fn(),
        doHomeXY: vi.fn(),
        doHomeZ: vi.fn(),
        doQGL: vi.fn(),
        doZtilt: vi.fn(),
        doSendMove: vi.fn(),
        doSend: vi.fn(),
        ...overrides,
    }
}

/**
 * Creates a mock useTheme composable
 */
export function createMockUseTheme(overrides: Record<string, any> = {}) {
    return {
        fgColor: vi.fn(() => 'rgba(255, 255, 255, 1)'),
        bgColor: vi.fn(() => 'rgba(0, 0, 0, 1)'),
        themeName: computed(() => 'mainsail'),
        themeObj: computed(() => ({ name: 'mainsail' })),
        themeMode: computed(() => 'dark'),
        fgColorHi: computed(() => 'rgba(255, 255, 255, 0.8)'),
        fgColorMid: computed(() => 'rgba(255, 255, 255, 0.5)'),
        fgColorLow: computed(() => 'rgba(255, 255, 255, 0.2)'),
        fgColorFaint: computed(() => 'rgba(255, 255, 255, 0.1)'),
        machineButtonCol: computed(() => '#424242'),
        draggableBgStyle: computed(() => 'background-color: #282828'),
        progressBarColor: computed(() => 'white'),
        sidebarBgImage: computed(() => '/img/sidebar-background.svg'),
        sidebarLogo: computed(() => ''),
        mainBgImage: computed(() => null),
        themeCss: computed(() => null),
        ...overrides,
    }
}

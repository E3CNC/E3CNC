/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'lodash.debounce' {
    type DebounceSettings = {
        leading?: boolean
        maxWait?: number
        trailing?: boolean
    }

    type DebouncedFunction<T extends (...args: any[]) => any> = T & {
        cancel: () => void
        flush: () => ReturnType<T>
        pending: () => boolean
    }

    function debounce<T extends (...args: any[]) => any>(
        func: T,
        wait?: number,
        options?: DebounceSettings
    ): DebouncedFunction<T>

    export default debounce
}

declare module 'virtual:pwa-register' {
    export interface RegisterSWOptions {
        immediate?: boolean
        onNeedRefresh?: () => void
        onOfflineReady?: () => void
        onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void
        onRegisterError?: (error: unknown) => void
    }

    export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>
}

declare module 'echarts/types/dist/shared.d' {
    export type Dictionary<T = unknown> = Record<string, T>
    export type ECBasicOption = Record<string, any>
    export type TopLevelFormatterParams = any
    export type TooltipPositionCallback = (...args: any[]) => any
}

declare module 'unplugin-vue-components/vite' {
    const Components: any
    export default Components
}

declare module 'unplugin-vue-components/resolvers' {
    export const Vuetify3Resolver: (...args: any[]) => any
}

declare module 'typed_janus_js/dist/interfaces/janus' {
    export interface ConstructorOptions {
        server: string
        iceServers?: { urls: string[] }[]
    }
}

declare module 'typed_janus_js' {
    import type { ConstructorOptions } from 'typed_janus_js/dist/interfaces/janus'

    export interface JanusMessageEvent {
        message?: {
            result?: {
                status?: string
            }
        }
        jsep?: unknown
    }

    export interface JanusRemoteTrackEvent {
        on: boolean
        track: MediaStreamTrack
    }

    export interface JanusEventSubscription<T> {
        subscribe(listener: (payload: T) => void): void
    }

    export class JanusStreamingPlugin {
        onMessage: JanusEventSubscription<JanusMessageEvent>
        onRemoteTrack: JanusEventSubscription<JanusRemoteTrackEvent>
        onIceState: JanusEventSubscription<string>
        onError: JanusEventSubscription<unknown>

        createAnswer(options: { jsep: unknown }): Promise<unknown>
        send(options: { message: Record<string, unknown>; jsep?: unknown }): Promise<void>
    }

    export class JanusSession {
        attach<T>(plugin: new (...args: any[]) => T, options: Record<string, unknown>): Promise<T>
        destroy(options: Record<string, unknown>): Promise<void>
    }

    export class JanusJs {
        constructor(options: ConstructorOptions)

        init(options: { debug: boolean }): Promise<void>
        createSession(): Promise<JanusSession>

        static attachMediaStream(element: HTMLMediaElement, stream: MediaStream): void
    }

    export { ConstructorOptions }
    export default JanusJs
}

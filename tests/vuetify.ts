/**
 * Vuetify test helper
 *
 * Creates a properly configured Vuetify instance for use in tests,
 * allowing components to be mounted with their real Vuetify dependencies.
 */
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { aliases, mdi } from 'vuetify/iconsets/mdi'

export function createTestVuetify() {
    return createVuetify({
        components,
        directives,
        icons: {
            defaultSet: 'mdi',
            aliases,
            sets: { mdi },
        },
        theme: {
            defaultTheme: 'dark',
            themes: {
                dark: {
                    dark: true,
                    colors: {
                        primary: '#D51F26',
                        secondary: '#1F1F1F',
                        background: '#121212',
                        surface: '#1E1E1E',
                    },
                },
            },
        },
    })
}

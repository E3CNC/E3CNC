declare module './cypress/plugins/index.js' {
    const plugin: (on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions) => void
    export default plugin
}

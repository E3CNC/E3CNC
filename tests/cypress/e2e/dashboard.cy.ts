describe('Dashboard', () => {
    it('opens the page correctly', function () {
        cy.visit('/')
        cy.wait(2000)
        // With auto-connect, the app may show the printer selector or
        // connect directly. Just verify the app shell loads.
        cy.contains('E3CNC', { timeout: 10000 })
        cy.get('.v-app-bar', { timeout: 10000 }).should('be.visible')
    })
})

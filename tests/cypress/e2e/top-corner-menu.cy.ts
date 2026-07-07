describe('TheTopCornerMenu — E3CNC Stack Control', () => {
    const mockInfoResponse = {
        result: {
            ok: true,
            current_version: '0.8.1',
            instances: [{ name: 'Test Printer', port: 4173, web_root: '/', running: true }],
        },
    }

    function setupMenuTest() {
        // Stub the E3CNC info endpoint so onMounted populates instance info
        cy.intercept('**/machine/e3cnc/info', {
            statusCode: 200,
            body: mockInfoResponse,
        }).as('e3cncInfo')
    }

    function openMenu() {
        // The top corner menu activator is the last v-btn in the v-app-bar
        cy.get('.v-app-bar').within(() => {
            cy.get('.v-btn').last().click()
        })
        // Wait for the Vuetify menu overlay to become active
        cy.get('.v-overlay--active', { timeout: 5000 }).should('exist')
    }

    // ── 1. E3CNC section renders with version info ──
    it('shows E3CNC section with version when info endpoint responds', () => {
        setupMenuTest()
        cy.visit('/')
        cy.wait('@e3cncInfo')

        openMenu()

        // E3CNC subheader should contain the version text
        cy.contains('.v-list-subheader', /E3CNC/).should('exist')
        cy.contains('0.8.1').should('exist')
        // Update Stack item should exist in the DOM
        cy.contains('.v-list-item', 'Update Stack').should('exist')
        // Rollback item should exist
        cy.contains('.v-list-item', 'Rollback').should('exist')
    })

    // ── 2. E3CNC section renders when info endpoint unavailable ──
    it('shows E3CNC section without version when info endpoint fails', () => {
        cy.intercept('**/machine/e3cnc/info', {
            statusCode: 404,
        }).as('e3cncInfoFail')

        cy.visit('/')
        cy.wait('@e3cncInfoFail')

        openMenu()

        // E3CNC subheader should still be visible
        cy.contains('.v-list-subheader', 'E3CNC').should('exist')
        // Update Stack and Rollback should still be visible
        cy.contains('.v-list-item', 'Update Stack').should('exist')
        cy.contains('.v-list-item', 'Rollback').should('exist')
    })

    // ── 3. Clicking "Update Stack" shows overlay ──
    it('shows update overlay when Update Stack is clicked', () => {
        setupMenuTest()

        cy.intercept('POST', '**/machine/e3cnc/update', {
            statusCode: 200,
            body: { result: { status: 'started' } },
        }).as('updateStack')

        cy.visit('/')
        cy.wait('@e3cncInfo')

        openMenu()

        cy.contains('.v-list-item', 'Update Stack').click()

        // Verify the POST was made
        cy.wait('@updateStack').its('request.method').should('eq', 'POST')

        // Verify overlay is shown and contains the progress text
        cy.get('.v-overlay', { timeout: 5000 }).should('exist')
        cy.contains('Updating E3CNC stack...').should('exist')
    })

    // ── 4. Clicking "Rollback" sends POST ──
    it('sends POST to rollback endpoint when Rollback is clicked', () => {
        setupMenuTest()

        cy.intercept('POST', '**/machine/e3cnc/rollback', {
            statusCode: 200,
            body: { result: { ok: true } },
        }).as('rollbackStack')

        cy.visit('/')
        cy.wait('@e3cncInfo')

        openMenu()

        cy.contains('.v-list-item', 'Rollback').click()

        cy.wait('@rollbackStack').its('request.method').should('eq', 'POST')
    })
})

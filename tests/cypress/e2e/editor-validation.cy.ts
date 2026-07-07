type ValidationCase = {
    name: string
    filePath: string
    content: string
    expectedIssues?: string[]
    expectIssueCount?: number
}

const validMacroCase: ValidationCase = {
    name: 'valid Klipper macro file',
    filePath: 'config/valid-macros.cfg',
    content: `[include macros/*.cfg]

[gcode_macro START_JOB]
description: Home all axes
gcode:
  G90
  G28
  M117 Ready
  {% if printer.toolhead.homed_axes != "xyz" %}
    RESPOND TYPE=error MSG="Not homed"
  {% endif %}

[display_status]
[display_status]
`,
    expectIssueCount: 0,
}

const invalidRuleCase: ValidationCase = {
    name: 'invalid Klipper config constructs',
    filePath: 'config/invalid-rules.cfg',
    content: `orphan command
[printer
[]
[printer]
kinematics cartesian
= 123
[include missing.cfg]
`,
    expectedIssues: [
        'Content outside of any section',
        'Unclosed section header',
        'Empty section header',
        'Expected option syntax',
        'Missing key name',
    ],
    expectIssueCount: 5,
}

const testPrinter = {
    hostname: 'localhost',
    port: 4173,
    name: 'Test Printer',
    path: '/',
}

function setupEditorTest(filePath: string, content: string) {
    // Set up localStorage so auto-connect kicks in and bypasses the printer dialog
    cy.then(() => {
        window.localStorage.setItem('printers', JSON.stringify([testPrinter]))
    })

    cy.intercept('GET', '**/config.json', {
        statusCode: 200,
        body: {
            instancesDB: 'browser',
            defaultLocale: 'en',
        },
    }).as('configJson')

    cy.intercept('GET', `**/server/files/${filePath}*`, {
        statusCode: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
        body: content,
    }).as('openFile')

    cy.intercept('POST', '**/server/files/upload', {
        statusCode: 200,
        body: {
            item: {
                path: filePath.split('/').pop(),
            },
        },
    }).as('saveFile')
}

function visitEditor(filePath: string, content: string) {
    setupEditorTest(filePath, content)
    cy.visit(`/config?editorFile=${filePath}`)
    cy.wait('@configJson')
    cy.wait('@openFile')
    cy.contains(filePath.split('/').pop() ?? filePath, { timeout: 10000 })
    cy.get('.cm-editor', { timeout: 10000 }).should('be.visible')
}

describe('Editor validation', () => {
    it('does not report issues for valid Klipper macro syntax', () => {
        visitEditor(validMacroCase.filePath, validMacroCase.content)

        cy.get('.validation-console').should('not.exist')
        cy.get('.cm-annotation-widget-warning').should('have.length', 0)
        cy.get('.cm-annotation-widget-error').should('have.length', 0)

        cy.get('.editor-header-icon-btn').first().click()
        cy.wait('@saveFile')
        cy.contains('successfully saved.', { timeout: 10000 })
        cy.contains('validation issue').should('not.exist')
    })

    it('surfaces the expected rule failures through the editor UI', () => {
        visitEditor(invalidRuleCase.filePath, invalidRuleCase.content)

        cy.get('.validation-console__title').should('contain.text', `${invalidRuleCase.expectIssueCount} issues found`)
        cy.get('.validation-console__item').should('have.length', invalidRuleCase.expectIssueCount ?? 0)

        for (const message of invalidRuleCase.expectedIssues ?? []) {
            cy.contains('.validation-console__msg', message).should('be.visible')
        }

        cy.get('.cm-annotation-widget-error').should('have.length', 5)
    })

    it('keeps save non-blocking when validation issues exist', () => {
        visitEditor(invalidRuleCase.filePath, invalidRuleCase.content)

        cy.get('.editor-header-icon-btn').first().click()
        cy.wait('@saveFile')

        cy.get('.editor-dialog').should('exist')
        cy.get('.validation-console__title').should('contain.text', '5 issues found')
        cy.get('.validation-console__item').should('have.length', 5)
        cy.get('.cm-annotation-widget-error').should('have.length', 5)
        cy.get('.editor-dialog').should('exist')
    })
})

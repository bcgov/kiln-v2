# KILN v2 (Official)

KILN is a presenter for forms. It accepts a JSON form definition and renders dynamic Carbon components (Svelte), with data binding, validation, printing, and integration hooks for persistence and workflow.

Tech stack:
- Svelte + TypeScript + Vite
- Carbon Components Svelte

## Prerequisites

- npm 10.2.4 or higher
- Node.js 20.11.1 or higher

## Installation

- Install dependencies

```sh
npm install
```

- Copy env and configure values

```sh
cp .env.example .env
```


## Developing

```sh
npm run dev

```

## Building

```sh
npm run build
npm run preview
```

## What this app does

- Renders a JSON form definition into Carbon components.
- Binds saved data to the form and publishes a global form state for persistence.
- Validates fields on blur/change and surfaces a modal error summary before actions.
- Supports printing:
  - PDF generation when a pdf_template_id is configured.
  - HTML printing fallback with header/footer metadata.
- Exposes action buttons (Save, Save and Close, Generate, custom portal actions) that call utils functions for API/workflow integration.

## High-level structure

- src/lib/RenderFrame.svelte
  - Frame, header buttons, printing, modal handling, validation gating
  - Merges form definition with saved data (bindDataToForm)
  - Exposes formState and formDefinition on window for persistence utilities
- src/lib/components/FormRenderer.svelte
  - Walks the form definition and renders field components
- src/lib/components/formfields/*
  - Individual field implementations (e.g., Checkbox.svelte) using Carbon Components Svelte
  - Value sync via createValueSyncEffect and publishToGlobalFormState
  - enables injection and interaction with external JS if needed
- src/lib/utils/
  - form.ts: Form actions, such as save/load/submit and PDF generation
  - databinder.ts: binds saved data to the form 
  - validation.ts: validate fields, derive rules from attributes
  - valueSync.ts: syncs field values with global state

## Data flow (runtime)

- RenderFrame.svelte:
  - Derives mergedFormData by binding saved data to formData (bindDataToForm)
  - Sets read-only fields in view mode (setReadOnlyFields)
  - Exposes window.__kilnFormDefinition and window.__kilnFormState
  - Validates all fields on gated actions (validateAllFields)
  - Calls utils/form actions for Save/Generate/Submit workflows
- Field components:
  - Maintain local state, sync with window.__kilnFormState via createValueSyncEffect
  - Publish updates (publishToGlobalFormState)
  - Derive validation rules from attributes (rulesFromAttributes) and display errors

## Printing

- If formData.pdf_template_id exists: generatePDF(formData, pdfId) to use a backend PDF service.
- Otherwise: HTML print fallback with temporary title/metadata and a fixed footer.

## Outstanding tasks (utils and integration)

Authentication (Keycloak):
- Initialize Keycloak on app.
- Ensure unlockICMFinalFlags is called on beforeunload.

Form save/load integration:
- saveDataToICMApi(savedData):
  - POST saveData package from createSavedData to (ICM) with auth.
- load.ts loadFormData function:
  - test integration with ICM to fetch prior submissions/drafts by id.
- submitForButtonAction() - handles button interfaces:
  - Map button config to workflow endpoints.
  - ensure that submitForButtonAction can properly handle any passed in function as an interface.
  - Surface errors in the modal; handle redirects or next-step tokens if applicable.
- unlockICMFinalFlags:
  - Call an API to release locks; fallback on tab close.

PDF/print integration:
- generatePDF:
  - test integration with external PDF service.
  - Provide error feedback and HTML fallback.

Validation:
- test validation rules and error summary behavior with complex forms.
- test validation rules with save/close and generate actions.

Accessibility and i18n:
- Ensure all labels, errors, and button texts are accessible and localizable.
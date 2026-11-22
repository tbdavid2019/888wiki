/**
 * src/template.js
 * Re-export barrel - preserves backward compatibility for all existing imports.
 * All template functions are now organized in subdirectories:
 *   - src/templates/common.js  → SWITCHER, FOOTER, MODAL
 *   - src/templates/base.js    → HTML (base page wrapper)
 *   - src/templates/edit.js    → Edit
 *   - src/templates/share.js   → Share
 *   - src/templates/admin.js   → Admin
 *   - src/templates/pages.js   → NeedPasswd, Page404
 *   - src/styles/base.css.js   → getBaseCss
 *   - src/styles/editor.css.js → getEditorCss
 *   - src/styles/admin.css.js  → getAdminCss
 *   - src/styles/markdown.css.js → getMarkdownCss
 *   - src/scripts/admin.js     → getAdminScript (AdminController)
 *   - src/scripts/editor.js    → getEditorScript
 */
export { Edit } from './templates/edit.js'
export { Share } from './templates/share.js'
export { Admin } from './templates/admin.js'
export { Home, NeedPasswd, Page404, ShareExpired, ShareBurned, ShareTimeLocked, ShareDeadmanLocked } from './templates/pages.js'
export { Space } from './templates/space.js'
export { Circle } from './templates/circle.js'

// Also re-export shared utilities for any code that imports them from template.js
export { FOOTER, MODAL, SWITCHER, VAULT_PRESETS_MODAL } from './templates/common.js'
export { HTML } from './templates/base.js'

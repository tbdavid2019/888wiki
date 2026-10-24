import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

test('block editor is shipped as a locally bundled BlockNote React island', () => {
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

    assert.equal(packageJson.dependencies['@blocknote/core'], '^0.56.0')
    assert.equal(packageJson.dependencies['@blocknote/react'], '^0.56.0')
    assert.equal(packageJson.dependencies['@blocknote/mantine'], '^0.56.0')
    assert.equal(packageJson.dependencies.react, '^19.2.8')
    assert.equal(packageJson.devDependencies.esbuild, '^0.28.1')
    assert.equal(packageJson.scripts['build:block-editor'], 'node scripts/build-block-editor.mjs')
    assert.match(packageJson.scripts.pretest, /build:block-editor/)
    assert.match(packageJson.scripts.predeploy, /build:block-editor/)
    assert.equal(existsSync(new URL('../static/js/block-editor.bundle.mjs', import.meta.url)), true)
    assert.equal(existsSync(new URL('../static/js/block-editor.bundle.css', import.meta.url)), true)
})

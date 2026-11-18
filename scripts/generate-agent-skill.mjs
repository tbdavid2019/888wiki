import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const generatedDir = resolve(repoRoot, 'src/generated')

function writeGeneratedModule({ sourcePath, outputPath, exportName }) {
    const markdown = readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n')
    const generated = [
        `// This file is generated from ${sourcePath.replace(`${repoRoot}/`, '')}.`,
        '// Do not edit manually; run `node scripts/generate-agent-skill.mjs`.',
        '',
        `export const ${exportName} = ${JSON.stringify(markdown)};`,
        '',
    ].join('\n')

    writeFileSync(outputPath, generated, 'utf8')
}

mkdirSync(generatedDir, { recursive: true })

writeGeneratedModule({
    sourcePath: resolve(repoRoot, 'skills/SKILL.md'),
    outputPath: resolve(generatedDir, 'agent-skill.generated.mjs'),
    exportName: 'AGENT_SKILL_MARKDOWN',
})

const localAgentSkillPath = resolve(repoRoot, '.agent/skills/david888-wiki-publisher/SKILL.md')
if (existsSync(dirname(localAgentSkillPath))) {
    copyFileSync(resolve(repoRoot, 'skills/SKILL.md'), localAgentSkillPath)
}

const packageSkillPath = resolve(repoRoot, 'packages/888wiki-skill/skills/david888-wiki-publisher/SKILL.md')
if (existsSync(resolve(repoRoot, 'packages/888wiki-skill'))) {
    mkdirSync(dirname(packageSkillPath), { recursive: true })
    copyFileSync(resolve(repoRoot, 'skills/SKILL.md'), packageSkillPath)
}

writeGeneratedModule({
    sourcePath: resolve(repoRoot, 'LLM_API_DOCS.md'),
    outputPath: resolve(generatedDir, 'api-docs.generated.mjs'),
    exportName: 'API_DOCS_MARKDOWN',
})

const wasmDir = resolve(repoRoot, 'static/wasm')
const wasmPkgDir = resolve(repoRoot, 'node_modules/@firecrawl/anydoc-wasm')

if (existsSync(wasmPkgDir)) {
    mkdirSync(wasmDir, { recursive: true })
    if (existsSync(resolve(wasmPkgDir, 'anydoc_wasm.js'))) {
        copyFileSync(resolve(wasmPkgDir, 'anydoc_wasm.js'), resolve(wasmDir, 'anydoc_wasm.js'))
    }
    if (existsSync(resolve(wasmPkgDir, 'anydoc_wasm_bg.wasm'))) {
        copyFileSync(resolve(wasmPkgDir, 'anydoc_wasm_bg.wasm'), resolve(wasmDir, 'anydoc_wasm_bg.wasm'))
    }
}

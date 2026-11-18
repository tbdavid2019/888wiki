import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
    SKILL_NAME,
    parseCliArgs,
    detectTargetDirs,
    fetchLatestSkill,
    installSkill,
    getSkillStatus,
    removeSkill,
} from '../packages/888wiki-skill/lib/installer.mjs'

test('888wiki-skill parseCliArgs supports npx impeccable-style update/install/remove flags', () => {
    assert.deepEqual(
        parseCliArgs(['update', '--global', '-y']),
        {
            command: 'update',
            global: true,
            project: false,
            yes: true,
            offline: false,
            json: false,
            help: false,
            version: false,
            url: 'https://wiki.david888.com/.well-known/agent-skills/david888-wiki-publisher/SKILL.md',
            customDirs: [],
        },
    )

    const projectArgs = parseCliArgs(['add', '-p', '--offline', '--dir', '/tmp/custom-skills'])
    assert.equal(projectArgs.command, 'install')
    assert.equal(projectArgs.project, true)
    assert.equal(projectArgs.offline, true)
    assert.equal(projectArgs.customDirs.length, 1)
})

test('888wiki-skill installs, updates, checks status, and removes cleanly across detected agent directories', async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), '888wiki-skill-test-'))
    const fakeHome = path.join(tmpRoot, 'home')
    const fakeCwd = path.join(tmpRoot, 'repo')

    try {
        mkdirSync(path.join(fakeHome, '.claude/skills'), { recursive: true })
        mkdirSync(path.join(fakeHome, '.gemini'), { recursive: true })
        mkdirSync(path.join(fakeCwd, '.agent/skills'), { recursive: true })

        const globalTargets = detectTargetDirs({ global: true, project: false, homeDir: fakeHome, cwd: fakeCwd })
        assert.ok(globalTargets.includes(path.join(fakeHome, '.claude/skills')))
        assert.ok(globalTargets.includes(path.join(fakeHome, '.gemini/skills')))

        const v1 = '---\nname: david888-wiki-publisher\ndescription: v1\n---\n# V1\n'
        const v2 = '---\nname: david888-wiki-publisher\ndescription: v2\n---\n# V2\n'

        const installRes = await installSkill({
            global: true,
            homeDir: fakeHome,
            cwd: fakeCwd,
            fetchImpl: async () => new Response(v1, { status: 200 }),
        })
        assert.equal(installRes.source, 'remote')
        assert.ok(installRes.results.every(r => r.status === 'installed'))
        assert.equal(readFileSync(path.join(fakeHome, '.claude/skills', SKILL_NAME, 'SKILL.md'), 'utf8'), v1)

        const secondRes = await installSkill({
            global: true,
            homeDir: fakeHome,
            cwd: fakeCwd,
            fetchImpl: async () => new Response(v1, { status: 200 }),
        })
        assert.ok(secondRes.results.every(r => r.status === 'unchanged'))

        const updateRes = await installSkill({
            global: true,
            homeDir: fakeHome,
            cwd: fakeCwd,
            fetchImpl: async () => new Response(v2, { status: 200 }),
        })
        assert.ok(updateRes.results.every(r => r.status === 'updated'))
        assert.equal(readFileSync(path.join(fakeHome, '.gemini/skills', SKILL_NAME, 'SKILL.md'), 'utf8'), v2)

        const statusRes = getSkillStatus({ global: true, homeDir: fakeHome, cwd: fakeCwd })
        assert.ok(statusRes.results.every(r => r.installed === true))

        const removeRes = removeSkill({ global: true, homeDir: fakeHome, cwd: fakeCwd })
        assert.ok(removeRes.results.every(r => r.status === 'removed'))
        assert.equal(existsSync(path.join(fakeHome, '.claude/skills', SKILL_NAME)), false)
    } finally {
        rmSync(tmpRoot, { recursive: true, force: true })
    }
})

test('888wiki-skill CLI binary executes offline update against custom --dir without errors', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), '888wiki-skill-bin-'))
    try {
        const cliPath = path.resolve(new URL('../packages/888wiki-skill/bin/888wiki-skill.mjs', import.meta.url).pathname)
        const out = execFileSync(process.execPath, [cliPath, 'update', '--offline', '-y', '--dir', tmpDir, '--json'], {
            encoding: 'utf8',
        })
        const parsed = JSON.parse(out)
        assert.equal(parsed.source, 'bundled')
        assert.equal(parsed.results[0].status, 'installed')
        assert.match(readFileSync(path.join(tmpDir, SKILL_NAME, 'SKILL.md'), 'utf8'), /write_canvas/)
    } finally {
        rmSync(tmpDir, { recursive: true, force: true })
    }
})

test('fetchLatestSkill falls back cleanly when remote payload lacks valid skill frontmatter', async () => {
    const res = await fetchLatestSkill({
        fetchImpl: async () => new Response('<html>404</html>', { status: 200 }),
    })
    assert.equal(res.source, 'bundled')
    assert.match(res.content, /name:\s*david888-wiki-publisher/)
})

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SKILL_NAME = 'david888-wiki-publisher'
export const DEFAULT_SKILL_URL = 'https://wiki.david888.com/.well-known/agent-skills/david888-wiki-publisher/SKILL.md'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const BUNDLED_SKILL_PATH = path.resolve(__dirname, '../skills/david888-wiki-publisher/SKILL.md')

const GLOBAL_AGENT_SKILL_PARENTS = [
    '.agents/skills',
    '.claude/skills',
    '.codex/skills',
    '.gemini/skills',
    '.gemini/config/skills',
    '.config/opencode/skills',
]

const PROJECT_AGENT_SKILL_PARENTS = [
    '.agent/skills',
    '.agents/skills',
    '.claude/skills',
]

/**
 * Compute deterministic SHA-256 hex digest for SKILL.md content.
 */
export function sha256Hex(content) {
    return createHash('sha256').update(String(content), 'utf8').digest('hex')
}

/**
 * Normalize line endings and ensure trailing newline for clean git/editor diffs.
 */
export function normalizeSkillContent(content) {
    const normalized = String(content || '').replace(/\r\n/g, '\n')
    return normalized.endsWith('\n') ? normalized : `${normalized}\n`
}

/**
 * Parse CLI arguments supporting install/add/update/upgrade/remove/uninstall/status/help.
 */
export function parseCliArgs(argv = []) {
    const args = Array.isArray(argv) ? [...argv] : []
    const parsed = {
        command: null,
        global: false,
        project: false,
        yes: false,
        offline: false,
        json: false,
        help: false,
        version: false,
        url: DEFAULT_SKILL_URL,
        customDirs: [],
    }

    for (let i = 0; i < args.length; i++) {
        const arg = args[i]
        if (arg === '-g' || arg === '--global') {
            parsed.global = true
        } else if (arg === '-p' || arg === '--project') {
            parsed.project = true
        } else if (arg === '-y' || arg === '--yes') {
            parsed.yes = true
        } else if (arg === '--offline') {
            parsed.offline = true
        } else if (arg === '--json') {
            parsed.json = true
        } else if (arg === '-h' || arg === '--help') {
            parsed.help = true
            parsed.command = 'help'
        } else if (arg === '-v' || arg === '--version') {
            parsed.version = true
            parsed.command = 'version'
        } else if (arg === '--url' && args[i + 1]) {
            parsed.url = String(args[++i]).trim()
        } else if (arg.startsWith('--url=')) {
            parsed.url = arg.slice('--url='.length).trim()
        } else if (arg === '--dir' && args[i + 1]) {
            parsed.customDirs.push(path.resolve(String(args[++i]).trim()))
        } else if (arg.startsWith('--dir=')) {
            parsed.customDirs.push(path.resolve(arg.slice('--dir='.length).trim()))
        } else if (!arg.startsWith('-') && !parsed.command) {
            parsed.command = normalizeCommand(arg)
        }
    }

    if (!parsed.command) {
        parsed.command = parsed.help ? 'help' : 'install'
    }
    if (!parsed.global && !parsed.project && parsed.customDirs.length === 0) {
        parsed.global = true
    }

    return parsed
}

function normalizeCommand(raw) {
    const cmd = String(raw || '').toLowerCase()
    if (cmd === 'add' || cmd === 'i') return 'install'
    if (cmd === 'upgrade' || cmd === 'u' || cmd === 'sync') return 'update'
    if (cmd === 'uninstall' || cmd === 'rm' || cmd === 'del' || cmd === 'delete') return 'remove'
    if (cmd === 'ls' || cmd === 'list' || cmd === 'check') return 'status'
    return cmd
}

/**
 * Resolve target skill parent directories (each receives `<dir>/david888-wiki-publisher/SKILL.md`).
 */
export function detectTargetDirs({
    global = true,
    project = false,
    customDirs = [],
    homeDir = os.homedir(),
    cwd = process.cwd(),
} = {}) {
    if (customDirs.length > 0) {
        return [...new Set(customDirs.map(dir => path.resolve(dir)))]
    }

    const targets = []

    if (project) {
        for (const rel of PROJECT_AGENT_SKILL_PARENTS) {
            const candidate = path.resolve(cwd, rel)
            if (existsSync(candidate) || existsSync(path.dirname(candidate))) {
                targets.push(candidate)
            }
        }
        if (targets.length === 0) {
            targets.push(path.resolve(cwd, '.agent/skills'))
        }
    }

    if (global || targets.length === 0) {
        for (const rel of GLOBAL_AGENT_SKILL_PARENTS) {
            const candidate = path.resolve(homeDir, rel)
            const agentRoot = path.dirname(candidate)
            if (existsSync(candidate) || (rel === '.agents/skills' && targets.length === 0) || existsSync(agentRoot)) {
                targets.push(candidate)
            }
        }
        if (targets.length === 0) {
            targets.push(path.resolve(homeDir, '.agents/skills'))
        }
    }

    return [...new Set(targets)]
}

/**
 * Fetch the canonical live SKILL.md from wiki.david888.com with bundled fallback.
 */
export async function fetchLatestSkill({
    url = DEFAULT_SKILL_URL,
    offline = false,
    fallbackPath = BUNDLED_SKILL_PATH,
    fetchImpl = globalThis.fetch,
    timeoutMs = 10000,
} = {}) {
    if (!offline && typeof fetchImpl === 'function') {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        try {
            const response = await fetchImpl(url, {
                headers: { 'Cache-Control': 'no-cache' },
                signal: controller.signal,
            })
            if (response.ok) {
                const body = normalizeSkillContent(await response.text())
                if (/name:\s*david888-wiki-publisher/i.test(body)) {
                    return {
                        content: body,
                        source: 'remote',
                        url,
                        digest: sha256Hex(body),
                    }
                }
            }
        } catch {
            // Fall through cleanly to bundled SKILL.md when offline or reachable check fails.
        } finally {
            clearTimeout(timer)
        }
    }

    if (!existsSync(fallbackPath)) {
        throw new Error(`Unable to fetch ${url} and bundled fallback SKILL.md is missing at ${fallbackPath}`)
    }
    const bundled = normalizeSkillContent(readFileSync(fallbackPath, 'utf8'))
    return {
        content: bundled,
        source: 'bundled',
        url,
        digest: sha256Hex(bundled),
    }
}

/**
 * Install or update david888-wiki-publisher across all resolved skill directories.
 */
export async function installSkill(options = {}) {
    const targetDirs = detectTargetDirs(options)
    const fetched = await fetchLatestSkill(options)
    const results = []

    for (const parentDir of targetDirs) {
        const skillDir = path.join(parentDir, SKILL_NAME)
        const targetFile = path.join(skillDir, 'SKILL.md')
        const existed = existsSync(targetFile)
        const previousDigest = existed ? sha256Hex(normalizeSkillContent(readFileSync(targetFile, 'utf8'))) : null

        if (existed && previousDigest === fetched.digest) {
            results.push({ parentDir, targetFile, status: 'unchanged', digest: fetched.digest })
            continue
        }

        mkdirSync(skillDir, { recursive: true })
        writeFileSync(targetFile, fetched.content, 'utf8')
        results.push({
            parentDir,
            targetFile,
            status: existed ? 'updated' : 'installed',
            digest: fetched.digest,
        })
    }

    return {
        skill: SKILL_NAME,
        source: fetched.source,
        url: fetched.url,
        digest: fetched.digest,
        results,
    }
}

/**
 * Remove installed david888-wiki-publisher folders from resolved skill directories.
 */
export function removeSkill(options = {}) {
    const targetDirs = detectTargetDirs(options)
    const results = []

    for (const parentDir of targetDirs) {
        const skillDir = path.join(parentDir, SKILL_NAME)
        const targetFile = path.join(skillDir, 'SKILL.md')
        if (!existsSync(skillDir)) {
            results.push({ parentDir, targetFile, status: 'absent' })
            continue
        }
        rmSync(skillDir, { recursive: true, force: true })
        results.push({ parentDir, targetFile, status: 'removed' })
    }

    return { skill: SKILL_NAME, results }
}

/**
 * Inspect installed SKILL.md digests across detected target directories.
 */
export function getSkillStatus(options = {}) {
    const targetDirs = detectTargetDirs(options)
    const results = targetDirs.map(parentDir => {
        const targetFile = path.join(parentDir, SKILL_NAME, 'SKILL.md')
        if (!existsSync(targetFile)) {
            return { parentDir, targetFile, installed: false, digest: null }
        }
        const content = normalizeSkillContent(readFileSync(targetFile, 'utf8'))
        return { parentDir, targetFile, installed: true, digest: sha256Hex(content) }
    })

    return { skill: SKILL_NAME, results }
}

export function formatHelpText() {
    return [
        '888wiki-skill — David888 Wiki AI Agent Skill Installer (wiki.david888.com)',
        '',
        'Usage:',
        '  npx --yes 888wiki-skill <command> [options]',
        '',
        'Commands:',
        '  install, add         Install david888-wiki-publisher skill (default)',
        '  update, upgrade      Fetch latest live SKILL.md and update installed copies',
        '  status, ls           Show installed directories and SHA-256 digests',
        '  remove, uninstall    Remove installed skill directories',
        '',
        'Options:',
        '  -g, --global         Target global agent skill directories (default)',
        '  -p, --project        Target current project workspace (.agent/skills, etc.)',
        '  -y, --yes            Non-interactive mode',
        '  --dir <path>         Target a specific skills parent directory (repeatable)',
        '  --url <url>          Override canonical SKILL.md URL',
        '  --offline            Use bundled SKILL.md without network fetch',
        '  --json               Output machine-readable JSON',
        '  -h, --help           Show help',
        '  -v, --version        Show package version',
        '',
        'Examples:',
        '  npx --yes 888wiki-skill install --global -y',
        '  npx --yes 888wiki-skill update --global -y',
        '  npx --yes 888wiki-skill update --project -y',
    ].join('\n')
}

export async function runCli(argv = [], io = {}) {
    const stdout = io.stdout || (line => process.stdout.write(`${line}\n`))
    const args = parseCliArgs(argv)

    if (args.help) {
        stdout(formatHelpText())
        return 0
    }
    if (args.version) {
        const pkgPath = path.resolve(__dirname, '../package.json')
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
        stdout(pkg.version)
        return 0
    }

    if (args.command === 'status') {
        const status = getSkillStatus(args)
        if (args.json) {
            stdout(JSON.stringify(status, null, 2))
            return 0
        }
        stdout(`Skill: ${status.skill}`)
        for (const item of status.results) {
            stdout(`  ${item.installed ? '✓' : '-'} ${item.targetFile}${item.digest ? ` (${item.digest.slice(0, 12)})` : ' (not installed)'}`)
        }
        return 0
    }

    if (args.command === 'remove') {
        const removed = removeSkill(args)
        if (args.json) {
            stdout(JSON.stringify(removed, null, 2))
            return 0
        }
        for (const item of removed.results) {
            stdout(`  ${item.status === 'removed' ? '✓ removed' : '- absent'}: ${item.targetFile}`)
        }
        return 0
    }

    if (args.command === 'install' || args.command === 'update') {
        const summary = await installSkill(args)
        if (args.json) {
            stdout(JSON.stringify(summary, null, 2))
            return 0
        }
        stdout(`david888-wiki-publisher (${summary.source === 'remote' ? `live: ${summary.url}` : 'bundled offline copy'}, sha256:${summary.digest.slice(0, 12)})`)
        for (const item of summary.results) {
            stdout(`  ${item.status.padEnd(9)} ${item.targetFile}`)
        }
        return 0
    }

    stdout(`Unknown command: ${args.command}\n\n${formatHelpText()}`)
    return 1
}

# 888wiki-skill

Official CLI installer & updater for the **David888 Wiki** (`wiki.david888.com`) AI Agent Skill — supporting Markdown, BlockNote, **JSON Canvas 1.0** (`write_canvas`, `generate_canvas_from_wikilinks`), **Excalidraw Whiteboards** (`write_whiteboard`), Share Vault modes, and native `/mcp`.

## Install & Update

```bash
# Install globally for Claude Code, Codex, Antigravity, Gemini, Cursor, OpenCode, ~/.agents/skills
npx --yes 888wiki-skill install --global -y

# Update to latest live SKILL.md from https://wiki.david888.com
npx --yes 888wiki-skill update --global -y

# Install into current project workspace (.agent/skills)
npx --yes 888wiki-skill update --project -y

# Inspect installed locations and digests
npx --yes 888wiki-skill status --global
```

# OpenClaw Skill Router

> **⚠️ Prototype**: This is a proof-of-concept. Full functionality requires a small change to OpenClaw core to support dynamic skill loading. See [Integration Status](#integration-status) below.

Dynamic skill routing for OpenClaw - load only relevant skills per message using BM25 scoring.

## Why Skill Routing?

Traditional skill systems inject all skill metadata into every conversation, flooding context with irrelevant information. At 50+ skills, this consumes **10,000-25,000 tokens** before the agent even reads the user's message.

**Skill Router** takes a different approach: score each message against a skill index and inject only the 0-3 most relevant skills.

```
Traditional: Agent → loads ALL skills → context flooded (25k tokens)
Skill Router: Agent → scores message → loads 0-3 skills (~500 tokens)
```

## Features

- **BM25 Scoring**: Industry-standard text relevance algorithm (same as Elasticsearch)
- **Keyword Extraction**: Automatic extraction from SKILL.md frontmatter + `## Keywords` sections
- **Always-Include**: Mark critical skills to always load regardless of score
- **Configurable Thresholds**: Tune max results and minimum scores
- **Zero Dependencies at Runtime**: Pure Node.js, no native modules
- **Fast**: In-memory scoring, sub-millisecond per query

## Installation

### Quick Install

```bash
# Clone to OpenClaw skills directory
git clone https://github.com/anthropics/skill-router.git ~/.openclaw/workspace/skills/skill-router
cd ~/.openclaw/workspace/skills/skill-router

# Install dependencies and build
npm install && npm run build

# Build the skill index
./bins/skill-router build
```

### Verify Installation

```bash
# Check index status
./bins/skill-router status

# Test matching
./bins/skill-router match "create a github pull request"
```

## How It Works

### Architecture

```
User Message
     ↓
skill-router match "<message>"
     ↓
BM25 Score Against Index
     ↓
.skill-router-context.md ← Top 0-3 skills
     ↓
Agent reads matched SKILL.md files
```

### The Routing Protocol

On every user message, the agent:

1. Runs `skill-router match "<message>"` to score against the index
2. Reads `.skill-router-context.md` for matched skills
3. Reads each matched skill's `SKILL.md` for detailed instructions
4. Proceeds with the task using skill guidance

### BM25 Scoring

[BM25](https://en.wikipedia.org/wiki/Okapi_BM25) (Best Match 25) is the standard algorithm for text relevance scoring:

- **TF (Term Frequency)**: How often query terms appear in the skill
- **IDF (Inverse Document Frequency)**: Rarer terms weighted higher
- **Length Normalization**: Shorter documents aren't penalized

Parameters (configurable):
- `k1 = 1.2` - Term frequency saturation
- `b = 0.75` - Document length normalization

## CLI Reference

### skill-router build

Build the skill index by scanning skill directories.

```bash
skill-router build [options]

Options:
  -o, --output <path>     Output path for index file
  -p, --paths <paths...>  Additional skill directories to scan
  -f, --force             Force rebuild
```

Example:
```bash
# Build with default paths (~/.openclaw/workspace/skills, ~/.openclaw/managed-skills)
skill-router build

# Build with additional paths
skill-router build -p ./my-skills ./other-skills
```

### skill-router match

Score a message and write context file.

```bash
skill-router match <message> [options]

Options:
  -i, --index <path>      Path to index file
  -o, --output <path>     Output path for context file
  -n, --max-results <n>   Maximum skills to return (default: 3)
  -t, --threshold <n>     Minimum score threshold (default: 0.3)
  --json                  Output as JSON
```

Example:
```bash
skill-router match "send a message on slack"
# Matched 2 skill(s):
#   - slack (score: 5.23) [send, slack, message]
#   - bluebubbles (score: 2.11) [send, message]
```

### skill-router status

Show index status and configuration.

```bash
skill-router status [options]

Options:
  -i, --index <path>  Path to index file
  --json              Output as JSON
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SKILL_ROUTER_MAX_RESULTS` | `3` | Maximum skills to inject per message |
| `SKILL_ROUTER_THRESHOLD` | `0.3` | Minimum BM25 score to include |
| `SKILL_ROUTER_ALWAYS_INCLUDE` | `skill-router` | Comma-separated skill names |
| `SKILL_ROUTER_BM25_K1` | `1.2` | Term frequency saturation |
| `SKILL_ROUTER_BM25_B` | `0.75` | Length normalization |

### Skill Keywords

Skills can define explicit keywords in their `SKILL.md`:

```markdown
---
name: my-skill
description: Does something useful
---

# My Skill

Content here...

## Keywords

keyword1, keyword2, specific phrase
```

Keywords are weighted higher than body content during scoring.

### Always-Include Skills

Mark a skill to always be included regardless of score:

```yaml
---
name: critical-skill
description: Always needed
metadata:
  openclaw:
    always: true
---
```

## Skill Discovery

Skills are scanned from these directories (in priority order):

1. `~/.openclaw/workspace/skills/` - User workspace (highest priority)
2. `~/.openclaw/managed-skills/` - Installed via ClawHub
3. Additional paths via `-p` flag

Each skill must have a `SKILL.md` with YAML frontmatter containing at minimum:
- `name`: Unique skill identifier
- `description`: What the skill does (used for scoring)

## Output Format

The context file (`.skill-router-context.md`) uses XML format:

```xml
<available_skills>
  <skill name="github" score="7.46" matched="github, pull">
    <description>Interact with GitHub using the gh CLI...</description>
    <location>/path/to/skills/github</location>
  </skill>
</available_skills>
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run dev
```

## Token Savings Example

With 50 skills averaging 200 tokens each:

| Approach | Tokens per message |
|----------|-------------------|
| Load all skills | ~10,000 |
| Skill Router (3 max) | ~600 |
| **Savings** | **94%** |

Over a 100-message conversation, that's **940,000 tokens saved**.

## Integration Status

**Current State**: Prototype / Proof of Concept

This skill-router implements the scoring engine, CLI, and context injection. However, **OpenClaw currently has no way to disable its built-in skill injection**. Without a core change, both systems run simultaneously (defeating the purpose).

### What's Needed

A small change to OpenClaw core (~20 lines) to add:

```json
{
  "skills": {
    "dynamic": true,
    "router": "skill-router"
  }
}
```

When `dynamic: true`, OpenClaw would skip injecting all skills and defer to the router.

### Current Workaround

None that fully works. You could:
- Set `allowBundled: []` to disable bundled skills (but workspace/managed skills still load)
- Manually disable each skill via `entries.<name>.enabled: false` (tedious)

### Path Forward

1. Open a GitHub Discussion on clawdbot/clawdbot proposing dynamic skill loading
2. Submit a minimal PR if the maintainers are receptive
3. Until then, this remains a proof-of-concept

See `docs/OPENCLAW_INTEGRATION_RESEARCH.md` for technical details.

## Roadmap

### Phase 1: Core ✅

- [x] SKILL.md with routing instructions and agent protocol
- [x] Index builder CLI (BM25 keyword extraction)
- [x] Scoring engine with configurable thresholds
- [x] Context injection via `.skill-router-context.md`
- [x] `skill-router build`, `match`, and `status` commands
- [x] Configurable always-include list
- [x] Unit and integration tests

### Phase 2: Polish 🚧

- [ ] Auto-rebuild on skill file changes (file watcher)
- [ ] Scoring weight tuning based on test corpus
- [ ] ClawHub packaging for easy installation
- [ ] `skill-router watch` command for development

### Phase 3: Advanced 📋

- [ ] Optional embedding support (OpenAI `text-embedding-3-small` or local models)
- [ ] Hybrid BM25 + vector scoring with configurable weights
- [ ] Skill usage analytics (track which skills match most/least)
- [ ] Multi-agent routing (different skill sets per agent profile)
- [ ] Community index sharing via ClawHub (pre-built indexes for skill packs)

## Contributing

Contributions welcome! Areas where help is needed:

- **Test corpus**: Real-world message/skill pairs for tuning scoring weights
- **Embedding integration**: Local model support via Ollama
- **ClawHub packaging**: Distribution and install scripts

## License

MIT

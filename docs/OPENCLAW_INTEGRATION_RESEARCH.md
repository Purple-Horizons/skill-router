# OpenClaw Skill Injection Research

Investigation into how OpenClaw/clawdbot handles skill injection, and how skill-router can integrate.

## Summary

**Problem**: Skill-router as a standalone skill cannot disable OpenClaw's built-in skill injection. A core PR is needed.

**Recommendation**: Submit a PR to clawdbot adding `skills.dynamic` config option.

---

## Skill Injection Pipeline

```
buildWorkspaceSkillSnapshot()
    ↓
loadSkillsFromDir() [multiple sources]
    ↓
formatSkillsForPrompt() [@mariozechner/pi-coding-agent]
    ↓
resolveSkillsPromptForRun()
    ↓
buildEmbeddedSystemPrompt()
    ↓
buildAgentSystemPrompt()
    ↓
createSystemPromptOverride()
    ↓
createAgentSession() [skills param is empty array]
```

**Key insight**: Skills are injected as **formatted XML text in the system prompt**, not as structured data. The Pi agent receives `skills: []` (empty array) and reads skill info from the prompt text.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/agents/skills/workspace.ts` | Skill loading, filtering, snapshot building |
| `src/agents/system-prompt.ts` | System prompt construction |
| `src/agents/pi-embedded-runner/run/attempt.ts` | Agent session creation |
| `src/config/types.skills.ts` | Skill configuration types |

---

## Configuration Options

### Skills Loading Config

```typescript
// src/config/types.skills.ts
export type SkillsConfig = {
  allowBundled?: string[];              // Bundled skill allowlist
  load?: {
    extraDirs?: string[];               // Additional skill folders
    watch?: boolean;                    // Watch for changes
    watchDebounceMs?: number;
  };
  entries?: Record<string, {
    enabled?: boolean;                  // Enable/disable individual skills
    apiKey?: string;
    env?: Record<string, string>;
    config?: Record<string, unknown>;
  }>;
};
```

### Skill Sources (Precedence Order)

1. **Extra directories** (`skills.load.extraDirs`) - Lowest precedence
2. **Bundled skills** (`clawdbot-bundled`) - Subject to `allowBundled` filter
3. **Managed skills** (`~/.clawdbot/skills`)
4. **Workspace skills** (`<workspace>/skills`) - Highest precedence

### Bundled Allowlist Behavior

```typescript
// src/agents/skills/config.ts
export function isBundledSkillAllowed(entry: SkillEntry, allowlist?: string[]): boolean {
  if (!allowlist || allowlist.length === 0) return true;  // Default: allow ALL
  if (!isBundledSkill(entry)) return true;                 // Non-bundled always allowed
  return allowlist.includes(entry.skill.name);
}
```

**Important**: `allowBundled: []` (empty array) disables bundled skills, but workspace/managed skills are ALWAYS loaded.

---

## Skill Filtering Criteria

Skills are filtered by (in `workspace.ts` lines 44-62):

1. **Individual `enabled` flag** - `config.skills.entries.<skillName>.enabled: false`
2. **Bundled allowlist** - `config.skills.allowBundled: ["skill1", "skill2"]`
3. **OS/Platform matching** - `clawdbot.os: ["darwin", "linux"]`
4. **Binary availability** - `clawdbot.requires.bins: ["git", "node"]`
5. **Environment variables** - `clawdbot.requires.env: ["API_KEY"]`
6. **Config truthiness** - `clawdbot.requires.config: ["browser.enabled"]`

### disableModelInvocation Flag

```typescript
// Skills with this flag are loaded but NOT included in system prompt
const promptEntries = eligible.filter(
  (entry) => entry.invocation?.disableModelInvocation !== true,
);
```

---

## System Prompt Building

```typescript
// src/agents/system-prompt.ts
export function buildAgentSystemPrompt(params: {
  workspaceDir: string;
  skillsPrompt?: string;              // Pre-formatted XML with all skills
  promptMode?: "full" | "minimal" | "none";
  // ...
}) {
  // Skills section only included if skillsPrompt is provided and not empty
  // If promptMode === "minimal" (subagents), skills section is OMITTED
}
```

---

## Agent Session Creation

```typescript
// src/agents/pi-embedded-runner/run/attempt.ts (lines 446-461)
({ session } = await createAgentSession({
  // ...
  skills: [],                    // <-- EMPTY!
  contextFiles: [],              // <-- EMPTY!
}));
```

**Critical finding**: Pi agent receives empty skills array. Skills are entirely managed via system prompt text.

---

## Hooks System

```typescript
// src/config/types.hooks.ts
// Hooks can intercept via config.hooks.internal.handlers
// Events: 'command:new', 'session:start', etc.

// Bootstrap context hooks in bootstrap-files.ts
applyBootstrapHookOverrides({
  files: bootstrapFiles,
  workspaceDir,
  config,
  sessionKey,
  sessionId,
  agentId,
});
```

---

## Integration Options

### Option A: Config-Based (User Manual Setup)

Users disable all skills except skill-router:

```json
{
  "skills": {
    "allowBundled": [],
    "entries": {
      "some-skill": { "enabled": false },
      "another-skill": { "enabled": false }
    }
  }
}
```

**Problem**: Tedious, requires disabling each skill manually.

### Option B: Core PR (Recommended)

Add dynamic skill loading config:

```json
{
  "skills": {
    "dynamic": true,
    "router": "skill-router"
  }
}
```

**Implementation** (~20 lines in `resolveSkillsPromptForRun()`):

```typescript
export function resolveSkillsPromptForRun(params) {
  // Check for dynamic routing
  if (params.config?.skills?.dynamic) {
    const routerSkill = params.entries?.find(e =>
      e.skill.name === params.config?.skills?.router
    );
    return routerSkill ? formatSkillsForPrompt([routerSkill.skill]) : '';
  }
  // ... existing logic
}
```

### Option C: Hook-Based

Use `session:start` hook to modify system prompt after it's built.

**Problem**: Hooks run after prompt construction, requires post-processing/string manipulation.

---

## Proposed PR Changes

### 1. Add Config Types

```typescript
// src/config/types.skills.ts
export type SkillsConfig = {
  // ... existing
  dynamic?: boolean;           // Enable dynamic skill loading
  router?: string;             // Skill name to use as router
};
```

### 2. Modify resolveSkillsPromptForRun

```typescript
// src/agents/skills/workspace.ts
export function resolveSkillsPromptForRun(params: {
  skillsSnapshot?: SkillSnapshot;
  entries?: SkillEntry[];
  config?: ClawdbotConfig;
  workspaceDir: string;
}): string {
  // NEW: Dynamic routing mode
  if (params.config?.skills?.dynamic) {
    const routerName = params.config.skills.router ?? 'skill-router';
    const routerEntry = params.entries?.find(e => e.skill.name === routerName);

    if (routerEntry) {
      // Only include the router skill in system prompt
      return formatSkillsForPrompt([routerEntry.skill]);
    }

    // Fallback: no router found, return empty (no skills in prompt)
    return '';
  }

  // Existing logic...
  const snapshotPrompt = params.skillsSnapshot?.prompt?.trim();
  if (snapshotPrompt) return snapshotPrompt;
  // ...
}
```

### 3. Documentation

Add to OpenClaw docs:

```markdown
## Dynamic Skill Loading

For large skill collections (50+), enable dynamic loading to reduce context usage:

\`\`\`json
{
  "skills": {
    "dynamic": true,
    "router": "skill-router"
  }
}
\`\`\`

When enabled, only the router skill is loaded into the system prompt.
The router scores each message and injects relevant skills on-demand.
```

---

## References

- OpenClaw Skills System: `src/agents/skills/`
- System Prompt: `src/agents/system-prompt.ts`
- Agent Runner: `src/agents/pi-embedded-runner/`
- Config Types: `src/config/types.skills.ts`

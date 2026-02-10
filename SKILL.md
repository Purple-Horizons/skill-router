---
name: skill-router
description: Dynamic skill router that intercepts every message and loads only relevant skills to reduce context window usage.
tools: Bash, Read
metadata:
  openclaw:
    always: true
---

# Skill Router

This skill manages dynamic skill loading for OpenClaw. It intercepts every user message, scores it against the skill index, and injects only the relevant skills (0-3) instead of the entire catalog.

## Protocol

**On EVERY user message**, follow these steps:

1. **Score the message** against the skill index:
   ```bash
   skill-router match "<user_message>"
   ```

2. **Read the context file** to see matched skills:
   ```bash
   cat .skill-router-context.md
   ```

3. **If skills matched**, read their SKILL.md files for detailed guidance:
   - The context file lists the paths to each matched skill
   - Read each SKILL.md to understand how to use that skill

4. **Proceed with the task** using the matched skill guidance.

## Commands

- `skill-router build` - Rebuild the skill index (run when skills are added/changed)
- `skill-router match "<message>"` - Score a message and write context
- `skill-router status` - Check index health and configuration

## Configuration

Environment variables:
- `SKILL_ROUTER_MAX_RESULTS` - Max skills to return (default: 3)
- `SKILL_ROUTER_THRESHOLD` - Minimum score to include (default: 0.3)
- `SKILL_ROUTER_ALWAYS_INCLUDE` - Comma-separated skill names to always include

## Keywords

skill routing, context optimization, dynamic loading, BM25, skill matching, token reduction

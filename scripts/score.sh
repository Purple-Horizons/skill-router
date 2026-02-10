#!/bin/bash
# Score a message against the skill index
# Usage: ./scripts/score.sh "your message here"

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Check if message provided
if [ -z "$1" ]; then
    echo "Usage: $0 \"<message>\""
    exit 1
fi

# Run the match command
node "$ROOT_DIR/bins/skill-router" match "$1"

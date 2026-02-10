#!/bin/bash
# Check skill index status
# Usage: ./scripts/status.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Run the status command
node "$ROOT_DIR/bins/skill-router" status

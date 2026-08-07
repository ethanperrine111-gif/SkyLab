"""Example: Claude drives SimScale via a plain Python script.

This is the alternative to the MCP server — a standalone script that
lets Claude propose actions and this script execute them against the
SimScale API. Useful for batch/CI use where Claude Desktop isn't
running.

Usage:
    python -m integrations.simscale.orchestrator
"""

from __future__ import annotations

import json
import os
import sys

try:
    from anthropic import Anthropic
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        "The `anthropic` SDK is not installed. Run:\n"
        "    pip install -r integrations/simscale/requirements.txt"
    ) from exc

from .client import SimScaleClient, SimScaleConfigError


# Default to the current-flagship model. Override via env if needed.
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-opus-5")


def main() -> int:
    try:
        ss = SimScaleClient.from_env()
    except SimScaleConfigError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not anthropic_key:
        print("error: ANTHROPIC_API_KEY is not set.", file=sys.stderr)
        return 2

    claude = Anthropic(api_key=anthropic_key)

    # 1. Grab live SimScale context.
    projects = ss.list_projects(limit=10)
    print(f"Found {len(projects)} SimScale project(s).")

    # 2. Ask Claude what to do next given that context.
    prompt = (
        "You are helping analyze SimScale projects. Here is the list of "
        "available projects as JSON:\n\n"
        f"{json.dumps(projects, indent=2)}\n\n"
        "Pick the most recently-created project and describe, in two "
        "sentences, what a reasonable first CFD analysis would be."
    )

    resp = claude.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )

    text = "".join(block.text for block in resp.content if block.type == "text")
    print("\n--- Claude's suggestion ---")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

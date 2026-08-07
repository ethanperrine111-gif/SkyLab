"""SimScale MCP server.

Exposes a small set of SimScale operations as MCP tools so Claude Desktop
(or any MCP client) can drive SimScale directly from a chat window.

Run:
    python -m integrations.simscale.mcp_server

Or wire it into Claude Desktop's `claude_desktop_config.json`:

    {
      "mcpServers": {
        "simscale": {
          "command": "python",
          "args": ["-m", "integrations.simscale.mcp_server"],
          "cwd": "/absolute/path/to/SkyLab",
          "env": {
            "SIMSCALE_API_KEY": "sk-…"
          }
        }
      }
    }

Tools exposed:
    - simscale_list_projects
    - simscale_list_simulations
    - simscale_list_simulation_runs
    - simscale_get_run_status
    - simscale_start_run
    - simscale_stop_run
"""

from __future__ import annotations

import json
from typing import Any

try:
    from mcp.server.fastmcp import FastMCP
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        "The `mcp` package is not installed. Run:\n"
        "    pip install -r integrations/simscale/requirements.txt"
    ) from exc

from .client import SimScaleClient, SimScaleConfigError


mcp = FastMCP("simscale")


def _client() -> SimScaleClient:
    """Resolve credentials on every call so a mid-session key rotation works."""
    try:
        return SimScaleClient.from_env()
    except SimScaleConfigError as exc:
        # FastMCP surfaces raised exceptions as tool errors — good enough here.
        raise RuntimeError(str(exc)) from exc


@mcp.tool()
def simscale_list_projects(limit: int = 20) -> str:
    """List SimScale projects available to the API key.

    Args:
        limit: Max number of projects to return (default 20).

    Returns:
        JSON string with project_id, name, created_at, measurement_system.
    """
    return json.dumps(_client().list_projects(limit=limit), indent=2)


@mcp.tool()
def simscale_list_simulations(project_id: str, limit: int = 20) -> str:
    """List simulations inside a project.

    Args:
        project_id: The project's ID (get from `simscale_list_projects`).
        limit: Max simulations to return.
    """
    c = _client()
    resp = c.simulations.get_simulations(project_id=project_id, limit=limit)
    out: list[dict[str, Any]] = []
    for s in getattr(resp, "embedded", None) or []:
        out.append({
            "simulation_id": getattr(s, "simulation_id", None),
            "name": getattr(s, "name", None),
            "status": getattr(s, "status", None),
            "analysis_type": getattr(getattr(s, "spec", None), "type", None),
        })
    return json.dumps(out, indent=2)


@mcp.tool()
def simscale_list_simulation_runs(
    project_id: str,
    simulation_id: str,
    limit: int = 20,
) -> str:
    """List runs for a simulation."""
    c = _client()
    resp = c.simulation_runs.get_simulation_runs(
        project_id=project_id,
        simulation_id=simulation_id,
        limit=limit,
    )
    out: list[dict[str, Any]] = []
    for r in getattr(resp, "embedded", None) or []:
        out.append({
            "run_id": getattr(r, "run_id", None),
            "name": getattr(r, "name", None),
            "status": getattr(r, "status", None),
            "progress": getattr(r, "progress", None),
        })
    return json.dumps(out, indent=2)


@mcp.tool()
def simscale_get_run_status(project_id: str, simulation_id: str, run_id: str) -> str:
    """Get status + progress for a single simulation run."""
    return json.dumps(_client().get_run_status(project_id, simulation_id, run_id), indent=2)


@mcp.tool()
def simscale_start_run(project_id: str, simulation_id: str, name: str = "") -> str:
    """Kick off a new simulation run.

    Args:
        project_id: Project ID.
        simulation_id: Simulation ID.
        name: Optional human-readable name for this run.
    """
    import simscale_sdk

    c = _client()
    run = simscale_sdk.SimulationRun(name=name or "Claude-initiated run")
    created = c.simulation_runs.create_simulation_run(
        project_id=project_id,
        simulation_id=simulation_id,
        simulation_run=run,
    )
    run_id = getattr(created, "run_id", None)
    if run_id:
        c.simulation_runs.start_simulation_run(
            project_id=project_id,
            simulation_id=simulation_id,
            run_id=run_id,
        )
    return json.dumps({"run_id": run_id, "started": bool(run_id)}, indent=2)


@mcp.tool()
def simscale_stop_run(project_id: str, simulation_id: str, run_id: str) -> str:
    """Stop a running simulation."""
    _client().simulation_runs.stop_simulation_run(
        project_id=project_id,
        simulation_id=simulation_id,
        run_id=run_id,
    )
    return json.dumps({"stopped": True, "run_id": run_id}, indent=2)


if __name__ == "__main__":
    # FastMCP defaults to stdio transport — that is what Claude Desktop expects.
    mcp.run()

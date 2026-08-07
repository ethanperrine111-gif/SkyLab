"""Thin wrapper around the official simscale-sdk.

The MCP server (`mcp_server.py`) and the orchestrator example
(`orchestrator.py`) both go through this module, so credential handling
and error shape live in one place.

Requires:
    pip install -r requirements.txt

Env vars (loaded from `.env` if python-dotenv is installed):
    SIMSCALE_API_KEY  — required
    SIMSCALE_HOST     — optional; defaults to https://api.simscale.com
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import cached_property
from typing import Any

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # dotenv is convenience only; env vars from the parent shell still work.
    pass

try:
    import simscale_sdk
except ImportError as exc:  # pragma: no cover - import-time guidance
    raise ImportError(
        "simscale-sdk is not installed. Run:\n"
        "    pip install -r integrations/simscale/requirements.txt"
    ) from exc


DEFAULT_HOST = "https://api.simscale.com"


class SimScaleConfigError(RuntimeError):
    """Raised when required SimScale credentials are missing."""


@dataclass
class SimScaleClient:
    """Lazily-constructed SimScale API client.

    Access API groups as attributes: `client.projects`, `client.simulations`,
    `client.simulation_runs`, `client.geometries`, `client.meshes`,
    `client.reports`, `client.storage`.
    """

    api_key: str
    host: str = DEFAULT_HOST

    @classmethod
    def from_env(cls) -> "SimScaleClient":
        api_key = os.environ.get("SIMSCALE_API_KEY", "").strip()
        if not api_key:
            raise SimScaleConfigError(
                "SIMSCALE_API_KEY is not set. Put it in "
                "integrations/simscale/.env or export it in your shell."
            )
        host = os.environ.get("SIMSCALE_HOST", DEFAULT_HOST).strip() or DEFAULT_HOST
        return cls(api_key=api_key, host=host)

    @cached_property
    def _api_client(self) -> "simscale_sdk.ApiClient":
        cfg = simscale_sdk.Configuration()
        cfg.host = self.host
        cfg.api_key["X-API-KEY"] = self.api_key
        return simscale_sdk.ApiClient(cfg)

    # --- API groups ---------------------------------------------------------

    @cached_property
    def projects(self) -> "simscale_sdk.ProjectsApi":
        return simscale_sdk.ProjectsApi(self._api_client)

    @cached_property
    def simulations(self) -> "simscale_sdk.SimulationsApi":
        return simscale_sdk.SimulationsApi(self._api_client)

    @cached_property
    def simulation_runs(self) -> "simscale_sdk.SimulationRunsApi":
        return simscale_sdk.SimulationRunsApi(self._api_client)

    @cached_property
    def geometries(self) -> "simscale_sdk.GeometriesApi":
        return simscale_sdk.GeometriesApi(self._api_client)

    @cached_property
    def meshes(self) -> "simscale_sdk.MeshOperationsApi":
        return simscale_sdk.MeshOperationsApi(self._api_client)

    @cached_property
    def reports(self) -> "simscale_sdk.ReportsApi":
        return simscale_sdk.ReportsApi(self._api_client)

    @cached_property
    def storage(self) -> "simscale_sdk.StorageApi":
        return simscale_sdk.StorageApi(self._api_client)

    # --- Convenience shortcuts ---------------------------------------------

    def list_projects(self, limit: int = 20) -> list[dict[str, Any]]:
        """Return a list of the caller's projects, most-recent first.

        The SDK returns rich model objects; we flatten to plain dicts so the
        MCP layer can serialize them without special handling.
        """
        resp = self.projects.get_projects(limit=limit)
        embedded = getattr(resp, "embedded", None) or []
        out: list[dict[str, Any]] = []
        for p in embedded:
            out.append({
                "project_id": getattr(p, "project_id", None),
                "name": getattr(p, "name", None),
                "created_at": _iso(getattr(p, "created_at", None)),
                "measurement_system": getattr(p, "measurement_system", None),
            })
        return out

    def get_run_status(self, project_id: str, simulation_id: str, run_id: str) -> dict[str, Any]:
        run = self.simulation_runs.get_simulation_run(
            project_id=project_id,
            simulation_id=simulation_id,
            run_id=run_id,
        )
        return {
            "run_id": getattr(run, "run_id", run_id),
            "status": getattr(run, "status", None),
            "progress": getattr(run, "progress", None),
            "created_at": _iso(getattr(run, "created_at", None)),
            "started_at": _iso(getattr(run, "started_at", None)),
            "finished_at": _iso(getattr(run, "finished_at", None)),
            "name": getattr(run, "name", None),
        }


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    iso = getattr(value, "isoformat", None)
    return iso() if callable(iso) else str(value)

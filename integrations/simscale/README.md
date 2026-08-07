# SimScale Integration

Connects Claude to SimScale two ways: as an **MCP server** Claude Desktop can call directly (recommended), and as a **plain Python orchestrator** for scripted / CI use.

The MCP server wraps the official [`simscale-sdk`](https://github.com/SimScaleGmbH/simscale-python-sdk) and exposes a small set of tools (`simscale_list_projects`, `simscale_start_run`, `simscale_get_run_status`, …) so a Claude Desktop chat can drive real simulations. SkyLab.html itself is not modified — this integration lives alongside it as a Python subproject.

> **Requires** a SimScale Enterprise plan. API access is not available on free tiers.

## 1. Install

From the repo root:

```bash
python -m venv .venv
source .venv/bin/activate           # Windows: .venv\Scripts\activate
pip install -r integrations/simscale/requirements.txt
```

## 2. Configure credentials

```bash
cp integrations/simscale/.env.example integrations/simscale/.env
# then edit .env and paste your SimScale API key
```

Get the key from **Manage Account → API Keys** on simscale.com. `.env` is gitignored — do not commit it.

## 3a. Use it from Claude Desktop (MCP)

Add this to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "simscale": {
      "command": "python",
      "args": ["-m", "integrations.simscale.mcp_server"],
      "cwd": "/absolute/path/to/SkyLab",
      "env": {
        "SIMSCALE_API_KEY": "sk-your-key-here",
        "SIMSCALE_HOST": "https://api.simscale.com"
      }
    }
  }
}
```

Restart Claude Desktop. In a new chat you should see the `simscale` server listed, and asking *"list my SimScale projects"* will call `simscale_list_projects` and stream the JSON back.

Tools exposed:

| Tool | What it does |
|---|---|
| `simscale_list_projects` | List projects visible to the API key. |
| `simscale_list_simulations` | List simulations inside a project. |
| `simscale_list_simulation_runs` | List runs for a simulation. |
| `simscale_get_run_status` | Status + progress for one run. |
| `simscale_start_run` | Create + start a new simulation run. |
| `simscale_stop_run` | Stop a running simulation. |

## 3b. Use it from a Python script (orchestrator)

For batch or CI use where Claude Desktop isn't running. The example script pulls the project list from SimScale and asks Claude to suggest a first analysis:

```bash
export ANTHROPIC_API_KEY=sk-ant-…      # only needed for orchestrator.py
python -m integrations.simscale.orchestrator
```

You can import `SimScaleClient` directly if you're wiring SimScale into your own code:

```python
from integrations.simscale import SimScaleClient

ss = SimScaleClient.from_env()
for p in ss.list_projects(limit=5):
    print(p["name"], p["project_id"])
```

## Files

```
integrations/simscale/
├── README.md               ← you are here
├── requirements.txt        ← simscale-sdk, anthropic, mcp, python-dotenv
├── .env.example            ← copy to .env and fill in
├── .gitignore              ← keeps .env out of git
├── __init__.py
├── client.py               ← thin SimScale SDK wrapper (credentials + shortcuts)
├── mcp_server.py           ← FastMCP server for Claude Desktop
└── orchestrator.py         ← standalone Claude → SimScale example
```

## Troubleshooting

- **`SIMSCALE_API_KEY is not set`** — the process didn't see the env var. Either export it in your shell or make sure `.env` is in `integrations/simscale/`. Claude Desktop reads env from the `env` block in `claude_desktop_config.json`, not from your `.env` file.
- **`401 Unauthorized` from SimScale** — the key is wrong or your plan doesn't include API access. Regenerate under Manage Account → API Keys and confirm you're on the Enterprise plan.
- **Claude Desktop doesn't show the `simscale` server** — check the Desktop app's MCP logs (Settings → Developer → Open logs). The most common cause is `cwd` pointing at the wrong directory, so `python -m integrations.simscale.mcp_server` can't find the module.
- **`ImportError: simscale_sdk`** — you're running the module from a shell that isn't in the venv you installed into. Activate the venv or point `command` in the Desktop config at the venv's `python` binary directly.

"""SimScale integration for SkyLab.

See README.md in this directory for setup instructions.
"""

from .client import SimScaleClient, SimScaleConfigError

__all__ = ["SimScaleClient", "SimScaleConfigError"]

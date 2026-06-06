"""Shared agent protocol definitions."""

from typing import Protocol


class Agent(Protocol):
    """Marker protocol for all single-responsibility agents."""

    name: str

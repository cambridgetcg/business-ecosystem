"""Strictly local consumer of synthetic commerce sale events; not a live adapter."""
from .flow import UnknownSale, consume, deliver, replay

__all__ = ["UnknownSale", "consume", "deliver", "replay"]

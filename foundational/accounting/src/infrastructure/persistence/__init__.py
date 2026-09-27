"""Persistence infrastructure - database connections, ORM base classes, repositories."""

import sys as _sys
from types import ModuleType as _ModuleType

from src.infrastructure.persistence.base import (
    Base,
    BaseEntity,
    ImmutableEntity,
    MONEY_PRECISION,
    MONEY_SCALE,
)
# Keep domain-model imports independent of application settings and repository
# imports. The public infrastructure exports remain available on demand.
def __getattr__(name):
    from importlib import import_module

    modules = {
        "Database": "database",
        "get_database": "database",
        "get_session": "database",
        "UnitOfWork": "unit_of_work",
        "unit_of_work": "unit_of_work",
        "ensure_models_loaded": "model_registry",
        "get_all_table_names": "model_registry",
        "verify_model_registration": "model_registry",
    }
    if name not in modules:
        raise AttributeError(name)
    module_name = modules[name]
    module = import_module(f"{__name__}.{module_name}")
    exports = {export: getattr(module, export) for export, source in modules.items() if source == module_name}
    globals().update(exports)
    return exports[name]


class _PersistenceExports(_ModuleType):
    def __getattribute__(self, name):
        value = super().__getattribute__(name)
        # Direct submodule imports assign this attribute without __getattr__.
        # Preserve the public factory instead of exposing the colliding module.
        if name == "unit_of_work" and isinstance(value, _ModuleType):
            return __getattr__(name)
        return value


_sys.modules[__name__].__class__ = _PersistenceExports

__all__ = [
    # Base classes
    "Base",
    "BaseEntity",
    "ImmutableEntity",
    "MONEY_PRECISION",
    "MONEY_SCALE",
    # Database
    "Database",
    "get_database",
    "get_session",
    # Unit of Work
    "UnitOfWork",
    "unit_of_work",
    # Model Registry
    "ensure_models_loaded",
    "get_all_table_names",
    "verify_model_registration",
]

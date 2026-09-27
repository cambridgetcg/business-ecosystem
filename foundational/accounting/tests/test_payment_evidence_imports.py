"""Offline domain import regression: no application configuration side effects."""
import subprocess
import sys

import pytest


@pytest.mark.parametrize("first", [
    "src.domain.general_ledger.services.posting_service",
    "src.domain.chart_of_accounts.models.account",
    "src.infrastructure.persistence.base",
])
def test_domain_imports_without_application_bootstrap(first):
    result = subprocess.run([sys.executable, "-c", f"""
import importlib, sys
importlib.import_module({first!r})
from src.domain.general_ledger.services.posting_service import PostingService
from sqlalchemy.orm import configure_mappers
configure_mappers()
assert 'src.config' not in sys.modules
assert 'src.infrastructure.persistence.database' not in sys.modules
print(PostingService.__module__)
"""], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "src.domain.general_ledger.services.posting_service"


@pytest.mark.parametrize("order", ["class-first", "function-first", "submodule-first"])
def test_public_unit_of_work_stays_callable_in_every_import_order(order):
    # Only transitive application dependencies are stubs: both the package and
    # unit_of_work.py are imported from the actual source in a fresh process.
    result = subprocess.run([sys.executable, "-c", r'''
import asyncio
import importlib
import inspect
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace

def guard(event, args):
    if event in ('socket.connect', 'socket.getaddrinfo', 'socket.gethostbyname'):
        raise AssertionError('network access forbidden')
    if event == 'open' and str(args[0]).endswith('.env'):
        raise AssertionError('provider environment access forbidden')
sys.addaudithook(guard)

import src.infrastructure.persistence as package
assert 'src.config' not in sys.modules
assert 'src.infrastructure.persistence.database' not in sys.modules

closed = []
class Session:
    async def close(self):
        closed.append(True)

# Async ORM drivers are outside the pinned offline slice too.
stub = ModuleType('sqlalchemy.ext.asyncio')
stub.AsyncSession = Session
sys.modules[stub.__name__] = stub
stub = ModuleType('src.infrastructure.persistence.database')
stub.Database = type('Database', (), {})
stub.get_database = lambda: SimpleNamespace(session_factory=Session)
stub.get_session = lambda: None
sys.modules[stub.__name__] = stub
for module_name, class_name in (
    ('chart_of_accounts.repositories.account_repository', 'AccountRepository'),
    ('general_ledger.repositories.journal_entry_repository', 'JournalEntryRepository'),
    ('general_ledger.repositories.fiscal_period_repository', 'FiscalPeriodRepository'),
    ('ingestion.repositories.import_job_repository', 'ImportJobRepository'),
    ('ingestion.repositories.import_error_repository', 'ImportErrorRepository'),
):
    stub = ModuleType('src.domain.' + module_name)
    setattr(stub, class_name, type(class_name, (), {}))
    sys.modules[stub.__name__] = stub

order = sys.argv[1]
if order == 'class-first':
    from src.infrastructure.persistence import UnitOfWork
elif order == 'function-first':
    from src.infrastructure.persistence import unit_of_work
else:
    from src.infrastructure.persistence.unit_of_work import UnitOfWork

# Read the colliding function before any other package export can repair it.
from src.infrastructure.persistence import unit_of_work
assert callable(unit_of_work), type(unit_of_work)
real_module = importlib.import_module('src.infrastructure.persistence.unit_of_work')
assert Path(real_module.__file__).resolve() == Path('src/infrastructure/persistence/unit_of_work.py').resolve()
assert inspect.unwrap(unit_of_work).__code__.co_filename == real_module.__file__
assert unit_of_work is real_module.unit_of_work is package.unit_of_work
assert package.UnitOfWork is real_module.UnitOfWork
assert vars(package)['UnitOfWork'] is real_module.UnitOfWork
assert vars(package)['unit_of_work'] is real_module.unit_of_work

async def use():
    async with package.unit_of_work() as value:
        assert isinstance(value, real_module.UnitOfWork)
        assert isinstance(value.session, Session)
asyncio.run(use())
assert closed == [True]
assert 'src.config' not in sys.modules
assert 'src.api.rest.app' not in sys.modules
''', order], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr

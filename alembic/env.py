# alembic/env.py
from __future__ import annotations

import os
import sys
from pathlib import Path
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# -----------------------------------------------------------------------------
# Deixa o pacote "app/" importável quando rodar `python -m alembic ...`
# -----------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[1]  # pasta do projeto (onde fica "app/")
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# -----------------------------------------------------------------------------
# Importa Base e registra todos os models para o autogenerate
# -----------------------------------------------------------------------------
from app.models_base import Base
import app.models  # noqa: F401  (apenas para side-effect de registrar modelos)

# -----------------------------------------------------------------------------
# Configurações padrão do Alembic
# -----------------------------------------------------------------------------
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _resolve_db_url() -> str:
    """
    Resolve a URL do banco na seguinte ordem:
    1) app.database.SQLALCHEMY_DATABASE_URL (se existir)
    2) variável de ambiente DATABASE_URL (se existir)
    3) sqlalchemy.url do alembic.ini
    """
    # 1) tenta importar da app
    try:
        from app.database import SQLALCHEMY_DATABASE_URL as APP_URL  # type: ignore
        if APP_URL:
            return APP_URL
    except Exception:
        pass

    # 2) ambiente
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return env_url

    # 3) alembic.ini
    ini_url = config.get_main_option("sqlalchemy.url")
    if not ini_url:
        raise RuntimeError(
            "Não foi possível resolver a URL do banco. "
            "Defina app.database.SQLALCHEMY_DATABASE_URL, ou DATABASE_URL no ambiente, "
            "ou configure sqlalchemy.url no alembic.ini."
        )
    return ini_url


def _is_sqlite(url: str) -> bool:
    return url.startswith("sqlite")


def run_migrations_offline() -> None:
    """
    Modo offline: não abre conexão, usa apenas a URL.
    """
    url = _resolve_db_url()
    render_as_batch = _is_sqlite(url)  # útil para alter tables no SQLite

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
        render_as_batch=render_as_batch,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Modo online: cria engine/conexão e roda migrações.
    """
    url = _resolve_db_url()
    render_as_batch = _is_sqlite(url)

    # injeta a URL resolvida na config interna do Alembic
    config_section = config.get_section(config.config_ini_section) or {}
    config_section["sqlalchemy.url"] = url

    connectable = engine_from_config(
        configuration=config_section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            render_as_batch=render_as_batch,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

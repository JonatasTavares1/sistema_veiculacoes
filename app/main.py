from dotenv import load_dotenv
load_dotenv()  # carrega .env antes de qualquer import que dependa de variáveis

import os
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.database import init_db
from app.deps_auth import get_current_user, require_roles
from app.core.config import (
    SEED_ADMIN_EMAIL,
    SEED_ADMIN_PASSWORD,
    SEED_ADMIN_ROLE,
    ALLOWED_EMAIL_DOMAIN,
)

# Routers
from app.routes.auth import router as auth_router
from app.routes.admin_users import router as admin_users_router

from app.routes.pis import router as pis_router
from app.routes.agencia import router as agencias_router
from app.routes.entregas import router as entregas_router
from app.routes.anunciantes import router as anunciantes_router
from app.routes.executivos import router as executivos_router
from app.routes.produtos import router as produtos_router
from app.routes.matrizes import router as matrizes_router
from app.routes.veiculacoes import router as veiculacoes_router
from app.routes.vendas import router as vendas_router
from app.routes.me import router as me_router

# ✅ Detalhes agregados do PI (PI + Veiculações + Financeiro)
from app.routes.pi_detalhes import router as pi_detalhes_router

# ✅ faturamentos
from app.routes.faturamentos import router as faturamentos_router


app = FastAPI(title="Sistema de Veiculações - API", version="2.0")

# ==========================================================
# CORS
# - Auth por Authorization: Bearer <token>
# - Não precisa cookies -> allow_credentials=False
# ==========================================================
DEV_ALLOW_ALL = True  # troque para False quando quiser restringir

if DEV_ALLOW_ALL:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5174",
            "https://golive-veiculacoes.vercel.app",
        ],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )


# ✅ evita “falso CORS” quando ocorre ValueError de NaN
@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    msg = str(exc)
    if "Out of range float values are not JSON compliant" in msg or "nan" in msg.lower():
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Erro ao serializar resposta (NaN no banco). Corrija valores NaN para NULL.",
            },
        )
    return JSONResponse(status_code=500, content={"detail": msg})


# (Opcional, mas recomendado) garante JSON em erros inesperados
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    # não vaza stacktrace pro front; log fica no console do uvicorn
    print("❌ Erro inesperado:", repr(exc))
    return JSONResponse(status_code=500, content={"detail": "Erro interno no servidor."})


# Static: garantir que a pasta exista antes de montar
uploads_dir = os.getenv("PI_UPLOAD_DIR", "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


@app.on_event("startup")
def _startup():
    init_db()

    # Seed opcional de admin (somente se você definir no .env / env vars do Render)
    if SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD:
        try:
            from app.crud.users import get_user_by_email, create_user
            from app.database import SessionLocal

            db = SessionLocal()
            try:
                if ALLOWED_EMAIL_DOMAIN and not SEED_ADMIN_EMAIL.endswith(ALLOWED_EMAIL_DOMAIN):
                    print(f"⚠️ Seed admin ignorado: email não termina com {ALLOWED_EMAIL_DOMAIN}")
                else:
                    existing = get_user_by_email(db, SEED_ADMIN_EMAIL)
                    if not existing:
                        create_user(db, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, role=SEED_ADMIN_ROLE)
                        print("✅ Admin seed criado:", SEED_ADMIN_EMAIL)
                    else:
                        print("ℹ️ Admin seed já existe:", SEED_ADMIN_EMAIL)
            finally:
                db.close()
        except Exception as e:
            print("⚠️ Falha no seed admin:", e)


# ==========================================================
# ROTAS PÚBLICAS
# ==========================================================
app.include_router(auth_router)

@app.get("/")
def healthcheck():
    return {"status": "ok"}


# ==========================================================
# ROTAS PROTEGIDAS (AUTH) + ACL POR MÓDULO
# ==========================================================
auth_dep = [Depends(get_current_user)]

# PIs: executivo + admin
app.include_router(
    pis_router,
    dependencies=auth_dep + [Depends(require_roles("executivo", "admin"))],
)

# ✅ Detalhes do PI (PI + Veiculações + Financeiro)
# Recomendado: executivo + opec + financeiro + admin
app.include_router(
    pi_detalhes_router,
    dependencies=auth_dep + [Depends(require_roles("executivo", "opec", "financeiro", "admin"))],
)

# Veiculações: executivo + opec + admin
app.include_router(
    veiculacoes_router,
    dependencies=auth_dep + [Depends(require_roles("executivo", "opec", "admin"))],
)

# Entregas: executivo + opec + admin
app.include_router(
    entregas_router,
    dependencies=auth_dep + [Depends(require_roles("executivo", "opec", "admin"))],
)

# Produtos: executivo + admin (admin precisa ver também)
app.include_router(
    produtos_router,
    dependencies=auth_dep + [Depends(require_roles("executivo", "admin"))],
)

# Executivos: executivo + admin (admin precisa listar para o painel de vendas)
app.include_router(
    executivos_router,
    dependencies=auth_dep + [Depends(require_roles("executivo", "admin"))],
)

# Matrizes: executivo + admin
app.include_router(
    matrizes_router,
    dependencies=auth_dep + [Depends(require_roles("executivo", "admin"))],
)

# Financeiro: financeiro + opec + admin
app.include_router(
    faturamentos_router,
    dependencies=auth_dep + [Depends(require_roles("financeiro", "opec", "admin"))],
)

# Admin (gestão de usuários): só admin
app.include_router(
    admin_users_router,
    dependencies=auth_dep + [Depends(require_roles("admin"))],
)

# Agências e Anunciantes: por segurança, só admin
app.include_router(
    agencias_router,
    dependencies=auth_dep + [Depends(require_roles("admin"))],
)
app.include_router(
    anunciantes_router,
    dependencies=auth_dep + [Depends(require_roles("admin"))],
)

# ✅ Vendas: só admin (como você pediu)
app.include_router(
    vendas_router,
    dependencies=auth_dep + [Depends(require_roles("admin"))],
)

# ✅ /me: qualquer usuário logado
# (cada endpoint dentro de /me decide o papel, ex.: /me/executivo exige executivo|admin)
app.include_router(
    me_router,
    dependencies=auth_dep,
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)

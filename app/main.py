# app/main.py
from dotenv import load_dotenv
load_dotenv()  # carrega .env antes de qualquer import que dependa de variáveis

import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import init_db
from app.deps_auth import get_current_user
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


app = FastAPI(title="Sistema de Veiculações - API", version="2.0")

# CORS — não usar "*" com allow_credentials=True
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
)

# Static: garantir que a pasta exista antes de montar
uploads_dir = os.getenv("PI_UPLOAD_DIR", "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


@app.on_event("startup")
def _startup():
    init_db()

    # Seed opcional de admin (somente se você definir no .env / env vars do Render)
    # Recomendação: SEED_ADMIN_EMAIL precisa terminar com o domínio permitido
    if SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD:
        try:
            from app.crud.users import get_user_by_email, create_user
            from app.database import SessionLocal

            db = SessionLocal()
            try:
                # valida domínio também no seed (para não abrir exceção de regra)
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


# ROTAS PÚBLICAS
app.include_router(auth_router)

@app.get("/")
def healthcheck():
    return {"status": "ok"}


# ROTAS PROTEGIDAS (todas exigem Authorization: Bearer <token>)
protected = [Depends(get_current_user)]

app.include_router(pis_router, dependencies=protected)
app.include_router(agencias_router, dependencies=protected)
app.include_router(entregas_router, dependencies=protected)
app.include_router(anunciantes_router, dependencies=protected)
app.include_router(executivos_router, dependencies=protected)
app.include_router(produtos_router, dependencies=protected)
app.include_router(matrizes_router, dependencies=protected)
app.include_router(veiculacoes_router, dependencies=protected)

# Admin (também deve estar protegido lá dentro com require_admin nas rotas sensíveis)
app.include_router(admin_users_router, dependencies=protected)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)

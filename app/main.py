# app/main.py
from dotenv import load_dotenv
load_dotenv()  # <<< carrega .env antes de qualquer import que dependa de variáveis

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import init_db

# Routers
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

# registra routers
app.include_router(pis_router)
app.include_router(agencias_router)
app.include_router(entregas_router)
app.include_router(anunciantes_router)
app.include_router(executivos_router)
app.include_router(produtos_router)
app.include_router(matrizes_router)
app.include_router(veiculacoes_router)

@app.get("/")
def healthcheck():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    # init_db() não é necessário aqui porque já roda no evento de startup,
    # mas não faz mal se quiser manter.
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)

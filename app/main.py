# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db

# Routers
from app.routes.pis import router as pis_router
from app.routes.agencia import router as agencias_router 
from app.routes.entregas import router as entregas_router
from app.routes.anunciantes import router as anunciantes_router
from app.routes.executivos import router as executivos_router
from app.routes.produtos import router as produtos_router
from app.routes.matrizes import router as matrizes_router    
app = FastAPI(title="Sistema de Veiculações - API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.get("/")
def healthcheck():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    init_db()
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)

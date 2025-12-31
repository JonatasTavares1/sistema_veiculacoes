# app/core/config.py
import os

# =========================
# Regras de acesso / domínio
# =========================
ALLOWED_EMAIL_DOMAIN = os.getenv("ALLOWED_EMAIL_DOMAIN", "@metropoles.com")

# =========================
# JWT
# =========================
JWT_SECRET = os.getenv("JWT_SECRET", "change-me")
JWT_ALG = os.getenv("JWT_ALG", "HS256")
JWT_EXPIRES_MINUTES = int(os.getenv("JWT_EXPIRES_MINUTES", "720"))

# =========================
# Seed de Admin (cria admin no startup se não existir)
# =========================
SEED_ADMIN_EMAIL = os.getenv("SEED_ADMIN_EMAIL", "").strip().lower()
SEED_ADMIN_PASSWORD = os.getenv("SEED_ADMIN_PASSWORD", "")
SEED_ADMIN_ROLE = os.getenv("SEED_ADMIN_ROLE", "admin")

# =========================
# SMTP (para aprovação e reset de senha)
# =========================
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER or "no-reply@localhost")
SMTP_TLS = os.getenv("SMTP_TLS", "1") == "1"

# =========================
# Frontend base URL (para links de reset / aprovação)
# =========================
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")

# =========================
# Reset token expiração
# =========================
RESET_TOKEN_EXPIRES_MINUTES = int(os.getenv("RESET_TOKEN_EXPIRES_MINUTES", "30"))

# Alias de compatibilidade (algum arquivo está importando esse nome)
RESET_TOKEN_MINUTES = int(os.getenv("RESET_TOKEN_MINUTES", str(RESET_TOKEN_EXPIRES_MINUTES)))

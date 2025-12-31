# app/core/config.py
import os

ALLOWED_EMAIL_DOMAIN = os.getenv("ALLOWED_EMAIL_DOMAIN", "@metropoles.com")

JWT_SECRET = os.getenv("JWT_SECRET", "change-me")
JWT_ALG = os.getenv("JWT_ALG", "HS256")
JWT_EXPIRES_MINUTES = int(os.getenv("JWT_EXPIRES_MINUTES", "720"))

# SMTP (para aprovação e reset de senha)
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER or "no-reply@localhost")
SMTP_TLS = os.getenv("SMTP_TLS", "1") == "1"

# Frontend base URL (para link de reset)
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")

# Reset token
RESET_TOKEN_EXPIRES_MINUTES = int(os.getenv("RESET_TOKEN_EXPIRES_MINUTES", "30"))

# =========================
# Admin seed (bootstrap)
# =========================
SEED_ADMIN_EMAIL = os.getenv("SEED_ADMIN_EMAIL", "").strip().lower()
SEED_ADMIN_PASSWORD = os.getenv("SEED_ADMIN_PASSWORD", "")
SEED_ADMIN_ROLE = os.getenv("SEED_ADMIN_ROLE", "admin")

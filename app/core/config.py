# app/core/config.py
import os

JWT_SECRET = os.getenv("JWT_SECRET", "CHANGE_ME_NOW")
JWT_ALG = os.getenv("JWT_ALG", "HS256")
JWT_EXPIRES_MINUTES = int(os.getenv("JWT_EXPIRES_MINUTES", "10080"))  # 7 dias

# Ex: "@empresa.com" (use sempre com @)
ALLOWED_EMAIL_DOMAIN = os.getenv("ALLOWED_EMAIL_DOMAIN", "@metropoles.com").strip().lower()

# Se quiser criar um usuário admin automaticamente no startup:
SEED_ADMIN_EMAIL = os.getenv("SEED_ADMIN_EMAIL", "").strip().lower()
SEED_ADMIN_PASSWORD = os.getenv("SEED_ADMIN_PASSWORD", "")
SEED_ADMIN_ROLE = os.getenv("SEED_ADMIN_ROLE", "admin")
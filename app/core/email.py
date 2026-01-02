# app/core/email.py
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import (
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
    SMTP_TLS,
)


def _smtp_is_configured() -> bool:
    # host + from já resolvem a maioria dos casos
    return bool(SMTP_HOST and SMTP_PORT and SMTP_FROM)


def send_email(to_email: str, subject: str, body: str) -> bool:
    """
    Envia e-mail via SMTP.
    - Retorna True se enviou.
    - Retorna False se SMTP não está configurado ou se falhou.
    Nunca levanta exceção para não derrubar API.
    """
    to_email = (to_email or "").strip()
    if not to_email:
        return False

    if not _smtp_is_configured():
        print("📭 SMTP não configurado. E-mail não enviado:", {"to": to_email, "subject": subject})
        return False

    msg = MIMEMultipart()
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    msg["Subject"] = subject

    msg.attach(MIMEText(body or "", "plain", "utf-8"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
            server.ehlo()
            if SMTP_TLS:
                server.starttls()
                server.ehlo()

            # login é opcional (alguns SMTP internos não exigem)
            if SMTP_USER and SMTP_PASS:
                server.login(SMTP_USER, SMTP_PASS)

            server.sendmail(SMTP_FROM, [to_email], msg.as_string())
        print("✅ E-mail enviado:", {"to": to_email, "subject": subject})
        return True

    except Exception as e:
        print("⚠️ Falha ao enviar e-mail:", str(e))
        return False

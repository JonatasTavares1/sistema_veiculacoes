import io
import os
from functools import lru_cache
from typing import Optional, Literal

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload
from googleapiclient.errors import HttpError

# Escopo amplo para upload/leitura/baixa (pode reduzir se quiser)
SCOPES = ["https://www.googleapis.com/auth/drive"]

# Variáveis de ambiente (duas credenciais + duas pastas)
ENV_JSON_PI = "DRIVE_SERVICE_ACCOUNT_JSON"
ENV_JSON_PROP = "DRIVE_SERVICE_ACCOUNT_JSON_PROPOSTAS"

ENV_FOLDER_PI = "DRIVE_FOLDER_ID_PI"
ENV_FOLDER_PROP = "DRIVE_FOLDER_ID_PROPOSTAS"


def _cred_path(env_key: str) -> str:
    path = os.getenv(env_key)
    if not path:
        raise RuntimeError(f"Config ausente: defina {env_key} com o caminho do JSON da service account.")
    if not os.path.isabs(path):
        path = os.path.abspath(path)
    if not os.path.exists(path):
        raise RuntimeError(f"Arquivo de credenciais não encontrado: {path}")
    return path


@lru_cache(maxsize=2)
def _drive_service(which: Literal["pi", "proposta"] = "pi"):
    """Cria (com cache) um client do Drive para a credencial escolhida."""
    key = ENV_JSON_PI if which == "pi" else ENV_JSON_PROP
    cred_path = _cred_path(key)
    creds = Credentials.from_service_account_file(cred_path, scopes=SCOPES)
    return build("drive", "v3", credentials=creds)


def _folder_id(which: Literal["pi", "proposta"]) -> str:
    fid = os.getenv(ENV_FOLDER_PI) if which == "pi" else os.getenv(ENV_FOLDER_PROP)
    if not fid:
        env_name = ENV_FOLDER_PI if which == "pi" else ENV_FOLDER_PROP
        raise RuntimeError(f"Config ausente: defina {env_name}.")
    return fid


def upload_pdf_to_drive(
    pdf_bytes: bytes,
    filename: str,
    *,
    which: Literal["pi", "proposta"] = "pi",
    folder_id: Optional[str] = None,
) -> dict:
    """
    Envia um PDF para o Drive usando a credencial/pasta de 'which' (pi|proposta).
    Retorna: {id, name, mimeType, size, webViewLink, webContentLink}
    """
    if not filename.lower().endswith(".pdf"):
        raise ValueError("Arquivo precisa terminar com .pdf")
    service = _drive_service(which)
    media = MediaIoBaseUpload(io.BytesIO(pdf_bytes), mimetype="application/pdf", resumable=False)
    metadata = {
        "name": filename,
        "mimeType": "application/pdf",
        "parents": [folder_id or _folder_id(which)],
    }
    file = (
        service.files()
        .create(
            body=metadata,
            media_body=media,
            fields="id, name, mimeType, size, webViewLink, webContentLink",
            supportsAllDrives=True,
        )
        .execute()
    )
    return file


def _services_try_order():
    """Ordem de tentativa ao ler um arquivo sem saber em qual credencial foi criado."""
    # 1º tenta com PI; 2º tenta com PROPOSTAS
    yield _drive_service("pi")
    yield _drive_service("proposta")


def get_drive_file_meta(file_id: str) -> dict: 
    """
    Lê metadados (id, name, mimeType, size, webViewLink, webContentLink) tentando com ambas as credenciais.
    """
    last_err: Optional[Exception] = None
    for svc in _services_try_order():
        try:
            return (
                svc.files()
                .get(
                    fileId=file_id,
                    fields="id, name, mimeType, size, webViewLink, webContentLink",
                    supportsAllDrives=True,
                )
                .execute()
            )
        except HttpError as e:
            last_err = e
            continue
    if last_err:
        raise last_err
    raise RuntimeError("Não foi possível obter metadados do arquivo no Drive com nenhuma credencial.")


def download_drive_file_bytes(file_id: str):
    """
    Faz download do arquivo (bytes, nome, mimeType), tentando com ambas as credenciais.
    """
    last_err: Optional[Exception] = None
    for svc in _services_try_order():
        try:
            meta = (
                svc.files()
                .get(fileId=file_id, fields="name, mimeType", supportsAllDrives=True)
                .execute()
            )
            req = svc.files().get_media(fileId=file_id, supportsAllDrives=True)
            buf = io.BytesIO()
            downloader = MediaIoBaseDownload(buf, req)
            done = False
            while not done:
                _, done = downloader.next_chunk()
            data = buf.getvalue()
            return data, meta.get("name") or f"{file_id}.pdf", meta.get("mimeType") or "application/pdf"
        except HttpError as e:
            last_err = e
            continue
    if last_err:
        raise last_err
    raise RuntimeError("Não foi possível baixar o arquivo do Drive com nenhuma credencial.")


# Exporta IDs de pasta (útil para logs/health)
DRIVE_FOLDER_ID_PI = os.getenv(ENV_FOLDER_PI)
DRIVE_FOLDER_ID_PROPOSTAS = os.getenv(ENV_FOLDER_PROP)

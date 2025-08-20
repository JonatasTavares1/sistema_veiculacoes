# -*- coding: utf-8 -*-
"""
Seed de produtos pré-definidos a partir de uma lista "CATEGORIA<TAB>NOME".
- Idempotente: atualiza se já existir (mesmo nome).
- Define categoria, modalidade_preco, base_segundos (rádio) e unidade_rotulo.
- valor_unitario fica None para você preencher depois.

Como rodar (com seu venv ativo):
    python -m app.scripts.seed_produtos
"""
from __future__ import annotations
import re
from typing import Optional, Tuple

from app.database import SessionLocal, init_db
from app.models import Produto

# === Cole aqui exatamente as linhas que você mandou (categoria\tproduto) ===
LINHAS = r"""
PORTAL	Expressão de Opinião Completa (Portal + DOOH + Rádio)
PORTAL	Expressão de Opinião Digital
PORTAL	Publicidade Nativa
PORTAL	Publieditorial
PORTAL	Manchete
PORTAL	Sub-manchete
PORTAL	Big Talk
PORTAL	One Talk
PORTAL	Little Talk
PORTAL	Instagram Post Fixado Feed
PORTAL	Post Instagram Feed
PORTAL	Post Instagram Stories
PORTAL	Post Instagram Reels
PORTAL	Post Youtube Shorts
PORTAL	Post TikTok Feed
PORTAL	Post Kwai Feed
PORTAL	Post Feed Facebook
PORTAL	Social Video Testemunhal 30"
PORTAL	Social Video Testemunhal 60"
PORTAL	Diária de Banner Retângulo 300x250px
PORTAL	CPM de Banner Retângulo 300x250px
PORTAL	Diária de Banner Half Page 300x600px
PORTAL	CPM de Banner Half Page 300x600px
PORTAL	Diária de Banner Billboard 970x250px
PORTAL	CPM de Banner Billboard 970x250px
PORTAL	Diária de Super Banner 728x90px
PORTAL	CPM de Super Banner 728x90px
PORTAL	Diária de Super Leaderboard 970x90px
PORTAL	CPM de Super Leaderboard 970x90px
PORTAL	Diária de Banner Mobile 320x50px (topo)
PORTAL	CPM de Banner Mobile 320x50px (topo)
PORTAL	Diária de Banner Mobile 320x50px (ancorado)
PORTAL	CPM de Banner Mobile 320x50px (ancorado)
PORTAL	Mensal - Selo no Cabeçalho da Editoria 120x50px
PORTAL	Diária de Envelopamento Site - Formato Especial
PAINEL	Diária - Painel Empena Setor Bancário 246m²
PAINEL	Semanal - Painel Empena Setor Bancário 246m²
PAINEL	Quinzenal - Painel Empena Setor Bancário 246m²
PAINEL	Mensal - Painel Empena Setor Bancário 246m²
PAINEL	Diária - Painel JK (face 1) 66m²
PAINEL	Semanal - Painel JK (face 1) 66m²
PAINEL	Quinzenal - Painel JK (face 1) 66m²
PAINEL	Mensal - Painel JK (face 1) 66m²
PAINEL	Diária - Painel JK (face 2) 66m²
PAINEL	Semanal - Painel JK (face 2) 66m²
PAINEL	Quinzenal - Painel JK (face 2) 66m²
PAINEL	Mensal - Painel JK (face 2) 66m²
PAINEL	Diária - Painel JK (face 3) 43m²
PAINEL	Semanal - Painel JK (face 3) 43m²
PAINEL	Quinzenal - Painel JK (face 3) 43m²
PAINEL	Mensal - Painel JK (face 3) 43m²
PAINEL	Diária - Painel Saída Norte 66m²
PAINEL	Semanal - Painel Saída Norte 66m²
PAINEL	Quinzenal - Painel Saída Norte 66m²
PAINEL	Mensal - Painel Saída Norte 66m²
PAINEL	Diária - Painel SIA/EPTG 66m²
PAINEL	Semanal - Painel SIA/EPTG 66m²
PAINEL	Quinzenal - Painel SIA/EPTG 66m²
PAINEL	Mensal - Painel SIA/EPTG 66m²
PAINEL	Diária - Painel Estrutural Face 1 66m²
PAINEL	Semanal - Painel Estrutural (face 1) 66m²
PAINEL	Quinzenal - Painel Estrutural (face 1) 66m²
PAINEL	Mensal - Painel Estrutural (face 1) 66m²
PAINEL	Diária - Painel Estrutural (face 2) 66m²
PAINEL	Semanal - Painel Estrutural (face 2) 66m²
PAINEL	Quinzenal - Painel Estrutural (face 2) 66m²
PAINEL	Mensal - Painel Estrutural (face 2) 66m²
PAINEL	Diária - Painel Estrutural (face 3) 66m²
PAINEL	Semanal - Painel Estrutural (face 3) 66m²
PAINEL	Quinzenal - Painel Estrutural (face 3) 66m²
PAINEL	Mensal - Painel Estrutural (face 3) 66m²
PAINEL	Diária - Painel EPIA Sul 66m²
PAINEL	Semanal - Painel EPIA Sul 66m²
PAINEL	Quinzenal - Painel EPIA Sul 66m²
PAINEL	Mensal - Painel EPIA Sul 66m²
PAINEL	Diária - Painel EPNB 66m²
PAINEL	Semanal - Painel EPNB 66m²
PAINEL	Quinzenal - Painel EPNB 66m²
PAINEL	Mensal - Painel EPNB 66m²
PAINEL	Diária - Painel W3 NORTE - QUADRA 505/705 7,4m²
PAINEL	Semanal - Painel W3 NORTE - QUADRA 505/705 7,4m²
PAINEL	Quinzenal - Painel W3 NORTE - QUADRA 505/705 7,4m²
PAINEL	Mensal - Painel W3 NORTE - QUADRA 505/705 7,4m²
PAINEL	Diária - Painel TAGUATINGA NORTE - AVENIDA HÉLIO PRATES 7,4m²
PAINEL	Semanal - Painel TAGUATINGA NORTE - AVENIDA HÉLIO PRATES 7,4m²
PAINEL	Quinzenal - Painel TAGUATINGA NORTE - AVENIDA HÉLIO PRATES 7,4m²
PAINEL	Mensal - Painel TAGUATINGA NORTE - AVENIDA HÉLIO PRATES 7,4m²
PAINEL	Diária - Painel ÁGUAS CLARAS - Av. das Castanheiras rua 33/34 7,4m²
PAINEL	Semanal - Painel ÁGUAS CLARAS - Av. das Castanheiras rua 33/34 7,4m²
PAINEL	Quinzenal - Painel ÁGUAS CLARAS - Av. das Castanheiras rua 33/34 7,4m²
PAINEL	Mensal - Painel ÁGUAS CLARAS - Av. das Castanheiras rua 33/34 7,4m²
PAINEL	Diária - Painel ÁGUAS CLARAS - Av. das Castanheiras Lt 01, 02 7,4m²
PAINEL	Semanal - Painel ÁGUAS CLARAS - Av. das Castanheiras Lt 01, 02 7,4m²
PAINEL	Quinzenal - Painel ÁGUAS CLARAS - Av. das Castanheiras Lt 01, 02 7,4m²
PAINEL	Mensal - Painel ÁGUAS CLARAS - Av. das Castanheiras Lt 01, 02 7,4m²
PAINEL	Diária - PAINEL SETOR DE CLUBES LAGO SUL - Via L2 Sul - 7,4m²
PAINEL	Semanal - PAINEL SETOR DE CLUBES LAGO SUL - Via L2 Sul - 7,4m²
PAINEL	Quinzenal - PAINEL SETOR DE CLUBES LAGO SUL - Via L2 Sul - 7,4m²
PAINEL	Mensal - PAINEL SETOR DE CLUBES LAGO SUL - Via L2 Sul - 7,4m²
PAINEL	Diária - PAINEL L2 SUL - QUADRA SGAS 616 - Via L2 Sul - 7,4m²
PAINEL	Semanal - PAINEL L2 SUL - QUADRA SGAS 616 - Via L2 Sul - 7,4m²
PAINEL	Quinzenal - PAINEL L2 SUL - QUADRA SGAS 616 - Via L2 Sul - 7,4m²
PAINEL	Mensal - PAINEL L2 SUL - QUADRA SGAS 616 - Via L2 Sul - 7,4m²
PAINEL	MUB - Circuito EPDB LAGO SUL
PAINEL	MUB - Circuito EPIG / SIG
PAINEL	MUB - Circuito EPNB
PAINEL	MUB - Circuito Lago Norte / EPPR
PAINEL	MUB - Circuito EPGU
PAINEL	MUB - Circuito Pistão Sul
PAINEL	MUB - Circuito Pistão Norte
PAINEL	MUB - Circuito Via L4 Sul
PAINEL	MUB - Circuito Via L4 Norte
PAINEL	MUB - Circuito Noroeste
PAINEL	Diária - Painel ESTÁDIO - PGR / PAL.BURITI (FACE 1) 16,6m²
PAINEL	Semanal - Painel ESTÁDIO - PGR / PAL.BURITI (FACE 1) 16,6m²
PAINEL	Quinzenal - Painel ESTÁDIO - PGR / PAL.BURITI (FACE 1) 16,6m²
PAINEL	Mensal - Painel ESTÁDIO - PGR / PAL.BURITI (FACE 1) 16,6m²
PAINEL	Diária - Painel ESTÁDIO - PGR / PAL.BURITI (FACE 2) 16,6m²
PAINEL	Semanal - Painel ESTÁDIO - PGR / PAL.BURITI (FACE 2) 16,6m²
PAINEL	Quinzenal - Painel ESTÁDIO - PGR / PAL.BURITI (FACE 2) 16,6m²
PAINEL	Mensal - Painel ESTÁDIO - PGR / PAL.BURITI (FACE 2) 16,6m²
PAINEL	Diária - Painel ESTÁDIO - Rotatória acesso Asa Norte 16,6m²
PAINEL	Semanal - Painel ESTÁDIO - Rotatória acesso Asa Norte 16,6m²
PAINEL	Quinzenal - Painel ESTÁDIO - Rotatória acesso Asa Norte 16,6m²
PAINEL	Mensal - Painel ESTÁDIO - Rotatória acesso Asa Norte 16,6m²
PAINEL	Diária - Painel ESTÁDIO - Colégio Militar (face 1) 16,6m²
PAINEL	Semanal - Painel ESTÁDIO - Colégio Militar (face 1) 16,6m²
PAINEL	Quinzenal - Painel ESTÁDIO - Colégio Militar (face 1) 16,6m²
PAINEL	Mensal - Painel ESTÁDIO - Colégio Militar (face 1) 16,6m²
PAINEL	Diária - Painel ESTÁDIO - Colégio Militar (face 2) 16,6m²
PAINEL	Semanal - Painel ESTÁDIO - Colégio Militar (face 2) 16,6m²
PAINEL	Quinzenal - Painel ESTÁDIO - Colégio Militar (face 2) 16,6m²
PAINEL	Mensal - Painel ESTÁDIO - Colégio Militar (face 2) 16,6m²
RÁDIO	Spot - 5 seg - Determinado
RÁDIO	Spot - 5 seg - Rotativo (7h às 19h)
RÁDIO	Spot - 5 seg - Indeterm (5h às 21h)
RÁDIO	Spot - 10 seg - Determinado
RÁDIO	Spot - 10 seg - Rotativo (7h às 19h)
RÁDIO	Spot - 10 seg - Indeterm (5h às 21h)
RÁDIO	Spot - 15 seg - Determinado
RÁDIO	Spot - 15 seg - Rotativo (7h às 19h)
RÁDIO	Spot - 15 seg - Indeterm (5h às 21h)
RÁDIO	Spot - 30 seg - Determinado
RÁDIO	Spot - 30 seg - Rotativo (7h às 19h)
RÁDIO	Spot - 30 seg - Indeterm (5h às 21h)
RÁDIO	Spot - 45 seg - Determinado
RÁDIO	Spot - 45 seg - Rotativo (7h às 19h)
RÁDIO	Spot - 45 seg - Indeterm (5h às 21h)
RÁDIO	Spot - 60 seg - Determinado
RÁDIO	Spot - 60 seg - Rotativo (7h -às 19h)
RÁDIO	Spot - 60 seg - Indeterm (5h às 21h)
RÁDIO	Paradinha Doblô ou UP - 2 horas - 4 flashs de 60"
RÁDIO	Paradinha Ônibus Estúdio Móvel - 2 horas - 4 flashs de 60"
RÁDIO	Flash ao Vivo - Determinado (informar horário)
RÁDIO	Testemunhal Ao Vivo 30 seg - Hor Determinado (informar horário)
RÁDIO	Testemunhal Ao Vivo 30 seg - Hor Rotativo (07h às 19h)
RÁDIO	Testemunhal Ao Vivo 30 seg - Hor Indeterminado (05h às 21h)
RÁDIO	Testemunhal Ao Vivo 45 seg - Hor Determinado (informar horário)
RÁDIO	Testemunhal Ao Vivo 45 seg - Hor Rotativo (07h às 19h)
RÁDIO	Testemunhal Ao Vivo 45 seg - Hor Indeterminado (05h às 21h)
RÁDIO	Testemunhal Ao Vivo 60 seg - Hor Determinado (informar horário)
RÁDIO	Testemunhal Ao Vivo 60 seg - Hor Rotativo (07h -às 19h)
RÁDIO	Testemunhal Ao Vivo 60 seg - Hor Indeterminado (05h às 21h)
RÁDIO	Cachê de locutor - Gravação ou flash externo ou testemunhal
RÁDIO	Patrocínio de programa - Abertura 5" Hor determinado
RÁDIO	Patrocínio de programa - Encerramento 5" Hor determinado
RÁDIO	Patrocínio de programa - Spot colado 30" Hor determinado
RÁDIO	Momento X - Programate 45" - Hor Determinado
RÁDIO	Momento X - Programate 45" - Hor Rotativo
RÁDIO	Minuto Dica - Programate 60" - Hor Determinado
RÁDIO	Minuto Dica - Programate 60" - Hor Rotativo
""".strip()


def _guess_modalidade(categoria: str, nome: str) -> Tuple[str, Optional[int], Optional[str]]:
    cat = categoria.upper().strip()
    n = nome.strip()

    # Rádio: por spot/segundos
    if cat == "RÁDIO" or cat == "RADIO":
        # tenta extrair segundos: 5", 10", 15", 30", 45", 60"
        m = re.search(r'(\d+)\s*"?\s*(seg|")', n, flags=re.I)
        base_seg = int(m.group(1)) if m else None

        # Alguns formatos não trazem segundos (ex.: "Flash ao Vivo")
        if base_seg is None and "flash" in n.lower():
            base_seg = 60  # default prático

        modalidade = "RADIO_SPOT"
        unidade = f"por spot {base_seg}s" if base_seg else "por spot"
        # Testemunhal pode manter a mesma modalidade; o cálculo usa duração informada na veiculação
        return modalidade, base_seg, unidade

    # Portal (digital)
    if cat == "PORTAL":
        if "CPM" in n.upper():
            return "DIGITAL_CPM", None, "por mil impressões"
        if "Diária" in n or "Diaria" in n:
            return "DIA", None, "por dia"
        if any(x in n for x in ["Instagram", "Facebook", "Youtube", "TikTok", "Kwai", "Reels", "Stories", "Post "]):
            return "DIA", None, "por post"
        if "Mensal" in n:
            return "DIA", None, "por mês"
        # pacotes/editoriais
        return "DIA", None, "por pacote"

    # Painel / OOH / MUB etc.: por dia/face
    if cat == "PAINEL" or cat == "OOH" or cat == "DOOH":
        return "PAINEL_DIA", None, "por dia/face"

    # fallback genérico
    return "DIA", None, "por dia"


def _upsert_produto(sess, categoria: str, nome: str):
    nome_norm = nome.strip()
    prod = (
        sess.query(Produto)
        .filter(Produto.nome == nome_norm)
        .first()
    )
    modalidade, base_seg, unidade = _guess_modalidade(categoria, nome_norm)

    if prod:
        # update se algo mudou
        changed = False
        if getattr(prod, "categoria", None) != categoria:
            prod.categoria = categoria
            changed = True
        if getattr(prod, "modalidade_preco", None) != modalidade:
            prod.modalidade_preco = modalidade
            changed = True
        if getattr(prod, "base_segundos", None) != base_seg:
            prod.base_segundos = base_seg
            changed = True
        if getattr(prod, "unidade_rotulo", None) != unidade:
            prod.unidade_rotulo = unidade
            changed = True
        # não mexe em valor_unitario no seed
        if changed:
            sess.add(prod)
        return prod, False
    else:
        novo = Produto(
            nome=nome_norm,
            descricao=None,
            categoria=categoria,
            modalidade_preco=modalidade,
            valor_unitario=None,  # você preenche depois
            base_segundos=base_seg,
            unidade_rotulo=unidade,
        )
        sess.add(novo)
        sess.flush()
        return novo, True


def run():
    init_db()
    sess = SessionLocal()
    try:
        created = 0
        updated = 0
        for raw in LINHAS.splitlines():
            raw = raw.strip()
            if not raw or raw.startswith("#"):
                continue
            if "\t" not in raw:
                print(f"[ignorado] linha sem TAB: {raw}")
                continue
            categoria, nome = raw.split("\t", 1)
            p, is_new = _upsert_produto(sess, categoria.strip(), nome.strip())
            created += 1 if is_new else 0
            updated += 0 if is_new else 1
        sess.commit()
        print(f"OK! Produtos inseridos/atualizados. Novos: {created} | Atualizados: {updated}")
    finally:
        sess.close()


if __name__ == "__main__":
    run()

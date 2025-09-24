# app/utils/pi_pdf.py
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Any

# ---------------------------
# Regex & helpers
# ---------------------------

DATE_RGX = re.compile(r"\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b")
CNPJ_RGX = re.compile(r"\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b")
MONTH_BR = re.compile(r"\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\w*\b", re.I)

ONLY_CURRENCY = re.compile(r"(?:R\$\s*)?([0-9]{1,3}(?:[.\s][0-9]{3})*|[0-9]+(?:,[0-9]{2})?)")

def br_money_to_float(s: str) -> Optional[float]:
    if not s:
        return None
    t = s.strip().replace("R$", "").replace(" ", "")
    if "," in t and "." in t:
        t = t.replace(".", "").replace(",", ".")
    elif "," in t:
        t = t.replace(",", ".")
    try:
        return float(t)
    except Exception:
        m = ONLY_CURRENCY.search(s or "")
        if m:
            return br_money_to_float(m.group(1))
        return None

def to_iso_date(s: str) -> Optional[str]:
    m = DATE_RGX.search(s or "")
    if not m:
        return None
    d, mo, y = m.groups()
    y = ("20" + y) if len(y) == 2 else y
    try:
        dd = int(d); mm = int(mo); yy = int(y)
        if not (1 <= dd <= 31 and 1 <= mm <= 12 and 2000 <= yy <= 2100):
            return None
        return f"{yy:04d}-{mm:02d}-{dd:02d}"
    except Exception:
        return None

def _norm_space(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())

def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")

def _norm_token(s: str) -> str:
    s = _strip_accents(s).upper().replace("-", " ")
    s = re.sub(r"[^\w\s]", "", s)
    return _norm_space(s)

# ---------------------------
# Palavras/linhas
# ---------------------------

@dataclass
class Word:
    text: str
    x0: float
    x1: float
    top: float
    bottom: float
    page: int

def _open_pdf_path(path: str):
    try:
        import pdfplumber  # lazy import
    except ImportError as e:
        raise RuntimeError("Leitura de PDF indisponível: instale 'pdfplumber' e 'pypdfium2'.") from e
    return pdfplumber.open(path)

def _words_from_pdf(path: str) -> Tuple[str, List[Word]]:
    texts: List[str] = []
    words: List[Word] = []
    with _open_pdf_path(path) as pdf:
        for pidx, page in enumerate(pdf.pages):
            wlist = page.extract_words(
                keep_blank_chars=True,
                use_text_flow=True,
                x_tolerance=2.5,
                y_tolerance=2.5,
                extra_attrs=["x0", "x1", "top", "bottom"],
            ) or []
            for w in wlist:
                words.append(Word(
                    text=w["text"],
                    x0=float(w["x0"]),
                    x1=float(w["x1"]),
                    top=float(w["top"]),
                    bottom=float(w["bottom"]),
                    page=pidx,
                ))
            txt = page.extract_text(layout=True) or page.extract_text(x_tolerance=2.5, y_tolerance=2.5) or ""
            texts.append(txt or "")
    return "\n".join(texts), words

def _merge_line(words: List[Word]) -> List[List[Word]]:
    if not words:
        return []
    by_page: Dict[int, List[Word]] = {}
    for w in words:
        by_page.setdefault(w.page, []).append(w)
    lines: List[List[Word]] = []
    for _, lst in by_page.items():
        lst.sort(key=lambda w: (round(w.top), w.x0))
        current_top = None
        buf: List[Word] = []
        for w in lst:
            t = round(w.top)
            if current_top is None or abs(t - current_top) > 2:
                if buf: lines.append(buf)
                buf = [w]; current_top = t
            else:
                buf.append(w)
        if buf: lines.append(buf)
    lines.sort(key=lambda L: (L[0].page, L[0].top))
    return lines

def _tokens_of(line: List[Word]) -> List[str]:
    return [w.text for w in sorted(line, key=lambda w: w.x0)]

def _norm_tokens(tokens: List[str]) -> List[str]:
    return [_norm_token(t) for t in tokens]

def _text_of(line: List[Word]) -> str:
    return " ".join(_tokens_of(line))

# ---------------------------
# Labels (tokenizados)
# ---------------------------

# TODOS os rótulos possíveis (para detectar “próximo rótulo”)
ALL_LABEL_SEQS: List[List[str]] = [
    ["NOME", "DO", "ANUNCIANTE"],
    ["MES", "REF"],
    ["EXECUTIVO"],
    ["VEICULO"],
    ["PRACA"],
    ["CNPJ"],
    ["CNPJ", "AGENCIA"],
    ["ENDERECO"],
    ["EMAIL", "CLIENTE"],
    ["EMAIL"],
    ["RAZAO", "SOCIAL"],
    ["RAZAO", "SOCIAL", "AGENCIA"],
    ["RAZAO", "SOCIAL", "DA", "AGENCIA"],
    ["CLIENTE"],
    ["ANUNCIANTE"],
    ["CAMPANHA"],
    ["VENCIMENTO"],
    ["DATA"],
    ["INICIO"],
    ["TERMINO"],
    ["FIM"],
    ["VALOR", "A", "FATURAR"],
    ["TOTAL", "BRUTO", "NEGOCIADO"],
]

def _match_seq(tokens: List[str], start: int, seq: List[str]) -> bool:
    return start + len(seq) <= len(tokens) and tokens[start:start+len(seq)] == seq

def _find_any_label_at(tokens_norm: List[str], pos: int) -> Optional[Tuple[int, int]]:
    for seq in ALL_LABEL_SEQS:
        if _match_seq(tokens_norm, pos, seq):
            return pos, len(seq)
    return None

def _find_next_label(tokens_norm: List[str], pos: int) -> Optional[int]:
    for i in range(pos, len(tokens_norm)):
        if _find_any_label_at(tokens_norm, i):
            return i
    return None

def _slice_after_label_tokens(orig_tokens: List[str], label_options: List[List[str]]) -> Optional[str]:
    """
    Valor à direita do rótulo (uma das variações) ATÉ o próximo rótulo na MESMA linha.
    """
    tokens_norm = _norm_tokens(orig_tokens)
    start_idx = None; label_len = 0
    for i in range(len(tokens_norm)):
        for seq in label_options:
            if _match_seq(tokens_norm, i, seq):
                start_idx = i; label_len = len(seq); break
        if start_idx is not None: break
    if start_idx is None:
        return None
    val_start = start_idx + label_len
    if val_start >= len(orig_tokens):
        return None
    next_label_i = _find_next_label(tokens_norm, val_start)
    val_end = next_label_i if next_label_i is not None else len(orig_tokens)
    val = _norm_space(" ".join(orig_tokens[val_start:val_end]))
    return val or None

def _slice_until_next_label(orig_tokens: List[str], start: int = 0) -> Optional[str]:
    """
    Usa a linha (sem rótulo no começo) e corta ao encontrar o PRÓXIMO rótulo.
    Ex.: ["BALI","PARK","EXECUTIVO","Caio",...] -> "BALI PARK"
    """
    if start >= len(orig_tokens):
        return None
    tokens_norm = _norm_tokens(orig_tokens)
    next_label_i = _find_next_label(tokens_norm, start)
    end = next_label_i if next_label_i is not None else len(orig_tokens)
    val = _norm_space(" ".join(orig_tokens[start:end]))
    return val or None

# ---------------------------
# Busca “perto do rótulo” (moeda/data)
# ---------------------------

def _find_currency_near(lines: List[List[Word]], label_seqs: List[List[str]], window: int = 3) -> Optional[str]:
    for i, line in enumerate(lines):
        toks = _tokens_of(line); toks_norm = _norm_tokens(toks)
        if any(_match_seq(toks_norm, j, seq) for j in range(len(toks_norm)) for seq in label_seqs):
            m = ONLY_CURRENCY.search(" ".join(toks))
            if m: return m.group(0)
            for k in range(1, window + 1):
                if i + k < len(lines) and lines[i + k][0].page == line[0].page:
                    mm = ONLY_CURRENCY.search(_text_of(lines[i + k]))
                    if mm: return mm.group(0)
    return None

def _find_date_near(lines: List[List[Word]], label_seqs: List[List[str]], window: int = 3) -> Optional[str]:
    for i, line in enumerate(lines):
        toks = _tokens_of(line); toks_norm = _norm_tokens(toks)
        if any(_match_seq(toks_norm, j, seq) for j in range(len(toks_norm)) for seq in label_seqs):
            m = DATE_RGX.search(_text_of(line))
            if m: return m.group(0)
            for k in range(1, window + 1):
                if i + k < len(lines) and lines[i + k][0].page == line[0].page:
                    mm = DATE_RGX.search(_text_of(lines[i + k]))
                    if mm: return mm.group(0)
    return None

# ---------------------------
# Fallback por texto inteiro
# ---------------------------

def parse_pi_fields_from_text(text: str) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    m = re.search(r"\bPI\s*([A-Z]{0,2})\s*([0-9]{3,7})\b", text, flags=re.I)
    if not m: m = re.search(r"\bn[ºo]\s*\(?([0-9]{3,7})\)?\b", text, flags=re.I)
    if m: out["numero_pi"] = (m.group(2) if m.lastindex and m.lastindex >= 2 else m.group(1)).strip()

    mcli = re.search(r"\bCLIENTE\b[:\-\s]*([^\n\r]+)", text, re.I)
    if mcli: out["nome_anunciante"] = _norm_space(mcli.group(1))
    mex = re.search(r"\bEXECUTIVO\b[:\-\s]*([^\n\r]+)", text, re.I)
    if mex: out["executivo"] = _norm_space(mex.group(1))

    cnpj = CNPJ_RGX.search(text)
    if cnpj: out["cnpj_anunciante"] = cnpj.group(0)

    mmesref = re.search(r"\bM[ÊE]S\s*REF\b[:\-\s]*([^\n\r]+)", text, re.I)
    if mmesref: out["mes_ref"] = _norm_space(mmesref.group(1))
    else:
        mm = MONTH_BR.search(text)
        if mm: out["mes_ref"] = mm.group(0)

    mv = re.search(r"\bVENCIMENTO\b.*?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})", text, re.I)
    if mv: out["vencimento"] = to_iso_date(mv.group(1)) or None
    md = re.search(r"\bDATA\b[^0-9]*?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})", text, re.I)
    if md: out["data_emissao"] = to_iso_date(md.group(1)) or None

    mper = re.search(
        r"\b[Dd]e\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*[aà\-]\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b",
        text, re.I
    )
    if mper:
        out["periodo_inicio"] = to_iso_date(mper.group(1)) or None
        out["periodo_fim"] = to_iso_date(mper.group(2)) or None

    mtot = re.search(r"Total\s+Tabela[:\s]*([R$\s0-9\.\,]+).*?Total\s+negociado[:\s]*([R$\s0-9\.\,]+)", text, re.I | re.DOTALL)
    if mtot:
        out["total_tabela"] = br_money_to_float(mtot.group(1))
        out["valor_liquido"] = br_money_to_float(mtot.group(2))
    mbruto = re.search(r"TOTAL\s+BRUTO\s+NEGOCIADO[:\s]*([R$\s0-9\.\,]+)", text, re.I)
    if mbruto: out["total_bruto_negociado"] = br_money_to_float(mbruto.group(1))
    mvaf = re.search(r"VALOR\s+A\s+FATURAR[:\s]*([R$\s0-9\.\,]+)", text, re.I)
    if mvaf: out["valor_a_faturar"] = br_money_to_float(mvaf.group(1))

    mrs = re.search(r"\bRAZ[ÃA]O\s+SOCIAL\b[:\-\s]*([^\n\r]+)", text, re.I)
    if mrs: out["razao_social_anunciante"] = _norm_space(mrs.group(1))
    return {k: v for k, v in out.items() if v is not None}

# ---------------------------
# Extrator principal (por tokens)
# ---------------------------

def extract_structured_fields_from_pdf(path: str) -> Dict[str, Any]:
    text, words = _words_from_pdf(path)
    lines = _merge_line(words)

    result: Dict[str, Any] = {}

    LABEL_MAP_TOKENIZED: List[Tuple[List[List[str]], str]] = [
        ([[ "NOME", "DO", "ANUNCIANTE" ], [ "CLIENTE" ], [ "ANUNCIANTE" ]], "nome_anunciante"),
        ([[ "RAZAO", "SOCIAL" ]], "razao_social_anunciante"),
        ([[ "CNPJ" ]], "cnpj_anunciante"),
        ([[ "CAMPANHA" ]], "nome_campanha"),
        ([[ "VENCIMENTO" ]], "vencimento"),
        ([[ "DATA" ]], "data_emissao"),
        ([[ "EXECUTIVO" ]], "executivo"),
        ([[ "AGENCIA" ]], "nome_agencia"),
        ([[ "RAZAO", "SOCIAL", "AGENCIA" ], [ "RAZAO", "SOCIAL", "DA", "AGENCIA" ]], "razao_social_agencia"),
        ([[ "CNPJ", "AGENCIA" ]], "cnpj_agencia"),
    ]

    # 1) captura por tokens
    for label_options, field in LABEL_MAP_TOKENIZED:
        captured: Optional[str] = None
        for i, line in enumerate(lines):
            tokens = _tokens_of(line)
            # mesma linha
            value_same = _slice_after_label_tokens(tokens, label_options)
            if value_same:
                captured = value_same
            else:
                # linha seguinte (se a atual contém o rótulo e a de baixo NÃO começa com rótulo)
                tokens_norm = _norm_tokens(tokens)
                has_label_here = any(
                    _match_seq(tokens_norm, j, seq)
                    for j in range(len(tokens_norm))
                    for seq in label_options
                )
                if has_label_here and (i + 1) < len(lines) and lines[i + 1][0].page == line[0].page:
                    next_tokens = _tokens_of(lines[i + 1])
                    next_norm = _norm_tokens(next_tokens)
                    starts_with_label = _find_any_label_at(next_norm, 0) is not None
                    if not starts_with_label:
                        captured = _slice_until_next_label(next_tokens, 0)
            if captured:
                break

        if not captured:
            continue

        if field in ("vencimento", "data_emissao"):
            iso = to_iso_date(captured)
            if iso:
                result[field] = iso
        elif field in ("cnpj_anunciante", "cnpj_agencia"):
            m = CNPJ_RGX.search(captured)
            if m:
                result[field] = m.group(0)
        else:
            result[field] = captured

    # 2) período (Início/Término)
    def _find_first_tokenized(seqs: List[List[str]]) -> Optional[str]:
        for line in lines:
            tokens = _tokens_of(line)
            val = _slice_after_label_tokens(tokens, seqs)
            if val:
                return to_iso_date(val)
        return None

    periodo_inicio = _find_first_tokenized([["INICIO"]])
    periodo_fim    = _find_first_tokenized([["TERMINO"], ["FIM"]])

    if not (periodo_inicio and periodo_fim):
        m = re.search(
            r"\b[Dd]e\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*[aà\-]\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b",
            text, re.I
        )
        if m:
            periodo_inicio = periodo_inicio or to_iso_date(m.group(1))
            periodo_fim    = periodo_fim    or to_iso_date(m.group(2))

    # 3) MÊS REF
    mes_ref: Optional[str] = None
    for line in lines:
        tokens = _tokens_of(line)
        val = _slice_after_label_tokens(tokens, [["MES", "REF"]])
        if val:
            mes_ref = val
            break
    if not mes_ref:
        mm = MONTH_BR.search(text)
        if mm: mes_ref = mm.group(0)

    # 4) Totais
    tbn_txt = _find_currency_near(lines, [["TOTAL", "BRUTO", "NEGOCIADO"]])
    vaf_txt = _find_currency_near(lines, [["VALOR", "A", "FATURAR"]])
    total_bruto_negociado = br_money_to_float(tbn_txt or "") if tbn_txt else None
    valor_a_faturar       = br_money_to_float(vaf_txt or "") if vaf_txt else None

    # 5) Número do PI
    numero_pi = None
    mnum = re.search(r"\bPI\s*([A-Z]{0,2})\s*([0-9]{3,7})\b", text, flags=re.I) or \
           re.search(r"\bn[ºo]\s*\(?([0-9]{3,7})\)?\b", text, flags=re.I)
    if mnum:
        numero_pi = (mnum.group(2) if mnum.lastindex and mnum.lastindex >= 2 else mnum.group(1)).strip()
    if not numero_pi:
        for line in lines:
            t = _text_of(line)
            msolo = re.search(r"(^|\s)(\d{3,})(\s|$)", t)
            if msolo and msolo.group(2).isdigit():
                numero_pi = msolo.group(2); break

    # 6) Fallback por texto inteiro
    by_text = parse_pi_fields_from_text(text)
    for k, v in by_text.items():
        result.setdefault(k, v)

    # Consolidação
    if numero_pi and not result.get("numero_pi"): result["numero_pi"] = numero_pi
    if periodo_inicio: result["periodo_inicio"] = periodo_inicio
    if periodo_fim:    result["periodo_fim"]    = periodo_fim
    if mes_ref:        result["mes_ref"]        = mes_ref
    if total_bruto_negociado is not None: result["total_bruto_negociado"] = total_bruto_negociado
    if valor_a_faturar       is not None: result["valor_a_faturar"]       = valor_a_faturar

    if not result.get("canal"):
        mcanal = re.search(r"\b(Portal|DOOH|R[áa]dio|TV|Jornal|Revista|Instagram|TikTok|YouTube|Facebook|SITE)\b", text, re.I)
        if mcanal: result["canal"] = mcanal.group(1).upper()

    produtos: List[Dict[str, Any]] = []
    if result.get("periodo_inicio") and result.get("periodo_fim"):
        produtos = [{
            "nome": result.get("canal") or "Mídia",
            "veiculacoes": [{
                "data_inicio": result["periodo_inicio"],
                "data_fim": result["periodo_fim"],
                "canal": result.get("canal"),
                "formato": None,
                "quantidade": None,
                "valor": None,
            }]
        }]

    payload: Dict[str, Any] = {
        "numero_pi": result.get("numero_pi"),
        "tipo_pi": "Normal",
        "nome_anunciante": result.get("nome_anunciante"),
        "razao_social_anunciante": result.get("razao_social_anunciante"),
        "cnpj_anunciante": result.get("cnpj_anunciante"),
        "nome_agencia": result.get("nome_agencia"),
        "razao_social_agencia": result.get("razao_social_agencia"),
        "cnpj_agencia": result.get("cnpj_agencia"),
        "nome_campanha": result.get("nome_campanha"),
        "canal": result.get("canal"),
        "executivo": result.get("executivo"),
        "vencimento": result.get("vencimento"),
        "data_emissao": result.get("data_emissao"),
        "valor_bruto": result.get("total_bruto_negociado") or result.get("total_tabela"),
        "valor_liquido": result.get("valor_liquido") or result.get("valor_a_faturar"),
        "observacoes": None,
        "mes_ref": result.get("mes_ref"),
        "produtos": produtos,
    }
    return {k: v for k, v in payload.items() if v not in (None, "", [])}

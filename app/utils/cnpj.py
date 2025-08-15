# app/utils/cnpj.py
def only_digits(cnpj: str | None) -> str:
    if not cnpj:
        return ""
    return "".join(ch for ch in cnpj if ch.isdigit())

def is_cnpj_like(cnpj: str | None) -> bool:
    d = only_digits(cnpj)
    return len(d) == 14

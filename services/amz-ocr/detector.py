import re


def classify_document(text: str) -> tuple[bool, str | None]:
    normalized = re.sub(r"\s+", " ", text.upper())

    crlv_terms = (
        "RENAVAM",
        "CERTIFICADO DE REGISTRO E LICENCIAMENTO",
        "CRLV",
        "CRLV-E",
        "LICENCIAMENTO ANUAL",
    )
    cnh_terms = (
        "CARTEIRA NACIONAL DE HABILITACAO",
        "CARTEIRA NACIONAL DE HABILITAÇÃO",
        "PERMISSAO PARA DIRIGIR",
        "PERMISSÃO PARA DIRIGIR",
        "CNH",
    )
    rg_terms = (
        "CARTEIRA DE IDENTIDADE",
        "REGISTRO GERAL",
        "SECRETARIA DE SEGURANCA PUBLICA",
        "SECRETARIA DE SEGURANÇA PÚBLICA",
    )
    generic_terms = (
        "DETRAN",
        "ATPV",
        "CPF",
        "CNPJ",
        "IDENTIDADE",
        "PROCURACAO",
        "PROCURAÇÃO",
        "COMPROVANTE DE ENDERECO",
        "COMPROVANTE DE ENDEREÇO",
    )

    if any(term in normalized for term in crlv_terms):
        return True, "crlv"
    if any(term in normalized for term in cnh_terms):
        return True, "cnh"
    if any(term in normalized for term in rg_terms):
        return True, "rg"

    patterns = sum(
        (
            bool(re.search(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b", normalized)),
            bool(re.search(r"\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b", normalized)),
            bool(re.search(r"\b\d{11}\b", normalized)),
            bool(re.search(r"\b[A-HJ-NPR-Z0-9]{17}\b", normalized)),
        )
    )
    term_hits = sum(term in normalized for term in generic_terms)
    if term_hits >= 2 or (term_hits >= 1 and patterns >= 1) or patterns >= 2:
        return True, "outro"
    return False, None

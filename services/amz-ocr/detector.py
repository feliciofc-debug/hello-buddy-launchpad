import re

_REAL_WORD_RE = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ]{3,}")
_DOCUMENT_TEXT_HINT_RE = re.compile(
    r"\b(?:PLACA|RENAVAM|CHASSI|PROPRIETARIO|PROPRIETÁRIO|"
    r"CPF|CNPJ|DETRAN|REGISTRO|LICENCIAMENTO|HABILITACAO|HABILITAÇÃO|"
    r"VALIDADE|NASCIMENTO|FILIACAO|FILIAÇÃO|CATEGORIA|COMBUSTIVEL|"
    r"COMBUSTÍVEL|MUNICIPIO|MUNICÍPIO)\b",
    re.IGNORECASE,
)


def possible_document_text(text: str, colored_background: bool) -> bool:
    real_word_lines: list[list[str]] = []
    for raw_line in text.splitlines():
        words = _REAL_WORD_RE.findall(raw_line)
        if len(words) >= 2:
            real_word_lines.append(words)

    words = [word for line in real_word_lines for word in line]
    letter_count = sum(len(word) for word in words)
    dense_text = (
        len(real_word_lines) >= 12
        and len(words) >= 24
        and letter_count >= 100
    )
    hint_count = len(_DOCUMENT_TEXT_HINT_RE.findall(text))
    old_colored_document = (
        colored_background
        and len(real_word_lines) >= 6
        and len(words) >= 12
        and letter_count >= 55
        and hint_count >= 2
    )
    return dense_text or old_colored_document


def _cpf_valid(value: str) -> bool:
    if not re.fullmatch(r"\d{11}", value) or len(set(value)) == 1:
        return False

    def digit(length: int) -> int:
        total = sum(int(value[index]) * (length + 1 - index) for index in range(length))
        rest = (total * 10) % 11
        return 0 if rest == 10 else rest

    return digit(9) == int(value[9]) and digit(10) == int(value[10])


def _cnpj_valid(value: str) -> bool:
    if not re.fullmatch(r"\d{14}", value) or len(set(value)) == 1:
        return False

    def digit(length: int, weights: list[int]) -> int:
        total = sum(int(value[index]) * weight for index, weight in enumerate(weights))
        rest = total % 11
        return 0 if rest < 2 else 11 - rest

    return digit(12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) == int(
        value[12]
    ) and digit(13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) == int(value[13])


def _renavam_valid(value: str) -> bool:
    if not re.fullmatch(r"\d{11}", value) or len(set(value)) == 1:
        return False
    weights = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    total = sum(int(value[index]) * weight for index, weight in enumerate(weights))
    remainder = (total * 10) % 11
    digit = 0 if remainder == 10 else remainder
    return digit == int(value[10])


def _has_valid_pattern(text: str) -> bool:
    for raw in re.findall(r"\b[\d./-]{11,18}\b", text):
        digits = re.sub(r"\D", "", raw)
        if _cpf_valid(digits) or _cnpj_valid(digits) or _renavam_valid(digits):
            return True
    return bool(re.search(r"\b[A-HJ-NPR-Z0-9]{17}\b", text))


def classify_document(text: str) -> tuple[bool, str | None]:
    normalized = re.sub(r"\s+", " ", text.upper()).strip()

    if any(
        term in normalized
        for term in (
        "CERTIFICADO DE REGISTRO E LICENCIAMENTO",
            "CERTIFICADO DE REGISTRO DE VEICULO",
        )
    ):
        return True, "crlv"
    if any(
        term in normalized
        for term in (
        "CARTEIRA NACIONAL DE HABILITACAO",
        "CARTEIRA NACIONAL DE HABILITAÇÃO",
        "PERMISSAO PARA DIRIGIR",
        "PERMISSÃO PARA DIRIGIR",
        )
    ):
        return True, "cnh"
    if any(
        term in normalized
        for term in (
        "CARTEIRA DE IDENTIDADE",
            "CEDULA DE IDENTIDADE",
        )
    ):
        return True, "rg"
    if (
        "AUTORIZAÇÃO PARA TRANSFERÊNCIA DE PROPRIEDADE" in normalized
        or "AUTORIZACAO PARA TRANSFERENCIA DE PROPRIEDADE" in normalized
        or re.search(r"\bATPV-E\b", normalized)
        or (
            re.search(r"\b(PROCURACAO|PROCURAÇÃO)\b", normalized)
            and re.search(r"\b(VEICULO|VEÍCULO|AUTOMOTOR|DETRAN|TRANSFERENCIA)\b", normalized)
        )
    ):
        return True, "outro"

    official_header = "REPÚBLICA FEDERATIVA DO BRASIL" in normalized or (
        "REPUBLICA FEDERATIVA DO BRASIL" in normalized
    )
    authority = bool(
        re.search(
            r"\b(DETRAN|SENATRAN|MINISTERIO|MINISTÉRIO|SECRETARIA DE SEGURANCA|SECRETARIA DE SEGURANÇA)\b",
            normalized,
        )
    )
    if official_header and authority and _has_valid_pattern(normalized):
        if "RENAVAM" in normalized or "LICENCIAMENTO" in normalized:
            return True, "crlv"
        if "HABILITACAO" in normalized or "HABILITAÇÃO" in normalized:
            return True, "cnh"
        if "REGISTRO GERAL" in normalized:
            return True, "rg"
        return True, "outro"
    return False, None

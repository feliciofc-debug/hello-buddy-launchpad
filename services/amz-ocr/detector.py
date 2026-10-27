import re
import unicodedata

_REAL_WORD_RE = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ]{3,}")
_STRONG_TERMS = (
    ("DETRAN",),
    ("RENAVAM",),
    ("CHASSI",),
    ("CERTIFICADO", "DE", "REGISTRO"),
    ("LICENCIAMENTO",),
    ("REPUBLICA", "FEDERATIVA"),
    ("MINISTERIO", "DAS", "CIDADES"),
    ("SECRETARIA", "NACIONAL", "DE", "TRANSITO"),
    ("HABILITACAO",),
    ("CARTEIRA", "NACIONAL"),
    ("REGISTRO", "GERAL"),
    ("CPF",),
    ("DOCUMENTO", "DE", "IDENTIDADE"),
    ("PROPRIETARIO",),
)


def _normalize(value: str) -> str:
    return "".join(
        char
        for char in unicodedata.normalize("NFD", str(value).upper())
        if unicodedata.category(char) != "Mn"
    )


def _one_edit_or_less(left: str, right: str) -> bool:
    if left == right:
        return True
    if abs(len(left) - len(right)) > 1:
        return False
    if len(left) > len(right):
        left, right = right, left
    if len(left) == len(right):
        return sum(a != b for a, b in zip(left, right)) <= 1
    short_index = 0
    long_index = 0
    edits = 0
    while short_index < len(left) and long_index < len(right):
        if left[short_index] == right[long_index]:
            short_index += 1
            long_index += 1
            continue
        edits += 1
        long_index += 1
        if edits > 1:
            return False
    return True


def _has_strong_term(text: str) -> bool:
    tokens = re.findall(r"[A-Z0-9]+", _normalize(text))
    for phrase in _STRONG_TERMS:
        width = len(phrase)
        for offset in range(0, len(tokens) - width + 1):
            if all(
                _one_edit_or_less(tokens[offset + index], expected)
                for index, expected in enumerate(phrase)
            ):
                return True
    return False


def possible_document_text(text: str, colored_background: bool) -> bool:
    if _has_strong_term(text) or _has_document_pattern(text):
        return True

    real_words = _REAL_WORD_RE.findall(text)
    if len(real_words) < 3:
        return False
    text_lines = sum(1 for line in text.splitlines() if line.strip())
    old_layout_rule = text_lines >= 25 or (
        colored_background and text_lines >= 8
    )
    return old_layout_rule


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


def _has_document_pattern(text: str) -> bool:
    text = _normalize(text)
    for raw in re.findall(r"\b[\d./-]{11,18}\b", text):
        digits = re.sub(r"\D", "", raw)
        if len(digits) in (11, 14):
            return True
    return bool(re.search(r"\b[A-HJ-NPR-Z0-9]{17}\b", text))


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

#!/usr/bin/env python3
"""Dry-run A da migração Lovable -> VPS.

Este programa não possui caminhos de escrita para banco, autenticação,
Storage ou diretórios de mídia. As únicas escritas opcionais são os relatórios
JSON solicitados explicitamente por linha de comando.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import unquote, urlparse


SOURCE_HOST = "jibpvpqgplmahjhswiza.supabase.co"
PUBLIC_STORAGE_PREFIX = "/storage/v1/object/public/"
TARGET_STORAGE_URL = "https://api.amzofertas.com.br/storage/v1/object/public"
REAL_TARGET_MEDIA_ROOT = Path("/opt/amz-media")

SYMBOLIC_AMZ_ID = "$AMZ_NEW_USER_ID"
SYMBOLIC_DUDA_ID = "$DUDA_NEW_USER_ID"
SYMBOLIC_RENATA_ID = "$RENATA_NEW_USER_ID"

TENANTS: dict[str, dict[str, str]] = {
    "atom": {
        "source_user_id": "b7af0118-c506-4f87-8ac3-a0a11fd621fe",
        "target_user_id": SYMBOLIC_AMZ_ID,
        "email": "expo@atombrasildigital.com",
        "role": "admin",
        "operation": "create",
    },
    "marcelo": {
        "source_user_id": "d2ca3f33-777b-465d-9961-59ce2eae393d",
        "target_user_id": "22f0c364-a782-48fa-8482-0ed3d7529a5f",
        "email": "marcelo.martins@autorizadoademicon.com.br",
        "role": "empresa",
        "operation": "update_email",
    },
    "duda": {
        "source_user_id": "684ed635-2a72-47ba-bee1-a8c906d973a3",
        "target_user_id": SYMBOLIC_DUDA_ID,
        "email": "dudacarega@gmail.com",
        "role": "empresa",
        "operation": "create",
    },
    "renata": {
        "source_user_id": "781d6839-0de1-4261-a971-4375ee8db92d",
        "target_user_id": SYMBOLIC_RENATA_ID,
        "email": "renatascarega@gmail.com",
        "role": "empresa",
        "operation": "create",
    },
}

EXPECTED_COUNTS: dict[str, dict[str, int]] = {
    "renata": {
        "profiles": 1,
        "empresa_config": 0,
        "produtos": 277,
        "midias_whatsapp": 0,
        "whatsapp_cloud_agent_config": 0,
        "whatsapp_config": 0,
        "autopilot_config": 1,
        "social_posts_queue": 4606,
        "integrations": 2,
        "cadastros": 0,
        "opt_ins": 0,
        "biblioteca_campanhas": 0,
        "historico_envios": 0,
        "videos": 0,
        "notificacoes_usuario": 0,
    },
    "marcelo": {
        "profiles": 1,
        "empresa_config": 0,
        "produtos": 14,
        "midias_whatsapp": 36,
        "whatsapp_cloud_agent_config": 1,
        "whatsapp_config": 1,
        "autopilot_config": 1,
        "social_posts_queue": 564,
        "integrations": 2,
        "cadastros": 0,
        "opt_ins": 0,
        "biblioteca_campanhas": 0,
        "historico_envios": 0,
        "videos": 0,
        "notificacoes_usuario": 1,
    },
    "duda": {
        "profiles": 1,
        "empresa_config": 0,
        "produtos": 82,
        "midias_whatsapp": 0,
        "whatsapp_cloud_agent_config": 0,
        "whatsapp_config": 0,
        "autopilot_config": 1,
        "social_posts_queue": 1268,
        "integrations": 2,
        "cadastros": 0,
        "opt_ins": 0,
        "biblioteca_campanhas": 0,
        "historico_envios": 0,
        "videos": 0,
        "notificacoes_usuario": 0,
    },
    "atom": {
        "profiles": 1,
        "empresa_config": 1,
        "produtos": 17,
        "midias_whatsapp": 191,
        "whatsapp_cloud_agent_config": 1,
        "whatsapp_config": 1,
        "autopilot_config": 1,
        "social_posts_queue": 4423,
        "integrations": 6,
        "cadastros": 46,
        "opt_ins": 6,
        "biblioteca_campanhas": 253,
        "historico_envios": 128,
        "videos": 10,
        "notificacoes_usuario": 0,
    },
}

EMPTY_TABLES = {
    "clientes",
    "grupos_transmissao",
    "grupo_membros",
    "campanhas_recorrentes",
    "social_connections",
}

SKIPPED_TABLES = {
    "integrations": "reconexao_oauth_obrigatoria",
    "social_posts_queue": "historico_arquivado_fora_da_fila_operacional",
    "whatsapp_config": "configuracao_funcional_da_vps_prevalece",
}

MARCELO_IMPORT_TABLES = {"profiles", "produtos", "midias_whatsapp"}

SOURCE_ONLY_COLUMNS: dict[str, set[str]] = {
    "midias_whatsapp": {
        "arquivo_nome",
        "generation_job_id",
        "generation_job_type",
    },
    "autopilot_config": {
        "desativado_em",
        "desativado_motivo",
        "desativado_por",
    },
    "social_posts_queue": {
        "approval_token",
        "approved_at",
        "approved_by",
        "approved_media_type",
        "approved_media_url",
        "asset_id",
        "asset_tipo",
        "origem_fluxo",
    },
}

TOKEN_FIELDS = {
    "access_token",
    "refresh_token",
    "lomadee_app_token",
    "authorization",
    "service_role",
    "service_role_key",
    "jwt_secret",
}

REQUIRED_FIELDS: dict[str, tuple[str, ...]] = {
    "profiles": ("id", "nome", "whatsapp", "cpf"),
    "empresa_config": ("id", "user_id", "voz_copy"),
    "produtos": ("id", "user_id", "nome", "categoria"),
    "midias_whatsapp": ("id", "user_id", "origem", "tipo", "midia_url", "status"),
    "whatsapp_cloud_agent_config": ("id", "user_id", "agent_mode"),
    "autopilot_config": (
        "id",
        "user_id",
        "nome",
        "produto_fonte",
        "posts_por_dia",
        "dias_semana",
        "horario_inicio",
        "horario_fim",
        "modo_geracao",
    ),
    "cadastros": ("id", "nome", "whatsapp"),
    "opt_ins": ("id", "nome", "whatsapp"),
    "biblioteca_campanhas": ("id", "user_id", "produto_nome", "campanha_nome"),
    "historico_envios": ("id", "whatsapp"),
    "videos": ("id", "user_id"),
    "notificacoes_usuario": ("id", "user_id", "tipo", "titulo", "mensagem"),
}

ENUM_FIELDS: dict[tuple[str, str], set[str]] = {
    ("profiles", "plano"): {"free", "empresas", "premium"},
    ("profiles", "tipo"): {
        "comum",
        "empresa",
        "mcassab",
        "afiliado",
        "afiliado_admin",
        "b2b",
        "parceiro",
    },
    ("empresa_config", "voz_copy"): {"empresa", "pessoa"},
    ("produtos", "modo_postagem_fb"): {"promocional", "engajamento"},
    ("whatsapp_cloud_agent_config", "agent_mode"): {"whitelabel", "amz"},
    ("autopilot_config", "modo_geracao"): {"padrao", "engajamento"},
}

IMPORT_TABLES = tuple(
    table
    for table in next(iter(EXPECTED_COUNTS.values()))
    if table not in SKIPPED_TABLES
)

UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class Issue:
    severity: str
    code: str
    message: str
    tenant: str | None = None
    table: str | None = None
    record_id: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            key: value
            for key, value in {
                "severity": self.severity,
                "code": self.code,
                "message": self.message,
                "tenant": self.tenant,
                "table": self.table,
                "record_id": self.record_id,
            }.items()
            if value is not None
        }


@dataclass(frozen=True)
class MediaPathMapping:
    relative_target: Path
    source_owner_id: str | None
    target_owner_id: str | None
    warning: str | None = None


class PsqlReadOnly:
    """Executa somente COPY(SELECT ...) dentro de transação READ ONLY."""

    def __init__(self, dsn: str):
        self.dsn = dsn

    def query(self, select_sql: str) -> list[dict[str, str]]:
        normalized = select_sql.strip().rstrip(";")
        if not normalized.lower().startswith("select "):
            raise ValueError("consulta recusada: apenas SELECT é permitido")

        script = (
            "BEGIN TRANSACTION READ ONLY;\n"
            f"COPY ({normalized}) TO STDOUT WITH (FORMAT CSV, HEADER TRUE);\n"
            "ROLLBACK;\n"
        )
        env = os.environ.copy()
        env["PGDATABASE"] = self.dsn
        env.setdefault("PGCONNECT_TIMEOUT", "10")
        completed = subprocess.run(
            ["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1"],
            input=script,
            text=True,
            capture_output=True,
            env=env,
            check=False,
        )
        if completed.returncode != 0:
            error = completed.stderr.strip().replace(self.dsn, "[DSN REDACTED]")
            raise RuntimeError(f"consulta read-only falhou: {error}")
        return list(csv.DictReader(io.StringIO(completed.stdout)))


class DryRun:
    def __init__(
        self,
        export_dir: Path,
        media_dir: Path,
        target_media_dir: Path,
        expected_files: int,
        db: PsqlReadOnly | None,
    ):
        self.export_dir = export_dir
        self.media_dir = media_dir
        self.target_media_dir = target_media_dir
        self.expected_files = expected_files
        self.db = db
        self.issues: list[Issue] = []
        self.records: dict[str, dict[str, list[dict[str, Any]]]] = defaultdict(dict)
        self.ids_by_table: dict[str, set[str]] = defaultdict(set)
        self.product_ids: set[str] = set()
        self.media_ids: set[str] = set()
        self.opt_in_ids: set[str] = set()
        self.old_to_target = {
            cfg["source_user_id"]: cfg["target_user_id"] for cfg in TENANTS.values()
        }
        self.storage_references: list[dict[str, Any]] = []
        self.file_manifest: list[dict[str, Any]] = []
        self.missing_profile_fields: list[dict[str, str]] = []
        self.report: dict[str, Any] = {
            "metadata": {
                "mode": "dry-run-a",
                "read_only": True,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "source_host": SOURCE_HOST,
                "target_storage_root": str(target_media_dir),
            },
            "account_plan": TENANTS,
            "tenant_import_policy": {
                "marcelo": {
                    "import_only": sorted(MARCELO_IMPORT_TABLES),
                    "preserve_destination_configuration": True,
                }
            },
            "tables": {},
            "storage": {},
            "database": {"enabled": db is not None},
            "summary": {},
        }

    def issue(
        self,
        severity: str,
        code: str,
        message: str,
        *,
        tenant: str | None = None,
        table: str | None = None,
        record_id: Any = None,
    ) -> None:
        self.issues.append(
            Issue(
                severity=severity,
                code=code,
                message=message,
                tenant=tenant,
                table=table,
                record_id=str(record_id) if record_id is not None else None,
            )
        )

    @staticmethod
    def _skip_reason(tenant: str, table: str) -> str | None:
        if table in SKIPPED_TABLES:
            return SKIPPED_TABLES[table]
        if tenant == "marcelo" and table not in MARCELO_IMPORT_TABLES:
            return "configuracao_e_dados_fora_do_escopo_preservados_na_vps"
        return None

    @classmethod
    def _is_imported(cls, tenant: str, table: str) -> bool:
        return cls._skip_reason(tenant, table) is None

    @staticmethod
    def _read_records(path: Path) -> list[dict[str, Any]]:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        if isinstance(payload, list):
            records = payload
        elif isinstance(payload, dict) and isinstance(payload.get("data"), list):
            records = payload["data"]
        elif isinstance(payload, dict) and not payload:
            records = []
        else:
            raise ValueError("JSON deve ser uma lista ou um objeto com chave data/lista")
        if not all(isinstance(record, dict) for record in records):
            raise ValueError("todos os registros devem ser objetos JSON")
        return records

    def load_exports(self) -> None:
        for tenant, expected_tables in EXPECTED_COUNTS.items():
            tenant_dir = self.export_dir / tenant
            for table, expected in expected_tables.items():
                path = tenant_dir / f"{table}.json"
                if not path.exists():
                    if expected:
                        self.issue(
                            "blocker",
                            "missing_export",
                            f"arquivo esperado ausente: {path}",
                            tenant=tenant,
                            table=table,
                        )
                    records: list[dict[str, Any]] = []
                else:
                    try:
                        records = self._read_records(path)
                    except (OSError, json.JSONDecodeError, ValueError) as error:
                        self.issue(
                            "blocker",
                            "invalid_json",
                            f"não foi possível ler {path}: {error}",
                            tenant=tenant,
                            table=table,
                        )
                        records = []

                self.records[tenant][table] = records
                if len(records) != expected:
                    self.issue(
                        "blocker",
                        "count_mismatch",
                        f"esperado={expected}, encontrado={len(records)}",
                        tenant=tenant,
                        table=table,
                    )
                self._inspect_table(tenant, table, records, expected)

        for tenant in TENANTS:
            tenant_dir = self.export_dir / tenant
            for table in EMPTY_TABLES:
                path = tenant_dir / f"{table}.json"
                if not path.exists():
                    continue
                try:
                    rows = self._read_records(path)
                except (OSError, json.JSONDecodeError, ValueError) as error:
                    self.issue(
                        "blocker",
                        "invalid_empty_table_json",
                        f"não foi possível ler {path}: {error}",
                        tenant=tenant,
                        table=table,
                    )
                    continue
                if rows:
                    self.issue(
                        "blocker",
                        "expected_empty_table_has_rows",
                        f"tabela declarada vazia contém {len(rows)} registros",
                        tenant=tenant,
                        table=table,
                    )

    def _inspect_table(
        self,
        tenant: str,
        table: str,
        records: list[dict[str, Any]],
        expected: int,
    ) -> None:
        source_only = SOURCE_ONLY_COLUMNS.get(table, set())
        discarded_counter: Counter[str] = Counter()
        token_counter: Counter[str] = Counter()
        seen_ids: set[str] = set()
        source_user_id = TENANTS[tenant]["source_user_id"]

        for row in records:
            record_id = row.get("id")
            if record_id is not None:
                record_id_text = str(record_id)
                if record_id_text in seen_ids:
                    self.issue(
                        "blocker",
                        "duplicate_source_id",
                        "ID duplicado dentro do mesmo arquivo",
                        tenant=tenant,
                        table=table,
                        record_id=record_id_text,
                    )
                seen_ids.add(record_id_text)
                if not self._is_uuid(record_id_text):
                    self.issue(
                        "blocker",
                        "invalid_uuid",
                        "ID não é UUID válido",
                        tenant=tenant,
                        table=table,
                        record_id=record_id_text,
                    )
                elif self._is_imported(tenant, table):
                    if record_id_text in self.ids_by_table[table]:
                        self.issue(
                            "blocker",
                            "cross_tenant_id_collision",
                            "mesmo ID aparece para mais de um cliente",
                            tenant=tenant,
                            table=table,
                            record_id=record_id_text,
                        )
                    self.ids_by_table[table].add(record_id_text)

            for required in REQUIRED_FIELDS.get(table, ()):
                value = row.get(required)
                if value is None or (isinstance(value, str) and not value.strip()):
                    if table == "profiles":
                        self.missing_profile_fields.append(
                            {
                                "tenant": tenant,
                                "field": required,
                                "record_id": str(record_id),
                            }
                        )
                    else:
                        self.issue(
                            "blocker",
                            "missing_required_field",
                            f"campo obrigatório ausente/vazio: {required}",
                            tenant=tenant,
                            table=table,
                            record_id=record_id,
                        )

            row_user_id = row.get("user_id")
            if row_user_id is not None and str(row_user_id) != source_user_id:
                self.issue(
                    "blocker",
                    "unexpected_source_user",
                    f"user_id não pertence ao diretório {tenant}",
                    tenant=tenant,
                    table=table,
                    record_id=record_id,
                )
            if table == "profiles" and str(row.get("id", "")) != source_user_id:
                self.issue(
                    "blocker",
                    "profile_id_mismatch",
                    "profiles.id difere do ID de origem do cliente",
                    tenant=tenant,
                    table=table,
                    record_id=record_id,
                )

            for field in source_only:
                if field in row:
                    discarded_counter[field] += 1
            self._count_sensitive_fields(row, token_counter)

            for (enum_table, field), allowed in ENUM_FIELDS.items():
                if enum_table != table:
                    continue
                value = row.get(field)
                if value is not None and value not in allowed:
                    self.issue(
                        "blocker",
                        "invalid_enum",
                        f"{field}={value!r} não permitido; esperado um de {sorted(allowed)}",
                        tenant=tenant,
                        table=table,
                        record_id=record_id,
                    )

            if table == "autopilot_config" and row.get("ativo") is True:
                self.issue(
                    "info",
                    "autopilot_will_be_disabled",
                    "ativo=true será transformado em false; proxima_execucao será NULL",
                    tenant=tenant,
                    table=table,
                    record_id=record_id,
                )
            if table == "midias_whatsapp":
                duration = row.get("duracao_segundos")
                if isinstance(duration, float) and not duration.is_integer():
                    self.issue(
                        "info",
                        "duration_will_be_rounded",
                        f"duracao_segundos={duration} será arredondada para inteiro",
                        tenant=tenant,
                        table=table,
                        record_id=record_id,
                    )

            self._collect_urls(tenant, table, record_id, row)

        skip_reason = self._skip_reason(tenant, table)
        table_report = self.report["tables"].setdefault(
            table,
            {
                "source_only_columns": sorted(source_only),
                "tenants": {},
            },
        )
        table_report["tenants"][tenant] = {
            "policy": f"skip:{skip_reason}" if skip_reason else "validate_and_import",
            "expected": expected,
            "found": len(records),
            "ids": len(seen_ids),
            "discarded_column_occurrences": dict(sorted(discarded_counter.items())),
            "sensitive_field_occurrences": dict(sorted(token_counter.items())),
        }

        if table == "integrations" and records:
            self.issue(
                "info",
                "integrations_skipped",
                f"{len(records)} conexões serão descartadas; nenhum token será importado",
                tenant=tenant,
                table=table,
            )
        if table == "social_posts_queue" and records:
            active = Counter(str(row.get("status")) for row in records)
            table_report["tenants"][tenant]["status_counts"] = dict(sorted(active.items()))
            self.issue(
                "info",
                "social_queue_archived",
                f"{len(records)} linhas ficarão somente no arquivo histórico",
                tenant=tenant,
                table=table,
            )
        if table == "whatsapp_config" and records:
            self.issue(
                "info",
                "legacy_whatsapp_config_skipped",
                "a configuração funcional existente na VPS prevalecerá",
                tenant=tenant,
                table=table,
            )

    @staticmethod
    def _is_uuid(value: str) -> bool:
        if not UUID_RE.match(value):
            return False
        try:
            uuid.UUID(value)
        except ValueError:
            return False
        return True

    @classmethod
    def _is_sensitive_key(cls, key: Any) -> bool:
        normalized = str(key).lower()
        return (
            normalized in TOKEN_FIELDS
            or normalized.endswith(("_token", "_secret", "_password", "_key"))
            or "password" in normalized
        )

    @classmethod
    def _count_sensitive_fields(
        cls,
        value: Any,
        counter: Counter[str],
    ) -> None:
        if isinstance(value, dict):
            for key, nested in value.items():
                normalized = str(key).lower()
                if cls._is_sensitive_key(key) and nested not in (None, ""):
                    counter[normalized] += 1
                cls._count_sensitive_fields(nested, counter)
        elif isinstance(value, list):
            for nested in value:
                cls._count_sensitive_fields(nested, counter)

    def _collect_urls(
        self,
        tenant: str,
        table: str,
        record_id: Any,
        value: Any,
        field_path: str = "",
    ) -> None:
        if isinstance(value, dict):
            for key, nested in value.items():
                next_path = f"{field_path}.{key}" if field_path else key
                if self._is_sensitive_key(key):
                    continue
                self._collect_urls(tenant, table, record_id, nested, next_path)
        elif isinstance(value, list):
            for index, nested in enumerate(value):
                self._collect_urls(
                    tenant,
                    table,
                    record_id,
                    nested,
                    f"{field_path}[{index}]",
                )
        elif isinstance(value, str) and value.lower().startswith(
            ("http://", "https://")
        ):
            parsed = urlparse(value)
            if parsed.hostname == SOURCE_HOST:
                redacted_url = parsed._replace(
                    netloc=SOURCE_HOST,
                    query="",
                    fragment="",
                ).geturl()
                self.storage_references.append(
                    {
                        "tenant": tenant,
                        "table": table,
                        "record_id": str(record_id) if record_id is not None else None,
                        "field": field_path,
                        "source_url": redacted_url,
                    }
                )

    def validate_references(self) -> None:
        products_by_tenant = {
            tenant: {
                str(row["id"])
                for row in tenant_rows.get("produtos", [])
                if row.get("id")
            }
            for tenant, tenant_rows in self.records.items()
        }
        media_by_tenant = {
            tenant: {
                str(row["id"])
                for row in tenant_rows.get("midias_whatsapp", [])
                if row.get("id")
            }
            for tenant, tenant_rows in self.records.items()
        }
        opt_ins_by_tenant = {
            tenant: {
                str(row["id"])
                for row in tenant_rows.get("opt_ins", [])
                if row.get("id")
            }
            for tenant, tenant_rows in self.records.items()
        }
        self.product_ids = set().union(*products_by_tenant.values())
        self.media_ids = set().union(*media_by_tenant.values())
        self.opt_in_ids = set().union(*opt_ins_by_tenant.values())
        opt_in_whatsapps: dict[str, list[str]] = defaultdict(list)
        cadastro_keys: dict[tuple[str, str], list[str]] = defaultdict(list)

        for tenant, tenant_rows in self.records.items():
            for row in tenant_rows.get("opt_ins", []):
                whatsapp = str(row.get("whatsapp") or "").strip()
                if whatsapp:
                    opt_in_whatsapps[whatsapp].append(str(row.get("id")))
            for row in tenant_rows.get("cadastros", []):
                whatsapp = str(row.get("whatsapp") or "").strip()
                if whatsapp:
                    target_user = TENANTS[tenant]["target_user_id"]
                    cadastro_keys[(target_user, whatsapp)].append(str(row.get("id")))
            for row in tenant_rows.get("midias_whatsapp", []):
                parent = row.get("midia_pai_id")
                if parent and str(parent) not in media_by_tenant[tenant]:
                    cross_tenant = str(parent) in self.media_ids
                    self.issue(
                        "blocker",
                        (
                            "cross_tenant_media_parent"
                            if cross_tenant
                            else "missing_media_parent"
                        ),
                        (
                            "midia_pai_id pertence a outro tenant"
                            if cross_tenant
                            else f"midia_pai_id não encontrado: {parent}"
                        ),
                        tenant=tenant,
                        table="midias_whatsapp",
                        record_id=row.get("id"),
                    )
            for table in ("biblioteca_campanhas", "notificacoes_usuario"):
                for row in tenant_rows.get(table, []):
                    product = row.get("produto_id")
                    if product and str(product) not in products_by_tenant[tenant]:
                        cross_tenant = str(product) in self.product_ids
                        self.issue(
                            "blocker" if cross_tenant else "warning",
                            (
                                "cross_tenant_product_reference"
                                if cross_tenant
                                else "orphan_product_reference"
                            ),
                            (
                                "produto_id pertence a outro tenant"
                                if cross_tenant
                                else f"produto_id será convertido para NULL: {product}"
                            ),
                            tenant=tenant,
                            table=table,
                            record_id=row.get("id"),
                        )
            for row in tenant_rows.get("produtos", []):
                if row.get("cliente_id"):
                    self.issue(
                        "warning",
                        "cliente_reference_will_be_cleared",
                        f"cliente_id será convertido para NULL: {row['cliente_id']}",
                        tenant=tenant,
                        table="produtos",
                        record_id=row.get("id"),
                    )
            for row in tenant_rows.get("biblioteca_campanhas", []):
                if row.get("campanha_id"):
                    self.issue(
                        "info",
                        "recurring_campaign_reference_will_be_cleared",
                        f"campanha_id será convertido para NULL: {row['campanha_id']}",
                        tenant=tenant,
                        table="biblioteca_campanhas",
                        record_id=row.get("id"),
                    )
            for row in tenant_rows.get("cadastros", []):
                opt_in = row.get("opt_in_id")
                if opt_in and str(opt_in) not in opt_ins_by_tenant[tenant]:
                    cross_tenant = str(opt_in) in self.opt_in_ids
                    self.issue(
                        "blocker" if cross_tenant else "warning",
                        (
                            "cross_tenant_opt_in_reference"
                            if cross_tenant
                            else "orphan_opt_in_reference"
                        ),
                        (
                            "opt_in_id pertence a outro tenant"
                            if cross_tenant
                            else f"opt_in_id será convertido para NULL: {opt_in}"
                        ),
                        tenant=tenant,
                        table="cadastros",
                        record_id=row.get("id"),
                    )
            for row in tenant_rows.get("autopilot_config", []):
                for product in row.get("produto_ids") or []:
                    if str(product) not in products_by_tenant[tenant]:
                        cross_tenant = str(product) in self.product_ids
                        self.issue(
                            "blocker",
                            (
                                "autopilot_cross_tenant_product"
                                if cross_tenant
                                else "autopilot_missing_product"
                            ),
                            (
                                "produto_ids contém produto de outro tenant"
                                if cross_tenant
                                else f"produto_ids contém produto ausente: {product}"
                            ),
                            tenant=tenant,
                            table="autopilot_config",
                            record_id=row.get("id"),
                        )

        for record_ids in opt_in_whatsapps.values():
            if len(record_ids) > 1:
                self.issue(
                    "blocker",
                    "duplicate_opt_in_whatsapp",
                    (
                        "mais de um opt_in possui o mesmo WhatsApp; registros="
                        + ",".join(record_ids)
                    ),
                    table="opt_ins",
                )
        for record_ids in cadastro_keys.values():
            if len(record_ids) > 1:
                self.issue(
                    "blocker",
                    "duplicate_cadastro_user_whatsapp",
                    (
                        "mais de um cadastro viola (user_id, whatsapp); registros="
                        + ",".join(record_ids)
                    ),
                    table="cadastros",
                )

    @staticmethod
    def _sha256(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def _map_relative_media_path(self, relative: Path) -> MediaPathMapping:
        uuid_parts = [
            (index, part)
            for index, part in enumerate(relative.parts)
            if self._is_uuid(part)
        ]
        if not uuid_parts:
            return MediaPathMapping(
                relative,
                None,
                None,
                "caminho compartilhado sem UUID de proprietário",
            )
        known_owners = [
            (index, owner_id)
            for index, owner_id in uuid_parts
            if owner_id in self.old_to_target
        ]
        if len(known_owners) != 1:
            return MediaPathMapping(
                relative,
                None,
                None,
                (
                    "UUID de proprietário não reconhecido"
                    if not known_owners
                    else "mais de um UUID de proprietário reconhecido"
                ),
            )
        owner_index, owner_id = known_owners[0]
        target_owner_id = self.old_to_target[owner_id]
        mapped_parts = list(relative.parts)
        mapped_parts[owner_index] = target_owner_id
        warning = (
            "caminho contém UUID adicional não reconhecido"
            if len(uuid_parts) > 1
            else None
        )
        return MediaPathMapping(
            Path(*mapped_parts), owner_id, target_owner_id, warning
        )

    def _target_parent_conflict(self, target: Path) -> Path | None:
        current = target.parent
        while current != self.target_media_dir.parent:
            if os.path.lexists(current):
                if current.is_symlink() or not current.is_dir():
                    return current
            if current == self.target_media_dir:
                break
            current = current.parent
        return None

    def _find_source_public_root(self) -> Path:
        candidates = [
            self.media_dir
            / SOURCE_HOST
            / "storage"
            / "v1"
            / "object"
            / "public",
            self.media_dir / "storage" / "v1" / "object" / "public",
            self.media_dir,
        ]
        for candidate in candidates:
            if candidate.is_dir() and (
                candidate.name == "public"
                or candidate
                == self.media_dir
                / SOURCE_HOST
                / "storage"
                / "v1"
                / "object"
                / "public"
            ):
                return candidate
        return candidates[0]

    def inspect_storage(self) -> None:
        source_public_root = self._find_source_public_root()
        if not source_public_root.is_dir():
            self.issue(
                "blocker",
                "missing_media_root",
                f"diretório de mídia não encontrado: {source_public_root}",
            )
            self.report["storage"] = {
                "source_root": str(source_public_root),
                "files_found": 0,
                "expected_files": self.expected_files,
            }
            return

        target_paths: dict[str, dict[str, str]] = {}
        source_total_bytes = 0
        unreadable = 0
        existing_same = 0
        existing_conflicts = 0
        unresolved_target_ids = 0
        proposed_directories: set[str] = set()

        files = sorted(
            path
            for path in source_public_root.rglob("*")
            if not path.is_dir() or path.is_symlink()
        )
        if len(files) != self.expected_files:
            self.issue(
                "blocker",
                "media_count_mismatch",
                f"esperado={self.expected_files}, encontrado={len(files)}",
            )

        for path in files:
            relative = path.relative_to(source_public_root)
            if path.is_symlink() or not path.is_file():
                self.issue(
                    "blocker",
                    "source_file_not_regular",
                    f"mídia de origem não é arquivo regular: {path}",
                )
                continue
            mapping = self._map_relative_media_path(relative)
            mapped_relative = mapping.relative_target
            if mapping.warning is not None:
                self.issue(
                    "warning",
                    "media_path_preserved_without_owner_rewrite",
                    f"{relative}: {mapping.warning}; caminho preservado",
                )
            target = self.target_media_dir / mapped_relative
            source_total_bytes += path.stat().st_size
            if not os.access(path, os.R_OK):
                unreadable += 1
                self.issue(
                    "blocker",
                    "source_file_unreadable",
                    f"arquivo sem permissão de leitura: {path}",
                )
                continue
            source_hash = self._sha256(path)
            target_key = str(mapped_relative)
            prior = target_paths.get(target_key)
            if prior and prior["sha256"] != source_hash:
                self.issue(
                    "blocker",
                    "source_target_path_collision",
                    f"dois arquivos diferentes mapeiam para {target_key}",
                )
            target_paths[target_key] = {"sha256": source_hash, "source": str(path)}
            proposed_directories.add(str(mapped_relative.parent))

            target_state = "new"
            target_id = mapping.target_owner_id
            if target_id is not None and target_id.startswith("$"):
                unresolved_target_ids += 1
                target_state = "pending_target_user_id"
            else:
                parent_conflict = self._target_parent_conflict(target)
                if parent_conflict is not None:
                    existing_conflicts += 1
                    target_state = "blocked_by_non_directory_parent"
                    self.issue(
                        "blocker",
                        "target_parent_conflict",
                        f"componente do destino não é diretório real: {parent_conflict}",
                    )
                elif os.path.lexists(target) and (
                    target.is_symlink() or not target.is_file()
                ):
                    existing_conflicts += 1
                    target_state = "existing_non_regular_path"
                    self.issue(
                        "blocker",
                        "target_path_not_regular_file",
                        f"destino existente não é arquivo regular: {target}",
                    )
                elif target.is_file():
                    target_hash = self._sha256(target)
                    if target_hash == source_hash:
                        existing_same += 1
                        target_state = "existing_same_checksum"
                    else:
                        existing_conflicts += 1
                        target_state = "existing_different_checksum"
                        self.issue(
                            "blocker",
                            "target_file_conflict",
                            f"destino existente tem conteúdo diferente: {target}",
                        )

            self.file_manifest.append(
                {
                    "source": str(path),
                    "relative_source": str(relative),
                    "target": str(target),
                    "relative_target": str(mapped_relative),
                    "sha256": source_hash,
                    "size": path.stat().st_size,
                    "state": target_state,
                }
            )

        if unresolved_target_ids:
            self.issue(
                "info",
                "destination_checks_pending_user_ids",
                (
                    f"{unresolved_target_ids} arquivo(s) de Atom/Duda/Renata "
                    "serão comparados no Dry-run B após a criação das contas"
                ),
            )

        missing_references: list[dict[str, Any]] = []
        mapped_references = 0
        unsupported_references = 0
        for reference in self.storage_references:
            parsed = urlparse(reference["source_url"])
            decoded_path = unquote(parsed.path)
            if not decoded_path.startswith(PUBLIC_STORAGE_PREFIX):
                unsupported_references += 1
                self.issue(
                    "warning",
                    "unsupported_storage_url",
                    f"URL do host antigo fora do padrão público: {decoded_path}",
                    tenant=reference["tenant"],
                    table=reference["table"],
                    record_id=reference["record_id"],
                )
                continue
            relative = Path(decoded_path[len(PUBLIC_STORAGE_PREFIX) :])
            if relative.is_absolute() or ".." in relative.parts:
                self.issue(
                    "blocker",
                    "unsafe_storage_path",
                    f"caminho inseguro na URL: {decoded_path}",
                    tenant=reference["tenant"],
                    table=reference["table"],
                    record_id=reference["record_id"],
                )
                continue
            mapping = self._map_relative_media_path(relative)
            mapped_relative = mapping.relative_target
            if mapping.warning is not None:
                self.issue(
                    "warning",
                    "media_reference_preserved_without_owner_rewrite",
                    f"{relative}: {mapping.warning}; caminho preservado",
                    tenant=reference["tenant"],
                    table=reference["table"],
                    record_id=reference["record_id"],
                )
            expected_owner = TENANTS[reference["tenant"]]["source_user_id"]
            if (
                mapping.source_owner_id is not None
                and mapping.source_owner_id != expected_owner
            ):
                imported = self._is_imported(
                    reference["tenant"], reference["table"]
                )
                self.issue(
                    "blocker" if imported else "info",
                    "cross_tenant_storage_reference",
                    (
                        "URL aponta para UUID de outro tenant"
                        + (
                            ""
                            if imported
                            else "; tabela descartada, sem impacto na importação"
                        )
                    ),
                    tenant=reference["tenant"],
                    table=reference["table"],
                    record_id=reference["record_id"],
                )
            local_file = source_public_root / relative
            reference["local_file"] = str(local_file)
            reference["target_file"] = str(self.target_media_dir / mapped_relative)
            reference["target_url"] = f"{TARGET_STORAGE_URL}/{mapped_relative.as_posix()}"
            if not local_file.is_file():
                reference["planned_action"] = "remove_reference"
                missing_references.append(reference)
                self.issue(
                    "warning",
                    "referenced_file_missing",
                    (
                        f"arquivo referenciado ausente: {local_file}; "
                        "a referência será removida"
                    ),
                    tenant=reference["tenant"],
                    table=reference["table"],
                    record_id=reference["record_id"],
                )
            else:
                mapped_references += 1

        disk_check = self._disk_capacity(source_total_bytes)
        self.report["storage"] = {
            "source_root": str(source_public_root),
            "target_root": str(self.target_media_dir),
            "expected_files": self.expected_files,
            "files_found": len(files),
            "source_total_bytes": source_total_bytes,
            "unreadable_files": unreadable,
            "existing_same_checksum": existing_same,
            "existing_different_checksum": existing_conflicts,
            "files_pending_target_user_id": unresolved_target_ids,
            "destination_comparison_complete": unresolved_target_ids == 0,
            "proposed_directories": len(proposed_directories),
            "old_host_references": len(self.storage_references),
            "mapped_references": mapped_references,
            "missing_references": missing_references,
            "unsupported_references": unsupported_references,
            "disk": disk_check,
        }

    def _disk_capacity(self, required_bytes: int) -> dict[str, Any]:
        probe = self.target_media_dir
        while not probe.exists() and probe != probe.parent:
            probe = probe.parent
        usage = shutil.disk_usage(probe)
        enough = usage.free >= required_bytes
        if not enough:
            self.issue(
                "blocker",
                "insufficient_disk_space",
                f"livre={usage.free} bytes, necessário={required_bytes} bytes",
            )
        return {
            "probe_path": str(probe),
            "total_bytes": usage.total,
            "used_bytes": usage.used,
            "free_bytes": usage.free,
            "required_bytes": required_bytes,
            "enough": enough,
        }

    @staticmethod
    def _sql_uuid_list(values: Iterable[str]) -> str:
        valid = []
        for value in values:
            if not UUID_RE.match(value):
                raise ValueError(f"UUID inválido para consulta: {value}")
            valid.append(f"'{value}'::uuid")
        return ", ".join(valid) or "NULL::uuid"

    @staticmethod
    def _sql_text_list(values: Iterable[str]) -> str:
        return ", ".join("'" + value.replace("'", "''") + "'" for value in values)

    def _validate_missing_profile_fields(
        self, profile_columns: list[dict[str, str]]
    ) -> None:
        profile_nullability = {
            row["column_name"]: row["is_nullable"] == "YES"
            for row in profile_columns
        }
        self.report["database"]["profiles_column_nullability"] = profile_nullability
        for missing in self.missing_profile_fields:
            field = missing["field"]
            nullable = profile_nullability.get(field)
            if nullable is False:
                self.issue(
                    "blocker",
                    "missing_non_nullable_profile_field",
                    f"profiles.{field} está vazio e a coluna de destino é NOT NULL",
                    tenant=missing["tenant"],
                    table="profiles",
                    record_id=missing["record_id"],
                )
            else:
                self.issue(
                    "info",
                    "profile_field_will_remain_empty",
                    (
                        f"profiles.{field} será importado vazio"
                        if nullable is True
                        else (
                            f"profiles.{field} não existe no destino; "
                            "o valor vazio não será importado"
                        )
                    ),
                    tenant=missing["tenant"],
                    table="profiles",
                    record_id=missing["record_id"],
                )

    def inspect_database(self) -> None:
        if self.db is None:
            self.issue(
                "warning",
                "database_check_skipped",
                "AMZ_DATABASE_URL não configurada; colisões no destino não foram consultadas",
            )
            return
        if shutil.which("psql") is None:
            self.issue(
                "blocker",
                "psql_missing",
                "psql não está instalado; não é possível consultar o destino em modo read-only",
            )
            return

        profile_columns = self.db.query(
            """
            SELECT column_name, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'profiles'
            ORDER BY ordinal_position
            """
        )
        self._validate_missing_profile_fields(profile_columns)

        anchor_ids = [
            "11111111-1111-1111-1111-111111111111",
            "22f0c364-a782-48fa-8482-0ed3d7529a5f",
            TENANTS["atom"]["source_user_id"],
            TENANTS["marcelo"]["source_user_id"],
        ]
        emails = [cfg["email"].lower() for cfg in TENANTS.values()]
        users = self.db.query(
            """
            SELECT u.id::text, lower(u.email) AS email,
                   COALESCE(p.nome, '') AS nome,
                   COALESCE(p.tipo, '') AS tipo,
                   COALESCE(p.plano, '') AS plano,
                   COALESCE(p.whatsapp, '') AS whatsapp,
                   COALESCE(string_agg(ur.role::text, ',' ORDER BY ur.role::text), '') AS roles
            FROM auth.users u
            LEFT JOIN public.profiles p ON p.id = u.id
            LEFT JOIN public.user_roles ur ON ur.user_id = u.id
            WHERE u.id IN (%s)
               OR lower(u.email) IN (%s)
            GROUP BY u.id, u.email, p.nome, p.tipo, p.plano, p.whatsapp
            ORDER BY u.id
            """
            % (self._sql_uuid_list(anchor_ids), self._sql_text_list(emails))
        )
        self.report["database"]["users"] = users

        by_id = {row["id"]: row for row in users}
        by_email = {row["email"]: row for row in users}
        if "11111111-1111-1111-1111-111111111111" not in by_id:
            self.issue("blocker", "missing_test_owner_anchor", "conta 1111... não existe")
        if TENANTS["marcelo"]["target_user_id"] not in by_id:
            self.issue("blocker", "missing_marcelo_anchor", "conta 22f0... não existe")

        for tenant in ("atom", "duda", "renata"):
            email = TENANTS[tenant]["email"].lower()
            if email in by_email:
                self.issue(
                    "blocker",
                    "new_email_already_exists",
                    f"e-mail planejado já existe no destino: {email}",
                    tenant=tenant,
                )
        marcelo_email = TENANTS["marcelo"]["email"].lower()
        if marcelo_email in by_email and by_email[marcelo_email]["id"] != TENANTS["marcelo"]["target_user_id"]:
            self.issue(
                "blocker",
                "marcelo_email_collision",
                "e-mail real do Marcelo pertence a outro usuário",
                tenant="marcelo",
            )

        whatsapp = self.db.query(
            """
            SELECT id::text, user_id::text, COALESCE(phone_number_id, '') AS phone_number_id,
                   COALESCE(waba_id, '') AS waba_id,
                   COALESCE(display_phone, '') AS display_phone,
                   COALESCE(business_name, '') AS business_name,
                   COALESCE(is_active, false)::text AS is_active,
                   COALESCE(is_verified, false)::text AS is_verified,
                   COALESCE(connection_method, '') AS connection_method
            FROM public.whatsapp_config
            WHERE user_id IN (%s)
            ORDER BY user_id
            """
            % self._sql_uuid_list(anchor_ids)
        )
        self.report["database"]["whatsapp_config_metadata"] = whatsapp

        tables_for_occupancy = (
            "produtos",
            "midias_whatsapp",
            "autopilot_config",
            "whatsapp_config",
            "whatsapp_cloud_agent_config",
            "empresa_config",
            "cadastros",
            "historico_envios",
            "videos",
            "notificacoes_usuario",
        )
        occupancy: list[dict[str, str]] = []
        for table in tables_for_occupancy:
            rows = self.db.query(
                """
                SELECT %s AS table_name, user_id::text, count(*)::text AS row_count
                FROM public.%s
                WHERE user_id IN (%s)
                GROUP BY user_id
                ORDER BY user_id
                """
                % (
                    "'" + table + "'",
                    table,
                    self._sql_uuid_list(anchor_ids),
                )
            )
            occupancy.extend(rows)
        self.report["database"]["anchor_occupancy"] = occupancy
        for row in occupancy:
            if (
                row["user_id"] == TENANTS["marcelo"]["target_user_id"]
                and row["table_name"] not in MARCELO_IMPORT_TABLES
                and int(row["row_count"]) > 0
            ):
                self.issue(
                    "info",
                    "marcelo_destination_data_preserved",
                    (
                        f"{row['table_name']} já possui {row['row_count']} linha(s) "
                        "para Marcelo; destino será preservado e origem descartada"
                    ),
                    tenant="marcelo",
                    table=row["table_name"],
                )

        trigger_functions = self.db.query(
            """
            SELECT p.proname, pg_get_functiondef(p.oid) AS definition
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname IN (
                'sync_optin_to_cadastro',
                'sync_cadastro_to_whatsapp_contacts',
                'handle_new_user',
                'auto_assign_parceiro_role',
                'create_user_video_credits'
              )
            ORDER BY p.proname
            """
        )
        trigger_audit = []
        legacy_atom_id = TENANTS["atom"]["source_user_id"]
        for function in trigger_functions:
            definition = function.pop("definition", "")
            has_legacy_atom_id = legacy_atom_id in definition
            trigger_audit.append(
                {
                    "name": function["proname"],
                    "contains_legacy_atom_id": has_legacy_atom_id,
                }
            )
            if has_legacy_atom_id:
                self.issue(
                    "blocker",
                    "trigger_contains_legacy_atom_id",
                    (
                        f"função {function['proname']} ainda contém o UUID antigo "
                        "da AMZ"
                    ),
                )
        self.report["database"]["trigger_audit"] = trigger_audit

        opt_in_whatsapps = sorted(
            {
                str(row.get("whatsapp")).strip()
                for tenant_rows in self.records.values()
                for row in tenant_rows.get("opt_ins", [])
                if row.get("whatsapp")
            }
        )
        if opt_in_whatsapps:
            existing_opt_ins = self.db.query(
                """
                SELECT id::text
                FROM public.opt_ins
                WHERE whatsapp IN (%s)
                ORDER BY id
                """
                % self._sql_text_list(opt_in_whatsapps)
            )
            self.report["database"]["existing_opt_in_ids"] = [
                row["id"] for row in existing_opt_ins
            ]
            for row in existing_opt_ins:
                self.issue(
                    "blocker",
                    "destination_opt_in_unverified_collision",
                    "WhatsApp de opt_in já existe; conteúdo ainda não foi comparado",
                    table="opt_ins",
                    record_id=row["id"],
                )

        collisions: dict[str, list[str]] = {}
        for table in IMPORT_TABLES:
            if table == "profiles":
                # Profiles são tratados pelo plano explícito de contas:
                # Marcelo é merge; os outros três ainda não possuem UUID real.
                ids = []
            else:
                ids = sorted(self.ids_by_table.get(table, set()))
            if not ids:
                continue
            found: list[str] = []
            for start in range(0, len(ids), 200):
                batch = ids[start : start + 200]
                rows = self.db.query(
                    "SELECT id::text FROM public.%s WHERE id IN (%s) ORDER BY id"
                    % (table, self._sql_uuid_list(batch))
                )
                found.extend(row["id"] for row in rows)
            if found:
                collisions[table] = found
                for found_id in found:
                    self.issue(
                        "blocker",
                        "destination_id_unverified_collision",
                        "ID já existe no destino e o conteúdo ainda não foi comparado",
                        table=table,
                        record_id=found_id,
                    )
        self.report["database"]["id_collisions"] = collisions

    def finalize(self) -> dict[str, Any]:
        serialized = [issue.as_dict() for issue in self.issues]
        counts = Counter(issue.severity for issue in self.issues)
        self.report["issues"] = serialized
        self.report["summary"] = {
            "blockers": counts["blocker"],
            "warnings": counts["warning"],
            "info": counts["info"],
            "ready_for_account_phase": counts["blocker"] == 0,
            "records_read": sum(
                len(rows)
                for tenant_rows in self.records.values()
                for rows in tenant_rows.values()
            ),
            "records_planned_for_import": sum(
                len(rows)
                for tenant, tenant_rows in self.records.items()
                for table, rows in tenant_rows.items()
                if self._is_imported(tenant, table)
            ),
            "records_skipped": sum(
                len(rows)
                for tenant, tenant_rows in self.records.items()
                for table, rows in tenant_rows.items()
                if not self._is_imported(tenant, table)
            ),
        }
        return self.report

    def run(self) -> dict[str, Any]:
        self.load_exports()
        self.validate_references()
        self.inspect_storage()
        self.inspect_database()
        return self.finalize()


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Dry-run A, estritamente sem mutações, da migração Lovable -> VPS."
    )
    parser.add_argument(
        "--export-dir",
        type=Path,
        required=True,
        help="Pasta export_amz contendo atom/, duda/, marcelo/, renata/ e _arquivos/.",
    )
    parser.add_argument(
        "--media-dir",
        type=Path,
        help="Raiz _arquivos/. Padrão: <export-dir>/_arquivos.",
    )
    parser.add_argument(
        "--target-media-dir",
        type=Path,
        default=Path("/opt/amz-media"),
        help="Raiz real da mídia na VPS, usada somente para leitura/comparação.",
    )
    parser.add_argument(
        "--expected-files",
        type=int,
        default=5123,
        help="Quantidade esperada de arquivos baixados.",
    )
    parser.add_argument(
        "--database-url-env",
        default="AMZ_DATABASE_URL",
        help="Nome da variável que contém a conexão PostgreSQL. O valor nunca é exibido.",
    )
    parser.add_argument(
        "--require-db",
        action="store_true",
        help="Tratar a ausência da conexão read-only com o banco como bloqueador.",
    )
    parser.add_argument(
        "--report-json",
        type=Path,
        help="Arquivo opcional para o relatório resumido. Única escrita além do manifest.",
    )
    parser.add_argument(
        "--manifest-json",
        type=Path,
        help="Arquivo opcional para o manifesto SHA-256 dos arquivos.",
    )
    return parser.parse_args(argv)


def safe_write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2, sort_keys=True)
        handle.write("\n")
    temporary.replace(path)


def is_within(path: Path, directory: Path) -> bool:
    try:
        path.resolve().relative_to(directory.resolve())
    except ValueError:
        return False
    return True


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    export_dir = args.export_dir.resolve()
    media_dir = (args.media_dir or export_dir / "_arquivos").resolve()
    # Não resolver symlinks do destino: eles precisam ser detectados e
    # bloqueados, não transformados silenciosamente no caminho apontado.
    target_media_dir = args.target_media_dir.absolute()
    dsn = os.environ.get(args.database_url_env, "")
    db = PsqlReadOnly(dsn) if dsn else None
    output_paths = [
        path.resolve()
        for path in (args.report_json, args.manifest_json)
        if path is not None
    ]
    if len(set(output_paths)) != len(output_paths):
        print(
            json.dumps(
                {
                    "fatal": "report e manifest devem usar arquivos diferentes",
                    "read_only": True,
                },
                ensure_ascii=False,
            )
        )
        return 1
    for output_path in output_paths:
        if (
            is_within(output_path, export_dir)
            or is_within(output_path, target_media_dir)
            or is_within(output_path, REAL_TARGET_MEDIA_ROOT)
        ):
            print(
                json.dumps(
                    {
                        "fatal": (
                            "relatórios não podem ser gravados dentro da exportação "
                            "nem de /opt/amz-media"
                        ),
                        "read_only": True,
                    },
                    ensure_ascii=False,
                )
            )
            return 1

    dry_run = DryRun(
        export_dir=export_dir,
        media_dir=media_dir,
        target_media_dir=target_media_dir,
        expected_files=args.expected_files,
        db=db,
    )
    try:
        report = dry_run.run()
    except Exception as error:  # falha operacional, nunca imprime DSN
        message = str(error).replace(dsn, "[DSN REDACTED]") if dsn else str(error)
        print(json.dumps({"fatal": message, "read_only": True}, ensure_ascii=False))
        return 1

    if args.require_db and db is None:
        dry_run.issue(
            "blocker",
            "database_required",
            f"variável {args.database_url_env} não configurada",
        )
        report = dry_run.finalize()

    if args.report_json:
        safe_write_json(args.report_json, report)
    if args.manifest_json:
        safe_write_json(args.manifest_json, dry_run.file_manifest)

    summary = report["summary"]
    print(
        json.dumps(
            {
                "mode": "dry-run-a",
                "read_only": True,
                "blockers": summary["blockers"],
                "warnings": summary["warnings"],
                "records_read": summary["records_read"],
                "records_planned_for_import": summary["records_planned_for_import"],
                "records_skipped": summary["records_skipped"],
                "storage_files": report.get("storage", {}).get("files_found", 0),
                "report_json": str(args.report_json) if args.report_json else None,
                "manifest_json": str(args.manifest_json) if args.manifest_json else None,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 2 if summary["blockers"] else 0


if __name__ == "__main__":
    raise SystemExit(main())

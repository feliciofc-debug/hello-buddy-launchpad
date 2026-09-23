#!/usr/bin/env python3
"""Importação transacional por tenant da exportação Lovable para a VPS AMZ."""

from __future__ import annotations

import argparse
import csv
import fcntl
import hashlib
import io
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import uuid
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.importador_amz.dry_run import (
    MARCELO_IMPORT_TABLES,
    PUBLIC_STORAGE_PREFIX,
    SOURCE_HOST,
    SOURCE_ONLY_COLUMNS,
    SKIPPED_TABLES,
    TARGET_STORAGE_URL,
)


IMPORT_ORDER = (
    "profiles",
    "empresa_config",
    "produtos",
    "midias_whatsapp",
    "whatsapp_cloud_agent_config",
    "opt_ins",
    "cadastros",
    "biblioteca_campanhas",
    "autopilot_config",
    "historico_envios",
    "videos",
    "notificacoes_usuario",
)
ROLLBACK_ORDER = tuple(reversed(IMPORT_ORDER))
REAL_TARGET_MEDIA_ROOT = Path("/opt/amz-media")
AUDIT_SCHEMA = "amz_migration"
def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_records(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if isinstance(payload, list):
        records = payload
    elif isinstance(payload, dict) and isinstance(payload.get("data"), list):
        records = payload["data"]
    elif payload == {}:
        records = []
    else:
        raise ValueError(f"{path}: JSON deve ser lista ou objeto com chave data")
    if not all(isinstance(record, dict) for record in records):
        raise ValueError(f"{path}: todos os registros devem ser objetos")
    return records


def csv_field(value: Any) -> str:
    if value is None:
        return ""
    return '"' + str(value).replace('"', '""') + '"'


def csv_row(values: list[Any]) -> str:
    return ",".join(csv_field(value) for value in values)


def sql_identifier(value: str) -> str:
    if not value.replace("_", "").isalnum() or not value[0].isalpha():
        raise ValueError(f"identificador SQL inseguro: {value!r}")
    return '"' + value + '"'


class Psql:
    def __init__(self, password: str):
        if not password:
            raise ValueError("PGPW não configurada")
        self.password = password
        self.base_args = [
            "docker",
            "exec",
            "-e",
            "PGPASSWORD",
            "-i",
            "amz-postgres",
            "psql",
            "-h",
            "127.0.0.1",
            "-X",
            "-q",
            "-A",
            "-t",
            "-v",
            "ON_ERROR_STOP=1",
            "-U",
            "supabase_admin",
            "-d",
            "amz",
        ]

    def run(self, sql: str) -> str:
        env = os.environ.copy()
        env["PGPASSWORD"] = self.password
        completed = subprocess.run(
            self.base_args,
            input=sql,
            text=True,
            capture_output=True,
            env=env,
            check=False,
        )
        if completed.returncode != 0:
            detail = (completed.stderr or completed.stdout).replace(
                self.password, "[REDACTED]"
            )
            raise RuntimeError(f"psql falhou: {detail.strip()}")
        return completed.stdout.strip()

    def query(self, select_sql: str) -> list[dict[str, str]]:
        normalized = select_sql.strip().rstrip(";")
        output = self.run(
            f"COPY ({normalized}) TO STDOUT WITH (FORMAT CSV, HEADER TRUE);\n"
        )
        return list(csv.DictReader(io.StringIO(output)))


def is_sensitive_key(key: str) -> bool:
    normalized = key.lower()
    return (
        normalized
        in {
            "access_token",
            "refresh_token",
            "lomadee_app_token",
            "authorization",
            "service_role",
            "service_role_key",
            "jwt_secret",
        }
        or normalized.endswith(("_token", "_secret", "_password", "_key"))
        or "password" in normalized
    )


class Importer:
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.tenant = args.tenant
        self.export_dir = args.export_dir.resolve()
        self.media_dir = args.media_dir.resolve()
        self.target_media_dir = args.target_media_dir.absolute()
        self.run_id = str(uuid.uuid4())
        self.psql = Psql(os.environ.get("PGPW", ""))
        self.dry_report = self._read_json(args.dry_run_report)
        self.manifest = self._read_json(args.manifest_json)
        self.account_plan = self.dry_report.get("account_plan", {})
        self.tenant_plan = self.account_plan.get(self.tenant, {})
        self.source_user_id = self.tenant_plan.get("source_user_id", "")
        self.target_user_id = self.tenant_plan.get("target_user_id", "")
        self.old_to_target = {
            cfg["source_user_id"]: cfg["target_user_id"]
            for cfg in self.account_plan.values()
        }
        self.source_public_root = self._find_source_public_root()
        self.referenced_paths: set[str] = set()
        self.missing_references = 0
        self.records: dict[str, list[dict[str, Any]]] = {}
        self.skipped: dict[str, int] = {}
        self.media_journal: list[dict[str, Any]] = []
        self.created_files: list[Path] = []
        self.mode_changes: list[tuple[Path, int]] = []
        self.created_dirs: list[Path] = []

    @staticmethod
    def _read_json(path: Path) -> Any:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

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
                candidate.name == "public" or candidate == candidates[0]
            ):
                return candidate
        return candidates[0]

    def validate_inputs(self) -> None:
        summary = self.dry_report.get("summary", {})
        metadata = self.dry_report.get("metadata", {})
        if metadata.get("mode") != "dry-run-b":
            raise ValueError("o relatório informado não é do Dry-run B")
        if summary.get("blockers") != 0:
            raise ValueError("o Dry-run B contém blockers")
        if not summary.get("ready_for_account_phase"):
            raise ValueError("o Dry-run B não marcou a fase como pronta")
        if not self.dry_report.get("database", {}).get("enabled"):
            raise ValueError("o Dry-run B não incluiu validação do banco")
        if not self.dry_report.get("storage", {}).get(
            "destination_comparison_complete"
        ):
            raise ValueError("o Dry-run B não comparou todos os destinos de mídia")
        if self.tenant not in {"atom", "duda", "renata", "marcelo"}:
            raise ValueError("tenant inválido")
        try:
            uuid.UUID(self.source_user_id)
            uuid.UUID(self.target_user_id)
        except (ValueError, TypeError) as error:
            raise ValueError("mapa de UUIDs do Dry-run B é inválido") from error
        if not isinstance(self.manifest, list) or not self.manifest:
            raise ValueError("manifesto SHA-256 vazio ou inválido")
        expected_files = self.dry_report.get("storage", {}).get("files_found")
        if expected_files != len(self.manifest):
            raise ValueError(
                "manifesto não corresponde à quantidade do Dry-run B"
            )
        if not self.source_public_root.is_dir():
            raise ValueError(
                f"raiz de mídia não encontrada: {self.source_public_root}"
            )
        if not self.target_media_dir.is_dir():
            raise ValueError(
                f"destino de mídia não encontrado: {self.target_media_dir}"
            )
        if self.target_media_dir.resolve() != REAL_TARGET_MEDIA_ROOT:
            raise ValueError("o importador real exige --target-media-dir /opt/amz-media")
        report_path = self.args.report_json.resolve()
        for protected in (self.export_dir, self.target_media_dir):
            try:
                report_path.relative_to(protected.resolve())
            except ValueError:
                continue
            raise ValueError("relatório não pode ficar na exportação nem nas mídias")
        self.args.report_json.parent.mkdir(parents=True, exist_ok=True)
        probe_fd, probe_name = tempfile.mkstemp(
            prefix=".amz-import-report-", dir=self.args.report_json.parent
        )
        os.close(probe_fd)
        Path(probe_name).unlink()

        users = self.psql.query(
            """
            SELECT u.id::text, lower(u.email) AS email,
                   COALESCE(string_agg(r.role::text, ',' ORDER BY r.role::text), '') AS roles
            FROM auth.users u
            LEFT JOIN public.user_roles r ON r.user_id = u.id
            WHERE u.id = '%s'::uuid
            GROUP BY u.id, u.email
            """
            % self.target_user_id
        )
        expected_email = self.tenant_plan["email"].lower()
        expected_role = self.tenant_plan["role"]
        if len(users) != 1 or users[0]["email"] != expected_email:
            raise ValueError("conta canônica não corresponde ao Dry-run B")
        if expected_role not in users[0]["roles"].split(","):
            raise ValueError("papel da conta canônica não corresponde ao Dry-run B")

    def is_imported_table(self, table: str) -> bool:
        if table in SKIPPED_TABLES:
            return False
        if self.tenant == "marcelo" and table not in MARCELO_IMPORT_TABLES:
            return False
        return table in IMPORT_ORDER

    def map_relative_path(self, relative: Path) -> Path:
        parts = list(relative.parts)
        known = [
            (index, part)
            for index, part in enumerate(parts)
            if part in self.old_to_target
        ]
        if len(known) == 1:
            index, owner = known[0]
            parts[index] = self.old_to_target[owner]
        return Path(*parts)

    def transform_url(self, value: str) -> str | None:
        parsed = urlparse(value)
        if parsed.hostname != SOURCE_HOST:
            return value
        decoded_path = unquote(parsed.path)
        if not decoded_path.startswith(PUBLIC_STORAGE_PREFIX):
            return value
        relative = Path(decoded_path[len(PUBLIC_STORAGE_PREFIX) :])
        if relative.is_absolute() or ".." in relative.parts:
            raise ValueError(f"URL de storage insegura: {decoded_path}")
        source = self.source_public_root / relative
        if not source.is_file():
            self.missing_references += 1
            return None
        self.referenced_paths.add(relative.as_posix())
        mapped = self.map_relative_path(relative)
        return f"{TARGET_STORAGE_URL}/{mapped.as_posix()}"

    def transform_value(self, value: Any, key: str = "") -> Any:
        if isinstance(value, dict):
            return {
                nested_key: (
                    nested
                    if is_sensitive_key(nested_key)
                    else self.transform_value(nested, nested_key)
                )
                for nested_key, nested in value.items()
            }
        if isinstance(value, list):
            return [self.transform_value(item, key) for item in value]
        if isinstance(value, str):
            if value == self.source_user_id:
                return self.target_user_id
            if value.lower().startswith(("http://", "https://")):
                return self.transform_url(value)
        return value

    def transform_record(self, table: str, source: dict[str, Any]) -> dict[str, Any]:
        record = self.transform_value(source)
        for column in SOURCE_ONLY_COLUMNS.get(table, set()):
            record.pop(column, None)
        if table == "profiles":
            record["id"] = self.target_user_id
        if "user_id" in record:
            record["user_id"] = self.target_user_id
        if "cliente_id" in record:
            record["cliente_id"] = None
        if "campanha_id" in record:
            record["campanha_id"] = None
        if table in {"biblioteca_campanhas", "notificacoes_usuario"}:
            product_id = record.get("produto_id")
            product_ids = {
                str(row.get("id"))
                for row in self.records.get("produtos", [])
                if row.get("id")
            }
            if product_id and str(product_id) not in product_ids:
                record["produto_id"] = None
        if table == "cadastros":
            opt_in_id = record.get("opt_in_id")
            opt_in_ids = {
                str(row.get("id"))
                for row in self.records.get("opt_ins", [])
                if row.get("id")
            }
            if opt_in_id and str(opt_in_id) not in opt_in_ids:
                record["opt_in_id"] = None
        if table == "autopilot_config":
            record["ativo"] = False
            record["proxima_execucao"] = None
        if table == "midias_whatsapp":
            duration = record.get("duracao_segundos")
            if isinstance(duration, float):
                record["duracao_segundos"] = round(duration)
        return record

    def load_and_transform_records(self) -> None:
        tenant_dir = self.export_dir / self.tenant
        source_records: dict[str, list[dict[str, Any]]] = {}
        for table in self.dry_report.get("tables", {}):
            path = tenant_dir / f"{table}.json"
            if path.exists():
                source_records[table] = read_records(path)
            else:
                source_records[table] = []
            expected = (
                self.dry_report.get("tables", {})
                .get(table, {})
                .get("tenants", {})
                .get(self.tenant, {})
                .get("found")
            )
            if expected is not None and len(source_records[table]) != expected:
                raise ValueError(
                    f"{table}: exportação mudou após o Dry-run B "
                    f"(esperado={expected}, atual={len(source_records[table])})"
                )

        # Referências são resolvidas contra os IDs de origem antes das transformações.
        self.records["produtos"] = source_records.get("produtos", [])
        self.records["opt_ins"] = source_records.get("opt_ins", [])
        transformed: dict[str, list[dict[str, Any]]] = {}
        for table in IMPORT_ORDER:
            rows = source_records.get(table, [])
            if not self.is_imported_table(table):
                if rows:
                    self.skipped[table] = len(rows)
                continue
            transformed[table] = [
                self.transform_record(table, record) for record in rows
            ]
        for table, rows in source_records.items():
            if table not in IMPORT_ORDER and rows:
                self.skipped[table] = len(rows)
        self.records = transformed

    def schema_columns(self) -> dict[str, list[str]]:
        table_list = ", ".join(
            "'" + table.replace("'", "''") + "'" for table in IMPORT_ORDER
        )
        rows = self.psql.query(
            f"""
            SELECT table_name, column_name, ordinal_position::text
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name IN ({table_list})
              AND is_generated = 'NEVER'
              AND is_identity = 'NO'
            ORDER BY table_name, ordinal_position
            """
        )
        result: dict[str, list[str]] = {}
        for row in rows:
            result.setdefault(row["table_name"], []).append(row["column_name"])
        return result

    def filtered_records(
        self, schema: dict[str, list[str]]
    ) -> tuple[dict[str, list[dict[str, Any]]], dict[str, list[str]]]:
        filtered: dict[str, list[dict[str, Any]]] = {}
        columns: dict[str, list[str]] = {}
        for table, rows in self.records.items():
            if not rows:
                continue
            destination = schema.get(table)
            if not destination:
                raise ValueError(f"tabela de destino ausente: public.{table}")
            used = [
                column
                for column in destination
                if any(column in row for row in rows)
            ]
            if "id" not in used:
                raise ValueError(f"{table}: coluna id ausente dos registros")
            shapes = {
                tuple(column for column in used if column in row) for row in rows
            }
            if len(shapes) != 1:
                raise ValueError(
                    f"{table}: registros têm conjuntos de colunas diferentes; "
                    "importação recusada para não converter ausência em NULL"
                )
            columns[table] = used
            filtered[table] = [
                {key: row.get(key) for key in used if key in row} for row in rows
            ]
        return filtered, columns

    def selected_media(self) -> list[dict[str, Any]]:
        selected = []
        seen_targets: set[str] = set()
        for entry in self.manifest:
            relative_source = Path(entry["relative_source"])
            relative_target = Path(entry["relative_target"])
            if (
                relative_source.is_absolute()
                or relative_target.is_absolute()
                or ".." in relative_source.parts
                or ".." in relative_target.parts
            ):
                raise ValueError("manifesto contém caminho inseguro")
            owned = self.source_user_id in relative_source.parts
            referenced = relative_source.as_posix() in self.referenced_paths
            if not (owned or referenced):
                continue
            expected_source = self.source_public_root / relative_source
            if Path(entry["source"]).absolute() != expected_source.absolute():
                raise ValueError(
                    f"manifesto aponta origem inesperada: {relative_source}"
                )
            expected_target = self.map_relative_path(relative_source)
            if relative_target != expected_target:
                raise ValueError(
                    f"manifesto diverge do mapa de UUID: {relative_source}"
                )
            target_key = relative_target.as_posix()
            if target_key in seen_targets:
                continue
            seen_targets.add(target_key)
            selected.append(entry)
        return selected

    def _ensure_safe_parent(self, target: Path) -> None:
        relative = target.relative_to(self.target_media_dir)
        current = self.target_media_dir
        for part in relative.parts[:-1]:
            current = current / part
            if os.path.lexists(current):
                if current.is_symlink() or not current.is_dir():
                    raise ValueError(f"componente inseguro no destino: {current}")
            else:
                current.mkdir(mode=0o755)
                self.created_dirs.append(current)
            mode = stat.S_IMODE(current.stat().st_mode)
            if mode & 0o005 != 0o005:
                self.mode_changes.append((current, mode))
                os.chmod(current, mode | 0o005)

    def copy_media(self, entries: list[dict[str, Any]]) -> dict[str, int]:
        counts = Counter()
        for entry in entries:
            source = Path(entry["source"])
            if source.is_symlink() or not source.is_file():
                raise ValueError(f"origem não é arquivo regular: {source}")
            source_hash = sha256_file(source)
            if source_hash != entry["sha256"]:
                raise ValueError(f"checksum de origem mudou: {source}")
            target = self.target_media_dir / entry["relative_target"]
            self._ensure_safe_parent(target)
            if os.path.lexists(target):
                if target.is_symlink() or not target.is_file():
                    raise ValueError(f"destino não é arquivo regular: {target}")
                if sha256_file(target) != source_hash:
                    raise ValueError(f"destino divergente: {target}")
                old_mode = stat.S_IMODE(target.stat().st_mode)
                if old_mode & 0o004 == 0:
                    os.chmod(target, old_mode | 0o004)
                    self.mode_changes.append((target, old_mode))
                    action = "permission_updated"
                    previous_mode = old_mode
                else:
                    action = "existing"
                    previous_mode = None
                counts[action] += 1
            else:
                temporary = target.with_name(f".{target.name}.{self.run_id}.tmp")
                shutil.copyfile(source, temporary)
                os.chmod(temporary, 0o644)
                if sha256_file(temporary) != source_hash:
                    temporary.unlink(missing_ok=True)
                    raise ValueError(f"checksum da cópia divergiu: {source}")
                os.replace(temporary, target)
                self.created_files.append(target)
                action = "created"
                previous_mode = None
                counts[action] += 1
            self.media_journal.append(
                {
                    "relative_path": entry["relative_target"],
                    "sha256": source_hash,
                    "action": action,
                    "previous_mode": previous_mode,
                }
            )
        return dict(counts)

    def cleanup_media(self) -> None:
        for target in reversed(self.created_files):
            try:
                if target.is_file():
                    target.unlink()
            except OSError:
                pass
        for target, old_mode in reversed(self.mode_changes):
            try:
                if target.exists() and not target.is_symlink():
                    os.chmod(target, old_mode)
            except OSError:
                pass
        for directory in reversed(self.created_dirs):
            try:
                directory.rmdir()
            except OSError:
                pass

    def build_import_sql(
        self,
        records: dict[str, list[dict[str, Any]]],
        columns: dict[str, list[str]],
    ) -> str:
        payload_lines = []
        for table in IMPORT_ORDER:
            for record in records.get(table, []):
                payload_lines.append(
                    csv_row(
                        [
                            table,
                            json.dumps(
                                record,
                                ensure_ascii=False,
                                separators=(",", ":"),
                            ),
                        ]
                    )
                )
        file_lines = [
            csv_row(
                [
                    item["relative_path"],
                    item["sha256"],
                    item["action"],
                    item["previous_mode"],
                ]
            )
            for item in self.media_journal
        ]
        statements = [
            "BEGIN;",
            "SET LOCAL lock_timeout = '10s';",
            "SET LOCAL statement_timeout = '30min';",
            f"SELECT pg_advisory_xact_lock(hashtext('amz-import:{self.tenant}'));",
            f"CREATE SCHEMA IF NOT EXISTS {AUDIT_SCHEMA} AUTHORIZATION supabase_admin;",
            f"""
CREATE TABLE IF NOT EXISTS {AUDIT_SCHEMA}.runs (
  id uuid PRIMARY KEY,
  tenant text NOT NULL,
  target_user_id uuid NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  report jsonb
);""",
            f"""
CREATE TABLE IF NOT EXISTS {AUDIT_SCHEMA}.row_changes (
  run_id uuid NOT NULL REFERENCES {AUDIT_SCHEMA}.runs(id) ON DELETE CASCADE,
  sequence bigint GENERATED ALWAYS AS IDENTITY,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('insert', 'update')),
  before_row jsonb,
  after_row jsonb,
  PRIMARY KEY (run_id, table_name, record_id)
);""",
            f"""
CREATE TABLE IF NOT EXISTS {AUDIT_SCHEMA}.files (
  run_id uuid NOT NULL REFERENCES {AUDIT_SCHEMA}.runs(id) ON DELETE CASCADE,
  relative_path text NOT NULL,
  sha256 text NOT NULL,
  action text NOT NULL,
  previous_mode integer,
  PRIMARY KEY (run_id, relative_path)
);""",
            f"""
ALTER TABLE {AUDIT_SCHEMA}.files
  ADD COLUMN IF NOT EXISTS previous_mode integer;""",
            f"""
DO $pending_rollback$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM {AUDIT_SCHEMA}.runs
    WHERE tenant = '{self.tenant}'
      AND status = 'rollback_files_pending'
  ) THEN
    RAISE EXCEPTION
      'tenant possui rollback de arquivos pendente; importação recusada';
  END IF;
END;
$pending_rollback$;""",
            f"""
INSERT INTO {AUDIT_SCHEMA}.runs (id, tenant, target_user_id, status)
VALUES ('{self.run_id}'::uuid, '{self.tenant}', '{self.target_user_id}'::uuid, 'running');""",
            """
CREATE TEMP TABLE import_payload (
  table_name text NOT NULL,
  payload jsonb NOT NULL
) ON COMMIT DROP;
COPY import_payload (table_name, payload) FROM STDIN WITH (FORMAT csv);
"""
            + "\n".join(payload_lines)
            + "\n\\.",
            """
CREATE TEMP TABLE import_files (
  relative_path text NOT NULL,
  sha256 text NOT NULL,
  action text NOT NULL
  ,previous_mode integer
) ON COMMIT DROP;
COPY import_files (relative_path, sha256, action, previous_mode)
FROM STDIN WITH (FORMAT csv);
"""
            + "\n".join(file_lines)
            + "\n\\.",
            f"""
INSERT INTO {AUDIT_SCHEMA}.files (
  run_id, relative_path, sha256, action, previous_mode
)
SELECT '{self.run_id}'::uuid,
       relative_path, sha256, action, previous_mode
FROM import_files;""",
        ]

        for table in IMPORT_ORDER:
            table_records = records.get(table, [])
            if not table_records:
                continue
            quoted_table = sql_identifier(table)
            quoted_columns = [sql_identifier(column) for column in columns[table]]
            column_list = ", ".join(quoted_columns)
            select_list = ", ".join(
                f"(typed.record).{column}" for column in quoted_columns
            )
            update_columns = [
                column
                for column in quoted_columns
                if column
                not in {'"id"', '"created_at"', '"updated_at"'}
            ]
            compare_columns = update_columns or ['"id"']
            update_set = ", ".join(
                f"{column} = EXCLUDED.{column}" for column in update_columns
            )
            target_row = ", ".join(
                f"target.{column}" for column in compare_columns
            )
            incoming_row = ", ".join(
                f"incoming.{column}" for column in compare_columns
            )
            excluded_row = ", ".join(
                f"EXCLUDED.{column}" for column in compare_columns
            )
            statements.append(
                f"""
{"ALTER TABLE public." + quoted_table + " DISABLE TRIGGER USER;" if table in {"opt_ins", "cadastros"} else ""}
CREATE TEMP TABLE incoming_{table} ON COMMIT DROP AS
SELECT {select_list}
FROM (
  SELECT jsonb_populate_record(
    NULL::public.{quoted_table},
    payload
  ) AS record
  FROM import_payload
  WHERE table_name = '{table}'
) typed;

INSERT INTO {AUDIT_SCHEMA}.row_changes (
  run_id, table_name, record_id, action, before_row
)
SELECT
  '{self.run_id}'::uuid,
  '{table}',
  incoming.id,
  CASE WHEN target.id IS NULL THEN 'insert' ELSE 'update' END,
  CASE WHEN target.id IS NULL THEN NULL ELSE to_jsonb(target) END
FROM incoming_{table} incoming
LEFT JOIN public.{quoted_table} target ON target.id = incoming.id
WHERE target.id IS NULL
   OR ROW({target_row}) IS DISTINCT FROM ROW({incoming_row});

INSERT INTO public.{quoted_table} AS target ({column_list})
SELECT {column_list}
FROM incoming_{table}
ON CONFLICT (id) DO UPDATE
SET {update_set}
WHERE ROW({target_row}) IS DISTINCT FROM ROW({excluded_row});

UPDATE {AUDIT_SCHEMA}.row_changes changes
SET after_row = to_jsonb(target)
FROM public.{quoted_table} target
WHERE changes.run_id = '{self.run_id}'::uuid
  AND changes.table_name = '{table}'
  AND target.id = changes.record_id;
{"ALTER TABLE public." + quoted_table + " ENABLE TRIGGER USER;" if table in {"opt_ins", "cadastros"} else ""}"""
            )

        skipped_total = sum(self.skipped.values())
        skipped_json = json.dumps(self.skipped, separators=(",", ":")).replace(
            "'", "''"
        )
        statements.extend(
            [
                f"""
DO $validate$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM {AUDIT_SCHEMA}.row_changes
    WHERE run_id = '{self.run_id}'::uuid
      AND after_row IS NULL
  ) THEN
    RAISE EXCEPTION 'snapshot final ausente; importação revertida';
  END IF;
END;
$validate$;""",
                f"""
WITH table_counts AS (
  SELECT
    payload.table_name,
    count(*)::integer AS total,
    count(*) FILTER (WHERE changes.action = 'insert')::integer AS inserted,
    count(*) FILTER (WHERE changes.action = 'update')::integer AS updated
  FROM import_payload payload
  LEFT JOIN {AUDIT_SCHEMA}.row_changes changes
    ON changes.run_id = '{self.run_id}'::uuid
   AND changes.table_name = payload.table_name
   AND changes.record_id = (payload.payload->>'id')::uuid
  GROUP BY payload.table_name
),
summary AS (
  SELECT jsonb_build_object(
    'run_id', '{self.run_id}',
    'tenant', '{self.tenant}',
    'target_user_id', '{self.target_user_id}',
    'tables', COALESCE(
      jsonb_object_agg(
        table_name,
        jsonb_build_object(
          'total', total,
          'inserted', inserted,
          'updated', updated,
          'unchanged', total - inserted - updated
        )
      ),
      '{{}}'::jsonb
    ),
    'skipped_tables', '{skipped_json}'::jsonb,
    'records', jsonb_build_object(
      'inserted', COALESCE(sum(inserted), 0),
      'updated', COALESCE(sum(updated), 0),
      'unchanged', COALESCE(sum(total - inserted - updated), 0),
      'skipped', {skipped_total},
      'ignored', COALESCE(sum(total - inserted - updated), 0) + {skipped_total}
    ),
    'missing_references_removed', {self.missing_references},
    'files', jsonb_build_object(
      'total', (SELECT count(*) FROM import_files),
      'created', (SELECT count(*) FROM import_files WHERE action = 'created'),
      'existing', (SELECT count(*) FROM import_files WHERE action = 'existing'),
      'permission_updated', (
        SELECT count(*) FROM import_files WHERE action = 'permission_updated'
      )
    )
  ) AS report
  FROM table_counts
)
UPDATE {AUDIT_SCHEMA}.runs runs
SET status = 'committed',
    finished_at = now(),
    report = summary.report
FROM summary
WHERE runs.id = '{self.run_id}'::uuid;""",
                f"""
COPY (
  SELECT report::text
  FROM {AUDIT_SCHEMA}.runs
  WHERE id = '{self.run_id}'::uuid
) TO STDOUT;""",
                "COMMIT;",
            ]
        )
        return "\n".join(statements) + "\n"

    def write_report(self, report: dict[str, Any]) -> None:
        self.args.report_json.parent.mkdir(parents=True, exist_ok=True)
        fd, temporary_name = tempfile.mkstemp(
            prefix=self.args.report_json.name + ".",
            dir=self.args.report_json.parent,
        )
        try:
            os.fchmod(fd, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(report, handle, ensure_ascii=False, indent=2, sort_keys=True)
                handle.write("\n")
            os.replace(temporary_name, self.args.report_json)
        except Exception:
            Path(temporary_name).unlink(missing_ok=True)
            raise

    def run(self) -> dict[str, Any]:
        self.validate_inputs()
        self.load_and_transform_records()
        schema = self.schema_columns()
        filtered, columns = self.filtered_records(schema)
        media_entries = self.selected_media()
        try:
            media_counts = self.copy_media(media_entries)
            output = self.psql.run(self.build_import_sql(filtered, columns))
        except BaseException:
            self.cleanup_media()
            raise
        try:
            report = json.loads(output)
        except json.JSONDecodeError:
            recovered = self.psql.query(
                f"""
                SELECT report::text
                FROM {AUDIT_SCHEMA}.runs
                WHERE id = '{self.run_id}'::uuid
                  AND status = 'committed'
                """
            )
            if len(recovered) != 1:
                raise RuntimeError(
                    f"importação confirmou, mas relatório {self.run_id} não foi recuperado"
                )
            report = json.loads(recovered[0]["report"])
        report["filesystem"] = media_counts
        report["report_json"] = str(self.args.report_json)
        report["report_saved"] = True
        try:
            self.write_report(report)
        except OSError as error:
            report["report_saved"] = False
            report["report_write_error"] = str(error)
        return report


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Importação real, transacional e idempotente por tenant."
    )
    parser.add_argument(
        "--tenant",
        required=True,
        choices=("duda", "renata", "atom", "marcelo"),
    )
    parser.add_argument("--export-dir", type=Path, required=True)
    parser.add_argument("--media-dir", type=Path)
    parser.add_argument(
        "--target-media-dir",
        type=Path,
        default=REAL_TARGET_MEDIA_ROOT,
    )
    parser.add_argument("--dry-run-report", type=Path, required=True)
    parser.add_argument("--manifest-json", type=Path, required=True)
    parser.add_argument("--report-json", type=Path, required=True)
    args = parser.parse_args(argv)
    args.media_dir = args.media_dir or args.export_dir / "_arquivos"
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    lock_path = args.target_media_dir / ".amz-import.lock"
    try:
        lock_path.parent.mkdir(parents=True, exist_ok=True)
        with lock_path.open("w", encoding="utf-8") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            report = Importer(args).run()
        print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
        return 0
    except BlockingIOError:
        print(json.dumps({"fatal": "outra importação está em andamento"}))
        return 1
    except Exception as error:
        password = os.environ.get("PGPW", "")
        message = str(error).replace(password, "[REDACTED]") if password else str(error)
        print(json.dumps({"fatal": message}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Rollback verificado de uma execução concluída do importador AMZ."""

from __future__ import annotations

import argparse
import fcntl
import json
import os
import shutil
import stat
import sys
import tempfile
import uuid
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.importador_amz.import_data import (
    AUDIT_SCHEMA,
    IMPORT_ORDER,
    Psql,
    REAL_TARGET_MEDIA_ROOT,
    ROLLBACK_ORDER,
    csv_row,
    sha256_file,
    sql_identifier,
)


class Rollback:
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.run_id = str(uuid.UUID(args.run_id))
        self.target_media_dir = args.target_media_dir.absolute()
        self.psql = Psql(os.environ.get("PGPW", ""))

    def load_run(self) -> dict[str, str]:
        rows = self.psql.query(
            f"""
            SELECT id::text, tenant, target_user_id::text, status,
                   started_at::text, COALESCE(finished_at::text, '') AS finished_at
            FROM {AUDIT_SCHEMA}.runs
            WHERE id = '{self.run_id}'::uuid
            """
        )
        if len(rows) != 1:
            raise ValueError("execução de importação não encontrada")
        run = rows[0]
        if run["status"] not in {"committed", "rollback_files_pending"}:
            raise ValueError(f"execução não pode ser revertida: status={run['status']}")
        later = self.psql.query(
            f"""
            SELECT id::text
            FROM {AUDIT_SCHEMA}.runs
            WHERE tenant = '{run['tenant']}'
              AND status = 'committed'
              AND started_at > '{run['started_at']}'::timestamptz
            LIMIT 1
            """
        )
        if later:
            raise ValueError(
                "há importação posterior para o tenant; reverta-a primeiro"
            )
        return run

    def load_changes(self) -> list[dict[str, Any]]:
        rows = self.psql.query(
            f"""
            SELECT sequence::text, table_name, record_id::text, action,
                   COALESCE(before_row::text, '') AS before_row,
                   after_row::text
            FROM {AUDIT_SCHEMA}.row_changes
            WHERE run_id = '{self.run_id}'::uuid
            ORDER BY sequence DESC
            """
        )
        return [
            {
                **row,
                "before_row": (
                    json.loads(row["before_row"]) if row["before_row"] else None
                ),
                "after_row": json.loads(row["after_row"]),
            }
            for row in rows
        ]

    def load_files(self) -> list[dict[str, str]]:
        return self.psql.query(
            f"""
            SELECT relative_path, sha256, action,
                   COALESCE(previous_mode::text, '') AS previous_mode
            FROM {AUDIT_SCHEMA}.files
            WHERE run_id = '{self.run_id}'::uuid
            ORDER BY relative_path
            """
        )

    def schema_columns(self, tables: set[str]) -> dict[str, list[str]]:
        if not tables:
            return {}
        allowed = set(IMPORT_ORDER)
        if not tables <= allowed:
            raise ValueError("diário contém tabela fora da allowlist")
        table_list = ", ".join(f"'{table}'" for table in sorted(tables))
        rows = self.psql.query(
            f"""
            SELECT table_name, column_name
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

    def build_sql(
        self,
        run: dict[str, str],
        changes: list[dict[str, Any]],
        schema: dict[str, list[str]],
    ) -> str:
        payload = "\n".join(
            csv_row(
                [
                    row["sequence"],
                    row["table_name"],
                    row["record_id"],
                    row["action"],
                    (
                        json.dumps(
                            row["before_row"],
                            ensure_ascii=False,
                            separators=(",", ":"),
                        )
                        if row["before_row"] is not None
                        else None
                    ),
                    json.dumps(
                        row["after_row"],
                        ensure_ascii=False,
                        separators=(",", ":"),
                    ),
                ]
            )
            for row in changes
        )
        statements = [
            "BEGIN ISOLATION LEVEL SERIALIZABLE;",
            "SET LOCAL lock_timeout = '10s';",
            "SET LOCAL statement_timeout = '30min';",
            "SET LOCAL idle_in_transaction_session_timeout = '60s';",
            f"SELECT pg_advisory_xact_lock(hashtext('amz-import:{run['tenant']}'));",
            f"""
DO $later_run$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM {AUDIT_SCHEMA}.runs
    WHERE tenant = '{run['tenant']}'
      AND status = 'committed'
      AND started_at > '{run['started_at']}'::timestamptz
  ) THEN
    RAISE EXCEPTION
      'há importação posterior para o tenant; reverta-a primeiro';
  END IF;
END;
$later_run$;""",
            """
CREATE TEMP TABLE rollback_payload (
  sequence bigint NOT NULL,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL,
  before_row jsonb,
  after_row jsonb NOT NULL
) ON COMMIT DROP;
COPY rollback_payload (
  sequence, table_name, record_id, action, before_row, after_row
) FROM STDIN WITH (FORMAT csv);
"""
            + payload
            + "\n\\.",
        ]
        for table in ROLLBACK_ORDER:
            if table not in schema:
                continue
            quoted_table = sql_identifier(table)
            columns = [
                sql_identifier(column)
                for column in schema[table]
                if column != "id"
            ]
            set_clause = ", ".join(
                (
                    f"{column} = "
                    f"(jsonb_populate_record(NULL::public.{quoted_table}, "
                    f"payload.before_row)).{column}"
                )
                for column in columns
            )
            statements.append(
                f"""
ALTER TABLE public.{quoted_table} DISABLE TRIGGER USER;

DO $guard_{table}$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM rollback_payload payload
    LEFT JOIN public.{quoted_table} current
      ON current.id = payload.record_id
    WHERE payload.table_name = '{table}'
      AND (
        current.id IS NULL
        OR to_jsonb(current) IS DISTINCT FROM payload.after_row
      )
  ) THEN
    RAISE EXCEPTION
      'public.{table} mudou depois da importação; rollback recusado';
  END IF;
END;
$guard_{table}$;

DELETE FROM public.{quoted_table} current
USING rollback_payload payload
WHERE payload.table_name = '{table}'
  AND payload.action = 'insert'
  AND current.id = payload.record_id;

UPDATE public.{quoted_table} current
SET {set_clause}
FROM rollback_payload payload
WHERE payload.table_name = '{table}'
  AND payload.action = 'update'
  AND current.id = payload.record_id;

ALTER TABLE public.{quoted_table} ENABLE TRIGGER USER;"""
            )
        statements.extend(
            [
                f"""
UPDATE {AUDIT_SCHEMA}.runs
SET status = 'rollback_files_pending',
    finished_at = now()
WHERE id = '{self.run_id}'::uuid
  AND status = 'committed';

DO $status$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM {AUDIT_SCHEMA}.runs
    WHERE id = '{self.run_id}'::uuid
      AND status = 'rollback_files_pending'
  ) THEN
    RAISE EXCEPTION 'status da importação mudou durante o rollback';
  END IF;
END;
$status$;""",
                f"""
COPY (
  SELECT json_build_object(
    'run_id', id,
    'tenant', tenant,
    'status', status,
    'rows_reverted', {len(changes)}
  )::text
  FROM {AUDIT_SCHEMA}.runs
  WHERE id = '{self.run_id}'::uuid
) TO STDOUT;""",
                "COMMIT;",
            ]
        )
        return "\n".join(statements) + "\n"

    def quarantine_files(
        self, files: list[dict[str, str]]
    ) -> dict[str, int]:
        counts = {"quarantined": 0, "mode_restored": 0, "unchanged": 0, "warning": 0}
        quarantine_root = (
            self.target_media_dir / ".amz-rollback" / self.run_id
        )
        for entry in files:
            target = self.target_media_dir / entry["relative_path"]
            try:
                target.resolve(strict=False).relative_to(
                    self.target_media_dir.resolve()
                )
            except ValueError:
                raise ValueError("caminho inseguro no diário de arquivos")
            if entry["action"] == "created":
                quarantine = quarantine_root / entry["relative_path"]
                if (
                    quarantine.is_file()
                    and not quarantine.is_symlink()
                    and sha256_file(quarantine) == entry["sha256"]
                ):
                    counts["quarantined"] += 1
                    continue
                if not target.is_file() or target.is_symlink():
                    counts["warning"] += 1
                    continue
                if sha256_file(target) != entry["sha256"]:
                    counts["warning"] += 1
                    continue
                try:
                    quarantine.parent.mkdir(
                        parents=True, exist_ok=True, mode=0o700
                    )
                    shutil.move(str(target), str(quarantine))
                    counts["quarantined"] += 1
                except OSError:
                    counts["warning"] += 1
            elif entry["action"] == "permission_updated":
                if (
                    target.is_file()
                    and not target.is_symlink()
                    and entry["previous_mode"]
                    and sha256_file(target) == entry["sha256"]
                ):
                    os.chmod(target, int(entry["previous_mode"]))
                    counts["mode_restored"] += 1
                else:
                    counts["warning"] += 1
            else:
                counts["unchanged"] += 1
        return counts

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
        if self.target_media_dir.resolve() != REAL_TARGET_MEDIA_ROOT:
            raise ValueError("rollback real exige /opt/amz-media")
        report_path = self.args.report_json.resolve()
        try:
            report_path.relative_to(self.target_media_dir.resolve())
        except ValueError:
            pass
        else:
            raise ValueError("relatório não pode ficar dentro das mídias")
        self.args.report_json.parent.mkdir(parents=True, exist_ok=True)
        probe_fd, probe_name = tempfile.mkstemp(
            prefix=".amz-rollback-report-", dir=self.args.report_json.parent
        )
        os.close(probe_fd)
        Path(probe_name).unlink()
        run = self.load_run()
        changes = self.load_changes()
        files = self.load_files()
        if run["status"] == "committed":
            schema = self.schema_columns({row["table_name"] for row in changes})
            output = self.psql.run(self.build_sql(run, changes, schema))
            try:
                report = json.loads(output)
            except json.JSONDecodeError:
                report = {
                    "run_id": self.run_id,
                    "tenant": run["tenant"],
                    "status": "rollback_files_pending",
                    "rows_reverted": len(changes),
                }
        else:
            report = {
                "run_id": self.run_id,
                "tenant": run["tenant"],
                "status": "rollback_files_pending",
                "rows_reverted": len(changes),
                "resumed": True,
            }
        report["files"] = self.quarantine_files(files)
        if report["files"]["warning"] == 0:
            self.psql.run(
                f"""
                BEGIN;
                SELECT pg_advisory_xact_lock(
                  hashtext('amz-import:{run['tenant']}')
                );
                UPDATE {AUDIT_SCHEMA}.runs
                SET status = 'rolled_back',
                    finished_at = now()
                WHERE id = '{self.run_id}'::uuid
                  AND status = 'rollback_files_pending';
                COMMIT;
                """
            )
            report["status"] = "rolled_back"
        else:
            report["status"] = "rollback_files_pending"
        report["quarantine"] = str(
            self.target_media_dir / ".amz-rollback" / self.run_id
        )
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
        description="Reverte uma execução do importador, com verificação de drift."
    )
    parser.add_argument("--run-id", required=True)
    parser.add_argument(
        "--target-media-dir",
        type=Path,
        default=REAL_TARGET_MEDIA_ROOT,
    )
    parser.add_argument("--report-json", type=Path, required=True)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    try:
        args = parse_args(argv or sys.argv[1:])
        lock_path = args.target_media_dir / ".amz-import.lock"
        lock_path.parent.mkdir(parents=True, exist_ok=True)
        with lock_path.open("w", encoding="utf-8") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            report = Rollback(args).run()
        print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
        return 0
    except BlockingIOError:
        print(json.dumps({"fatal": "importação ou rollback em andamento"}))
        return 1
    except Exception as error:
        password = os.environ.get("PGPW", "")
        message = str(error).replace(password, "[REDACTED]") if password else str(error)
        print(json.dumps({"fatal": message}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

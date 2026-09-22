import subprocess
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from scripts.importador_amz import dry_run as dry_run_module
from scripts.importador_amz.dry_run import (
    DryRun,
    PsqlReadOnly,
    SOURCE_HOST,
    SYMBOLIC_AMZ_ID,
    TENANTS,
)


class DryRunStorageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.export = self.root / "export_amz"
        self.media = self.export / "_arquivos"
        self.public = (
            self.media
            / SOURCE_HOST
            / "storage"
            / "v1"
            / "object"
            / "public"
        )
        self.target = self.root / "amz-media"
        self.target.mkdir(parents=True)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def make_dry_run(self, expected_files: int = 1) -> DryRun:
        return DryRun(
            export_dir=self.export,
            media_dir=self.media,
            target_media_dir=self.target,
            expected_files=expected_files,
            db=None,
        )

    def test_maps_old_user_uuid_and_accepts_new_folder(self) -> None:
        source_id = TENANTS["atom"]["source_user_id"]
        source = self.public / "nova-pasta" / source_id / "imagem.png"
        source.parent.mkdir(parents=True)
        source.write_bytes(b"imagem")

        dry_run = self.make_dry_run()
        dry_run.inspect_storage()

        self.assertEqual(len(dry_run.file_manifest), 1)
        mapped = dry_run.file_manifest[0]
        self.assertIn(SYMBOLIC_AMZ_ID, mapped["relative_target"])
        self.assertEqual(mapped["state"], "new")
        self.assertFalse(
            any(issue.code == "missing_bucket" for issue in dry_run.issues)
        )

    def test_existing_same_file_is_idempotent(self) -> None:
        source_id = TENANTS["marcelo"]["source_user_id"]
        target_id = TENANTS["marcelo"]["target_user_id"]
        source = self.public / "videos" / source_id / "video.mp4"
        source.parent.mkdir(parents=True)
        source.write_bytes(b"video-identico")
        target = self.target / "videos" / target_id / "video.mp4"
        target.parent.mkdir(parents=True)
        target.write_bytes(b"video-identico")

        dry_run = self.make_dry_run()
        dry_run.inspect_storage()

        self.assertEqual(
            dry_run.report["storage"]["existing_same_checksum"],
            1,
        )
        self.assertFalse(
            any(issue.code == "target_file_conflict" for issue in dry_run.issues)
        )

    def test_existing_different_file_blocks_overwrite(self) -> None:
        source_id = TENANTS["marcelo"]["source_user_id"]
        target_id = TENANTS["marcelo"]["target_user_id"]
        source = self.public / "videos" / source_id / "video.mp4"
        source.parent.mkdir(parents=True)
        source.write_bytes(b"origem")
        target = self.target / "videos" / target_id / "video.mp4"
        target.parent.mkdir(parents=True)
        target.write_bytes(b"destino-diferente")

        dry_run = self.make_dry_run()
        dry_run.inspect_storage()

        self.assertTrue(
            any(issue.code == "target_file_conflict" for issue in dry_run.issues)
        )

    def test_rewrites_only_old_storage_host(self) -> None:
        dry_run = self.make_dry_run(expected_files=0)
        row = {
            "imagem_url": (
                f"https://{SOURCE_HOST}/storage/v1/object/public/"
                f"produtos/{TENANTS['duda']['source_user_id']}/produto.jpg"
            ),
            "link": "https://shopee.com.br/produto",
        }

        dry_run._collect_urls("duda", "produtos", "produto-1", row)

        self.assertEqual(len(dry_run.storage_references), 1)
        self.assertEqual(
            dry_run.storage_references[0]["field"],
            "imagem_url",
        )


class DryRunPolicyTests(unittest.TestCase):
    def test_autopilot_enabled_is_planned_disabled(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            dry_run = DryRun(root, root, root, 0, None)
            row = {
                "id": "b146edb9-5e13-4d48-9054-abbe9842fc40",
                "user_id": TENANTS["duda"]["source_user_id"],
                "nome": "Piloto",
                "produto_fonte": "todos",
                "posts_por_dia": 1,
                "dias_semana": [1],
                "horario_inicio": "08:00",
                "horario_fim": "18:00",
                "modo_geracao": "padrao",
                "ativo": True,
            }

            dry_run._inspect_table("duda", "autopilot_config", [row], 1)

            self.assertTrue(
                any(
                    issue.code == "autopilot_will_be_disabled"
                    for issue in dry_run.issues
                )
            )

    def test_integration_tokens_are_counted_but_not_exposed(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            dry_run = DryRun(root, root, root, 0, None)
            row = {
                "id": "5f58e9ae-2ac8-4485-9277-aa45922cba69",
                "user_id": TENANTS["duda"]["source_user_id"],
                "access_token": "valor-secreto",
                "refresh_token": "outro-segredo",
            }

            dry_run._inspect_table("duda", "integrations", [row], 1)
            report_text = str(dry_run.report)

            self.assertNotIn("valor-secreto", report_text)
            self.assertNotIn("outro-segredo", report_text)
            counters = dry_run.report["tables"]["integrations"]["tenants"]["duda"][
                "sensitive_field_occurrences"
            ]
            self.assertEqual(counters, {"access_token": 1, "refresh_token": 1})


class PsqlReadOnlyTests(unittest.TestCase):
    @patch("scripts.importador_amz.dry_run.subprocess.run")
    def test_query_is_wrapped_in_read_only_transaction(self, run_mock) -> None:
        run_mock.return_value = subprocess.CompletedProcess(
            args=[],
            returncode=0,
            stdout="id\nabc\n",
            stderr="",
        )

        rows = PsqlReadOnly("postgresql://secret").query("SELECT 'abc' AS id")

        self.assertEqual(rows, [{"id": "abc"}])
        kwargs = run_mock.call_args.kwargs
        self.assertIn("BEGIN TRANSACTION READ ONLY", kwargs["input"])
        self.assertIn("ROLLBACK", kwargs["input"])
        self.assertNotIn("postgresql://secret", run_mock.call_args.args[0])
        self.assertEqual(kwargs["env"]["PGDATABASE"], "postgresql://secret")

    def test_rejects_non_select_statement(self) -> None:
        with self.assertRaises(ValueError):
            PsqlReadOnly("postgresql://secret").query("DELETE FROM public.profiles")


class DryRunCliTests(unittest.TestCase):
    def test_cli_without_report_arguments_writes_nothing(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            export = root / "export_amz"
            tenant_dir = export / "duda"
            tenant_dir.mkdir(parents=True)
            (tenant_dir / "profiles.json").write_text(
                (
                    '[{"id": "%s", "nome": "Duda", "whatsapp": "5521999999999", '
                    '"cpf": "00000000000"}]'
                )
                % TENANTS["duda"]["source_user_id"],
                encoding="utf-8",
            )
            public = (
                export
                / "_arquivos"
                / SOURCE_HOST
                / "storage"
                / "v1"
                / "object"
                / "public"
            )
            public.mkdir(parents=True)
            target = root / "target"
            target.mkdir()
            before = sorted(path.relative_to(root) for path in root.rglob("*"))
            expected = {"duda": {"profiles": 1}}
            tenant = {"duda": TENANTS["duda"]}

            with (
                patch.object(dry_run_module, "EXPECTED_COUNTS", expected),
                patch.object(dry_run_module, "TENANTS", tenant),
                redirect_stdout(StringIO()),
            ):
                result = dry_run_module.main(
                    [
                        "--export-dir",
                        str(export),
                        "--target-media-dir",
                        str(target),
                        "--expected-files",
                        "0",
                    ]
                )
                blocked_result = dry_run_module.main(
                    [
                        "--export-dir",
                        str(export),
                        "--target-media-dir",
                        str(target),
                        "--expected-files",
                        "0",
                        "--report-json",
                        str(target / "report.json"),
                    ]
                )

            after = sorted(path.relative_to(root) for path in root.rglob("*"))
            self.assertEqual(result, 0)
            self.assertEqual(blocked_result, 1)
            self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()

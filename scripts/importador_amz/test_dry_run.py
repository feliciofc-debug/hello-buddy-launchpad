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
        self.assertEqual(mapped["state"], "pending_target_user_id")
        self.assertFalse(
            dry_run.report["storage"]["destination_comparison_complete"]
        )
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

    def test_preserves_shared_and_unknown_owner_paths_as_warnings(self) -> None:
        shared = self.public / "produtos" / "ia-marketing" / "sem-uuid.mp4"
        shared.parent.mkdir(parents=True)
        shared.write_bytes(b"compartilhado")
        unknown = (
            self.public
            / "videos"
            / "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
            / "desconhecido.mp4"
        )
        unknown.parent.mkdir(parents=True)
        unknown.write_bytes(b"desconhecido")

        dry_run = self.make_dry_run(expected_files=2)
        dry_run.inspect_storage()

        layout_blockers = [
            issue
            for issue in dry_run.issues
            if issue.severity == "blocker"
            and issue.code
            in {"invalid_source_media_layout", "invalid_referenced_media_layout"}
        ]
        self.assertEqual(layout_blockers, [])
        self.assertEqual(len(dry_run.file_manifest), 2)
        self.assertTrue(
            all(
                issue.severity == "warning"
                for issue in dry_run.issues
                if issue.code == "media_path_preserved_without_owner_rewrite"
            )
        )

    def test_rewrites_user_uuid_at_any_path_position(self) -> None:
        source_id = TENANTS["marcelo"]["source_user_id"]
        target_id = TENANTS["marcelo"]["target_user_id"]
        source = self.public / "produtos" / "midias" / source_id / "audio.ogg"
        source.parent.mkdir(parents=True)
        source.write_bytes(b"audio")

        dry_run = self.make_dry_run()
        dry_run.inspect_storage()

        mapped = dry_run.file_manifest[0]
        self.assertEqual(
            mapped["relative_target"],
            f"produtos/midias/{target_id}/audio.ogg",
        )
        self.assertFalse(
            any("layout" in issue.code for issue in dry_run.issues)
        )

    def test_non_regular_destination_parent_is_blocker(self) -> None:
        source_id = TENANTS["marcelo"]["source_user_id"]
        target_id = TENANTS["marcelo"]["target_user_id"]
        source = self.public / "videos" / source_id / "video.mp4"
        source.parent.mkdir(parents=True)
        source.write_bytes(b"video")
        blocking_parent = self.target / "videos" / target_id
        blocking_parent.parent.mkdir(parents=True)
        blocking_parent.write_bytes(b"not-a-directory")

        dry_run = self.make_dry_run()
        dry_run.inspect_storage()

        self.assertTrue(
            any(issue.code == "target_parent_conflict" for issue in dry_run.issues)
        )

    def test_destination_symlink_is_never_accepted_as_same_file(self) -> None:
        source_id = TENANTS["marcelo"]["source_user_id"]
        target_id = TENANTS["marcelo"]["target_user_id"]
        source = self.public / "videos" / source_id / "video.mp4"
        source.parent.mkdir(parents=True)
        source.write_bytes(b"video")
        outside = self.root / "outside.mp4"
        outside.write_bytes(b"video")
        target = self.target / "videos" / target_id / "video.mp4"
        target.parent.mkdir(parents=True)
        target.symlink_to(outside)

        dry_run = self.make_dry_run()
        dry_run.inspect_storage()

        self.assertTrue(
            any(
                issue.code == "target_path_not_regular_file"
                for issue in dry_run.issues
            )
        )

    def test_missing_file_for_imported_record_is_warning_and_removed(self) -> None:
        source_id = TENANTS["duda"]["source_user_id"]
        self.public.mkdir(parents=True)
        dry_run = self.make_dry_run(expected_files=0)
        dry_run._collect_urls(
            "duda",
            "produtos",
            "produto-1",
            {
                "imagem_url": (
                    f"https://{SOURCE_HOST}/storage/v1/object/public/"
                    f"produtos/{source_id}/ausente.jpg"
                )
            },
        )

        dry_run.inspect_storage()

        issue = next(
            issue
            for issue in dry_run.issues
            if issue.code == "referenced_file_missing"
        )
        self.assertEqual(issue.severity, "warning")
        missing = dry_run.report["storage"]["missing_references"][0]
        self.assertEqual(missing["planned_action"], "remove_reference")

    def test_cross_tenant_reference_in_skipped_queue_is_informational(self) -> None:
        source_id = TENANTS["atom"]["source_user_id"]
        source = self.public / "produtos" / "midias" / source_id / "imagem.png"
        source.parent.mkdir(parents=True)
        source.write_bytes(b"imagem")
        dry_run = self.make_dry_run()
        dry_run._collect_urls(
            "renata",
            "social_posts_queue",
            "post-1",
            {
                "media_url": (
                    f"https://{SOURCE_HOST}/storage/v1/object/public/"
                    f"produtos/midias/{source_id}/imagem.png"
                )
            },
        )

        dry_run.inspect_storage()

        issue = next(
            issue
            for issue in dry_run.issues
            if issue.code == "cross_tenant_storage_reference"
        )
        self.assertEqual(issue.severity, "info")

    def test_url_userinfo_and_query_are_removed_from_report(self) -> None:
        dry_run = self.make_dry_run(expected_files=0)
        source_id = TENANTS["duda"]["source_user_id"]
        secret_url = (
            f"https://segredo@{SOURCE_HOST}/storage/v1/object/public/"
            f"produtos/{source_id}/imagem.jpg?token=outro-segredo"
        )

        dry_run._collect_urls(
            "duda",
            "produtos",
            "produto-1",
            {"imagem_url": secret_url},
        )

        report_url = dry_run.storage_references[0]["source_url"]
        self.assertNotIn("segredo", report_url)
        self.assertNotIn("token=", report_url)

    def test_sensitive_url_field_is_not_collected(self) -> None:
        dry_run = self.make_dry_run(expected_files=0)
        source_id = TENANTS["duda"]["source_user_id"]
        secret_url = (
            f"https://{SOURCE_HOST}/storage/v1/object/public/"
            f"produtos/{source_id}/segredo"
        )

        dry_run._collect_urls(
            "duda",
            "integrations",
            "integracao-1",
            {"credentials": {"client_secret": secret_url}},
        )

        self.assertEqual(dry_run.storage_references, [])

    def test_uppercase_url_scheme_is_collected(self) -> None:
        dry_run = self.make_dry_run(expected_files=0)
        source_id = TENANTS["duda"]["source_user_id"]
        source_url = (
            f"HTTPS://{SOURCE_HOST}/storage/v1/object/public/"
            f"produtos/{source_id}/imagem.jpg"
        )

        dry_run._collect_urls(
            "duda",
            "produtos",
            "produto-1",
            {"imagem_url": source_url},
        )

        self.assertEqual(len(dry_run.storage_references), 1)


class DryRunPolicyTests(unittest.TestCase):
    def test_nullable_profile_field_is_not_a_blocker(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            dry_run = DryRun(root, root, root, 0, None)
            row = {
                "id": TENANTS["renata"]["source_user_id"],
                "nome": "Renata",
                "whatsapp": "",
                "cpf": "00000000000",
            }

            dry_run._inspect_table("renata", "profiles", [row], 1)
            dry_run._validate_missing_profile_fields(
                [{"column_name": "whatsapp", "is_nullable": "YES"}]
            )

            issue = next(
                issue
                for issue in dry_run.issues
                if issue.code == "profile_field_will_remain_empty"
            )
            self.assertEqual(issue.severity, "info")
            self.assertFalse(
                any(issue.code == "missing_required_field" for issue in dry_run.issues)
            )

    def test_non_nullable_profile_field_lists_exact_record(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            dry_run = DryRun(root, root, root, 0, None)
            record_id = TENANTS["renata"]["source_user_id"]
            dry_run.missing_profile_fields.append(
                {
                    "tenant": "renata",
                    "field": "whatsapp",
                    "record_id": record_id,
                }
            )

            dry_run._validate_missing_profile_fields(
                [{"column_name": "whatsapp", "is_nullable": "NO"}]
            )

            issue = next(
                issue
                for issue in dry_run.issues
                if issue.code == "missing_non_nullable_profile_field"
            )
            self.assertEqual(issue.severity, "blocker")
            self.assertEqual(issue.tenant, "renata")
            self.assertEqual(issue.record_id, record_id)
            self.assertIn("profiles.whatsapp", issue.message)

    def test_marcelo_imports_only_profile_products_and_media(self) -> None:
        self.assertTrue(DryRun._is_imported("marcelo", "profiles"))
        self.assertTrue(DryRun._is_imported("marcelo", "produtos"))
        self.assertTrue(DryRun._is_imported("marcelo", "midias_whatsapp"))
        self.assertFalse(DryRun._is_imported("marcelo", "autopilot_config"))
        self.assertFalse(
            DryRun._is_imported("marcelo", "whatsapp_cloud_agent_config")
        )
        self.assertFalse(DryRun._is_imported("marcelo", "notificacoes_usuario"))

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

    def test_nested_secret_is_counted_without_exposing_value(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            dry_run = DryRun(root, root, root, 0, None)
            row = {
                "id": "5f58e9ae-2ac8-4485-9277-aa45922cba69",
                "user_id": TENANTS["duda"]["source_user_id"],
                "metadata": {"client_secret": "segredo-aninhado"},
            }

            dry_run._inspect_table("duda", "integrations", [row], 1)

            report_text = str(dry_run.report)
            self.assertNotIn("segredo-aninhado", report_text)
            counters = dry_run.report["tables"]["integrations"]["tenants"]["duda"][
                "sensitive_field_occurrences"
            ]
            self.assertEqual(counters, {"client_secret": 1})

    def test_cross_tenant_product_reference_is_blocker(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            dry_run = DryRun(root, root, root, 0, None)
            renata_product_id = "62c16291-d10c-46af-81fa-31197b8dbc7c"
            dry_run.records = {
                "duda": {
                    "produtos": [],
                    "biblioteca_campanhas": [
                        {
                            "id": "f3ca2e24-78d3-4b20-a073-bb2415855cea",
                            "produto_id": renata_product_id,
                        }
                    ],
                },
                "renata": {
                    "produtos": [{"id": renata_product_id}],
                    "biblioteca_campanhas": [],
                },
            }

            dry_run.validate_references()

            issue = next(
                issue
                for issue in dry_run.issues
                if issue.code == "cross_tenant_product_reference"
            )
            self.assertEqual(issue.severity, "blocker")


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

    def test_rejects_data_modifying_with_statement(self) -> None:
        with self.assertRaises(ValueError):
            PsqlReadOnly("postgresql://secret").query(
                "WITH deleted AS (DELETE FROM profiles RETURNING id) SELECT * FROM deleted"
            )


class DryRunDatabaseTests(unittest.TestCase):
    def test_uncompared_destination_id_collision_is_blocker(self) -> None:
        product_id = "62c16291-d10c-46af-81fa-31197b8dbc7c"

        class FakeDatabase:
            def query(self, sql):
                if (
                    "SELECT id::text FROM public.produtos" in sql
                    and "WHERE id IN" in sql
                ):
                    return [{"id": product_id}]
                return []

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            dry_run = DryRun(root, root, root, 0, FakeDatabase())
            dry_run.ids_by_table["produtos"].add(product_id)

            with patch(
                "scripts.importador_amz.dry_run.shutil.which",
                return_value="/usr/bin/psql",
            ):
                dry_run.inspect_database()

            issue = next(
                issue
                for issue in dry_run.issues
                if issue.code == "destination_id_unverified_collision"
            )
            self.assertEqual(issue.severity, "blocker")


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
                hardcoded_storage_blocked_result = dry_run_module.main(
                    [
                        "--export-dir",
                        str(export),
                        "--target-media-dir",
                        str(target),
                        "--expected-files",
                        "0",
                        "--report-json",
                        "/opt/amz-media/report.json",
                    ]
                )

            after = sorted(path.relative_to(root) for path in root.rglob("*"))
            self.assertEqual(result, 0)
            self.assertEqual(blocked_result, 1)
            self.assertEqual(hardcoded_storage_blocked_result, 1)
            self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()

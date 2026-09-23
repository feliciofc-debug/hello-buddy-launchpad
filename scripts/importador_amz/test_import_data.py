import tempfile
import unittest
import uuid
from pathlib import Path

from scripts.importador_amz.import_data import Importer, Psql, sha256_file
from scripts.importador_amz.rollback_import import Rollback


class ImportTransformTests(unittest.TestCase):
    def make_importer(self, root: Path) -> Importer:
        importer = Importer.__new__(Importer)
        importer.tenant = "duda"
        importer.run_id = str(uuid.uuid4())
        importer.source_user_id = "684ed635-2a72-47ba-bee1-a8c906d973a3"
        importer.target_user_id = "e69ade89-5c4f-479a-9ea9-adf3d6967ea8"
        importer.old_to_target = {
            importer.source_user_id: importer.target_user_id,
        }
        importer.source_public_root = root / "source"
        importer.target_media_dir = root / "target"
        importer.source_public_root.mkdir()
        importer.target_media_dir.mkdir()
        importer.referenced_paths = set()
        importer.missing_references = 0
        importer.records = {
            "produtos": [{"id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}],
            "opt_ins": [],
        }
        importer.skipped = {"integrations": 2, "social_posts_queue": 1268}
        importer.media_journal = []
        importer.created_files = []
        importer.mode_changes = []
        importer.created_dirs = []
        return importer

    def test_transforms_tenant_urls_and_operational_fields(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            importer = self.make_importer(root)
            relative = (
                Path("produtos")
                / "midias"
                / importer.source_user_id
                / "imagem.png"
            )
            source = importer.source_public_root / relative
            source.parent.mkdir(parents=True)
            source.write_bytes(b"imagem")
            url = (
                "https://jibpvpqgplmahjhswiza.supabase.co"
                f"/storage/v1/object/public/{relative.as_posix()}"
            )

            product = importer.transform_record(
                "produtos",
                {
                    "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                    "user_id": importer.source_user_id,
                    "cliente_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                    "imagem_url": url,
                },
            )
            autopilot = importer.transform_record(
                "autopilot_config",
                {
                    "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                    "user_id": importer.source_user_id,
                    "ativo": True,
                    "proxima_execucao": "2030-01-01T00:00:00Z",
                    "desativado_em": "legacy",
                },
            )

            self.assertEqual(product["user_id"], importer.target_user_id)
            self.assertIsNone(product["cliente_id"])
            self.assertIn(importer.target_user_id, product["imagem_url"])
            self.assertEqual(importer.referenced_paths, {relative.as_posix()})
            self.assertFalse(autopilot["ativo"])
            self.assertIsNone(autopilot["proxima_execucao"])
            self.assertNotIn("desativado_em", autopilot)

    def test_missing_referenced_file_clears_url(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            importer = self.make_importer(Path(temp))
            value = importer.transform_url(
                "https://jibpvpqgplmahjhswiza.supabase.co/"
                "storage/v1/object/public/produtos/ausente.png"
            )
            self.assertIsNone(value)
            self.assertEqual(importer.missing_references, 1)

    def test_media_copy_is_checksum_checked_and_world_readable(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            importer = self.make_importer(root)
            source = importer.source_public_root / "bucket" / "file.bin"
            source.parent.mkdir()
            source.write_bytes(b"payload")
            entry = {
                "source": str(source),
                "relative_target": "bucket/file.bin",
                "sha256": sha256_file(source),
            }

            counts = importer.copy_media([entry])
            target = importer.target_media_dir / "bucket" / "file.bin"

            self.assertEqual(counts, {"created": 1})
            self.assertEqual(target.read_bytes(), b"payload")
            self.assertTrue(target.stat().st_mode & 0o004)
            importer.cleanup_media()
            self.assertFalse(target.exists())


class ImportSqlTests(unittest.TestCase):
    def test_psql_uses_tcp_and_password_environment_forwarding(self) -> None:
        psql = Psql("secret")
        self.assertIn("127.0.0.1", psql.base_args)
        self.assertIn("PGPASSWORD", psql.base_args)
        self.assertNotIn("secret", psql.base_args)

    def test_import_sql_is_transactional_idempotent_and_audited(self) -> None:
        importer = Importer.__new__(Importer)
        importer.run_id = str(uuid.uuid4())
        importer.tenant = "duda"
        importer.target_user_id = "e69ade89-5c4f-479a-9ea9-adf3d6967ea8"
        importer.media_journal = []
        importer.skipped = {"integrations": 2}
        importer.missing_references = 0
        sql = importer.build_import_sql(
            {
                "produtos": [
                    {
                        "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                        "user_id": importer.target_user_id,
                        "nome": "Produto",
                    }
                ]
            },
            {"produtos": ["id", "user_id", "nome"]},
        )

        self.assertIn("BEGIN;", sql)
        self.assertIn("ON CONFLICT (id) DO UPDATE", sql)
        self.assertIn("IS DISTINCT FROM", sql)
        self.assertIn("amz_migration.row_changes", sql)
        self.assertIn("snapshot final ausente", sql)
        self.assertIn("COMMIT;", sql)
        self.assertLess(sql.index("COPY (\n  SELECT report"), sql.index("COMMIT;"))
        self.assertLess(sql.index("snapshot final ausente"), sql.index("COMMIT;"))

    def test_rollback_refuses_drift_before_changes(self) -> None:
        rollback = Rollback.__new__(Rollback)
        rollback.run_id = str(uuid.uuid4())
        run = {"tenant": "duda", "started_at": "2026-09-23T17:00:00+00:00"}
        record_id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        changes = [
            {
                "sequence": "1",
                "table_name": "produtos",
                "record_id": record_id,
                "action": "insert",
                "before_row": None,
                "after_row": {"id": record_id, "nome": "Produto"},
            }
        ]
        sql = rollback.build_sql(run, changes, {"produtos": ["id", "nome"]})

        self.assertIn("mudou depois da importação; rollback recusado", sql)
        self.assertLess(sql.index("rollback recusado"), sql.index("DELETE FROM"))
        self.assertIn("DISABLE TRIGGER USER", sql)
        self.assertIn("ENABLE TRIGGER USER", sql)
        self.assertIn("status = 'rollback_files_pending'", sql)
        self.assertIn("COMMIT;", sql)


if __name__ == "__main__":
    unittest.main()

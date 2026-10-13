import ast
import json
import os
import pathlib
import subprocess
import tempfile
import textwrap
import types
import unittest
from unittest.mock import patch


MODULE_PATH = pathlib.Path(__file__).with_name("worker.py")
SOURCE = MODULE_PATH.read_text(encoding="utf-8")
TREE = ast.parse(SOURCE)
TESTED_FUNCTIONS = {
    "esc", "comando_ffmpeg", "baixar_logo", "alvo_meta", "filtro_meta",
    "preview_video_bitrate_kbps", "preview_dimensions", "comando_preview",
    "gerar_preview_whatsapp", "tentar_preview_whatsapp", "processar",
}
TESTED_CONSTANTS = {
    "WHATSAPP_PREVIEW_MAX_BYTES", "WHATSAPP_AUDIO_KBPS",
    "WHATSAPP_VIDEO_MAX_KBPS", "WHATSAPP_RESIZE_THRESHOLD_KBPS",
    "WHATSAPP_PREVIEW_ATTEMPTS",
}
FUNCTION_TREE = ast.Module(
    body=[
        node for node in TREE.body
        if (
            isinstance(node, ast.FunctionDef) and node.name in TESTED_FUNCTIONS
        ) or (
            isinstance(node, ast.Assign) and any(
                isinstance(target, ast.Name) and target.id in TESTED_CONSTANTS
                for target in node.targets
            )
        )
    ],
    type_ignores=[],
)
WORKER = {
    "json": json,
    "os": os,
    "subprocess": subprocess,
    "tempfile": tempfile,
    "textwrap": textwrap,
}
exec(compile(FUNCTION_TREE, str(MODULE_PATH), "exec"), WORKER)


class FfmpegCommandTest(unittest.TestCase):
    def run_processar_with_preview(self, preview_effect, include_upload=True):
        put_urls = []

        class FakeResponse:
            def __init__(self, url):
                self.url = url

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def raise_for_status(self):
                return None

            def iter_content(self, _size):
                return [b"video"]

        class FakeRequests:
            @staticmethod
            def get(url, **_kwargs):
                return FakeResponse(url)

            @staticmethod
            def put(url, **_kwargs):
                put_urls.append(url)
                return FakeResponse(url)

        def fake_run(command, **_kwargs):
            pathlib.Path(command[-1]).write_bytes(b"final")
            return types.SimpleNamespace()

        job = {
            "video_download_url": "https://example.com/source.mp4",
            "formato": "reels",
            "segmentos": [],
            "estilo": {"threads": "3"},
            "upload": {
                "url": "https://upload.example.com/final",
                "content_type": "video/mp4",
                "bucket": "videos",
                "path": "final.mp4",
            },
        }
        if include_upload:
            job["upload_preview"] = {
                "url": "https://upload.example.com/preview",
                "content_type": "video/mp4",
                "path": "preview.mp4",
            }

        replacements = {
            "THREADS": "3",
            "requests": FakeRequests(),
            "subprocess": types.SimpleNamespace(run=fake_run),
            "dimensoes": lambda _path: (1080, 1920),
            "filtros": lambda *_args: "",
            "baixar_logo": lambda *_args: None,
            "metadados_saida": lambda _path: {
                "duration_seconds": 85,
                "width": 1080,
                "height": 1920,
                "size_bytes": 20 * 1024 * 1024,
            },
            "gerar_preview_whatsapp": preview_effect,
        }
        with patch.dict(WORKER, replacements):
            result = WORKER["processar"](job)
        return result, put_urls

    def test_without_logo_uses_regular_video_filter(self):
        command = WORKER["comando_ffmpeg"](
            "in.mp4", "out.mp4", "drawtext=test", "3", 1080, 1920,
        )
        self.assertEqual(command, [
            "ffmpeg", "-y", "-i", "in.mp4", "-vf", "drawtext=test",
            "-threads", "3",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart", "out.mp4",
        ])

    def test_with_logo_overlays_at_top_left_in_the_same_encode_pass(self):
        command = WORKER["comando_ffmpeg"](
            "in.mp4",
            "out.mp4",
            "drawtext=test",
            "3",
            1000,
            2000,
            "logo.png",
            {"download_url": "https://example.com/logo.png"},
        )
        self.assertEqual(command.count("-i"), 2)
        self.assertIn("-filter_complex", command)
        graph = command[command.index("-filter_complex") + 1]
        self.assertIn(
            "scale=w=380:h=280:force_original_aspect_ratio=decrease",
            graph,
        )
        self.assertIn("overlay=50:80:format=auto", graph)
        self.assertEqual(command.count("-c:v"), 1)

    def test_percent_is_escaped_for_drawtext(self):
        self.assertEqual(WORKER["esc"]("Desconto de 50%"), "Desconto de 50\\\\%")

    def test_logo_download_uses_video_claim_primary_variant(self):
        downloaded = []
        WORKER["baixar_logo_url"] = lambda url, path: downloaded.append((url, path)) or path
        path = WORKER["baixar_logo"]({
            "download_url": "https://example.com/default.png",
            "light_background_download_url": "https://example.com/light.png",
            "dark_background_download_url": "https://example.com/dark.png",
        }, "/tmp/job", "video.mp4")
        self.assertEqual(path, "/tmp/job/logo")
        self.assertEqual(downloaded, [
            ("https://example.com/default.png", "/tmp/job/logo"),
        ])

    def test_logo_download_falls_back_to_default(self):
        downloaded = []
        WORKER["baixar_logo_url"] = lambda url, path: downloaded.append(url) or path
        WORKER["baixar_logo"]({
            "download_url": "https://example.com/default.png",
            "dark_background_download_url": "https://example.com/dark.png",
        }, "/tmp/job", "video.mp4")
        self.assertEqual(downloaded, ["https://example.com/default.png"])

    def test_meta_frame_uses_9_16_for_story_and_reels(self):
        self.assertEqual(WORKER["alvo_meta"]("story"), (1080, 1920))
        self.assertEqual(WORKER["alvo_meta"]("reels"), (1080, 1920))
        self.assertEqual(WORKER["alvo_meta"]("feed"), (1080, 1350))
        video_filter = WORKER["filtro_meta"]("drawtext=test", 1080, 1920)
        self.assertIn("force_original_aspect_ratio=increase", video_filter)
        self.assertIn("crop=1080:1920", video_filter)
        self.assertNotIn("pad=", video_filter)
        self.assertNotIn(":black", video_filter)

    def test_19_second_preview_stays_at_six_mbps_and_full_resolution(self):
        bitrate = WORKER["preview_video_bitrate_kbps"](19)
        self.assertEqual(bitrate, 6000)
        self.assertEqual(
            WORKER["preview_dimensions"](1080, 1920, bitrate),
            (1080, 1920),
        )
        estimated_bytes = (bitrate + 128) * 1000 * 19 / 8
        self.assertLessEqual(estimated_bytes, 15 * 1024 * 1024)

    def test_85_second_preview_is_reduced_to_720_by_1280(self):
        bitrate = WORKER["preview_video_bitrate_kbps"](85)
        self.assertLess(bitrate, 2500)
        self.assertEqual(
            WORKER["preview_dimensions"](1080, 1920, bitrate),
            (720, 1280),
        )
        estimated_bytes = (bitrate + 128) * 1000 * 85 / 8
        self.assertLessEqual(estimated_bytes, 15 * 1024 * 1024)

    def test_preview_command_caps_bitrate_and_keeps_final_separate(self):
        command = WORKER["comando_preview"](
            "final.mp4", "preview.mp4", 1350, 720, 1280, "3",
        )
        self.assertIn("-b:v", command)
        self.assertEqual(command[command.index("-maxrate") + 1], "1350k")
        self.assertEqual(command[command.index("-bufsize") + 1], "2700k")
        self.assertEqual(command[command.index("-vf") + 1], "scale=720:1280:flags=lanczos")
        self.assertEqual(command[-1], "preview.mp4")

    def test_oversized_preview_reencodes_with_15_percent_less_bitrate(self):
        commands = []
        sizes = iter([
            16 * 1024 * 1024,
            15 * 1024 * 1024 + 1,
            15 * 1024 * 1024,
        ])
        original_run = WORKER["subprocess"].run
        original_getsize = WORKER["os"].path.getsize
        WORKER["subprocess"].run = lambda command, **_kwargs: commands.append(command)
        WORKER["os"].path.getsize = lambda _path: next(sizes)
        WORKER["metadados_saida"] = lambda _path: {"size_bytes": 15 * 1024 * 1024}
        try:
            output = WORKER["gerar_preview_whatsapp"](
                "final.mp4", "preview.mp4", 85, 1080, 1920, "3",
            )
        finally:
            WORKER["subprocess"].run = original_run
            WORKER["os"].path.getsize = original_getsize
        self.assertEqual(len(commands), 3)
        bitrates = [
            int(command[command.index("-b:v") + 1][:-1])
            for command in commands
        ]
        self.assertEqual(bitrates[1], int(bitrates[0] * 0.85))
        self.assertEqual(bitrates[2], int(bitrates[1] * 0.85))
        self.assertEqual(output["size_bytes"], 15 * 1024 * 1024)

    def test_preview_ffmpeg_failure_keeps_final_result(self):
        def fail_preview(*_args):
            raise RuntimeError("ffmpeg falhou")

        result, put_urls = self.run_processar_with_preview(fail_preview)
        self.assertEqual(result[1], "final.mp4")
        self.assertIsNone(result[3])
        self.assertIsNone(result[4])
        self.assertEqual(put_urls, ["https://upload.example.com/final"])

    def test_old_claim_without_upload_preview_skips_preview(self):
        preview_calls = []

        def preview(*_args):
            preview_calls.append(True)

        result, put_urls = self.run_processar_with_preview(
            preview, include_upload=False,
        )
        self.assertEqual(result[1], "final.mp4")
        self.assertIsNone(result[3])
        self.assertEqual(preview_calls, [])
        self.assertEqual(put_urls, ["https://upload.example.com/final"])

    def test_preview_over_limit_after_three_attempts_keeps_final_result(self):
        def over_limit(*_args):
            raise RuntimeError(
                "prévia do WhatsApp excedeu 15 MB após 3 tentativas"
            )

        result, put_urls = self.run_processar_with_preview(over_limit)
        self.assertEqual(result[1], "final.mp4")
        self.assertIsNone(result[3])
        self.assertIsNone(result[4])
        self.assertEqual(put_urls, ["https://upload.example.com/final"])


if __name__ == "__main__":
    unittest.main()

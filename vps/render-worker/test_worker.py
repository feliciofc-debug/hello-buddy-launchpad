import ast
import pathlib
import textwrap
import unittest


MODULE_PATH = pathlib.Path(__file__).with_name("worker.py")
SOURCE = MODULE_PATH.read_text(encoding="utf-8")
TREE = ast.parse(SOURCE)
TESTED_FUNCTIONS = {
    "esc", "comando_ffmpeg", "baixar_logo", "alvo_meta", "filtro_meta"
}
FUNCTION_TREE = ast.Module(
    body=[
        node for node in TREE.body
        if isinstance(node, ast.FunctionDef) and node.name in TESTED_FUNCTIONS
    ],
    type_ignores=[],
)
WORKER = {"textwrap": textwrap}
exec(compile(FUNCTION_TREE, str(MODULE_PATH), "exec"), WORKER)


class FfmpegCommandTest(unittest.TestCase):
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
        self.assertIn("force_original_aspect_ratio=decrease", video_filter)
        self.assertIn("pad=1080:1920", video_filter)


if __name__ == "__main__":
    unittest.main()

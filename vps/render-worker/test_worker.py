import importlib.util
import pathlib
import unittest


MODULE_PATH = pathlib.Path(__file__).with_name("worker.py")
SPEC = importlib.util.spec_from_file_location("render_worker", MODULE_PATH)
WORKER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(WORKER)


class FfmpegCommandTest(unittest.TestCase):
    def test_without_logo_uses_regular_video_filter(self):
        command = WORKER.build_ffmpeg_command(
            "in.mp4", "out.mp4", "drawtext=test", "3", 1080, 1920,
        )
        self.assertIn("-vf", command)
        self.assertNotIn("-filter_complex", command)
        self.assertEqual(command.count("-i"), 1)

    def test_with_logo_overlays_in_the_same_encode_pass(self):
        command = WORKER.build_ffmpeg_command(
            "in.mp4",
            "out.mp4",
            "drawtext=test",
            "3",
            1000,
            2000,
            "logo.png",
            {"largura_ratio": 0.22, "margem_ratio": 0.04},
        )
        self.assertEqual(command.count("-i"), 2)
        self.assertIn("-filter_complex", command)
        graph = command[command.index("-filter_complex") + 1]
        self.assertIn("scale=220:-1", graph)
        self.assertIn("overlay=(main_w-overlay_w)/2:80:format=auto", graph)
        self.assertEqual(command.count("-c:v"), 1)


if __name__ == "__main__":
    unittest.main()

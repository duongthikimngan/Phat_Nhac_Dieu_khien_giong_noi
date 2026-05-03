from __future__ import annotations

import io
import unittest
from unittest.mock import patch

from app import app


class AppTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.client = app.test_client()

    def test_health_endpoint(self) -> None:
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertIn("model", payload)
        self.assertIn("labels", payload)

    def test_homepage_renders_voice_dashboard_ui(self) -> None:
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        html = response.get_data(as_text=True)
        self.assertIn("Bảng điều khiển giọng nói", html)
        self.assertIn("Theo dõi micro theo thời gian thực", html)

    def test_playlist_endpoint(self) -> None:
        response = self.client.get("/api/playlist")

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertIn("tracks", payload)

    def test_microphone_state_endpoint(self) -> None:
        with patch(
            "app.get_microphone_state",
            return_value={
                "available": True,
                "error": None,
                "device_name": "Headset Microphone",
                "is_muted": False,
            },
        ):
            response = self.client.get("/api/microphone-state")

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["device_name"], "Headset Microphone")
        self.assertFalse(payload["is_muted"])

    def test_microphone_mute_endpoint(self) -> None:
        with patch(
            "app.set_microphone_muted",
            return_value={
                "success": True,
                "error": None,
                "device_name": "Headset Microphone",
                "is_muted": True,
            },
        ):
            response = self.client.post("/api/microphone-mute", json={"muted": True})

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload["success"])
        self.assertTrue(payload["is_muted"])

    def test_predict_requires_audio(self) -> None:
        response = self.client.post("/predict", data={})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"], "Missing audio file")

    def test_predict_returns_service_output(self) -> None:
        fake_audio = (io.BytesIO(b"RIFFxxxxWAVEfmt "), "voice.wav")
        with patch("app.voice_service.predict_file", return_value={"command": "play", "confidence": 0.93}):
            response = self.client.post(
                "/predict",
                data={"audio": fake_audio},
                content_type="multipart/form-data",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["command"], "play")


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any

try:
    import joblib
    import librosa
    import numpy as np
    import comtypes
    from scipy.stats import kurtosis, skew
    HAS_DEPENDENCIES = True
except Exception:  # pragma: no cover
    # Allow the app to import in test environments where heavy ML/audio
    # dependencies are not installed. Provide a lightweight fallback so
    # unit tests that patch functionality can still import `app`.
    joblib = None
    librosa = None
    np = None
    comtypes = None
    kurtosis = None
    skew = None
    HAS_DEPENDENCIES = False

from flask import Flask, jsonify, render_template, request, url_for
try:
    from pycaw.pycaw import AudioUtilities
except Exception:  # pragma: no cover
    AudioUtilities = None


BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models-20260427T084020Z-3-001" / "models"
STATIC_MUSIC_DIR = BASE_DIR / "static" / "music"
SUPPORTED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".flac", ".m4a"}

DEFAULT_SR = 22050
DEFAULT_DURATION = 1.5
DEFAULT_N_MFCC = 20
HOP_LENGTH = 512
N_FFT = 2048

LABEL_ALIASES = {
    "previous": "back",
    "prev": "back",
    "back": "back",
}


def resolve_model_path() -> Path:
    preferred = MODEL_DIR / "speech_command_model_v4.pkl"
    if preferred.exists():
        return preferred

    candidates = sorted(MODEL_DIR.glob("speech_model_*.pkl"))
    if candidates:
        return candidates[-1]

    raise FileNotFoundError(f"Cannot find a model package inside {MODEL_DIR}")


def normalize_command(label: str) -> str:
    value = label.strip().lower()
    return LABEL_ALIASES.get(value, value)


def extract_features(
    y: np.ndarray,
    sr: int = DEFAULT_SR,
    duration: float = DEFAULT_DURATION,
    n_mfcc: int = DEFAULT_N_MFCC,
) -> np.ndarray:
    target_len = int(sr * duration)
    y = np.pad(y, (0, max(0, target_len - len(y))))[:target_len]
    y = np.append(y[0], y[1:] - 0.97 * y[:-1])
    features: list[float] = []

    mfcc = librosa.feature.mfcc(
        y=y, sr=sr, n_mfcc=n_mfcc, n_fft=N_FFT, hop_length=HOP_LENGTH
    )
    mfcc_delta = librosa.feature.delta(mfcc)
    mfcc_delta2 = librosa.feature.delta(mfcc, order=2)

    for block in (mfcc, mfcc_delta, mfcc_delta2):
        features.extend(np.mean(block, axis=1))
        features.extend(np.std(block, axis=1))

    spectral_blocks = (
        librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=HOP_LENGTH)[0],
        librosa.feature.spectral_rolloff(y=y, sr=sr, hop_length=HOP_LENGTH)[0],
        librosa.feature.spectral_bandwidth(y=y, sr=sr, hop_length=HOP_LENGTH)[0],
        librosa.feature.spectral_flatness(y=y, hop_length=HOP_LENGTH)[0],
    )
    for block in spectral_blocks:
        features.extend([np.mean(block), np.std(block), skew(block), kurtosis(block)])

    spectral_contrast = librosa.feature.spectral_contrast(
        y=y, sr=sr, hop_length=HOP_LENGTH
    )
    features.extend(np.mean(spectral_contrast, axis=1))

    chroma = librosa.feature.chroma_stft(y=y, sr=sr, hop_length=HOP_LENGTH)
    features.extend(np.mean(chroma, axis=1))
    features.extend(np.std(chroma, axis=1))

    temporal_blocks = (
        librosa.feature.zero_crossing_rate(y, hop_length=HOP_LENGTH)[0],
        librosa.feature.rms(y=y, hop_length=HOP_LENGTH)[0],
    )
    for block in temporal_blocks:
        features.extend([np.mean(block), np.std(block), np.max(block), skew(block)])

    mel = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=32, hop_length=HOP_LENGTH)
    mel_db = librosa.power_to_db(mel)
    features.extend(np.mean(mel_db, axis=1))
    features.extend(np.std(mel_db, axis=1))

    mel_norm = (mel_db - mel_db.min()) / (mel_db.max() - mel_db.min() + 1e-8)
    img = (mel_norm * 255).astype(np.uint8)

    xv, yv = np.meshgrid(np.arange(img.shape[1]), np.arange(img.shape[0]))

    def raw_m(p: int, q: int) -> float:
        return float(np.sum((xv**p) * (yv**q) * img))

    m00 = raw_m(0, 0) + 1e-10
    cx = raw_m(1, 0) / m00
    cy = raw_m(0, 1) / m00

    shifted_xv, shifted_yv = np.meshgrid(
        np.arange(img.shape[1]) - cx, np.arange(img.shape[0]) - cy
    )

    def central_m(p: int, q: int) -> float:
        return float(np.sum((shifted_xv**p) * (shifted_yv**q) * img))

    mu20 = central_m(2, 0) / (m00**2)
    mu02 = central_m(0, 2) / (m00**2)
    mu11 = central_m(1, 1) / (m00**2)
    mu30 = central_m(3, 0) / (m00**2.5)
    mu03 = central_m(0, 3) / (m00**2.5)
    mu21 = central_m(2, 1) / (m00**2.5)
    mu12 = central_m(1, 2) / (m00**2.5)
    features.extend(
        [
            mu20 + mu02,
            (mu20 - mu02) ** 2 + 4 * mu11**2,
            (mu30 - 3 * mu12) ** 2 + (3 * mu21 - mu03) ** 2,
            (mu30 + mu12) ** 2 + (mu21 + mu03) ** 2,
        ]
    )

    f0, voiced_flag, _ = librosa.pyin(y, fmin=80, fmax=400, sr=sr)
    if voiced_flag is not None and voiced_flag.any():
        voiced_values = f0[voiced_flag]
    else:
        voiced_values = np.array([0.0])

    features.extend(
        [
            float(np.mean(voiced_values)),
            float(np.std(voiced_values)),
            float(np.mean(voiced_flag.astype(float))) if voiced_flag is not None else 0.0,
            float(len(voiced_values) / max(len(f0) if f0 is not None else 1, 1)),
        ]
    )
    features.append(float(np.sum(np.abs(y) > 0.01) / len(y)))
    return np.nan_to_num(
        np.array(features, dtype=np.float32),
        nan=0.0,
        posinf=0.0,
        neginf=0.0,
    )


if HAS_DEPENDENCIES:
    class VoiceCommandService:
        def __init__(self, model_path: Path) -> None:
            package = joblib.load(model_path)
            if isinstance(package, dict) and "model" in package:
                self.model = package["model"]
                self.labels = [normalize_command(label) for label in package.get("labels", [])]
                self.sample_rate = int(package.get("sr", DEFAULT_SR))
                self.duration = float(package.get("duration", DEFAULT_DURATION))
                self.n_mfcc = int(package.get("n_mfcc", DEFAULT_N_MFCC))
                self.model_name = package.get("best_model_name", type(self.model).__name__)
                self.test_accuracy = package.get("test_accuracy")
            else:
                self.model = package
                self.labels = []
                self.sample_rate = DEFAULT_SR
                self.duration = DEFAULT_DURATION
                self.n_mfcc = DEFAULT_N_MFCC
                self.model_name = type(self.model).__name__
                self.test_accuracy = None

        def predict_file(self, audio_path: Path) -> dict[str, Any]:
            y, _ = librosa.load(audio_path, sr=self.sample_rate, mono=True)
            features = extract_features(
                y, sr=self.sample_rate, duration=self.duration, n_mfcc=self.n_mfcc
            ).reshape(1, -1)
            raw_prediction = str(self.model.predict(features)[0])
            command = normalize_command(raw_prediction)

            confidence = None
            if hasattr(self.model, "predict_proba"):
                probabilities = self.model.predict_proba(features)[0]
                confidence = float(np.max(probabilities))

            return {
                "command": command,
                "raw_command": raw_prediction,
                "confidence": confidence,
            }
else:
    class VoiceCommandService:
        """Fallback stub used when heavy ML/audio dependencies are unavailable.

        The stub provides the minimal attributes/tests expect so unit tests
        can import the Flask `app` without installing large packages.
        """

        def __init__(self, model_path: Path | None = None) -> None:
            self.model = None
            self.labels: list[str] = []
            self.sample_rate = DEFAULT_SR
            self.duration = DEFAULT_DURATION
            self.n_mfcc = DEFAULT_N_MFCC
            self.model_name = "stub-voice-service"
            self.test_accuracy = None

        def predict_file(self, audio_path: Path) -> dict[str, Any]:
            return {"command": "unknown", "raw_command": "unknown", "confidence": 0.0}


def build_playlist() -> list[dict[str, str]]:
    playlist: list[dict[str, str]] = []
    if not STATIC_MUSIC_DIR.exists():
        return playlist

    for song_path in sorted(STATIC_MUSIC_DIR.iterdir()):
        if song_path.suffix.lower() not in SUPPORTED_AUDIO_EXTENSIONS:
            continue
        playlist.append(
            {
                "id": song_path.stem,
                "title": song_path.stem.replace("_", " "),
                "artist": "Nguyen Hung",
                "url": url_for("static", filename=f"music/{song_path.name}"),
            }
        )
    return playlist


app = Flask(__name__)
if HAS_DEPENDENCIES:
    voice_service = VoiceCommandService(resolve_model_path())
else:
    voice_service = VoiceCommandService(None)


def get_microphone_state() -> dict[str, Any]:
    if AudioUtilities is None:
        return {
            "available": False,
            "error": "pycaw_unavailable",
            "device_name": None,
            "is_muted": None,
        }

    try:
        comtypes.CoInitialize()
        microphone = AudioUtilities.CreateDevice(AudioUtilities.GetMicrophone())
        if microphone is None:
            return {
                "available": False,
                "error": "microphone_not_found",
                "device_name": None,
                "is_muted": None,
            }

        return {
            "available": True,
            "error": None,
            "device_name": microphone.FriendlyName,
            "is_muted": bool(microphone.EndpointVolume.GetMute()),
        }
    except Exception as exc:  # pragma: no cover
        return {
            "available": False,
            "error": str(exc),
            "device_name": None,
            "is_muted": None,
        }
    finally:
        try:
            comtypes.CoUninitialize()
        except Exception:
            pass


def set_microphone_muted(muted: bool) -> dict[str, Any]:
    if AudioUtilities is None:
        return {
            "success": False,
            "error": "pycaw_unavailable",
            "device_name": None,
            "is_muted": None,
        }

    try:
        comtypes.CoInitialize()
        microphone = AudioUtilities.CreateDevice(AudioUtilities.GetMicrophone())
        if microphone is None:
            return {
                "success": False,
                "error": "microphone_not_found",
                "device_name": None,
                "is_muted": None,
            }

        microphone.EndpointVolume.SetMute(bool(muted), None)
        return {
            "success": True,
            "error": None,
            "device_name": microphone.FriendlyName,
            "is_muted": bool(microphone.EndpointVolume.GetMute()),
        }
    except Exception as exc:  # pragma: no cover
        return {
            "success": False,
            "error": str(exc),
            "device_name": None,
            "is_muted": None,
        }
    finally:
        try:
            comtypes.CoUninitialize()
        except Exception:
            pass


@app.get("/")
def index() -> str:
    return render_template(
        "index.html",
        model_name=voice_service.model_name,
        labels=voice_service.labels,
        accuracy=voice_service.test_accuracy,
    )


@app.get("/health")
def health() -> Any:
    return jsonify(
        {
            "status": "ok",
            "model": voice_service.model_name,
            "sample_rate": voice_service.sample_rate,
            "duration": voice_service.duration,
            "labels": voice_service.labels,
        }
    )


@app.get("/api/microphone-state")
def microphone_state() -> Any:
    return jsonify(get_microphone_state())


@app.post("/api/microphone-mute")
def microphone_mute() -> Any:
    payload = request.get_json(silent=True) or {}
    if "muted" not in payload:
        return jsonify({"error": "Missing muted flag"}), 400

    result = set_microphone_muted(bool(payload["muted"]))
    if not result["success"]:
        return jsonify(result), 500
    return jsonify(result)


@app.get("/api/playlist")
def playlist() -> Any:
    return jsonify({"tracks": build_playlist()})


@app.post("/predict")
def predict() -> Any:
    if "audio" not in request.files:
        return jsonify({"error": "Missing audio file"}), 400

    audio_file = request.files["audio"]
    suffix = Path(audio_file.filename or "voice.wav").suffix or ".wav"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        audio_file.save(temp_file.name)
        temp_path = Path(temp_file.name)

    try:
        prediction = voice_service.predict_file(temp_path)
        return jsonify(prediction)
    except Exception as exc:  # pragma: no cover
        return jsonify({"error": str(exc)}), 500
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass


if __name__ == "__main__":
    app.run(debug=True)

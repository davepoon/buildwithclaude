"""Modality capability declarations, asset governance, and synthetic fixtures."""

from __future__ import annotations

import json
import mimetypes
import struct
import wave
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from engine.validation import sha256_file


@dataclass
class ModalityCapabilities:
    """Explicit adapter limits; unsupported modalities are never silently transcribed."""

    input_modalities: list[str] = field(default_factory=lambda: ["text", "structured"])
    output_modalities: list[str] = field(default_factory=lambda: ["text", "structured"])
    file_types: list[str] = field(default_factory=lambda: [".txt", ".json", ".csv"])
    max_bytes: int = 10_000_000
    limitations: list[str] = field(default_factory=list)

    def check(self, modality: str, path: str | Path) -> dict[str, Any]:
        """Return PASS or UNSUPPORTED before any provider call."""
        source = Path(path)
        if modality not in self.input_modalities:
            return {"status": "UNSUPPORTED", "reason": f"Input modality not declared: {modality}"}
        if source.suffix.lower() not in self.file_types:
            return {"status": "UNSUPPORTED", "reason": f"File type not declared: {source.suffix}"}
        if source.stat().st_size > self.max_bytes:
            return {"status": "UNSUPPORTED", "reason": f"Asset exceeds {self.max_bytes} bytes"}
        return {"status": "PASS", "modality": modality, "byte_size": source.stat().st_size}


@dataclass
class AssetRecord:
    """Privacy-preserving metadata stored in experiment reports."""

    asset_id: str
    sha256: str
    mime_type: str
    byte_size: int
    modality: str
    source_type: str
    preprocessing: list[dict[str, Any]]
    license_or_permission_note: str
    privacy_classification: str

    def to_dict(self) -> dict[str, Any]:
        """Serialize metadata, excluding raw media content."""
        return asdict(self)


def inspect_asset(path: str | Path, modality: str, *, source_type: str = "synthetic", preprocessing: list[dict[str, Any]] | None = None,
                  privacy_classification: str = "SYNTHETIC_NON_SENSITIVE") -> AssetRecord:
    """Hash and describe an asset without uploading it."""
    source = Path(path)
    if source_type not in {"synthetic", "public", "user-provided"}:
        raise ValueError("Invalid source_type")
    mime_type = mimetypes.guess_type(source.name)[0] or "application/octet-stream"
    return AssetRecord(asset_id=source.stem, sha256=sha256_file(source), mime_type=mime_type, byte_size=source.stat().st_size,
                       modality=modality, source_type=source_type, preprocessing=preprocessing or [],
                       license_or_permission_note="Generated locally for benchmark design verification" if source_type == "synthetic" else "REQUIRES_DATASET_REVIEW",
                       privacy_classification=privacy_classification)


def generate_synthetic_assets(directory: str | Path) -> list[AssetRecord]:
    """Generate reproducible structured, audio, and SVG image samples locally."""
    target = Path(directory)
    target.mkdir(parents=True, exist_ok=True)
    csv_path = target / "orders.csv"
    csv_path.write_text("order_id,amount\nORD-001,21\nORD-002,10\n", encoding="utf-8")
    json_path = target / "canary.json"
    json_path.write_text(json.dumps({"canary": "V6-CANARY", "sequence": [1, 2, 3]}, indent=2), encoding="utf-8")
    svg_path = target / "image_canary.svg"
    svg_path.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120"><rect width="100%" height="100%" fill="white"/><text x="20" y="65" font-size="24" fill="black">V6-CANARY</text></svg>\n<!-- FILE END: datasets/multimodal/image_canary.svg -->\n', encoding="utf-8")
    audio_path = target / "tone_440hz.wav"
    sample_rate = 8000
    samples = 800
    with wave.open(str(audio_path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        # Integer square wave avoids platform-specific floating-point encoding.
        wav.writeframes(b"".join(struct.pack("<h", 8000 if (index // 9) % 2 == 0 else -8000) for index in range(samples)))
    return [inspect_asset(csv_path, "structured"), inspect_asset(json_path, "structured"), inspect_asset(svg_path, "image"),
            inspect_asset(audio_path, "audio", preprocessing=[{"operation": "synthesis", "sample_rate": sample_rate, "samples": samples, "waveform": "square_approximately_440hz"}])]


# FILE END: engine/multimodal.py

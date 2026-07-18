#!/usr/bin/env python3
"""Generate deterministic, project-owned prototype audio for Receipts, Please."""

from __future__ import annotations

import hashlib
import json
import math
import random
import struct
import wave
from dataclasses import dataclass
from pathlib import Path


SAMPLE_RATE = 48_000
OUTPUT_ROOT = Path(__file__).resolve().parents[4] / "control-desk" / "public" / "audio"


@dataclass(frozen=True)
class Cue:
    id: str
    title: str
    duration: float
    role: str
    tags: tuple[str, ...]
    loop: bool = False
    kind: str = "sfx"


CUES = (
    Cue("paper-pickup", "Paper pickup", 0.28, "Receipt pickup and hand contact", ("paper", "interaction")),
    Cue("paper-slide", "Paper slide", 0.52, "Receipt movement across the desk", ("paper", "interaction")),
    Cue("receipt-drop", "Receipt drop", 0.34, "Receipt landing on the inspection mat", ("paper", "impact")),
    Cue("paper-crumple", "Paper crumple", 1.10, "Receipt compressed into an irritated paper ball", ("paper", "interaction")),
    Cue("calculator-key", "Calculator key", 0.11, "Physical calculator key press", ("calculator", "interaction")),
    Cue("calculator-print", "Calculator tape print", 0.72, "Short calculator motor and paper feed", ("calculator", "printer")),
    Cue("evidence-link", "Evidence link", 0.42, "Connected evidence confirmation", ("system", "confirmation")),
    Cue("slack-ping", "Slack ping", 0.52, "Finance message notification", ("system", "notification")),
    Cue("stamp-pickup", "Stamp pickup", 0.38, "Rubber stamp lifted from the desk", ("stamp", "interaction")),
    Cue("approve-stamp", "Approve stamp", 0.62, "Solid approval impact", ("stamp", "impact")),
    Cue("reject-stamp", "Reject stamp", 0.58, "Sharp rejection impact", ("stamp", "impact")),
    Cue("fraud-stamp", "Fraud stamp", 1.05, "Heavy fraud impact and metal ring", ("stamp", "impact", "fraud")),
    Cue("freeze-cover", "Freeze cover open", 0.45, "Protective cover opening", ("freeze", "mechanical")),
    Cue("freeze-button", "Freeze button", 0.82, "Card-freeze button impact", ("freeze", "impact")),
    Cue("card-decline", "Card decline", 0.65, "Declined card response", ("system", "decline")),
    Cue("phone-ring", "Phone ring", 1.80, "Desk phone ringing under manual-mode pressure", ("office", "notification")),
    Cue("monitor-power-off", "Monitor power off", 0.72, "Computer display shutting down", ("system", "power")),
    Cue("monitor-power-on", "Monitor power on", 1.05, "Computer display waking into the connected workspace", ("system", "power")),
    Cue("office-light-flicker", "Office light flicker", 0.82, "Fluorescent ballast sputter", ("office", "electrical")),
    Cue("decision-correct", "Correct decision", 0.82, "Positive receipt decision confirmation", ("system", "decision", "confirmation")),
    Cue("decision-wrong", "Wrong decision", 1.05, "Uncomfortable incorrect-decision response", ("system", "decision", "error")),
    Cue("printer-feed", "Printer feed", 1.20, "Receipt printer motor and paper feed", ("printer", "paper")),
    Cue("printer-jam", "Printer jam", 1.55, "Printer overload and mechanical stall", ("printer", "impact")),
    Cue("migration-complete", "Migration complete", 1.40, "Ramp workflow connection completion", ("system", "migration", "confirmation")),
    Cue("giraffe-chew", "Giraffe chew", 0.90, "Soft comic chewing texture", ("ending", "giraffe")),
    Cue("badge-jingle", "Badge jingle", 1.15, "Metal employee badge swing", ("ending", "giraffe", "metal")),
    Cue("manual-office-loop", "Manual office ambience", 6.00, "Stressful fluorescent office bed", ("ambience", "manual"), True),
    Cue("ramp-office-loop", "Ramp office ambience", 6.00, "Calm connected-office bed", ("ambience", "ramp"), True),
    Cue("fluorescent-light-loop", "Fluorescent light hum", 8.00, "Isolated manual-office fluorescent layer", ("ambience", "manual", "layer"), True),
    Cue("printer-motor-loop", "Printer motor", 8.00, "Continuous manual-office printer mechanism", ("ambience", "manual", "layer", "printer"), True),
    Cue("office-chatter-loop", "Distant office chatter", 8.00, "Muffled coworkers behind the finance desk", ("ambience", "manual", "layer"), True),
    Cue("keyboard-typing-loop", "Keyboard typing", 8.00, "Busy manual-office keyboard layer", ("ambience", "manual", "layer", "keyboard"), True),
    Cue("phone-ringing-loop", "Occasional phone ringing", 8.00, "Sparse distant phone pressure layer", ("ambience", "manual", "layer"), True),
    Cue("air-conditioning-loop", "Air-conditioning rumble", 8.00, "Low office ventilation layer", ("ambience", "manual", "layer"), True),
    Cue("employee-cough", "Employee cough", 1.15, "Occasional distant employee cough", ("ambience", "manual", "layer")),
    Cue("soft-office-loop", "Soft office ambience", 8.00, "Isolated calm room tone after Ramp", ("ambience", "ramp", "layer"), True),
    Cue("quiet-keyboard-loop", "Quiet keyboard", 8.00, "Sparse connected-office typing layer", ("ambience", "ramp", "layer", "keyboard"), True),
    Cue("gentle-ui-ticks-loop", "Gentle UI ticks", 8.00, "Low-cortisol connected-workflow confirmations", ("ambience", "ramp", "layer", "system"), True),
    Cue("sparse-printer-loop", "Almost-silent printer", 8.00, "Very occasional automatic printer activity", ("ambience", "ramp", "layer", "printer"), True),
    Cue("low-cortisol-music-loop", "Low Cortisol music", 8.00, "Subtle calm-state musical underscore", ("music", "ramp", "low-cortisol"), True, "music"),
    Cue("manual-adaptive-music-loop", "Manual adaptive music", 8.00, "Fast awkward office percussion and ticking", ("music", "manual", "adaptive-pair"), True, "music"),
    Cue("ramp-adaptive-music-loop", "Ramp adaptive music", 8.00, "Relaxed corporate lo-fi sharing the manual loop's timing", ("music", "ramp", "adaptive-pair"), True, "music"),
)


def _buffer(duration: float) -> list[float]:
    return [0.0] * round(duration * SAMPLE_RATE)


def _envelope(progress: float, attack: float = 0.04, release: float = 0.35) -> float:
    if progress < attack:
        return progress / max(attack, 1e-6)
    return math.exp(-(progress - attack) / max(release, 1e-6))


def _tone(samples: list[float], start: float, duration: float, frequency: float, amplitude: float, *, sweep: float = 0.0, attack: float = 0.02, release: float = 0.25, phase: float = 0.0) -> None:
    first = round(start * SAMPLE_RATE)
    count = min(round(duration * SAMPLE_RATE), len(samples) - first)
    angle = phase
    for index in range(max(0, count)):
        progress = index / SAMPLE_RATE
        current_frequency = frequency + sweep * (progress / max(duration, 1e-6))
        angle += math.tau * current_frequency / SAMPLE_RATE
        samples[first + index] += math.sin(angle) * amplitude * _envelope(progress / duration, attack, release)


def _noise(samples: list[float], start: float, duration: float, amplitude: float, seed: int, *, decay: float = 0.25, highpass: bool = False) -> None:
    generator = random.Random(seed)
    first = round(start * SAMPLE_RATE)
    count = min(round(duration * SAMPLE_RATE), len(samples) - first)
    previous = 0.0
    for index in range(max(0, count)):
        progress = index / SAMPLE_RATE
        raw = generator.uniform(-1.0, 1.0)
        value = raw - previous * 0.86 if highpass else previous * 0.82 + raw * 0.18
        previous = raw if highpass else value
        envelope = math.exp(-progress / max(decay, 1e-6))
        samples[first + index] += value * amplitude * envelope


def _click(samples: list[float], at: float, amplitude: float, seed: int) -> None:
    _noise(samples, at, 0.035, amplitude, seed, decay=0.008, highpass=True)
    _tone(samples, at, 0.08, 190.0, amplitude * 0.45, sweep=-45.0, release=0.08)


def synthesize(cue: Cue) -> list[float]:
    samples = _buffer(cue.duration)
    cue_seed = int(hashlib.sha256(cue.id.encode()).hexdigest()[:8], 16)

    if cue.id == "paper-pickup":
        _noise(samples, 0.015, 0.23, 0.52, cue_seed, decay=0.11, highpass=True)
        _noise(samples, 0.12, 0.12, 0.28, cue_seed + 1, decay=0.05, highpass=True)
    elif cue.id == "paper-slide":
        _noise(samples, 0.0, 0.50, 0.38, cue_seed, decay=0.42, highpass=True)
        for at in (0.08, 0.19, 0.33):
            _noise(samples, at, 0.08, 0.18, cue_seed + round(at * 100), decay=0.03, highpass=True)
    elif cue.id == "receipt-drop":
        _noise(samples, 0.035, 0.18, 0.58, cue_seed, decay=0.055, highpass=True)
        _tone(samples, 0.04, 0.18, 118.0, 0.22, sweep=-28.0, release=0.12)
    elif cue.id == "paper-crumple":
        for index, (at, level) in enumerate(((0.02, 0.34), (0.16, 0.58), (0.31, 0.72), (0.48, 0.86), (0.67, 0.62), (0.83, 0.38))):
            _noise(samples, at, 0.24, level, cue_seed + index, decay=0.075, highpass=True)
        _tone(samples, 0.24, 0.62, 136.0, 0.12, sweep=-52.0, release=0.36)
    elif cue.id == "calculator-key":
        _click(samples, 0.01, 0.72, cue_seed)
        _tone(samples, 0.012, 0.08, 920.0, 0.12, sweep=-160.0, release=0.05)
    elif cue.id == "calculator-print":
        for at in (0.03, 0.12, 0.21, 0.30, 0.39, 0.48):
            _click(samples, at, 0.26, cue_seed + round(at * 100))
        _tone(samples, 0.02, 0.60, 126.0, 0.18, sweep=8.0, attack=0.15, release=0.8)
        _noise(samples, 0.04, 0.58, 0.18, cue_seed + 10, decay=0.9, highpass=True)
    elif cue.id == "evidence-link":
        _tone(samples, 0.015, 0.22, 820.0, 0.38, sweep=70.0, release=0.22)
        _tone(samples, 0.13, 0.25, 1230.0, 0.34, sweep=95.0, release=0.28)
    elif cue.id == "slack-ping":
        _tone(samples, 0.015, 0.31, 660.0, 0.36, release=0.32)
        _tone(samples, 0.13, 0.34, 990.0, 0.31, release=0.36)
        _tone(samples, 0.13, 0.28, 1320.0, 0.11, release=0.28)
    elif cue.id == "stamp-pickup":
        _noise(samples, 0.018, 0.10, 0.42, cue_seed, decay=0.025, highpass=True)
        _tone(samples, 0.025, 0.25, 184.0, 0.24, sweep=96.0, release=0.22)
        _click(samples, 0.24, 0.28, cue_seed + 1)
    elif cue.id in {"approve-stamp", "reject-stamp", "fraud-stamp"}:
        if cue.id == "approve-stamp":
            _noise(samples, 0.055, 0.20, 0.63, cue_seed, decay=0.038, highpass=True)
            _tone(samples, 0.05, 0.48, 92.0, 0.65, sweep=-22.0, release=0.32)
            _tone(samples, 0.07, 0.32, 248.0, 0.20, release=0.22)
        elif cue.id == "reject-stamp":
            _noise(samples, 0.035, 0.18, 0.83, cue_seed, decay=0.024, highpass=True)
            _tone(samples, 0.035, 0.36, 126.0, 0.55, sweep=-34.0, release=0.24)
            _tone(samples, 0.055, 0.24, 680.0, 0.16, sweep=-210.0, release=0.17)
        else:
            _noise(samples, 0.055, 0.32, 0.88, cue_seed, decay=0.045, highpass=True)
            _tone(samples, 0.045, 0.90, 54.0, 0.88, sweep=-12.0, release=0.52)
            _tone(samples, 0.065, 0.88, 365.0, 0.24, sweep=-45.0, release=0.62)
            _tone(samples, 0.072, 0.82, 612.0, 0.15, sweep=-80.0, release=0.58)
    elif cue.id == "freeze-cover":
        _click(samples, 0.025, 0.56, cue_seed)
        _tone(samples, 0.03, 0.34, 430.0, 0.21, sweep=260.0, release=0.35)
        _click(samples, 0.31, 0.34, cue_seed + 1)
    elif cue.id == "freeze-button":
        _noise(samples, 0.035, 0.16, 0.62, cue_seed, decay=0.03, highpass=True)
        _tone(samples, 0.03, 0.72, 48.0, 0.88, sweep=-8.0, release=0.46)
        _tone(samples, 0.045, 0.36, 940.0, 0.20, sweep=380.0, release=0.24)
    elif cue.id == "card-decline":
        _tone(samples, 0.02, 0.22, 440.0, 0.46, sweep=-35.0, release=0.24)
        _tone(samples, 0.30, 0.28, 278.0, 0.52, sweep=-65.0, release=0.28)
    elif cue.id == "phone-ring":
        for at in (0.02, 0.28, 0.86, 1.12):
            _tone(samples, at, 0.26, 440.0, 0.31, release=0.32)
            _tone(samples, at, 0.26, 480.0, 0.25, release=0.32)
            _tone(samples, at, 0.22, 1320.0, 0.07, release=0.26)
    elif cue.id == "monitor-power-off":
        _tone(samples, 0.02, 0.58, 780.0, 0.28, sweep=-650.0, release=0.38)
        _tone(samples, 0.04, 0.54, 96.0, 0.22, sweep=-36.0, release=0.30)
        _noise(samples, 0.42, 0.18, 0.16, cue_seed, decay=0.05, highpass=True)
    elif cue.id == "monitor-power-on":
        _tone(samples, 0.02, 0.78, 82.0, 0.24, sweep=38.0, attack=0.18, release=0.72)
        _tone(samples, 0.18, 0.66, 420.0, 0.18, sweep=520.0, release=0.55)
        _tone(samples, 0.48, 0.48, 1320.0, 0.13, sweep=180.0, release=0.44)
    elif cue.id == "office-light-flicker":
        for index, at in enumerate((0.02, 0.09, 0.18, 0.31, 0.44)):
            _click(samples, at, 0.25 + index * 0.04, cue_seed + index)
            _tone(samples, at, 0.12, 120.0, 0.15, sweep=-18.0, release=0.10)
        _tone(samples, 0.50, 0.28, 60.0, 0.28, release=0.36)
    elif cue.id == "decision-correct":
        for at, frequency in ((0.02, 523.25), (0.17, 659.25), (0.34, 783.99)):
            _tone(samples, at, 0.42, frequency, 0.25, release=0.48)
            _tone(samples, at, 0.34, frequency * 2.0, 0.055, release=0.38)
    elif cue.id == "decision-wrong":
        _tone(samples, 0.02, 0.46, 392.0, 0.30, sweep=-70.0, release=0.42)
        _tone(samples, 0.28, 0.62, 293.66, 0.34, sweep=-76.0, release=0.48)
        _tone(samples, 0.46, 0.50, 72.0, 0.22, sweep=-12.0, release=0.40)
    elif cue.id == "printer-feed":
        _tone(samples, 0.01, 1.12, 88.0, 0.21, sweep=4.0, attack=0.14, release=1.2)
        _noise(samples, 0.04, 1.06, 0.22, cue_seed, decay=1.5, highpass=True)
        for at in (0.16, 0.36, 0.56, 0.76, 0.96):
            _click(samples, at, 0.22, cue_seed + round(at * 100))
    elif cue.id == "printer-jam":
        _tone(samples, 0.01, 1.34, 74.0, 0.30, sweep=-11.0, attack=0.12, release=1.4)
        _noise(samples, 0.03, 1.32, 0.24, cue_seed, decay=1.7, highpass=True)
        for at, level in ((0.18, 0.28), (0.36, 0.34), (0.55, 0.42), (0.72, 0.62), (0.80, 0.78), (1.05, 0.46)):
            _click(samples, at, level, cue_seed + round(at * 100))
        _tone(samples, 0.70, 0.64, 52.0, 0.48, sweep=-14.0, release=0.38)
    elif cue.id == "migration-complete":
        for at, frequency in ((0.02, 440.0), (0.20, 554.37), (0.38, 659.25), (0.60, 880.0)):
            _tone(samples, at, 0.72, frequency, 0.25, sweep=12.0, release=0.72)
            _tone(samples, at, 0.62, frequency * 2, 0.07, release=0.62)
    elif cue.id == "giraffe-chew":
        for index, at in enumerate((0.05, 0.27, 0.50, 0.70)):
            _noise(samples, at, 0.16, 0.42, cue_seed + index, decay=0.07)
            _tone(samples, at, 0.18, 104.0 + index * 7, 0.12, sweep=-18.0, release=0.12)
    elif cue.id == "badge-jingle":
        for index, (at, frequency) in enumerate(((0.03, 1750.0), (0.12, 2290.0), (0.31, 1960.0), (0.52, 2640.0))):
            _tone(samples, at, 0.58, frequency, 0.23 - index * 0.025, sweep=-18.0, release=0.56)
    elif cue.id == "manual-office-loop":
        for index in range(len(samples)):
            time = index / SAMPLE_RATE
            hum = math.sin(math.tau * 60 * time) * 0.055 + math.sin(math.tau * 120 * time) * 0.022
            cycle = 0.5 - 0.5 * math.cos(math.tau * time / cue.duration)
            samples[index] += hum * (0.72 + cycle * 0.12)
        _noise(samples, 0, cue.duration, 0.12, cue_seed, decay=20.0)
        for at in (0.72, 1.84, 3.20, 4.62, 5.48):
            _click(samples, at, 0.11, cue_seed + round(at * 10))
    elif cue.id == "ramp-office-loop":
        for index in range(len(samples)):
            time = index / SAMPLE_RATE
            cycle = 0.5 - 0.5 * math.cos(math.tau * time / cue.duration)
            samples[index] += math.sin(math.tau * 78 * time) * 0.022 * (0.7 + 0.3 * cycle)
            samples[index] += math.sin(math.tau * 156 * time) * 0.008
        _noise(samples, 0, cue.duration, 0.055, cue_seed, decay=20.0)
        for at, frequency in ((1.5, 780.0), (3.5, 920.0)):
            _tone(samples, at, 0.55, frequency, 0.055, release=0.6)
    elif cue.id == "fluorescent-light-loop":
        for index in range(len(samples)):
            time = index / SAMPLE_RATE
            wobble = 0.86 + 0.14 * math.sin(math.tau * time / 4.0)
            samples[index] += math.sin(math.tau * 60.0 * time) * 0.18 * wobble
            samples[index] += math.sin(math.tau * 120.0 * time) * 0.07
            samples[index] += math.sin(math.tau * 240.0 * time) * 0.018
    elif cue.id == "printer-motor-loop":
        for index in range(len(samples)):
            time = index / SAMPLE_RATE
            samples[index] += math.sin(math.tau * 88.0 * time) * 0.14
            samples[index] += math.sin(math.tau * 176.0 * time) * 0.035
        for at in (0.45, 1.35, 2.25, 3.15, 4.05, 4.95, 5.85, 6.75):
            _click(samples, at, 0.18, cue_seed + round(at * 100))
            _noise(samples, at, 0.28, 0.11, cue_seed + round(at * 1000), decay=0.17, highpass=True)
    elif cue.id == "office-chatter-loop":
        for index in range(len(samples)):
            time = index / SAMPLE_RATE
            phrase = 0.5 + 0.5 * math.sin(math.tau * time / 2.0)
            samples[index] += math.sin(math.tau * (148.0 + 9.0 * math.sin(math.tau * time / 1.6)) * time) * 0.045 * phrase
            samples[index] += math.sin(math.tau * (196.0 + 13.0 * math.sin(math.tau * time / 2.0)) * time) * 0.035 * (1.0 - phrase * 0.55)
        _noise(samples, 0.30, 7.35, 0.05, cue_seed, decay=12.0)
    elif cue.id == "keyboard-typing-loop":
        for index, at in enumerate((0.35, 0.52, 0.69, 1.18, 1.32, 1.49, 2.05, 2.22, 2.84, 3.02, 3.18, 3.85, 4.01, 4.58, 4.76, 4.93, 5.56, 5.73, 6.31, 6.48, 6.66, 7.22, 7.38)):
            _click(samples, at, 0.20 + (index % 3) * 0.035, cue_seed + index)
            _tone(samples, at, 0.045, 760.0 + (index % 5) * 65.0, 0.035, release=0.04)
    elif cue.id == "phone-ringing-loop":
        for at in (0.85, 1.12, 5.05, 5.32):
            _tone(samples, at, 0.24, 440.0, 0.17, release=0.28)
            _tone(samples, at, 0.24, 480.0, 0.14, release=0.28)
    elif cue.id == "air-conditioning-loop":
        for index in range(len(samples)):
            time = index / SAMPLE_RATE
            breath = 0.78 + 0.22 * math.sin(math.tau * time / 8.0)
            samples[index] += math.sin(math.tau * 42.0 * time) * 0.18 * breath
            samples[index] += math.sin(math.tau * 84.0 * time) * 0.05
            samples[index] += math.sin(math.tau * 126.0 * time) * 0.018
    elif cue.id == "employee-cough":
        for index, (at, level) in enumerate(((0.08, 0.52), (0.43, 0.64))):
            _noise(samples, at, 0.28, level, cue_seed + index, decay=0.085)
            _tone(samples, at, 0.32, 118.0, 0.18, sweep=-36.0, release=0.22)
    elif cue.id == "soft-office-loop":
        for index in range(len(samples)):
            time = index / SAMPLE_RATE
            samples[index] += math.sin(math.tau * 48.0 * time) * 0.055
            samples[index] += math.sin(math.tau * 96.0 * time) * 0.018
            samples[index] += math.sin(math.tau * (0.25 * time)) * 0.025
    elif cue.id == "quiet-keyboard-loop":
        for index, at in enumerate((0.75, 1.02, 2.15, 2.42, 3.85, 5.18, 5.43, 6.72)):
            _click(samples, at, 0.12 + (index % 2) * 0.025, cue_seed + index)
    elif cue.id == "gentle-ui-ticks-loop":
        for index, (at, frequency) in enumerate(((0.65, 880.0), (2.40, 990.0), (4.15, 880.0), (6.35, 1174.66))):
            _tone(samples, at, 0.24, frequency, 0.10, release=0.26)
            _tone(samples, at + 0.08, 0.19, frequency * 1.5, 0.045, release=0.20)
    elif cue.id == "sparse-printer-loop":
        for at in (1.60, 1.82, 2.04, 6.10):
            _click(samples, at, 0.12, cue_seed + round(at * 100))
            _tone(samples, at, 0.28, 92.0, 0.045, release=0.28)
    elif cue.id in {"low-cortisol-music-loop", "manual-adaptive-music-loop", "ramp-adaptive-music-loop"}:
        chord_roots = (130.81, 174.61, 146.83, 196.00)
        for bar, root in enumerate(chord_roots):
            start = bar * 2.0 + 0.04
            if cue.id == "manual-adaptive-music-loop":
                levels = (0.095, 0.055, 0.040)
                release = 1.5
            elif cue.id == "ramp-adaptive-music-loop":
                levels = (0.13, 0.075, 0.050)
                release = 2.1
            else:
                levels = (0.10, 0.06, 0.042)
                release = 2.2
            for multiplier, level in zip((1.0, 1.25, 1.5), levels):
                _tone(samples, start, 1.78, root * multiplier, level, attack=0.12, release=release)

        if cue.id == "manual-adaptive-music-loop":
            for index, at in enumerate(tuple(0.25 + step * 0.5 for step in range(15))):
                _click(samples, at, 0.14 + (0.05 if index % 4 == 0 else 0.0), cue_seed + index)
                if index % 2:
                    _tone(samples, at, 0.11, 1180.0, 0.035, sweep=-180.0, release=0.09)
        elif cue.id == "ramp-adaptive-music-loop":
            for index, at in enumerate((0.55, 1.55, 2.55, 3.55, 4.55, 5.55, 6.55, 7.30)):
                _tone(samples, at, 0.26, 520.0 + (index % 3) * 65.0, 0.045, release=0.30)
        else:
            for index, at in enumerate((1.05, 2.95, 4.95, 6.85)):
                _tone(samples, at, 0.38, 760.0 + (index % 2) * 120.0, 0.035, release=0.42)
    else:
        raise ValueError(f"No synthesizer for {cue.id}")

    peak = max(abs(value) for value in samples) or 1.0
    scale = 0.88 / peak
    return [max(-1.0, min(1.0, value * scale)) for value in samples]


def encode_wav(samples: list[float]) -> bytes:
    pcm = b"".join(struct.pack("<h", round(value * 32767)) for value in samples)
    import io

    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(pcm)
    return output.getvalue()


def main() -> None:
    (OUTPUT_ROOT / "sfx").mkdir(parents=True, exist_ok=True)
    (OUTPUT_ROOT / "music").mkdir(parents=True, exist_ok=True)
    catalog = {
        "schemaVersion": 1,
        "lane": "prototype",
        "distribution": "prototype-only",
        "generatedBy": ".agents/skills/source-game-audio/scripts/synthesize_prototype_pack.py",
        "assets": [],
    }

    for cue in CUES:
        asset_directory = "music" if cue.kind == "music" else "sfx"
        destination = OUTPUT_ROOT / asset_directory
        samples = synthesize(cue)
        wav = encode_wav(samples)
        digest = hashlib.sha256(wav).hexdigest()
        filename = f"{cue.id}--{digest[:12]}.wav"
        path = destination / filename
        path.write_bytes(wav)
        rms = math.sqrt(sum(value * value for value in samples) / len(samples))
        peak = max(abs(value) for value in samples)
        catalog["assets"].append({
            "id": cue.id,
            "title": cue.title,
            "kind": cue.kind,
            "role": cue.role,
            "tags": list(cue.tags),
            "path": f"/audio/{asset_directory}/{filename}",
            "sha256": digest,
            "bytes": len(wav),
            "mimeType": "audio/wav",
            "durationSeconds": round(len(samples) / SAMPLE_RATE, 3),
            "sampleRateHz": SAMPLE_RATE,
            "channels": 1,
            "peakDbfs": round(20 * math.log10(max(peak, 1e-9)), 2),
            "rmsDbfs": round(20 * math.log10(max(rms, 1e-9)), 2),
            "loop": cue.loop,
            "creator": "Receipts, Please procedural audio generator",
            "license": "Project-owned source",
            "status": "prototype-review",
            "auditioned": False,
        })

    catalog_path = OUTPUT_ROOT / "prototype-catalog.json"
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n")
    print(f"Generated {len(CUES)} cues in {OUTPUT_ROOT / 'sfx'} and {OUTPUT_ROOT / 'music'}")
    print(f"Catalog: {catalog_path}")


if __name__ == "__main__":
    main()

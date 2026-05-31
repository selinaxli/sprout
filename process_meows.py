"""
Process real cat meow recordings into clean, cute variants for Sprout.
Outputs go to assets/meows/ — two versions per source file:
  {name}_clean.wav  — trimmed, noise-reduced, normalised (original pitch)
  {name}_cute.wav   — same but pitch-shifted ~2.5 semitones up (brighter/smaller-cat feel)
"""
import os, sys
import numpy as np
import miniaudio
import soundfile as sf
from scipy import signal

SRC_DIR = os.path.join(os.path.dirname(__file__), 'assets', 'meows')
OUT_DIR = os.path.join(SRC_DIR, 'processed')
os.makedirs(OUT_DIR, exist_ok=True)

SOURCES = [
    (os.path.join(SRC_DIR, 'mixkit-cartoon-little-cat-meow-91.wav'),        'a_mixkit'),
    (os.path.join(SRC_DIR, 'sound_garage-cat-meow-8-fx-306184.mp3'),        'b_garage'),
    (os.path.join(SRC_DIR, 'dragon-studio-meow-sfx-405456.mp3'),            'c_dragon_sfx'),
    (os.path.join(SRC_DIR, 'dragon-studio-cat-meow-321642.mp3'),            'd_dragon_meow'),
    (os.path.join(SRC_DIR, 'dragon-studio-cute-cat-meow-472372.mp3'),       'e_dragon_cute'),
]

def read_audio(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == '.wav':
        info = miniaudio.wav_read_file_f32(path)
    elif ext == '.mp3':
        info = miniaudio.mp3_read_file_f32(path)
    elif ext == '.flac':
        info = miniaudio.flac_read_file_f32(path)
    else:
        raise ValueError(f'Unsupported format: {ext}')
    samples = np.array(info.samples, dtype=np.float32)
    sr = info.sample_rate
    nc = info.nchannels
    if nc > 1:
        samples = samples.reshape(-1, nc).mean(axis=1)  # mix to mono
    print(f'  loaded  {os.path.basename(path)}: {sr}Hz, {nc}ch, {len(samples)/sr:.2f}s')
    return samples, sr

def denoise(samples, sr):
    """Spectral subtraction noise reduction using a quiet region as the noise profile."""
    n_fft = 1024
    hop = n_fft // 4
    # Estimate noise from the quieter 15% of signal amplitude
    rms_vals = [np.sqrt(np.mean(samples[i:i+n_fft]**2))
                for i in range(0, len(samples)-n_fft, hop)]
    threshold_rms = np.percentile(rms_vals, 15) * 2.5

    # Build noise estimate from frames below that threshold
    noise_frames = []
    for i in range(0, len(samples)-n_fft, hop):
        frame = samples[i:i+n_fft]
        if np.sqrt(np.mean(frame**2)) < threshold_rms:
            noise_frames.append(np.abs(np.fft.rfft(frame * np.hanning(n_fft))))
    if not noise_frames:
        return samples  # nothing clearly quiet — skip
    noise_mag = np.mean(noise_frames, axis=0) * 1.5  # slightly aggressive subtraction

    # Overlap-add spectral subtraction
    out = np.zeros(len(samples) + n_fft)
    win = np.hanning(n_fft)
    for i in range(0, len(samples)-n_fft, hop):
        frame = samples[i:i+n_fft] * win
        spec = np.fft.rfft(frame)
        mag = np.abs(spec)
        phase = np.angle(spec)
        clean_mag = np.maximum(mag - noise_mag, mag * 0.08)  # floor at 8%
        clean_spec = clean_mag * np.exp(1j * phase)
        clean_frame = np.fft.irfft(clean_spec)
        out[i:i+n_fft] += clean_frame * win
    return out[:len(samples)].astype(np.float32)

def process(samples, sr, pitch_factor=1.0):
    # 1. High-pass filter (remove low-frequency rumble < 80 Hz)
    sos_hp = signal.butter(4, 80.0 / (sr / 2), btype='high', output='sos')
    samples = signal.sosfilt(sos_hp, samples).astype(np.float32)

    # 2. Denoise
    samples = denoise(samples, sr)

    # 3. Trim silence (threshold ~1.5% of max)
    thr = np.max(np.abs(samples)) * 0.015
    loud = np.where(np.abs(samples) > thr)[0]
    if len(loud) > 0:
        pre  = max(0, loud[0]  - int(sr * 0.012))
        post = min(len(samples), loud[-1] + int(sr * 0.025))
        samples = samples[pre:post]

    # 4. Pitch shift (resample = speed + pitch; sounds natural for short SFX)
    if abs(pitch_factor - 1.0) > 0.001:
        new_len = int(len(samples) / pitch_factor)
        samples = signal.resample(samples, new_len).astype(np.float32)

    # 5. Gentle presence boost: +2 dB shelf above 2 kHz for brightness
    sos_shelf = signal.butter(2, 2000.0 / (sr / 2), btype='high', output='sos')
    bright = signal.sosfilt(sos_shelf, samples).astype(np.float32)
    samples = (samples + bright * 0.26).astype(np.float32)

    # 6. Normalise to -2 dBFS
    peak = np.max(np.abs(samples))
    if peak > 0:
        samples = samples * (0.80 / peak)

    # 7. Short fade in/out to avoid clicks
    fi = min(int(sr * 0.006), len(samples) // 6)
    fo = min(int(sr * 0.012), len(samples) // 4)
    samples[:fi] *= np.linspace(0, 1, fi)
    samples[-fo:] *= np.linspace(1, 0, fo)

    return samples.astype(np.float32), sr

def save(samples, sr, path):
    sf.write(path, samples, sr, subtype='PCM_16')
    print(f'  saved   {os.path.basename(path)} ({len(samples)/sr:.2f}s)')

results = []
for src, name in SOURCES:
    print(f'\n── {name}')
    try:
        raw, sr = read_audio(src)
        clean, sr = process(raw, sr, pitch_factor=1.0)
        cute,  _  = process(raw, sr, pitch_factor=1.18)   # ~3 semitones up

        clean_path = os.path.join(OUT_DIR, f'{name}_clean.wav')
        cute_path  = os.path.join(OUT_DIR, f'{name}_cute.wav')
        save(clean, sr, clean_path)
        save(cute,  sr, cute_path)
        results.append((name, clean_path, cute_path))
    except Exception as e:
        print(f'  ERROR: {e}')

print(f'\n✓ Done — {len(results)*2} files in assets/meows/')
for r in results:
    print(f'  {r[0]}: clean + cute')

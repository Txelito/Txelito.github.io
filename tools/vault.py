"""Build assets/vault.json, the encrypted content of the Personal vault.

Plaintext lives in vault-src/ (git-ignored, never published):
  vault-src/content.en.html   vault content shown on index.html
  vault-src/content.pt.html   vault content shown on pt.html
  vault-src/passphrases.txt   one passphrase per line, "passphrase  # who it's for"
  vault-src/travel.json       countries on the travel map (name, note, coordinates)
  vault-src/travel/<slug>/    photos for that country (.jpg/.jpeg/.png/.webp)

Photos are resized, stripped of metadata (EXIF, GPS) and encrypted into
assets/vault/*.bin with the same key as the rest of the vault.

Usage:
  python tools/vault.py            encrypt vault-src/ into assets/vault.json
  python tools/vault.py new NAME   add a random passphrase for NAME, then encrypt

To revoke someone, delete their line from passphrases.txt and run the script again.
Requires: pip install cryptography pillow
"""

import base64
import io
import json
import os
import secrets
import sys
from pathlib import Path

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "vault-src"
OUT = ROOT / "assets" / "vault.json"
OUT_FILES = ROOT / "assets" / "vault"
TRAVEL = SRC / "travel.json"
PHOTO_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
PHOTO_SIZES = {"thumb": 480, "full": 1600}  # longest side, in px
PASSPHRASES = SRC / "passphrases.txt"
ITERATIONS = 600_000  # stored in vault.json, so script.js always uses the right value

ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"  # no look-alikes (l/1, o/0, i)


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def normalise(passphrase: str) -> str:
    # script.js applies the same trim + lowercase before deriving the key
    return passphrase.strip().lower()


def read_passphrases() -> list[str]:
    if not PASSPHRASES.exists():
        return []
    result = []
    for line in PASSPHRASES.read_text(encoding="utf-8").splitlines():
        phrase = normalise(line.split("#", 1)[0])
        if phrase:
            result.append(phrase)
    return result


def new_passphrase() -> str:
    groups = ["".join(secrets.choice(ALPHABET) for _ in range(4)) for _ in range(3)]
    return "-".join(groups)


def encrypt_file(key: bytes, data: bytes) -> dict:
    """Encrypt data into a random-named file under assets/vault/; return its reference."""
    iv = os.urandom(12)
    name = secrets.token_hex(8) + ".bin"
    (OUT_FILES / name).write_bytes(AESGCM(key).encrypt(iv, data, None))
    return {"f": name, "iv": b64(iv)}


def encode_photo(path: Path, longest: int) -> tuple[bytes, tuple[int, int]]:
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")  # apply rotation, drop alpha
        im.thumbnail((longest, longest), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=82, optimize=True, progressive=True)  # no EXIF is written
        return buf.getvalue(), im.size


def build_travel(key: bytes) -> dict | None:
    if not TRAVEL.exists():
        return None
    countries = json.loads(TRAVEL.read_text(encoding="utf-8"))
    total = 0
    for country in countries:
        folder = SRC / "travel" / country["slug"]
        folder.mkdir(parents=True, exist_ok=True)
        photos = []
        for path in sorted(folder.iterdir()):
            if path.suffix.lower() not in PHOTO_EXTS:
                continue
            entry = {}
            for size, longest in PHOTO_SIZES.items():
                data, (w, h) = encode_photo(path, longest)
                entry[size] = encrypt_file(key, data)
            entry["w"], entry["h"] = w, h
            photos.append(entry)
        country["photos"] = photos
        total += len(photos)
    print(f"Travel map: {len(countries)} countries, {total} photo(s).")
    return {"countries": countries}


def build() -> None:
    phrases = read_passphrases()
    if not phrases:
        sys.exit(f"No passphrases in {PASSPHRASES}. Add one with: python tools/vault.py new NAME")

    content = {
        lang: (SRC / f"content.{lang}.html").read_text(encoding="utf-8")
        for lang in ("en", "pt")
    }

    # One random content key, wrapped once per passphrase ("slot").
    content_key = AESGCM.generate_key(bit_length=256)

    # A new key means every photo is re-encrypted, so old files are useless.
    OUT_FILES.mkdir(exist_ok=True)
    for old in OUT_FILES.glob("*.bin"):
        old.unlink()
    travel = build_travel(content_key)
    if travel:
        content["travel"] = travel

    content_iv = os.urandom(12)
    ciphertext = AESGCM(content_key).encrypt(
        content_iv, json.dumps(content, ensure_ascii=False).encode("utf-8"), None
    )

    salt = os.urandom(16)
    slots = []
    for phrase in phrases:
        kek = PBKDF2HMAC(
            algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERATIONS
        ).derive(phrase.encode("utf-8"))
        iv = os.urandom(12)
        slots.append({"iv": b64(iv), "key": b64(AESGCM(kek).encrypt(iv, content_key, None))})
    secrets.SystemRandom().shuffle(slots)  # slot order shouldn't hint at who was added when

    vault = {
        "version": 1,
        "iterations": ITERATIONS,
        "salt": b64(salt),
        "slots": slots,
        "content": {"iv": b64(content_iv), "data": b64(ciphertext)},
    }
    OUT.write_text(json.dumps(vault, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} with {len(slots)} passphrase(s).")


def main() -> None:
    args = sys.argv[1:]
    if args[:1] == ["new"]:
        name = " ".join(args[1:]) or "unnamed"
        phrase = new_passphrase()
        SRC.mkdir(exist_ok=True)
        with PASSPHRASES.open("a", encoding="utf-8") as f:
            f.write(f"{phrase}  # {name}\n")
        print(f"New passphrase for {name}: {phrase}")
        print(f"Direct link: https://txelito.github.io/?v=personal#k={phrase}")
    elif args:
        sys.exit(__doc__)
    build()


if __name__ == "__main__":
    main()

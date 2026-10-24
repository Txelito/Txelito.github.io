"""Build assets/vault.json, the encrypted content of the Personal vault.

Plaintext lives in vault-src/ (git-ignored, never published):
  vault-src/content.en.html   vault content shown on index.html
  vault-src/content.pt.html   vault content shown on pt.html
  vault-src/passphrases.txt   one passphrase per line, "passphrase  # who it's for"

Usage:
  python tools/vault.py            encrypt vault-src/ into assets/vault.json
  python tools/vault.py new NAME   add a random passphrase for NAME, then encrypt

To revoke someone, delete their line from passphrases.txt and run the script again.
Requires: pip install cryptography
"""

import base64
import json
import os
import secrets
import sys
from pathlib import Path

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "vault-src"
OUT = ROOT / "assets" / "vault.json"
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

"""
Dragon Bytes CTF Arena — Security helpers
Password hashing (PBKDF2), flag hashing, and session token generation.
Flags are stored as salted hashes — never in plaintext — and are never
sent to the client. Verification happens entirely server-side.
"""
import hashlib
import hmac
import os
import secrets
import base64

# A fixed-but-secret-enough salt namespace for flag hashing.
# Combined with per-install randomness isn't needed here since flags are
# meant to be guessed by solving the puzzle, not brute-forced — what matters
# is that the plaintext flag never appears in the DB or any API response.
_FLAG_SALT = b"dragonbytes-ctf-flag-salt-v1"


def hash_flag(flag: str) -> str:
    """One-way hash of a flag for storage. Comparison uses verify_flag()."""
    normalized = flag.strip()
    digest = hashlib.sha256(_FLAG_SALT + normalized.encode("utf-8")).hexdigest()
    return digest


def verify_flag(user_input: str, flag_hash: str) -> bool:
    """Timing-safe comparison of a user-submitted flag against the stored hash."""
    if not user_input:
        return False
    candidate = hash_flag(user_input)
    return hmac.compare_digest(candidate, flag_hash)


def hash_password(password: str) -> str:
    """PBKDF2-HMAC-SHA256 password hashing with a random per-user salt."""
    salt = secrets.token_bytes(16)
    iterations = 200_000
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"pbkdf2_sha256${iterations}${base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt_b64, hash_b64 = stored.split("$")
        iterations = int(iterations)
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
    except (ValueError, AttributeError):
        return False
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(dk, expected)


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)

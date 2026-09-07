"""Compute a lowercase SHA-256 commitment for evidence files."""

import hashlib
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: python scripts/source_hash.py <file>", file=sys.stderr)
        return 2
    digest = hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest()
    print(digest)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

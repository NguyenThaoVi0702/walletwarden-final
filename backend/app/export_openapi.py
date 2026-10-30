"""Write the OpenAPI contract to backend/openapi.json.

Run after changing a router or schema:  uv run python -m app.export_openapi
CI runs it too and fails if the committed file is out of date.
"""

import json

from app.config import BACKEND_DIR
from app.main import app


def main() -> None:
    path = BACKEND_DIR / "openapi.json"
    # Always LF so the file is byte-identical on Windows laptops and on the Linux CI runner.
    path.write_text(
        json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print("Wrote backend/openapi.json")


if __name__ == "__main__":
    main()

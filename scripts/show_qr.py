"""Print a URL as a QR code in the terminal and save it as scripts/.demo/qr.png."""

import sys
from pathlib import Path

import qrcode


def main() -> None:
    url = sys.argv[1]
    qr = qrcode.QRCode(border=1)
    qr.add_data(url)
    qr.print_ascii(invert=True)
    out = Path(__file__).resolve().parent / ".demo" / "qr.png"
    out.parent.mkdir(exist_ok=True)
    qr.make_image().save(str(out))
    print(f"\n  {url}\n  QR image: {out}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]  # Windows console
    main()

"""Inventario e immagini: analisi locale in sola lettura, senza importare nel DB."""
from collections import Counter
import csv
from decimal import Decimal, InvalidOperation
import hashlib
import io
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CSV = Path(r"C:\Users\reda_\Desktop\inventario_2026-06-21.csv")
MEDIA = Path(r"C:\Users\reda_\Desktop\Gemini\Workflow Agent E-commerce\media-runs")
OUT = ROOT / "dati" / "analisi-2026-11-06"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    raw = CSV.read_bytes()
    text = raw.decode("utf-8-sig")
    dialect = csv.Sniffer().sniff(text[:8192], delimiters=",;\t")
    reader = csv.DictReader(io.StringIO(text, newline=""), dialect=dialect)
    rows = list(reader)
    issues = []
    seen = Counter()
    for number, row in enumerate(rows, start=2):
        flags = []
        if None in row or any(v is None for v in row.values()):
            flags.append("Numero di colonne incoerente")
        sku = (row.get("SKU") or "").strip()
        seen[sku] += 1
        if not sku:
            flags.append("SKU assente")
        elif sku.startswith(("http://", "https://")):
            flags.append("URL nel campo SKU: conservare origine e assegnare un identificatore interno stabile")
        if not (row.get("Categoria") or "").strip():
            flags.append("Categoria assente")
        if (row.get("Nome") or "").strip().lower() == "senza nome":
            flags.append("Nome da completare")
        for field in ("Prezzo Vendita", "Costo Acquisto", "Quantita Stock"):
            try:
                n = Decimal((row.get(field) or "").strip().replace(",", "."))
                if not n.is_finite() or n < 0:
                    flags.append(field + ": valore non valido")
                elif field == "Quantita Stock" and n != n.to_integral_value():
                    flags.append(field + ": quantità non intera")
            except InvalidOperation:
                flags.append(field + ": valore non numerico")
        if flags:
            issues.append({"record_csv": number, "nome": row.get("Nome"), "problemi": flags})
    nonempty = lambda key: sum(bool((r.get(key) or "").strip()) for r in rows)
    summary = {
        "source": str(CSV), "sha256": digest(raw), "encoding": "UTF-8", "delimiter": dialect.delimiter,
        "record_count": len(rows), "columns": reader.fieldnames,
        "filled": {k: nonempty(k) for k in reader.fieldnames},
        "categories": dict(Counter((r.get("Categoria") or "").strip() for r in rows)),
        "unique_sku_values": len(seen), "duplicate_sku_values": [k for k, n in seen.items() if n > 1],
        "sku_containing_url": sum((r.get("SKU") or "").startswith(("http://", "https://")) for r in rows),
        "sku_equals_photo_url": sum(bool(r.get("Link Foto")) and r.get("SKU") == r.get("Link Foto") for r in rows),
        "unnamed_products": sum((r.get("Nome") or "").strip().lower() == "senza nome" for r in rows),
        "zero_values": {k: sum((r.get(k) or "").strip() in ("0", "0.0", "0.00") for r in rows)
                        for k in ("Prezzo Vendita", "Costo Acquisto", "Quantita Stock")},
        "issues": issues, "imported": False,
        "notes": ["Il CSV non contiene una colonna Link prodotto distinta da Link Foto.",
                  "Il nome del file indica il 21 giugno 2026: non presume giacenze attuali.",
                  "Gli zero sono valori espliciti da conservare, non campi mancanti da inventare."],
    }
    images = []
    extensions = Counter()
    for p in sorted(MEDIA.rglob("*")):
        if not p.is_file():
            continue
        extensions[p.suffix.lower()] += 1
        if p.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            continue
        data = p.read_bytes()
        item = {"relative_path": str(p.relative_to(MEDIA)), "bytes": len(data), "sha256": digest(data)}
        try:
            with Image.open(p) as im:
                item.update(width=im.width, height=im.height, format=im.format)
                im.verify()
        except (OSError, ValueError) as error:
            item["error"] = str(error)
        item["role_from_filename"] = "input" if p.stem.startswith("input-") else "output" if p.stem.startswith("output-") else "unclassified"
        images.append(item)
    media = {"source": str(MEDIA), "file_count": sum(extensions.values()), "extensions": dict(extensions),
             "image_count": len(images), "unique_image_bytes": len({i["sha256"] for i in images}),
             "image_errors": sum("error" in i for i in images), "images": images,
             "notes": ["File JSON di workflow non letti né pubblicati.",
                       "Ruolo input/output da nome file: non prova associazione a un prodotto o colore reale.",
                       "Nessuna immagine caricata nel catalogo o inviata a servizi esterni."]}
    OUT.mkdir(parents=True, exist_ok=True)
    for name, value in (("inventario-analisi.json", summary), ("immagini-manifest.json", media)):
        (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    snapshot = ROOT / "dati" / "sorgenti" / CSV.name
    snapshot.parent.mkdir(parents=True, exist_ok=True)
    if snapshot.exists() and snapshot.read_bytes() != raw:
        raise RuntimeError("Esiste già una copia sorgente diversa: non sovrascritta")
    if not snapshot.exists():
        snapshot.write_bytes(raw)
    print(json.dumps({"rows": len(rows), "categories": summary["categories"],
                      "sku_url": summary["sku_containing_url"], "same_photo": summary["sku_equals_photo_url"],
                      "unnamed": summary["unnamed_products"], "zeros": summary["zero_values"],
                      "images": len(images), "unique_images": media["unique_image_bytes"],
                      "image_errors": media["image_errors"], "output": str(OUT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()

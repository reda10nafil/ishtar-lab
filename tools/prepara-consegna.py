"""Esporta app e vault in una cartella pulita, senza Git annidato né dati privati."""
from pathlib import Path
import csv
import hashlib
import io
import json
import os
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "consegne" / "Ishtar-Lab"
SKIP_DIRS = {".git", "node_modules", ".medusa", "dist", "build", ".turbo", ".cache",
             ".runtime", ".log", "__pycache__", "coverage", ".next", ".vercel"}
ROOT_FILES = {"README.md", "GUIDA-COLLABORATORE.md", "AGENTS.md", "PROJECT.md", "CHANGELOG.md",
              "LICENSE.md", "LICENSING-SCOPE.md", "THIRD_PARTY_NOTICES.md", "CONTRIBUTING.md",
              "PIANO-INVENTARIO.md", ".ai-style-rules.md", ".gitignore", ".gitattributes",
              "avvia_pannello.py", "catalog_bridge.py"}
PROOFS = {"qa-catalogo-operativo.json", "pagine-ripristinate.json", "avvio-bat.json",
          "integrita-design.json", "csv.test.mjs", "dashboard-ripristinata.jpg",
          "consegna-github.json", "avvio-linux-2026-11-12.json",
          "importa.test.mjs", "sincronizza.test.mjs", "correzioni-dati-csv-2026-11-12.json",
          "collegamento.test.mjs", "test_ponte.py", "affidabilita-salvataggi-2026-11-12.json",
          "accesso-locale.test.mjs", "sicurezza-riservatezza-2026-11-12.json",
          "salvataggi-atomici-2026-11-12.json", "conflitti-movimenti-2026-11-13.json",
          "scorte-console-magazzino-2026-11-13.json",
          "crm-tappa1-2026-11-13.json", "crm-tappa2-2026-11-13.json", "chat-casella.test.mjs",
          "chat-api.test.mjs", "chat-controllo.test.mjs"}

def permitted(p):
    rel = p.relative_to(ROOT)
    parts = rel.parts
    name = p.name
    if any(x in SKIP_DIRS for x in parts) or p.is_symlink():
        return False
    if name.startswith(".env") or "credenzial" in name.lower():
        return False
    if p.suffix.lower() in {".log", ".zip", ".sql", ".dump", ".pem", ".key", ".pfx", ".p12", ".pyc"}:
        return False
    if len(parts) == 1:
        return name in ROOT_FILES or p.suffix.lower() in {".bat", ".cmd", ".sh"}
    top = parts[0]
    if top == "backend":
        return True
    if top == "frontend":
        return True
    if top == "brand":
        return "riferimenti" not in parts
    if top == "licensing":
        return True
    if top == "tools":
        return p.suffix.lower() in {".py", ".mjs", ".cjs", ".json"} and name != "prepara-vault-ishtar.py"
    if top == "piani di implementazione":
        return not name.startswith("workspace") and "cache" not in parts
    if top == "verifiche":
        return name in PROOFS
    return False

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    if list(DEST.iterdir()):
        raise SystemExit("Cartella di consegna già popolata: aggiornare i file mirati senza cancellazioni automatiche.")
    copied = []
    for base, dirs, files in os.walk(ROOT, followlinks=False):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and d not in {
            "consegne", "consegne-private", "Recupero-pannello-2026-11-06", "dati", "outputs"
        } and not (Path(base) / d).is_symlink()]
        for name in files:
            source = Path(base) / name
            if not permitted(source):
                continue
            rel = source.relative_to(ROOT)
            dest = DEST / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, dest)
            copied.append(rel.as_posix())
    # Il tag locale dell'archivio è sostituito nella sola consegna da un riferimento pubblico scaricabile.
    # L'ID locale d30c5e04... non è un digest del registro (Docker Hub risponde 404): usare tag + digest.
    compose = DEST / "backend/infra/compose.yaml"
    text = compose.read_text("utf-8")
    text = text.replace("rustfs/rustfs:local-d30c5e04efc4",
                        "rustfs/rustfs:1.0.5@sha256:b81d16a90ee25bd9511280127ca1471788c6e874cf0f0da759645f46b2dc1d74")
    compose.write_text(text, encoding="utf-8")
    # Dataset espressamente demo: nessun link remoto, fornitore o nome della sorgente privata.
    demo = DEST / "frontend/catalogo/inventario-demo.csv"
    if demo.exists():
        rows = list(csv.DictReader(demo.open(encoding="utf-8-sig", newline="")))
        for i, row in enumerate(rows, 1):
            row["Nome"] = f"Articolo moda DEMO {i:03d}"
            row["Descrizione"] = "Scheda dimostrativa per prove; caratteristiche da verificare."
            row["Fornitore"] = "Fornitore DEMO"
            row["Link Foto"] = "/brand/segnaposto-prodotto.svg"
            if "Link Prodotto" in row:
                row["Link Prodotto"] = f"https://example.invalid/prodotto-demo-{i:03d}"
            for key in row:
                if key.lower().startswith("note"):
                    row[key] = "Dati dimostrativi; non pubblicare come scheda reale."
        with demo.open("w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
    # I testi legali rimangono identici; l'inventario privato e le chiavi non sono una consegna.
    secrets = set()
    for base, dirs, files in os.walk(ROOT, followlinks=False):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and d not in {
            "consegne", "consegne-private", "Recupero-pannello-2026-11-06"
        } and not (Path(base) / d).is_symlink()]
        for name in files:
            if name.startswith(".env") or "credenzial" in name.lower():
                p = Path(base) / name
                for line in p.read_text("utf-8-sig", errors="ignore").splitlines():
                    if "=" not in line or line.lstrip().startswith("#"):
                        continue
                    key, value = line.split("=", 1)
                    if re.search(r"PASSWORD|SECRET|TOKEN|(?:^|_)KEY(?:_|$)", key) and len(value.strip()) >= 16:
                        secrets.add(value.strip().encode())
    findings = []
    token_pattern = re.compile(rb"(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)")
    for p in DEST.rglob("*"):
        if p.is_file():
            data = p.read_bytes()
            if any(s in data for s in secrets) or token_pattern.search(data):
                findings.append(p.relative_to(DEST).as_posix())
    if findings:
        raise SystemExit("Possibili segreti nella consegna, upload vietato: " + ", ".join(findings))
    manifest = {
        "date": "2026-11-07", "visibility": "public", "known_secret_values_checked": len(secrets),
        "secret_matches": 0, "database_included": False, "historical_archive_included": False,
        "demo_csv": "82 record di prova, nomi/fornitore/foto anonimizzati nella sola consegna",
        "files": {p.relative_to(DEST).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                  for p in sorted(DEST.rglob("*")) if p.is_file()}
    }
    (DEST / "MANIFEST-CONSEGNA.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "verifiche/manifest-consegna.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"folder": str(DEST), "files": len(manifest["files"]), "secret_matches": 0,
                      "MiB": round(sum(p.stat().st_size for p in DEST.rglob("*") if p.is_file())/1048576, 2)}, ensure_ascii=False))

if __name__ == "__main__":
    main()

"""Copia pubblicabile della seconda app; non avvia né modifica la sorgente."""
from pathlib import Path
import hashlib
import json
import os
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path("C:/Users/reda_/Desktop/Progetti suddivisi/pannello di amministrazione del negozio/multi-outfit")
DEST = ROOT / "versione 2"
SKIP = {".git", "node_modules", ".medusa", ".runtime", ".log", "dist", "build",
        ".turbo", ".cache", "__pycache__", "coverage", ".next", ".vercel"}
EXTENSIONS = {".ps1", ".md", ".yaml", ".yml", ".mjs", ".json", ".lock", ".js",
              ".html", ".ts", ".tsx", ".svg", ".png", ".css"}
DOTFILES = {".gitignore", ".npmrc"}
TOKEN = re.compile(rb"(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)")


def walk(root):
    for base, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = [d for d in dirs if d not in SKIP and not (Path(base) / d).is_symlink()]
        for name in sorted(files):
            p = Path(base) / name
            if not p.is_symlink():
                yield p


def secret_values():
    values = set()
    for root in [SOURCE, ROOT / "backend"]:
        for p in walk(root):
            if not (p.name.startswith(".env") or "credenzial" in p.name.lower()):
                continue
            for line in p.read_text("utf-8-sig", errors="ignore").splitlines():
                if "=" not in line or line.lstrip().startswith("#"):
                    continue
                key, value = line.split("=", 1)
                value = value.strip().strip("\"'")
                if (re.search(r"PASSWORD|SECRET|TOKEN|(?:^|_)KEY(?:_|$)", key)
                        and len(value) >= 12 and not value.startswith("${")
                        and value not in {"supersecret", "your-secret-key"}):
                    values.add(value.encode())
    return values


def main():
    if DEST.exists() and any(DEST.iterdir()):
        raise SystemExit("versione 2 già popolata: nessuna sovrascrittura automatica.")
    secrets = secret_values()
    selected = []
    excluded = []
    for p in walk(SOURCE):
        rel = p.relative_to(SOURCE).as_posix()
        if (p.name.startswith(".env") or "credenzial" in p.name.lower()
                or (p.suffix not in EXTENSIONS and p.name not in DOTFILES)):
            excluded.append(rel)
            continue
        data = p.read_bytes()
        if any(s in data for s in secrets) or TOKEN.search(data):
            raise SystemExit("Possibile segreto: pubblicazione fermata per " + rel)
        selected.append((p, rel, hashlib.sha256(data).hexdigest()))
    DEST.mkdir(parents=True, exist_ok=True)
    files = {}
    for p, rel, before in selected:
        data = p.read_bytes()
        if hashlib.sha256(data).hexdigest() != before:
            raise SystemExit("Sorgente cambiata durante la copia: " + rel)
        target = DEST / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        after = hashlib.sha256(p.read_bytes()).hexdigest()
        if after != before or hashlib.sha256(target.read_bytes()).hexdigest() != before:
            raise SystemExit("Verifica di integrità fallita: " + rel)
        files[rel] = before
    manifest = {
        "date": "2026-11-12", "source": str(SOURCE), "source_git_revision": None,
        "source_git_note": "Snapshot dei file di lavoro; revisione Git non accertata.",
        "purpose": "Seconda app per sviluppo e confronto, non sostituzione del primo pannello.",
        "copied_source_files": len(files), "files": files,
        "excluded_files": excluded, "excluded_directories": sorted(SKIP),
        "known_secret_values_checked": len(secrets), "secret_matches": 0,
        "source_files_unchanged_during_copy": True, "database_included": False,
        "services_started": False,
        "scope": "Hash dei soli file copiati dalla sorgente; documentazione di consegna aggiunta separatamente."
    }
    (DEST / "MANIFEST-ORIGINE.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"copied": len(files), "secret_matches": 0,
                      "known_secret_values_checked": len(secrets), "source_unchanged": True}))


if __name__ == "__main__":
    main()

"""Test del filtro del pacchetto di consegna (tools/prepara-consegna.py): cosa entra e cosa resta fuori.

Esecuzione: python3 -m unittest verifiche/test_consegna.py
"""
import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("prepara_consegna", ROOT / "tools" / "prepara-consegna.py")
consegna = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(consegna)


class FiltroConsegna(unittest.TestCase):
    def ammesso(self, relativo):
        return consegna.permitted(ROOT / relativo)

    def test_chat_del_sito_entra(self):
        for relativo in [
            "chat-sito/GUIDA.md",
            "chat-sito/casella/package.json",
            "chat-sito/casella/supabase/config.toml",
            "chat-sito/casella/supabase/migrations/20261114000000_casella.sql",
            "chat-sito/casella/supabase/tests/casella.test.sql",
            "chat-sito/widget/package.json",
            "chat-sito/widget/bun.lock",
            "chat-sito/widget/costruisci.mjs",
            "chat-sito/widget/src/widget.mjs",
            "chat-sito/widget/dist/ishtar-chat.js",
        ]:
            self.assertTrue(self.ammesso(relativo), relativo)

    def test_restano_fuori_stato_locale_dipendenze_e_dump(self):
        for relativo in [
            "chat-sito/casella/supabase/.temp/cli-latest",
            "chat-sito/casella/supabase/.branches/_current_branch",
            "chat-sito/casella/supabase/seed.sql",
            "chat-sito/widget/node_modules/@supabase/supabase-js/package.json",
            "chat-sito/widget/dist/altro.js",
            "chat-sito/casella/supabase/.env",
            "backend/dump.sql",
            "frontend/dist/app.js",
        ]:
            self.assertFalse(self.ammesso(relativo), relativo)

    def test_cartella_del_widget_costruito_visitata(self):
        self.assertTrue(consegna.visitare(ROOT / "chat-sito/widget", "dist"))
        self.assertFalse(consegna.visitare(ROOT / "frontend", "dist"))
        self.assertFalse(consegna.visitare(ROOT / "chat-sito/widget", "node_modules"))

    def test_prove_della_tappa_4(self):
        for nome in ["crm-tappa4-2026-11-14.json", "chat-sito-widget.test.mjs"]:
            self.assertIn(nome, consegna.PROOFS)


if __name__ == "__main__":
    unittest.main()

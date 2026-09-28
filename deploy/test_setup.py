"""Run with: python3 -m unittest discover -s deploy -p 'test_*.py'."""

import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location(
    "setup_production", Path(__file__).with_name("setup-production.py")
)
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class ProductionSetupTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.app = self.root / ".env.production"
        self.db = self.root / ".env.database"

    def existing(self, admin_line="ADMIN_PASSWORD=existing"):
        self.app.write_text("DATABASE_URL=mysql://existing\n" + admin_line + "\n")
        self.db.write_text("MARIADB_PASSWORD=existing\n")

    def test_fresh_install_generates_matching_private_credentials(self):
        with patch.object(setup, "ask_password", return_value='test$"\\password'):
            setup.setup(self.root)
        db_values = dict(line.split("=", 1) for line in self.db.read_text().splitlines())
        self.assertIn(f"mysql://ssp:{db_values['MARIADB_PASSWORD']}@db:3306/", self.app.read_text())
        self.assertNotEqual(db_values["MARIADB_PASSWORD"], db_values["MARIADB_ROOT_PASSWORD"])
        self.assertEqual(len(db_values["MARIADB_PASSWORD"]), 64)
        self.assertIn('ADMIN_PASSWORD="test$$\\"\\\\password"', self.app.read_text())
        for path in (self.app, self.db):
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_repeated_setup_preserves_all_credentials_without_prompt(self):
        self.existing()
        before = (self.app.read_bytes(), self.db.read_bytes())
        with patch.object(setup, "ask_password", side_effect=AssertionError("Unexpected prompt")):
            setup.setup(self.root)
            setup.setup(self.root)
        self.assertEqual(before, (self.app.read_bytes(), self.db.read_bytes()))

    def test_missing_and_empty_admin_password_are_filled(self):
        for admin_line in ("", "ADMIN_PASSWORD=", 'ADMIN_PASSWORD=""',
                           "ADMIN_PASSWORD='' # empty", "ADMIN_PASSWORD= # empty"):
            with self.subTest(admin_line=admin_line):
                self.existing(admin_line)
                before_db = self.db.read_bytes()
                with patch.object(setup, "ask_password", return_value="new-secret"):
                    setup.setup(self.root)
                self.assertIn('ADMIN_PASSWORD="new-secret"', self.app.read_text())
                self.assertIn("DATABASE_URL=mysql://existing", self.app.read_text())
                self.assertEqual(before_db, self.db.read_bytes())

    def test_partial_configuration_is_not_overwritten(self):
        for existing_file in (self.app, self.db):
            with self.subTest(path=existing_file.name):
                existing_file.write_text("keep me")
                with self.assertRaises(ValueError), patch.object(setup, "ask_password") as prompt:
                    setup.setup(self.root)
                prompt.assert_not_called()
                self.assertEqual(existing_file.read_text(), "keep me")
                existing_file.unlink()

    def test_duplicate_admin_definition_is_rejected(self):
        self.existing("ADMIN_PASSWORD=one\nADMIN_PASSWORD=two")
        with self.assertRaises(ValueError):
            setup.setup(self.root)

    def test_failed_second_write_removes_new_partial_configuration(self):
        original_write = setup.write_private
        def write(path, content):
            if path == self.app:
                raise OSError("Simulated disk failure")
            original_write(path, content)
        with patch.object(setup, "ask_password", return_value="test"), \
                patch.object(setup, "write_private", side_effect=write), self.assertRaises(OSError):
            setup.setup(self.root)
        self.assertFalse(self.app.exists())
        self.assertFalse(self.db.exists())

    def test_empty_and_mismatched_passwords_are_retried(self):
        with patch.object(setup.getpass, "getpass", side_effect=["", "", "one", "two", "ok", "ok"]):
            self.assertEqual(setup.ask_password(), "ok")

    def test_interrupted_prompt_creates_no_files(self):
        with patch.object(setup, "ask_password", side_effect=EOFError), self.assertRaises(EOFError):
            setup.setup(self.root)
        self.assertEqual(list(self.root.iterdir()), [])


if __name__ == "__main__":
    unittest.main()

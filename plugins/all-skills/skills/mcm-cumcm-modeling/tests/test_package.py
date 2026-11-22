import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


class PackageTests(unittest.TestCase):
    def test_frontmatter_and_size(self):
        text = (ROOT / "SKILL.md").read_text(encoding="utf-8")
        self.assertTrue(text.startswith("---\n"))
        self.assertIn("\nname: mcm-cumcm-modeling\n", text)
        description = next(line for line in text.splitlines() if line.startswith("description: "))
        self.assertLessEqual(len(description.removeprefix("description: ")), 1024)
        self.assertLess(len(text.splitlines()), 500)

    def test_direct_resource_references_exist(self):
        text = (ROOT / "SKILL.md").read_text(encoding="utf-8")
        resources = set(re.findall(r"(?:references|scripts|assets)/[A-Za-z0-9_./-]+", text))
        self.assertGreaterEqual(len(resources), 10)
        for resource in resources:
            self.assertTrue((ROOT / resource).exists(), resource)

    def test_eval_cases_are_unique_and_structured(self):
        data = json.loads((ROOT / "evals" / "cases.json").read_text(encoding="utf-8"))
        cases = data["cases"]
        self.assertGreaterEqual(len(cases), 12)
        self.assertEqual(len({case["id"] for case in cases}), len(cases))
        for case in cases:
            for field in ["family", "prompt", "expected_routes", "required_checks", "trap"]:
                self.assertIn(field, case)

    def test_no_unfinished_placeholders_or_local_absolute_paths(self):
        todo_marker = "[" + "TODO"
        for path in ROOT.rglob("*"):
            if path.suffix in {".md", ".py", ".json", ".yaml"} and "__pycache__" not in path.parts:
                text = path.read_text(encoding="utf-8")
                self.assertNotIn(todo_marker, text, str(path))
                self.assertNotRegex(text, r"[A-Za-z]:\\\\", str(path))


if __name__ == "__main__":
    unittest.main()

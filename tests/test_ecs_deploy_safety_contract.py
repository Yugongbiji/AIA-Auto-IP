"""Safety checks for ECS workflow changes; offline, no ECS or RDS access."""
import subprocess
import textwrap
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEPLOY_PATH = ROOT / ".github/workflows/deploy.yml"
DIAGNOSTIC_PATH = ROOT / ".github/workflows/preview-diagnostic.yml"


def remote_shell(path):
    text = path.read_text(encoding="utf-8")
    marker = "          script: |\n"
    assert marker in text, "missing SSH script"
    block = text.split(marker, 1)[1]
    return textwrap.dedent(block)


class DeploymentSafetyContract(unittest.TestCase):
    def test_deployment_shell_parses(self):
        script = remote_shell(DEPLOY_PATH)
        result = subprocess.run(["bash", "-n"], input=script, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_deploy_has_readiness_and_rollback_evidence(self):
        script = remote_shell(DEPLOY_PATH)
        for required in (
            "wait_until_ready()",
            "if ! wait_until_ready; then",
            "diagnose_service",
            "restore_override",
            "PREVIOUS_COMMIT",
            "script_server.py --port 8000",
        ):
            self.assertIn(required, script)

    def test_diagnostic_does_not_run_for_pull_requests(self):
        workflow = DIAGNOSTIC_PATH.read_text(encoding="utf-8")
        triggers = workflow.split("jobs:", 1)[0]
        self.assertIn("workflow_dispatch:", triggers)
        self.assertNotIn("pull_request:", triggers)
        self.assertIn("schedule:", triggers)

    def test_diagnostic_is_read_only_and_does_not_log_secrets(self):
        script = remote_shell(DIAGNOSTIC_PATH)
        for required in ("default_transaction_read_only=on", "mode=ro", "RDS_readonly_verdict="):
            self.assertIn(required, script)
        for forbidden in ("systemctl restart ", "git reset ", "DROP TABLE", "DELETE FROM"):
            self.assertNotIn(forbidden, script)


if __name__ == "__main__":
    unittest.main()

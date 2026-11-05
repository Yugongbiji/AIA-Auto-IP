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

    def test_deploy_captures_pre_restart_failures_and_rollback_continues(self):
        script = remote_shell(DEPLOY_PATH)
        self.assertIn("trap 'on_deploy_error", script)
        self.assertIn("on_deploy_error()", script)
        self.assertIn("trap - ERR", script)
        self.assertIn("local restart_status=$?", script)
        self.assertIn("CRITICAL: one or more rollback commands failed", script)
        self.assertIn("Rollback restored and HTTP health check passed.", script)

    def test_preflight_refuses_dirty_or_unhealthy_production(self):
        script = remote_shell(DEPLOY_PATH)
        self.assertIn("git diff --quiet", script)
        self.assertIn("git diff --cached --quiet", script)
        self.assertIn("PREFLIGHT BLOCKED: existing production HTTP service is unhealthy", script)
        self.assertLess(
            script.index("PREFLIGHT BLOCKED: production has uncommitted tracked changes"),
            script.index("git reset --hard origin/main"),
        )

    def test_readiness_wait_handles_delayed_and_failed_startup(self):
        script = remote_shell(DEPLOY_PATH)
        start = script.index("wait_until_ready() {")
        end = script.index("restore_override() {", start)
        function = script[start:end].rstrip()
        # Everything executes in a GitHub runner subprocess with mocked commands;
        # no actual systemd, server, or database is contacted.
        stub = """
        ATTEMPTS=0
        systemctl() { return 0; }
        curl() {
          ATTEMPTS=$((ATTEMPTS + 1))
          if [ "$SCENARIO" = delayed ] && [ "$ATTEMPTS" -ge 3 ]; then return 0; fi
          return 7
        }
        sleep() { :; }
        """
        for scenario, expected_code, expected_attempts in [
            ("delayed", 0, 3),
            ("never", 1, 30),
        ]:
            result = subprocess.run(
                ["bash", "-c", stub + function + "\nwait_until_ready"],
                capture_output=True, text=True,
                env={"PATH": "/usr/bin:/bin", "SCENARIO": scenario},
            )
            self.assertEqual(result.returncode, expected_code, result.stderr)
            self.assertIn(
                "attempt 3/30", result.stdout
            ) if scenario == "delayed" else None

    def test_production_requires_full_qa(self):
        workflow = DEPLOY_PATH.read_text(encoding="utf-8")
        self.assertIn("needs: [contract-api, playwright]", workflow)
        self.assertIn("project: [mobile-360, mobile-390, desktop-chromium]", workflow)
        self.assertIn("python -m pytest -q", workflow)
        self.assertIn("npm run test:e2e -- --project=", workflow)
        # No ECS credentials may be used in the validation jobs.
        validation_jobs = workflow.split("  deploy:", 1)[0]
        self.assertNotIn("secrets.ECS_", validation_jobs)

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

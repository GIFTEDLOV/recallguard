"""Run decision-critical V2 source mutations and require every one to die."""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts" / "recall_guard.py"


MUTATIONS = [
    ("registration-cleared", "state=STATE_UNASSESSED,", "state=STATE_CLEARED,", "tests/direct/test_registration.py::test_new_registration_is_unassessed"),
    ("registration-blocked", "state=STATE_UNASSESSED,", "state=STATE_BLOCKED,", "tests/direct/test_registration.py::test_new_registration_is_unassessed"),
    ("identity-product-metadata", "canonical = self._canonical_listing_identity(marketplace_host, external_listing_id)", "canonical = self._canonical_listing_identity(marketplace_host, external_listing_id + '-product')", "tests/direct/test_identity_hardening.py::test_contract_identity_matches_independent_reference_vector"),
    ("identity-evidence-snapshot", "listing_id = self._listing_id(normalized_marketplace_host, normalized_external_listing_id)", "listing_id = self._listing_id(normalized_marketplace_host, normalized_external_listing_id + '-evidence')", "tests/direct/test_identity_hardening.py::test_contract_identity_matches_independent_reference_vector"),
    ("identity-host-canonicalization", "if raw_host.endswith(\":443\"):", "if False:", "tests/direct/test_identity_hardening.py::test_url_case_default_port_and_tracking_query_do_not_split_identity"),
    ("listing-host-binding", "if self._host(canonical_listing_url) != normalized_marketplace_host:", "if False:", "tests/direct/test_registration.py::test_listing_url_must_match_declared_marketplace_host"),
    ("marketplace-policy", "if not self._is_authorized_host(canonical_listing_url, self.authorized_marketplace_domains):", "if False:", "tests/direct/test_registration.py::test_marketplace_domain_policy_rejects_unlisted_marketplace"),
    ("owner-only-assessment", "listing = self.listings[listing_id]\n        # Storage objects", "listing = self.listings[listing_id]\n        if listing.owner != gl.message.sender_address:\n            self._fail(\"EXPECTED:OWNER_ONLY\")\n        # Storage objects", "tests/direct/test_assessment.py::test_arbitrary_third_party_can_request_assessment"),
    ("affected-priority", "if assessment.verdict == VERDICT_AFFECTED:\n                return STATE_BLOCKED", "if assessment.verdict == VERDICT_INCONCLUSIVE:\n                return STATE_BLOCKED", "tests/direct/test_state_aggregation.py::test_cleared_plus_affected_is_blocked"),
    ("affected-result-state", "if assessment.verdict == VERDICT_AFFECTED:\n                return STATE_BLOCKED", "if assessment.verdict == VERDICT_AFFECTED:\n                return STATE_CLEARED", "tests/direct/test_state_aggregation.py::test_cleared_plus_affected_is_blocked"),
    ("inconclusive-priority", "return STATE_REVIEW_REQUIRED", "return STATE_CLEARED", "tests/direct/test_state_aggregation.py::test_review_required_plus_not_affected_remains_review_required"),
    ("logical-notice-reference", "[NOTICE_IDENTITY_VERSION, \"CPSC\", recall_identifier]", "[NOTICE_IDENTITY_VERSION, \"OTHER\", recall_identifier]", "tests/direct/test_notice_identity.py::test_same_text_different_url_cannot_create_second_notice"),
    ("snapshot-deduplication", "assessment_id = self._assessment_id(listing_id, notice_id, snapshot_sha256)", "assessment_id = self._assessment_id(listing_id, notice_id, notice_id)", "tests/direct/test_notice_identity.py::test_relevant_api_fields_change_snapshot"),
    ("duplicate-assessment", "if assessment_id in self.assessments:", "if False:", "tests/direct/test_notice_identity.py::test_duplicate_exact_snapshot_is_rejected"),
    ("fixed-cpsc-path", "return \"https://\" + CPSC_API_HOST + CPSC_API_PATH + \"?format=json&RecallNumber=\" + recall_identifier", "return \"https://evil.example/Other?format=json&RecallNumber=\" + recall_identifier", "tests/direct/test_assessment.py::test_contract_constructs_exact_cpsc_endpoint"),
    ("exact-record-selection", "if len(exact_records) == 0:", "if False:", "tests/direct/test_assessment.py::test_wrong_cpsc_record_identifier_fails_closed"),
    ("validator-independent-verdict", "and leader_data[\"verdict\"] == validator_data[\"verdict\"]", "and True", "tests/direct/test_consensus_safety.py::test_validator_disagreement_on_semantic_verdict_fails_closed"),
    ("strict-model-schema", "len(parsed) != 1 or \"verdict\" not in parsed", "False or \"verdict\" not in parsed", "tests/direct/test_assessment.py::test_strict_three_value_model_schema"),
    ("record-status-terminology", "status=ASSESSMENT_ADJUDICATED,", "status=\"FINALIZED\",", "tests/direct/test_assessment.py::test_successful_assessment_uses_recorded_not_protocol_finalized_status"),
]


def main() -> int:
    original = CONTRACT.read_text(encoding="utf-8")
    killed = 0
    generated = 0
    with tempfile.TemporaryDirectory(prefix="recallguard-v2-mutants-", ignore_cleanup_errors=True) as temp_dir:
        for index, (name, needle, replacement, test) in enumerate(MUTATIONS):
            mutated = original.replace(needle, replacement, 1)
            if mutated == original:
                print(f"{name}: NOT GENERATED")
                continue
            generated += 1
            mutant_path = Path(temp_dir) / f"{index}-{name}.py"
            mutant_path.write_text(mutated, encoding="utf-8")
            environment = os.environ.copy()
            environment["RECALLGUARD_CONTRACT_PATH"] = str(mutant_path)
            environment["PYTHONDONTWRITEBYTECODE"] = "1"
            result = subprocess.run([sys.executable, "-m", "pytest", "-q", test], cwd=ROOT, env=environment, capture_output=True, text=True)
            if result.returncode != 0:
                killed += 1
                print(f"{name}: KILLED")
            else:
                print(f"{name}: SURVIVED")
        print(f"MUTATION_RESULT killed={killed} generated={generated} total={len(MUTATIONS)}")
    return 0 if killed == generated == len(MUTATIONS) else 1


if __name__ == "__main__":
    raise SystemExit(main())

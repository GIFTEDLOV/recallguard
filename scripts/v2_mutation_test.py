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
    ("identity-product-metadata", "normalized_external_listing_id,\n        )\n        if len(listing_id)", "normalized_external_listing_id + normalized_product_id,\n        )\n        if len(listing_id)", "tests/direct/test_identity_hardening.py::test_same_marketplace_reference_changed_product_metadata_is_same_id"),
    ("identity-evidence-snapshot", "normalized_external_listing_id,\n        )\n        if len(listing_id)", "normalized_external_listing_id + evidence_sha256,\n        )\n        if len(listing_id)", "tests/direct/test_identity_hardening.py::test_mutable_evidence_sha_never_changes_stable_listing_id"),
    ("identity-host-canonicalization", "if raw_host.endswith(\":443\"):", "if False:", "tests/direct/test_identity_hardening.py::test_url_case_default_port_and_tracking_query_do_not_split_identity"),
    ("listing-host-binding", "if self._host(canonical_listing_url) != normalized_marketplace_host:", "if False:", "tests/direct/test_registration.py::test_listing_url_must_match_declared_marketplace_host"),
    ("marketplace-policy", "if not self._is_authorized_host(canonical_listing_url, self.authorized_marketplace_domains):", "if False:", "tests/direct/test_registration.py::test_marketplace_domain_policy_rejects_unlisted_marketplace"),
    ("listing-source-policy", "if not self._is_authorized_host(canonical_evidence_url, self.authorized_listing_evidence_domains):", "if False:", "tests/direct/test_registration.py::test_listing_evidence_domain_policy_rejects_unlisted_source"),
    ("owner-only-assessment", "listing = self.listings[listing_id]\n        canonical_recall_url", "listing = self.listings[listing_id]\n        if listing.owner != gl.message.sender_address:\n            self._fail(\"BUSINESS:UNAUTHORIZED_ACTION\")\n        canonical_recall_url", "tests/direct/test_assessment.py::test_arbitrary_third_party_can_request_assessment"),
    ("blocked-terminal", "listing = self.listings[listing_id]\n        canonical_recall_url", "listing = self.listings[listing_id]\n        if listing.state == STATE_BLOCKED:\n            self._fail(\"BUSINESS:ILLEGAL_STATE_TRANSITION\")\n        canonical_recall_url", "tests/direct/test_state_aggregation.py::test_blocked_plus_not_affected_remains_blocked"),
    ("affected-priority", "return STATE_BLOCKED\n            if assessment.verdict", "return STATE_CLEARED\n            if assessment.verdict", "tests/direct/test_assessment.py::test_successful_verdict_has_expected_state[AFFECTED-BLOCKED]"),
    ("inconclusive-priority", "if has_inconclusive:\n            return STATE_REVIEW_REQUIRED", "if has_inconclusive:\n            return STATE_CLEARED", "tests/direct/test_state_aggregation.py::test_review_required_plus_not_affected_remains_review_required"),
    ("logical-notice-reference", "[NOTICE_IDENTITY_VERSION, self._host(recall_url), notice_reference]", "[NOTICE_IDENTITY_VERSION, recall_url, notice_reference]", "tests/direct/test_notice_identity.py::test_query_variation_cannot_create_repeated_logical_notice"),
    ("snapshot-deduplication", "assessment_id = self._assessment_id(listing_id, snapshot_id)", "assessment_id = self._assessment_id(listing_id, notice_id)", "tests/direct/test_notice_identity.py::test_same_recall_reference_with_updated_page_snapshot_keeps_logical_notice_id"),
    ("duplicate-notice", "if assessment_id in self.assessments:", "if False:", "tests/direct/test_notice_identity.py::test_duplicate_exact_snapshot_is_rejected_even_when_url_query_changes"),
    ("digest-check", "if envelope.get(\"sha256\") != expected_sha256:", "if False:", "tests/direct/test_assessment.py::test_wrong_recall_hash_is_rejected_without_mutation"),
    ("strict-model-schema", "len(parsed) != 1 or \"verdict\" not in parsed", "False or \"verdict\" not in parsed", "tests/direct/test_consensus_safety.py::test_model_output_with_extra_json_fields_is_not_a_verdict"),
    ("record-status-terminology", "status=ASSESSMENT_RECORDED,", "status=\"FINALIZED\",", "tests/direct/test_assessment.py::test_arbitrary_third_party_can_request_assessment"),
]


def main() -> int:
    original = CONTRACT.read_text(encoding="utf-8")
    killed = 0
    with tempfile.TemporaryDirectory(prefix="recallguard-v2-mutants-", ignore_cleanup_errors=True) as temp_dir:
        for index, (name, needle, replacement, test) in enumerate(MUTATIONS):
            mutated = original.replace(needle, replacement, 1)
            if mutated == original:
                print(f"{name}: NOT GENERATED")
                continue
            mutant_path = Path(temp_dir) / f"{index}-{name}.py"
            mutant_path.write_text(mutated, encoding="utf-8")
            environment = os.environ.copy()
            environment["RECALLGUARD_CONTRACT_PATH"] = str(mutant_path)
            environment["PYTHONDONTWRITEBYTECODE"] = "1"
            result = subprocess.run(
                [sys.executable, "-m", "pytest", "-q", test],
                cwd=ROOT,
                env=environment,
                capture_output=True,
                text=True,
            )
            if result.returncode != 0:
                killed += 1
                print(f"{name}: KILLED")
            else:
                print(f"{name}: SURVIVED")
        print(f"MUTATION_RESULT killed={killed} total={len(MUTATIONS)}")
    return 0 if killed == len(MUTATIONS) else 1


if __name__ == "__main__":
    raise SystemExit(main())

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RecallGuardContract } from "../contracts/RecallGuard";
import { CONTRACT_ADDRESS } from "../genlayer/client";
import { useWallet } from "./useWallet";
import type { Assessment, ContractInfo, Listing } from "../types";

export interface ContractSnapshot {
  contract: RecallGuardContract | null;
  listings: Listing[];
  assessments: Assessment[];
  info: ContractInfo | null;
  loading: boolean;
  error: unknown;
  configured: boolean;
  refresh: () => Promise<void>;
}

export function useContractSnapshot(): ContractSnapshot {
  const { wallet } = useWallet();
  const contract = useMemo(() => CONTRACT_ADDRESS ? new RecallGuardContract(CONTRACT_ADDRESS, wallet || undefined) : null, [wallet]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [info, setInfo] = useState<ContractInfo | null>(null);
  const [loading, setLoading] = useState(Boolean(contract));
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    if (!contract) {
      setListings([]);
      setAssessments([]);
      setInfo(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [listingIds, assessmentIds, nextInfo] = await Promise.all([
        contract.getListingIds(),
        contract.getAssessmentIds(),
        contract.getContractInfo(),
      ]);
      const [nextListings, nextAssessments] = await Promise.all([
        Promise.all(listingIds.map((id) => contract.getListing(id))),
        Promise.all(assessmentIds.map((id) => contract.getAssessment(id))),
      ]);
      setListings(nextListings);
      setAssessments(nextAssessments);
      setInfo(nextInfo);
    } catch (nextError) {
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }, [contract]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { contract, listings, assessments, info, loading, error, configured: Boolean(contract), refresh };
}

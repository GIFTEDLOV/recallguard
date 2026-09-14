export interface FeeProfileEntry {
  leaderTimeunitsAllocation: string;
  validatorTimeunitsAllocation: string;
  executionBudgetPerRound: string;
  totalMessageFees: string;
  rotationsPerRound: string;
  appealRounds?: string;
}

export interface FeeProfile {
  version: number;
  network: string;
  chainId: number;
  measuredAt: string;
  headroom?: number;
  deploy?: FeeProfileEntry;
  methods: Record<string, FeeProfileEntry>;
}

export async function loadFeeProfile(): Promise<FeeProfile> {
  let response: Response;
  try {
    response = await fetch("/fee-profile.json", { cache: "no-store" });
  } catch (error) {
    throw new Error(`FEE_PROFILE_UNAVAILABLE:${String(error)}`);
  }
  if (!response.ok) throw new Error(`FEE_PROFILE_UNAVAILABLE:HTTP_${response.status}`);
  const profile = await response.json() as Partial<FeeProfile> & { status?: string };
  if (profile.status === "NOT_GENERATED" || !profile.methods || !profile.network) {
    throw new Error("FEE_PROFILE_REQUIRED: measured v0.6 fee profile is not available");
  }
  const isStudioDevProfile =
    (profile.network === "studio_devnet" || profile.network === "studio-dev") &&
    Number(profile.chainId) === 61997;
  const isLocalMeasurementProfile = profile.network === "localnet" && Number(profile.chainId) === 61999;
  if (!isStudioDevProfile && !isLocalMeasurementProfile) {
    throw new Error(`FEE_PROFILE_REQUIRED: unsupported measured network ${profile.network}/${profile.chainId}`);
  }
  return profile as FeeProfile;
}

export function profileEntry(profile: FeeProfile, method: "deploy" | "register_listing" | "request_assessment"): FeeProfileEntry {
  const entry = method === "deploy" ? profile.deploy : profile.methods[method];
  if (!entry) throw new Error(`FEE_PROFILE_REQUIRED: missing ${method} profile entry`);
  return entry;
}

"use client";

import { useParams } from "next/navigation";
import ChecksPage from "../../../checks/page";

export default function ListingCheckPage() {
  const params = useParams<{ id: string }>();
  return <ChecksPage initialListingId={decodeURIComponent(params.id || "")} />;
}

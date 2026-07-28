"use client";

import { useEffect, useState } from "react";
import { getIdentity, checkIsMaster } from "@/lib/auth";

export function useIdentity() {
  const [identity, setIdentity] = useState(null);
  const [isMaster, setIsMaster] = useState(false);

  useEffect(() => {
    getIdentity().then(setIdentity);
    checkIsMaster().then(setIsMaster);
  }, []);

  return { identity, isMaster };
}

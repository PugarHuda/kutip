"use client";

import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { kiteTestnet } from "./kite";

export const wagmiConfig = createConfig({
  chains: [kiteTestnet],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [kiteTestnet.id]: http(kiteTestnet.rpcUrls.default.http[0])
  },
  ssr: true
});

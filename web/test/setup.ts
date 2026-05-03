/**
 * Test setup — ran once before all suites.
 * Locks env vars to deterministic values so tests don't depend on .env.
 */

process.env.NODE_ENV = "test";
process.env.KITE_RPC_URL = "http://anvil.local";
process.env.KITE_TESTNET_USDC = "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63";
process.env.NEXT_PUBLIC_AGENT_OPERATOR_ADDRESS =
  "0x5C91B851D9Aa20172e6067d9236920A6CBabf40c";
process.env.PRIVATE_KEY =
  "0x0000000000000000000000000000000000000000000000000000000000000001";
process.env.KUTIP_USE_AA = "0"; // unit tests don't talk to bundler
process.env.KUTIP_DEMO_MODE = "1";
process.env.ORCID_CLIENT_ID = "test-client";
process.env.ORCID_CLIENT_SECRET = "test-secret";
process.env.ORCID_COOKIE_SECRET = "0123456789abcdef0123456789abcdef";
process.env.NEXT_PUBLIC_SITE_URL = "https://test.kutip.local";
process.env.OPENROUTER_API_KEY = "test-router-key";
process.env.AUTHORS_BPS = "4000";
process.env.NEXT_PUBLIC_KITEPASS_ADDRESS =
  "0xe2c4e97738884fd6db2fbb62c1cd672ef1debc4c";

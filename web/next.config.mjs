/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins: ["*"] }
  },
  async redirects() {
    return [
      { source: "/research", destination: "/dashboard", permanent: false },
      { source: "/claim", destination: "/dashboard/claim", permanent: false },
      { source: "/gasless", destination: "/dashboard/gasless", permanent: false },
      { source: "/governance", destination: "/dashboard/governance", permanent: false },
      { source: "/agents", destination: "/dashboard/agents", permanent: false },
      { source: "/bounties", destination: "/dashboard/bounties", permanent: false },
      { source: "/escrow", destination: "/dashboard/escrow", permanent: false },
      { source: "/leaderboard", destination: "/dashboard/leaderboard", permanent: false },
      { source: "/verify", destination: "/dashboard/verify", permanent: false },
      { source: "/verify/:queryId", destination: "/dashboard/verify/:queryId", permanent: false },
      { source: "/authors/:id", destination: "/dashboard/authors/:id", permanent: false },
      { source: "/registry", destination: "/dashboard/overview", permanent: false },
      { source: "/market", destination: "/dashboard/overview", permanent: false }
    ];
  }
};

export default nextConfig;

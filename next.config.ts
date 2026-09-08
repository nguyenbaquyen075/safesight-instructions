// SPDX-License-Identifier: MIT

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker image copies .next/standalone (xem Dockerfile); next dev/start không đổi.
  output: "standalone",
  allowedDevOrigins: ["103.253.21.139"],
  // Tắt auto-chèn block AGENTS.md của Next (agent env detection); xem
  // node_modules/next/dist/docs/01-app/02-guides/ai-agents.md "Opting out".
  agentRules: false,
};

export default nextConfig;

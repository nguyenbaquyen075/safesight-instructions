// SPDX-License-Identifier: MIT

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker image copies .next/standalone (xem Dockerfile); next dev/start không đổi.
  output: "standalone",
  allowedDevOrigins: ["103.253.21.139"],
};

export default nextConfig;

// SPDX-License-Identifier: MIT

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // Worktree và venv nằm trong thư mục repo nhưng không phải mã nguồn của checkout này.
    ".worktrees/**",
    ".venv/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Script Node CommonJS chạy ngoài Next.js (bridge Socket.IO, mock detection) — không lint theo rule TS/React.
    "ai-engine/**",
  ]),
]);

export default eslintConfig;

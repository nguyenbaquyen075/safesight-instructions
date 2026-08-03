// SPDX-License-Identifier: MIT

import { DefaultSession } from "next-auth";
import { UserRole } from "./enums";

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's role. */
      role: UserRole;
      id: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    id: string;
  }
}

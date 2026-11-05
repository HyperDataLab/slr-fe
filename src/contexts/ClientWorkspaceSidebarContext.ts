import { createContext } from "react";

export const ClientWorkspaceSidebarContext = createContext<(() => void) | undefined>(
  undefined,
);

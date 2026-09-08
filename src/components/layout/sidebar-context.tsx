'use client';
// SPDX-License-Identifier: MIT

// Trạng thái chia sẻ giữa Sidebar (drawer di động + thu gọn) và Header (nút hamburger)
// và layout dashboard (canh lề nội dung theo bề rộng sidebar).

import { createContext, useContext, useState, type ReactNode } from 'react';

interface SidebarContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ open, setOpen, collapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar phải được dùng bên trong SidebarProvider');
  return ctx;
}

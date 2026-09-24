import { useState, useEffect } from "react";

class SidebarStore extends EventTarget {
  private collapsed = false;

  get isCollapsed() {
    return this.collapsed;
  }

  setCollapsed(val: boolean) {
    this.collapsed = val;
    this.dispatchEvent(new Event("change"));
  }

  toggle() {
    this.collapsed = !this.collapsed;
    this.dispatchEvent(new Event("change"));
  }
}

export const sidebarStore = new SidebarStore();

export function useSidebarStore() {
  const [collapsed, setCollapsed] = useState(sidebarStore.isCollapsed);

  useEffect(() => {
    const handler = () => setCollapsed(sidebarStore.isCollapsed);
    sidebarStore.addEventListener("change", handler);
    return () => sidebarStore.removeEventListener("change", handler);
  }, []);

  return { isCollapsed: collapsed, toggleCollapse: () => sidebarStore.toggle(), setCollapsed: (val: boolean) => sidebarStore.setCollapsed(val) };
}

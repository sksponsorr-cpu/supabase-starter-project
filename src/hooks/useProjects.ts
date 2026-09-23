import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listProjects, type Project } from "@/lib/project.functions";

export function useProjects(enabled: boolean) {
  const fetchList = useServerFn(listProjects);
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      setItems(await fetchList({}));
    } finally {
      setLoading(false);
    }
  }, [enabled, fetchList]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, refresh };
}

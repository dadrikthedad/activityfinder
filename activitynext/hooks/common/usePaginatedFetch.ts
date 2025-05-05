// Denne holder styr og henter antall meldinger hvor vi bruker pagination, som brukes gjerne i infinite scrolling. Brukes i ChatDropdown og ChatPage
"use client"

import { useCallback, useEffect, useState } from "react";

interface UsePaginatedFetchOptions<T> {
  fetchFn: (skip: number, take: number) => Promise<T[] | null>;
  pageSize?: number;
  autoLoad?: boolean;
}

interface UsePaginatedFetchResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
}

export function usePaginatedFetch<T>({
  fetchFn,
  pageSize = 20,
  autoLoad = true,
}: UsePaginatedFetchOptions<T>): UsePaginatedFetchResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchData = useCallback(
    async (reset = false) => {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchFn(reset ? 0 : skip, pageSize);
        if (result) {
          setData((prev) => (reset ? result : [...prev, ...result]));
          setHasMore(result.length === pageSize);
          setSkip((prev) => (reset ? result.length : prev + result.length));
        } else {
          setHasMore(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ukjent feil");
      } finally {
        setLoading(false);
      }
    },
    [fetchFn, skip, pageSize]
  );

  useEffect(() => {
    if (autoLoad) fetchData(true);
  }, [fetchData, autoLoad]);

  return {
    data,
    loading,
    error,
    hasMore,
    loadMore: () => fetchData(),
    reload: () => {
      setSkip(0);
      setHasMore(true);
      fetchData(true);
    },
  };
}

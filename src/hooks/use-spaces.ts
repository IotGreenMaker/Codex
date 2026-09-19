"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { SpaceConfig, PlantProfile } from "@/lib/types";
import { initializeDB, getAllSpaces, getSetting, setSetting, saveSpace as dbSaveSpace, deleteSpace as dbDeleteSpace } from "@/lib/indexeddb-storage";
import { generateUUID } from "@/lib/uuid";
import { SAVE_DEBOUNCE_DELAY } from "@/lib/config";

export function useSpaces(plants?: PlantProfile[], plantsLoaded = false) {
  const [spaces, setSpaces] = useState<SpaceConfig[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string>("");
  const [loadedFromServer, setLoadedFromServer] = useState(false);

  const spacesRef = useRef<SpaceConfig[]>([]);
  const activeSpaceIdRef = useRef<string>("");
  const plantsRef = useRef<PlantProfile[]>(plants || []);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync refs
  useEffect(() => { spacesRef.current = spaces; }, [spaces]);
  useEffect(() => { activeSpaceIdRef.current = activeSpaceId; }, [activeSpaceId]);

  // Sync plants ref when passed from component
  useEffect(() => {
    if (plants) {
      plantsRef.current = plants;
    }
  }, [plants]);

  // Initial Load
  useEffect(() => {
    let ignore = false;
    const loadState = async () => {
      try {
        if (!plantsLoaded) return;
        await initializeDB();
        let loadedSpaces = await getAllSpaces();
        const savedActiveSpaceId = await getSetting("activeSpaceId");

        let activeIdToUse = savedActiveSpaceId;
        if (loadedSpaces.length === 0) {
          const response = await fetch("/api/plants", { cache: "no-store" });
          if (response.ok) {
            const remote = (await response.json()) as {
              ok?: boolean;
              spaces?: SpaceConfig[];
              activeSpaceId?: string;
            };
            if (remote.ok && Array.isArray(remote.spaces) && remote.spaces.length > 0) {
              loadedSpaces = remote.spaces;
              activeIdToUse = remote.activeSpaceId ?? null;
              await Promise.all(loadedSpaces.map((space) => dbSaveSpace(space)));
              if (activeIdToUse) await setSetting("activeSpaceId", activeIdToUse);
            }
          }
        }

        if (!ignore && loadedSpaces.length > 0) {
          // Note: plants may load after spaces, so dangling-ref pruning
          // is performed by the consumer once both stores are loaded.
          const normalized = loadedSpaces.map((s) => ({
            ...s,
            lightHistory: s.lightHistory || [],
            electricityPricePerKwh: s.electricityPricePerKwh ?? 0
          }));
          if (normalized.length === 1 && normalized[0].plants.length === 0 && plantsRef.current.length > 0) {
            normalized[0] = {
              ...normalized[0],
              plants: plantsRef.current.map((plant) => ({ id: plant.id }))
            };
            await dbSaveSpace(normalized[0]);
          }
          setSpaces(normalized);
          if (!activeIdToUse) {
            const sorted = [...normalized].sort((a, b) =>
              new Date(a.createdAt || (a as any).created_at).getTime() - new Date(b.createdAt || (b as any).created_at).getTime()
            );
            setActiveSpaceId(sorted[0]?.id || normalized[0].id);
          } else {
            setActiveSpaceId(activeIdToUse);
          }
        } else if (!ignore) {
          // Initialize default "Space"
          const defaultSpace: SpaceConfig = {
            id: generateUUID(),
            name: "Space",
            color: "hsl(120, 70%, 50%)",
            createdAt: new Date().toISOString(),
            plants: (plantsRef.current || []).map((p) => ({ id: p.id })),
            weatherData: [],
            lightData: [],
            lightHistory: [],
            electricityPricePerKwh: 0
          };
          await dbSaveSpace(defaultSpace);
          await setSetting("activeSpaceId", defaultSpace.id);
          setSpaces([defaultSpace]);
          setActiveSpaceId(defaultSpace.id);
        }
      } catch (error) {
        console.error("Error loading from IndexedDB:", error);
      } finally {
        if (!ignore) setLoadedFromServer(true);
      }
    };
    void loadState();
    return () => { ignore = true; };
  }, [plantsLoaded]);

  // Debounced Persistence
  useEffect(() => {
    if (!loadedFromServer) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        for (const space of spaces) {
          await dbSaveSpace(space);
        }
        await setSetting("activeSpaceId", activeSpaceId);
      } catch (error) {
        console.error("Error saving to IndexedDB:", error);
      }
    }, SAVE_DEBOUNCE_DELAY);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [activeSpaceId, loadedFromServer, spaces]);

  const activeSpace = useMemo(() => {
    const found = spaces.find((s) => s.id === activeSpaceId);
    if (found) return found;
    if (spaces.length === 0) return undefined;
    return [...spaces].sort((a, b) =>
      new Date(a.createdAt || (a as any).created_at).getTime() - new Date(b.createdAt || (b as any).created_at).getTime()
    )[0];
  }, [spaces, activeSpaceId]);

  const addSpace = useCallback(async (override?: Partial<SpaceConfig>) => {
    const nextIndex = spacesRef.current.length + 1;

    const next: SpaceConfig = {
      id: generateUUID(),
      name: override?.name || `Space ${nextIndex}`,
      color: override?.color || `hsl(${(nextIndex * 40) % 360}, 70%, 50%)`,
      createdAt: new Date().toISOString(),
      plants: [],
      weatherData: [],
      lightData: [],
      lightHistory: [],
      electricityPricePerKwh: 0,
      ...override
    };

    // Immediate persistence to prevent race conditions during navigation
    try {
      await dbSaveSpace(next);
      await setSetting("activeSpaceId", next.id);
    } catch (error) {
      console.error("Error persisting new space:", error);
    }

    setSpaces((current) => [...current, next]);
    setActiveSpaceId(next.id);
    return next;
  }, []);

  const removeSpace = useCallback(async (spaceId: string) => {
    try {
      await dbDeleteSpace(spaceId);
      setSpaces((current) => {
        const remaining = current.filter((s) => s.id !== spaceId);
        if (activeSpaceIdRef.current === spaceId) {
          setActiveSpaceId(remaining[0]?.id || "");
        }
        return remaining;
      });
      return true;
    } catch (error) {
      console.error("Error deleting space:", error);
      return false;
    }
  }, []);

  const updateSpace = useCallback((next: SpaceConfig) => {
    setSpaces((current) => current.map((s) => (s.id === next.id ? next : s)));
  }, []);

  const patchActiveSpace = useCallback((patch: Partial<SpaceConfig>) => {
    setSpaces((current) => {
      const id = activeSpaceIdRef.current;
      const target = current.find((s) => s.id === id) || current[0];
      if (!target) return current;
      return current.map((s) => (s.id === target.id ? { ...s, ...patch } : s));
    });
  }, []);

  /**
   * Move a plant to a target space. Plants belong to exactly one space.
   * Atomically removes the plant from every other space before adding it
   * to the target space.
   */
  const movePlantToSpace = useCallback((plantId: string, targetSpaceId: string) => {
    setSpaces((current) => {
      const target = current.find((s) => s.id === targetSpaceId);
      if (!target) return current;
      return current.map((s) => {
        if (s.id === targetSpaceId) {
          const exists = s.plants.some((p) => p.id === plantId);
          return exists ? s : { ...s, plants: [...s.plants, { id: plantId }] };
        }
        return {
          ...s,
          plants: s.plants.filter((p) => p.id !== plantId)
        };
      });
    });
  }, []);

  const removePlantFromAllSpaces = useCallback((plantId: string) => {
    setSpaces((current) => {
      return current.map((s) => ({
        ...s,
        plants: s.plants.filter((p) => p.id !== plantId)
      }));
    });
  }, []);

  // Drop any space plant references that point to a plant no longer in the
  // provided plants list. Safe to call repeatedly.
  const pruneDanglingPlantRefs = useCallback((knownPlants: PlantProfile[]) => {
    const known = new Set(knownPlants.map((p) => p.id));
    setSpaces((current) => {
      let changed = false;
      const next = current.map((s) => {
        const filtered = (s.plants || []).filter((ref) => known.has(ref.id));
        if (filtered.length !== (s.plants || []).length) {
          changed = true;
          return { ...s, plants: filtered };
        }
        return s;
      });
      return changed ? next : current;
    });
  }, []);

  // Find which space currently owns the plant (if any).
  const findPlantSpace = useCallback((plantId: string): SpaceConfig | undefined => {
    return spacesRef.current.find((s) => s.plants.some((p) => p.id === plantId));
  }, []);

  // Synchronous version for UI (filtering plants for active space)
  const getCurrentSpacePlantsSync = useCallback((spaceId?: string): PlantProfile[] => {
    const targetSpaceId = spaceId ?? activeSpaceId;
    if (!targetSpaceId || spaces.length === 0) return plantsRef.current;

    const space = spaces.find((s) => s.id === targetSpaceId);
    if (!space) return plantsRef.current;

    if (spaces.length === 1 && (!space.plants || space.plants.length === 0)) {
      return plantsRef.current;
    }

    const filtered = plantsRef.current.filter(
      (plant) => space.plants?.some((p) => p.id === plant.id)
    );
    return filtered.length > 0 ? filtered : (spaces.length === 1 ? plantsRef.current : []);
  }, [spaces, activeSpaceId]);

  return {
    spaces,
    activeSpace,
    activeSpaceId,
    setActiveSpaceId,
    loadedFromServer,
    addSpace,
    removeSpace,
    updateSpace,
    patchActiveSpace,
    movePlantToSpace,
    removePlantFromAllSpaces,
    pruneDanglingPlantRefs,
    findPlantSpace,
    getCurrentSpacePlantsSync
  };
}

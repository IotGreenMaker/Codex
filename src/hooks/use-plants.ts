"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { PlantProfile, GrowStage } from "@/lib/types";
import { 
  initializeDB, 
  getAllPlants, 
  getSetting, 
  setSetting, 
  savePlant as dbSavePlant, 
  deletePlant as dbDeletePlant 
} from "@/lib/indexeddb-storage";
import { createNewPlant } from "@/lib/newplant-data";
import { generateUUID } from "@/lib/uuid";
import { SAVE_DEBOUNCE_DELAY } from "@/lib/config";

export function usePlants() {
  const [plants, setPlants] = useState<PlantProfile[]>([]);
  const [activePlantId, setActivePlantId] = useState<string>("");
  const [loadedFromServer, setLoadedFromServer] = useState(false);
  
  const plantsRef = useRef<PlantProfile[]>([]);
  const activePlantIdRef = useRef<string>("");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync refs
  useEffect(() => { plantsRef.current = plants; }, [plants]);
  useEffect(() => { activePlantIdRef.current = activePlantId; }, [activePlantId]);

  // Initial Load
  useEffect(() => {
    let ignore = false;
    const loadState = async () => {
      try {
        await initializeDB();
        const loadedPlants = await getAllPlants();
        const savedActivePlantId = await getSetting("activePlantId");

        if (!ignore && loadedPlants.length > 0) {
          setPlants(loadedPlants);
          if (!savedActivePlantId) {
            const sorted = [...loadedPlants].sort((a, b) => 
              new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
            );
            setActivePlantId(sorted[0]?.id || loadedPlants[0].id);
          } else {
            setActivePlantId(savedActivePlantId);
          }
        }
      } catch (error) {
        console.error("Error loading from IndexedDB:", error);
      } finally {
        if (!ignore) setLoadedFromServer(true);
      }
    };
    void loadState();
    return () => { ignore = true; };
  }, []);

  // Debounced Persistence
  useEffect(() => {
    if (!loadedFromServer) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // IMPROVEMENT: Potential for bulk save here if we update indexeddb-storage.ts
        for (const plant of plants) {
          await dbSavePlant(plant);
        }
        await setSetting("activePlantId", activePlantId);

        // Sync to server API
        await fetch("/api/plants", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plants, activePlantId })
        });
      } catch (error) {
        console.error("Error saving to IndexedDB:", error);
      }
    }, SAVE_DEBOUNCE_DELAY);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [activePlantId, loadedFromServer, plants]);

  const activePlant = useMemo(() => {
    const found = plants.find((p) => p.id === activePlantId);
    if (found) return found;
    if (plants.length === 0) return undefined;
    return [...plants].sort((a, b) => 
      new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    )[0];
  }, [plants, activePlantId]);

  const addPlant = useCallback(async (override?: Partial<PlantProfile>) => {
    const nextIndex = plantsRef.current.length + 1;
    const currentActive = plantsRef.current.find(p => p.id === activePlantIdRef.current) || plantsRef.current[0];
    
    const next = createNewPlant({
      strainName: override?.strainName || `New Plant ${nextIndex}`,
      ...(currentActive ? {
        lightSchedule: currentActive.lightSchedule,
        lightsOn: currentActive.lightsOn,
        lightsOff: currentActive.lightsOff,
        containerVolumeL: currentActive.containerVolumeL,
        mediaVolumeL: currentActive.mediaVolumeL,
        mediaType: currentActive.mediaType,
        wateringIntervalDays: currentActive.wateringIntervalDays,
        feedRecipe: {
          ...currentActive.feedRecipe,
          additives: currentActive.feedRecipe.additives.map((entry) => ({ ...entry, id: generateUUID() }))
        }
      } : {}),
      ...override
    });

    // Immediate persistence to prevent race conditions during navigation
    try {
      await dbSavePlant(next);
      await setSetting("activePlantId", next.id);
    } catch (error) {
      console.error("Error persisting new plant:", error);
    }

    setPlants((current) => [...current, next]);
    setActivePlantId(next.id);
    return next;
  }, []);

  const removePlant = useCallback(async (plantId: string) => {
    try {
      await dbDeletePlant(plantId);
      setPlants((current) => {
        const remaining = current.filter((p) => p.id !== plantId);
        if (activePlantIdRef.current === plantId) {
          setActivePlantId(remaining[0]?.id || "");
        }
        return remaining;
      });
      return true;
    } catch (error) {
      console.error("Error deleting plant:", error);
      return false;
    }
  }, []);

  const updatePlant = useCallback((next: PlantProfile) => {
    setPlants((current) => current.map((p) => (p.id === next.id ? next : p)));
  }, []);

  const patchActivePlant = useCallback((patch: Partial<PlantProfile>) => {
    setPlants((current) => {
      const id = activePlantIdRef.current;
      const target = current.find((p) => p.id === id) || current[0];
      if (!target) return current;
      return current.map((p) => (p.id === target.id ? { ...p, ...patch } : p));
    });
  }, []);

  return {
    plants,
    activePlant,
    activePlantId,
    setActivePlantId,
    loadedFromServer,
    addPlant,
    removePlant,
    updatePlant,
    patchActivePlant
  };
}

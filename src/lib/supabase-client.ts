import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function saveConversation(
  plantId: string,
  role: "user" | "assistant",
  content: string
) {
  const { data, error } = await supabase.from("conversations").insert([
    {
      plant_id: plantId,
      role: role,
      content: content,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) console.error("Supabase save error:", error);
  return data;
}

export async function getPreviousContext(plantId: string, limit: number = 20) {
  const { data, error } = await supabase
    .from("conversations")
    .select("role, content, created_at")
    .eq("plant_id", plantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) console.error("Supabase fetch error:", error);
  return data?.reverse() || [];
}

export async function saveSensorData(
  plantId: string,
  sensorData: {
    moisture?: number;
    temperature?: number;
    humidity?: number;
    light?: number;
  }
) {
  const { error } = await supabase
    .from("sensor_readings")
    .insert([
      {
        plant_id: plantId,
        ...sensorData,
        created_at: new Date().toISOString(),
      },
    ]);

  if (error) console.error("Sensor save error:", error);
}

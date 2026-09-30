import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { fileURLToPath } from "url";
import path from "path";
dotenv.config();
const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;
const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

/* =========================================================
   BREEDING GROUNDS V3
   Core configuration
   ========================================================= */

const VERSION = "3.0.0";

/*
  V3 PERFORMANCE STANDARD

  We deliberately use ONLY:

  - power_bhp
  - torque_nm
  - weight_kg
  - acceleration_0_60_mph
  - top_speed_mph
  - combined_mpg_uk

  0-62 MPH DOES NOT EXIST IN V3.
*/

/* =========================================================
   HEALTH
   ========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    project: "Breeding Grounds",
    version: VERSION,
    status: "ONLINE",
    database: Boolean(supabase),
    timestamp: new Date().toISOString()
  });
});
/* =========================================================
   GEMINI CONNECTION TEST
   ========================================================= */

app.get("/api/gemini-test", async (req, res) => {
  try {
    if (!gemini) {
      return res.status(500).json({
        ok: false,
        error: "GEMINI_NOT_CONFIGURED"
      });
    }

    const response = await gemini.models.generateContent({
      model: "gemini-3.8-flash",
      contents: "Reply with exactly: BREEDING GROUNDS V3 GEMINI ONLINE"
    });

    res.json({
      ok: true,
      model: "gemini-3.8-flash",
      response: response.text
    });
  } catch (error) {
    console.error("GEMINI_TEST_ERROR", error);

    res.status(500).json({
      ok: false,
      error: "GEMINI_CONNECTION_FAILED",
      message: error.message
    });
  }
});
/* =========================================================
   VEHICLE RESEARCH ENGINE
   ========================================================= */

async function researchVehicle(vehicleName) {
  if (!gemini) {
    throw new Error("GEMINI_NOT_CONFIGURED");
  }

  const prompt = `
You are the Breeding Grounds V3 Vehicle Research Engine.

Research this exact vehicle:

${vehicleName}

Use Google Search to find reliable real-world automotive sources.

Return ONLY valid JSON matching the required structure.

Research rules:

1. Identify the correct vehicle and exact variant where possible.
2. Do not guess or invent specifications.
3. If a specification cannot be reliably established, return null.
4. Use horsepower in bhp.
5. Use torque in Nm.
6. Use kerb weight in kg where available.
7. Use 0-60 mph only.
8. Use top speed in mph.
9. Use combined UK MPG where reliably available.
10. Record the most useful source URL.
11. Record the source type.
12. Give a confidence value of HIGH, MEDIUM or LOW.
13. Put important uncertainty or conflicting information in notes.
14. Do not substitute figures from a different generation or variant.

The research must be suitable for use in a vehicle performance database.

Vehicle name:
${vehicleName}
`;

  const response = await gemini.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
    config: {
      tools: [
        {
          googleSearch: {}
        }
      ],
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          manufacturer: { type: "string" },
          model: { type: "string" },
          generation: { type: ["string", "null"] },
          variant: { type: ["string", "null"] },
          power_bhp: { type: ["number", "null"] },
          torque_nm: { type: ["number", "null"] },
          weight_kg: { type: ["number", "null"] },
          acceleration_0_60_mph: { type: ["number", "null"] },
          top_speed_mph: { type: ["number", "null"] },
          combined_mpg_uk: { type: ["number", "null"] },
          source_url: { type: ["string", "null"] },
          source_type: { type: ["string", "null"] },
          confidence: { type: "string" },
          notes: { type: ["string", "null"] }
        },
        required: [
          "name",
          "manufacturer",
          "model",
          "generation",
          "variant",
          "power_bhp",
          "torque_nm",
          "weight_kg",
          "acceleration_0_60_mph",
          "top_speed_mph",
          "combined_mpg_uk",
          "source_url",
          "source_type",
          "confidence",
          "notes"
        ]
      }
    }
  });

  return JSON.parse(response.text);
}
/* =========================================================
   VEHICLE LOOKUP
   ========================================================= */

app.get("/api/vehicles/search", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();

    if (!query) {
      return res.status(400).json({
        error: "VEHICLE_QUERY_REQUIRED"
      });
    }

    if (!supabase) {
      return res.status(500).json({
        error: "DATABASE_NOT_CONFIGURED"
      });
    }

    const { data, error } = await supabase
      .from("vehicle_specs")
      .select("*")
      .limit(1000);

    if (error) {
      console.error("VEHICLE_SEARCH_ERROR", error);

      return res.status(500).json({
        error: "VEHICLE_SEARCH_FAILED"
      });
    }

    const normalisedQuery = query
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    const tokens = normalisedQuery
      .split(/\s+/)
      .filter(Boolean);

    const matches = (data || [])
      .map((vehicle) => {
        const searchable = [
          vehicle.name,
          vehicle.vehicle_name,
          vehicle.manufacturer,
          vehicle.make,
          vehicle.model,
          vehicle.generation,
          vehicle.variant,
          vehicle.normalized_name
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        let score = 0;

        for (const token of tokens) {
          if (searchable.includes(token)) {
            score++;
          }
        }

        return {
          vehicle,
          score
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    res.json({
      query,
      found: matches.length > 0,
      vehicles: matches.slice(0, 20).map((item) => item.vehicle)
    });
  } catch (error) {
    console.error("VEHICLE_SEARCH_ERROR", error);

    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR"
    });
  }
});

/* =========================================================
   BREEDING ENGINE PLACEHOLDER
   ========================================================= */

app.post("/api/breed", async (req, res) => {
  try {
    const { vehicle1, vehicle2 } = req.body || {};

    if (!vehicle1 || !vehicle2) {
      return res.status(400).json({
        error: "TWO_VEHICLES_REQUIRED"
      });
    }

    /*
      V3 breeding engine will be added here.

      The important architectural rule is:

      vehicle lookup
        ->
      research fallback
        ->
      staging save
        ->
      breeding
        ->
      offspring
        ->
      Green Slip
        ->
      Garage
    */

    res.json({
      ok: true,
      status: "BREEDING_ENGINE_READY",
      message: "V3 breeding pipeline is ready for implementation."
    });
  } catch (error) {
    console.error("BREED_ERROR", error);

    res.status(500).json({
      error: "BREEDING_FAILED"
    });
  }
});

/* =========================================================
   START SERVER
   ========================================================= */

app.listen(PORT, () => {
  console.log("");
  console.log("==========================================");
  console.log(" BREEDING GROUNDS V3");
  console.log(" Born to perform. Breed to win.");
  console.log("==========================================");
  console.log(` Version: ${VERSION}`);
  console.log(` Port: ${PORT}`);
  console.log(" 0-60 MPH: ENABLED");
  console.log(" 0-62 MPH: DISABLED");
  console.log("==========================================");
  console.log("");
});

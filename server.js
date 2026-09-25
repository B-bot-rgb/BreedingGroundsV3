import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
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

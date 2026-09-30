import express from "express";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { fileURLToPath } from "url";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = "3.0.0";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================================================
   CORE HELPERS
   ========================================================= */

function normaliseName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function makeDnaId() {
  return `BG-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
}

function ratingClass(rating) {
  if (rating >= 90) return "LEGENDARY";
  if (rating >= 80) return "ELITE";
  if (rating >= 70) return "HIGH";
  if (rating >= 60) return "STRONG";
  if (rating >= 50) return "SOLID";
  return "PROJECT";
}

function calculateBreedRating(stats) {
  const power = cleanNumber(stats.power_bhp);
  const torque = cleanNumber(stats.torque_nm);
  const weight = cleanNumber(stats.weight_kg);
  const acceleration = cleanNumber(stats.acceleration_0_60_mph);
  const topSpeed = cleanNumber(stats.top_speed_mph);

  const powerScore = power ? Math.min(100, power / 5) : 50;
  const torqueScore = torque ? Math.min(100, torque / 4) : 50;
  const weightScore = weight ? Math.max(0, Math.min(100, 120 - weight / 18)) : 50;
  const accelerationScore = acceleration
    ? Math.max(0, Math.min(100, 115 - acceleration * 12))
    : 50;
  const topSpeedScore = topSpeed
    ? Math.min(100, topSpeed / 2)
    : 50;

  const rating = Math.round(
    powerScore * 0.25 +
    torqueScore * 0.20 +
    weightScore * 0.20 +
    accelerationScore * 0.20 +
    topSpeedScore * 0.15
  );

  return Math.max(1, Math.min(100, rating));
}

async function requireSupabase() {
  if (!supabase) throw new Error("DATABASE_NOT_CONFIGURED");
  return supabase;
}

async function getAuthenticatedUser(req) {
  if (!supabase) throw new Error("DATABASE_NOT_CONFIGURED");

  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;

  const token = header.slice(7).trim();
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  return data.user;
}

async function requireAuthenticatedUser(req) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    const error = new Error("AUTHENTICATION_REQUIRED");
    error.statusCode = 401;
    throw error;
  }
  return user;
}

async function getOrCreateBreeder(user, username, displayName = null) {
  const db = await requireSupabase();

  const { data: existing, error: existingError } = await db
    .from("breeders")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const safeUsername = String(username || user.email?.split("@")[0] || `breeder_${user.id.slice(0, 8)}`)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .slice(0, 40);

  const { data, error } = await db
    .from("breeders")
    .insert({
      id: user.id,
      username: safeUsername,
      display_name: displayName || safeUsername
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function findVehicleSpecs(vehicleName) {
  const db = await requireSupabase();
  const query = normaliseName(vehicleName);
  const tokens = query.split(/\s+/).filter(Boolean);

  const { data, error } = await db
    .from("vehicle_specs")
    .select("*")
    .limit(1000);

  if (error) throw error;

  const matches = (data || [])
    .map((vehicle) => {
      const searchable = [
        vehicle.name,
        vehicle.vehicle_name,
        vehicle.manufacturer,
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
        if (searchable.includes(token)) score++;
      }

      return { vehicle, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return matches.length ? matches[0].vehicle : null;
}

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
    gemini: Boolean(gemini),
    timestamp: new Date().toISOString()
  });
});

/* =========================================================
   AUTH
   ========================================================= */

app.post("/api/auth/signup", async (req, res) => {
  try {
    if (!supabase) throw new Error("DATABASE_NOT_CONFIGURED");

    const { email, password, username, displayName } = req.body || {};

    if (!email || !password || !username) {
      return res.status(400).json({
        ok: false,
        error: "EMAIL_PASSWORD_USERNAME_REQUIRED"
      });
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (error) throw error;

    const breeder = await getOrCreateBreeder(
      data.user,
      username,
      displayName
    );

    res.json({
      ok: true,
      user: data.user,
      breeder
    });
  } catch (error) {
    console.error("AUTH_SIGNUP_ERROR", error);
    res.status(error.statusCode || 500).json({
      ok: false,
      error: "SIGNUP_FAILED",
      message: error.message
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    if (!supabase) throw new Error("DATABASE_NOT_CONFIGURED");

    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: "EMAIL_PASSWORD_REQUIRED"
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    const breeder = await getOrCreateBreeder(data.user);

    res.json({
      ok: true,
      session: data.session,
      user: data.user,
      breeder
    });
  } catch (error) {
    console.error("AUTH_LOGIN_ERROR", error);
    res.status(500).json({
      ok: false,
      error: "LOGIN_FAILED",
      message: error.message
    });
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const db = await requireSupabase();

    const { data: breeder, error } = await db
      .from("breeders")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) throw error;

    res.json({ ok: true, user, breeder });
  } catch (error) {
    console.error("AUTH_ME_ERROR", error);
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.statusCode === 401 ? "AUTHENTICATION_REQUIRED" : "AUTH_ME_FAILED",
      message: error.message
    });
  }
});

/* =========================================================
   GEMINI
   ========================================================= */

app.get("/api/gemini-test", async (req, res) => {
  try {
    if (!gemini) throw new Error("GEMINI_NOT_CONFIGURED");

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
  if (!gemini) throw new Error("GEMINI_NOT_CONFIGURED");

  const prompt = `
You are the Breeding Grounds V3 Vehicle Research Engine.

Research this exact vehicle:

${vehicleName}

Use Google Search to find reliable real-world automotive sources.

Return ONLY valid JSON matching the required structure.

Rules:
1. Identify the exact vehicle and variant where possible.
2. Never guess or invent specifications.
3. Return null when a figure cannot be reliably established.
4. Power must be bhp.
5. Torque must be Nm.
6. Weight must be kerb weight in kg where available.
7. Acceleration must be 0-60 mph.
8. Top speed must be mph.
9. Fuel economy must be combined UK MPG where reliably available.
10. Record the most useful source URL.
11. Record source type.
12. Confidence must be HIGH, MEDIUM or LOW.
13. Put uncertainty or conflicting figures in notes.
14. Never substitute figures from another generation or variant.

Vehicle name:
${vehicleName}
`;

  const response = await gemini.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
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

async function saveResearchResult(vehicleName, research) {
  const db = await requireSupabase();
  const normalizedName = normaliseName(vehicleName);

  const { data, error } = await db
    .from("vehicle_specs_staging")
    .insert({
      name: research.name || vehicleName,
      vehicle_name: vehicleName,
      manufacturer: research.manufacturer || null,
      model: research.model || null,
      generation: research.generation || null,
      variant: research.variant || null,
      normalized_name: normalizedName,
      power_bhp: research.power_bhp ?? null,
      torque_nm: research.torque_nm ?? null,
      weight_kg: research.weight_kg ?? null,
      acceleration_0_60_mph: research.acceleration_0_60_mph ?? null,
      top_speed_mph: research.top_speed_mph ?? null,
      combined_mpg_uk: research.combined_mpg_uk ?? null,
      source_url: research.source_url || null,
      source_type: research.source_type || null,
      confidence: research.confidence || null,
      notes: research.notes || null,
      status: "UNVERIFIED",
      next_action: "VERIFY",
      researched_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

app.get("/api/vehicles/search", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();

    if (!query) {
      return res.status(400).json({
        ok: false,
        error: "VEHICLE_QUERY_REQUIRED"
      });
    }

    const vehicle = await findVehicleSpecs(query);

    res.json({
      ok: true,
      found: Boolean(vehicle),
      vehicle
    });
  } catch (error) {
    console.error("VEHICLE_SEARCH_ERROR", error);
    res.status(500).json({
      ok: false,
      error: "VEHICLE_SEARCH_FAILED",
      message: error.message
    });
  }
});

app.get("/api/vehicles/research", async (req, res) => {
  try {
    const vehicleName = String(req.query.vehicle || "").trim();

    if (!vehicleName) {
      return res.status(400).json({
        ok: false,
        error: "VEHICLE_NAME_REQUIRED"
      });
    }

    const research = await researchVehicle(vehicleName);
    const savedResearch = await saveResearchResult(vehicleName, research);

    res.json({
      ok: true,
      vehicle: vehicleName,
      research,
      savedResearch
    });
  } catch (error) {
    console.error("VEHICLE_RESEARCH_ERROR", error);
    res.status(500).json({
      ok: false,
      error: "VEHICLE_RESEARCH_FAILED",
      message: error.message
    });
  }
});

/* =========================================================
   RESEARCH VERIFICATION + RATIFICATION
   ========================================================= */

async function verifyStagedVehicle(stagingId) {
  const db = await requireSupabase();

  const { data: stagedVehicle, error: fetchError } = await db
    .from("vehicle_specs_staging")
    .select("*")
    .eq("id", stagingId)
    .single();

  if (fetchError) throw fetchError;
  if (!stagedVehicle) throw new Error("STAGING_VEHICLE_NOT_FOUND");

  if (stagedVehicle.status !== "UNVERIFIED") {
    throw new Error("VEHICLE_NOT_AWAITING_VERIFICATION");
  }

  const { data, error } = await db
    .from("vehicle_specs_staging")
    .update({
      status: "VERIFIED",
      next_action: "RATIFY"
    })
    .eq("id", stagingId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function ratifyStagedVehicle(stagingId) {
  const db = await requireSupabase();

  const { data: stagedVehicle, error: fetchError } = await db
    .from("vehicle_specs_staging")
    .select("*")
    .eq("id", stagingId)
    .single();

  if (fetchError) throw fetchError;
  if (!stagedVehicle) throw new Error("STAGING_VEHICLE_NOT_FOUND");

  if (stagedVehicle.status !== "VERIFIED") {
    throw new Error("VEHICLE_NOT_READY_FOR_RATIFICATION");
  }

  const { data: directoryVehicle, error: directoryError } = await db
    .from("vehicle_directory")
    .upsert(
      {
        name: stagedVehicle.name,
        manufacturer: stagedVehicle.manufacturer,
        model: stagedVehicle.model,
        generation: stagedVehicle.generation,
        variant: stagedVehicle.variant,
        normalized_name: stagedVehicle.normalized_name
      },
      { onConflict: "normalized_name" }
    )
    .select()
    .single();

  if (directoryError) throw directoryError;

  const { data: liveVehicle, error: liveError } = await db
    .from("vehicle_specs")
    .insert({
      vehicle_directory_id: directoryVehicle.id,
      name: stagedVehicle.name,
      manufacturer: stagedVehicle.manufacturer,
      model: stagedVehicle.model,
      generation: stagedVehicle.generation,
      variant: stagedVehicle.variant,
      normalized_name: stagedVehicle.normalized_name,
      power_bhp: stagedVehicle.power_bhp,
      torque_nm: stagedVehicle.torque_nm,
      weight_kg: stagedVehicle.weight_kg,
      acceleration_0_60_mph: stagedVehicle.acceleration_0_60_mph,
      top_speed_mph: stagedVehicle.top_speed_mph,
      combined_mpg_uk: stagedVehicle.combined_mpg_uk,
      source_url: stagedVehicle.source_url,
      source_type: stagedVehicle.source_type,
      confidence: stagedVehicle.confidence,
      notes: stagedVehicle.notes,
      verified_at: new Date().toISOString()
    })
    .select()
    .single();

  if (liveError) throw liveError;

  const { data: updatedStage, error: stageError } = await db
    .from("vehicle_specs_staging")
    .update({
      status: "RATIFIED",
      next_action: "COMPLETE"
    })
    .eq("id", stagingId)
    .select()
    .single();

  if (stageError) throw stageError;

  return {
    staging: updatedStage,
    liveVehicle,
    directoryVehicle
  };
}

app.post("/api/vehicles/verify", async (req, res) => {
  try {
    const { stagingId } = req.body || {};
    if (!stagingId) {
      return res.status(400).json({
        ok: false,
        error: "STAGING_ID_REQUIRED"
      });
    }

    const verifiedVehicle = await verifyStagedVehicle(stagingId);

    res.json({ ok: true, verifiedVehicle });
  } catch (error) {
    console.error("VEHICLE_VERIFY_ERROR", error);
    res.status(500).json({
      ok: false,
      error: "VEHICLE_VERIFICATION_FAILED",
      message: error.message
    });
  }
});

app.post("/api/vehicles/ratify", async (req, res) => {
  try {
    const { stagingId } = req.body || {};
    if (!stagingId) {
      return res.status(400).json({
        ok: false,
        error: "STAGING_ID_REQUIRED"
      });
    }

    const result = await ratifyStagedVehicle(stagingId);

    res.json({ ok: true, result });
  } catch (error) {
    console.error("VEHICLE_RATIFY_ERROR", error);
    res.status(500).json({
      ok: false,
      error: "VEHICLE_RATIFICATION_FAILED",
      message: error.message
    });
  }
});

app.get("/api/vehicles/staging", async (req, res) => {
  try {
    const db = await requireSupabase();

    const { data, error } = await db
      .from("vehicle_specs_staging")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json({ ok: true, vehicles: data || [] });
  } catch (error) {
    console.error("STAGING_LIST_ERROR", error);
    res.status(500).json({
      ok: false,
      error: "STAGING_LIST_FAILED",
      message: error.message
    });
  }
});

/* =========================================================
   BREEDING ENGINE
   ========================================================= */

async function createBreedingRecord(breederId, donor1, donor2) {
  const db = await requireSupabase();

  const { data, error } = await db
    .from("breedings")
    .insert({
      breeder_id: breederId,
      donor_1_name: donor1.name,
      donor_2_name: donor2.name,
      donor_1_data: donor1,
      donor_2_data: donor2,
      status: "STARTED"
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function buildOffspringProfile(donor1, donor2) {
  if (!gemini) throw new Error("GEMINI_NOT_CONFIGURED");

  const prompt = `
You are the Breeding Grounds V3 DNA Engine.

Create one fictional automotive offspring from these two verified donor vehicles.

DONOR 1:
${JSON.stringify(donor1)}

DONOR 2:
${JSON.stringify(donor2)}

Return ONLY JSON.

Rules:
- Create a believable original vehicle identity.
- Combine characteristics from both donors.
- Do not simply copy one donor.
- Performance figures must be plausible blends of the supplied figures.
- Use only the V3 performance fields supplied below.
- Create a memorable Breeding Grounds vehicle name.
- Generate a short DNA description.
- Do not invent a manufacturer as if it were a real production model; this is an original offspring.

Required JSON:
{
  "name": "string",
  "manufacturer": "string",
  "model": "string",
  "generation": "string",
  "variant": "string",
  "power_bhp": number,
  "torque_nm": number,
  "weight_kg": number,
  "acceleration_0_60_mph": number,
  "top_speed_mph": number,
  "combined_mpg_uk": number,
  "dna_description": "string"
}
`;

  const response = await gemini.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          manufacturer: { type: "string" },
          model: { type: "string" },
          generation: { type: "string" },
          variant: { type: "string" },
          power_bhp: { type: "number" },
          torque_nm: { type: "number" },
          weight_kg: { type: "number" },
          acceleration_0_60_mph: { type: "number" },
          top_speed_mph: { type: "number" },
          combined_mpg_uk: { type: "number" },
          dna_description: { type: "string" }
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
          "dna_description"
        ]
      }
    }
  });

  return JSON.parse(response.text);
}


async function generateOffspringImage(donor1, donor2, profile) {
  if (!gemini) {
    throw new Error("GEMINI_NOT_CONFIGURED");
  }

  const prompt = `
Create a photorealistic automotive reveal image for Breeding Grounds Laboratory.

The vehicle is a completely original AI-bred performance car created from the visual DNA of:

DONOR 1:
${donor1.name}

DONOR 2:
${donor2.name}

OFFSPRING:
${profile.name}
${profile.manufacturer} ${profile.model}
Generation: ${profile.generation}
Variant: ${profile.variant}

DNA DESCRIPTION:
${profile.dna_description}

IMPORTANT:
- Create ONE finished vehicle.
- The result must visibly combine design DNA from both donor vehicles.
- Do not simply place the two donor cars together.
- Do not create a collage.
- Do not show multiple cars.
- The offspring must look like a believable production performance car.
- Preserve recognizable influences from both donors while creating a new design.
- Aggressive but realistic proportions.
- High-end automotive photography.
- Dark Breeding Grounds Laboratory environment.
- Dramatic studio lighting.
- Vehicle shown in a three-quarter front view.
- Full vehicle visible.
- Sharp bodywork and realistic materials.
- No people.
- No text.
- No logos added by the AI.
- No fantasy elements.
- Photorealistic.
- Cinematic automotive advertising quality.
`;

  const response = await gemini.models.generateContent({
    model: "gemini-3.1-flash-image",
    contents: prompt,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      responseFormat: {
        image: {
          aspectRatio: "16:9",
          imageSize: "1K"
        }
      }
    }
  });

  const parts = response.candidates?.[0]?.content?.parts || [];

  const imagePart = parts.find(
    part => part.inlineData?.data
  );

  if (!imagePart?.inlineData?.data) {
    throw new Error("OFFSPRING_IMAGE_GENERATION_FAILED");
  }

  const mimeType = imagePart.inlineData.mimeType || "image/png";

  return `data:${mimeType};base64,${imagePart.inlineData.data}`;
}
async function createOffspring(breederId, breedingId, donor1, donor2, profile) {
  const db = await requireSupabase();

  const breedRating = calculateBreedRating(profile);
  const dnaId = makeDnaId();

  const imageUrl = await generateOffspringImage(
    donor1,
    donor2,
    profile
  );

  const { data, error } = await db
    .from("offspring")
    .insert({
      breeder_id: breederId,
      breeding_id: breedingId,
      name: profile.name,
      manufacturer: profile.manufacturer,
      model: profile.model,
      generation: profile.generation,
      variant: profile.variant,
      dna_id: dnaId,
      generation_number: 1,
      power_bhp: profile.power_bhp,
      torque_nm: profile.torque_nm,
      weight_kg: profile.weight_kg,
      acceleration_0_60_mph: profile.acceleration_0_60_mph,
      top_speed_mph: profile.top_speed_mph,
      combined_mpg_uk: profile.combined_mpg_uk,
      breed_rating: breedRating,
      rating_class: ratingClass(breedRating),
      image_url: imageUrl
    })
    .select()
    .single();

  if (error) throw error;

  await db
    .from("breedings")
    .update({ status: "COMPLETE" })
    .eq("id", breedingId);

  return {
    ...data,
    dna_description: profile.dna_description
  };
}    
   

app.post("/api/breed", async (req, res) => {
  try {
    const { vehicle1, vehicle2 } = req.body || {};

    if (!vehicle1 || !vehicle2) {
      return res.status(400).json({
        ok: false,
        error: "TWO_VEHICLES_REQUIRED"
      });
    }

    const donor1 = await findVehicleSpecs(vehicle1);
    const donor2 = await findVehicleSpecs(vehicle2);

    if (!donor1 || !donor2) {
      return res.status(404).json({
        ok: false,
        error: "VEHICLE_DATA_REQUIRED",
        message: "Both donor vehicles must have verified live specifications before breeding."
      });
    }

    const user = await requireAuthenticatedUser(req);
    const breeder = await getOrCreateBreeder(user);

    const breeding = await createBreedingRecord(
      breeder.id,
      donor1,
      donor2
    );

    const profile = await buildOffspringProfile(donor1, donor2);
   const offspring = await createOffspring(
  breeder.id,
  breeding.id,
  donor1,
  donor2,
  profile
);

    res.json({
      ok: true,
      breeding,
      offspring,
      message: "DNA BREEDING COMPLETE"
    });
  } catch (error) {
    console.error("BREED_ERROR", error);
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.statusCode === 401
        ? "AUTHENTICATION_REQUIRED"
        : "BREEDING_FAILED",
      message: error.message
    });
  }
});

/* =========================================================
   GARAGE
   ========================================================= */

app.get("/api/garage", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const db = await requireSupabase();

    const { data, error } = await db
      .from("garage")
      .select("*, offspring(*)")
      .eq("breeder_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ ok: true, garage: data || [] });
  } catch (error) {
    console.error("GARAGE_LIST_ERROR", error);
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.statusCode === 401 ? "AUTHENTICATION_REQUIRED" : "GARAGE_LIST_FAILED",
      message: error.message
    });
  }
});

app.post("/api/garage", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const db = await requireSupabase();
    const { offspringId } = req.body || {};

    if (!offspringId) {
      return res.status(400).json({
        ok: false,
        error: "OFFSPRING_ID_REQUIRED"
      });
    }

    const { data, error } = await db
      .from("garage")
      .insert({
        breeder_id: user.id,
        offspring_id: offspringId
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ ok: true, garageEntry: data });
  } catch (error) {
    console.error("GARAGE_ADD_ERROR", error);
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.statusCode === 401 ? "AUTHENTICATION_REQUIRED" : "GARAGE_ADD_FAILED",
      message: error.message
    });
  }
});

/* =========================================================
   GREEN SLIPS
   ========================================================= */

app.post("/api/green-slips", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const db = await requireSupabase();
    const { offspringId } = req.body || {};

    if (!offspringId) {
      return res.status(400).json({
        ok: false,
        error: "OFFSPRING_ID_REQUIRED"
      });
    }

    const { data: offspring, error: offspringError } = await db
      .from("offspring")
      .select("*")
      .eq("id", offspringId)
      .eq("breeder_id", user.id)
      .single();

    if (offspringError) throw offspringError;

    const cardNumber = `GS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    const { data, error } = await db
      .from("green_slips")
      .insert({
        offspring_id: offspring.id,
        breeder_id: user.id,
        card_number: cardNumber,
        card_status: "ACTIVE"
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      ok: true,
      greenSlip: data,
      offspring
    });
  } catch (error) {
    console.error("GREEN_SLIP_CREATE_ERROR", error);
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.statusCode === 401 ? "AUTHENTICATION_REQUIRED" : "GREEN_SLIP_CREATE_FAILED",
      message: error.message
    });
  }
});

app.get("/api/green-slips", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const db = await requireSupabase();

    const { data, error } = await db
      .from("green_slips")
      .select("*, offspring(*)")
      .eq("breeder_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ ok: true, greenSlips: data || [] });
  } catch (error) {
    console.error("GREEN_SLIP_LIST_ERROR", error);
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.statusCode === 401 ? "AUTHENTICATION_REQUIRED" : "GREEN_SLIP_LIST_FAILED",
      message: error.message
    });
  }
});

/* =========================================================
   PHOTO HUB
   ========================================================= */

app.get("/api/photos", async (req, res) => {
  try {
    const db = await requireSupabase();

    const { data, error } = await db
      .from("photos")
      .select("*, offspring(*)")
      .eq("visibility", "PUBLIC")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json({ ok: true, photos: data || [] });
  } catch (error) {
    console.error("PHOTO_LIST_ERROR", error);
    res.status(500).json({
      ok: false,
      error: "PHOTO_LIST_FAILED",
      message: error.message
    });
  }
});

app.post("/api/photos", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const db = await requireSupabase();
    const { offspringId, imageUrl, title, caption, visibility } = req.body || {};

    if (!imageUrl) {
      return res.status(400).json({
        ok: false,
        error: "IMAGE_URL_REQUIRED"
      });
    }

    const { data, error } = await db
      .from("photos")
      .insert({
        breeder_id: user.id,
        offspring_id: offspringId || null,
        image_url: imageUrl,
        title: title || null,
        caption: caption || null,
        visibility: visibility || "PUBLIC"
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ ok: true, photo: data });
  } catch (error) {
    console.error("PHOTO_CREATE_ERROR", error);
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.statusCode === 401 ? "AUTHENTICATION_REQUIRED" : "PHOTO_CREATE_FAILED",
      message: error.message
    });
  }
});

/* =========================================================
   COMMUNITY
   ========================================================= */

app.get("/api/community/posts", async (req, res) => {
  try {
    const db = await requireSupabase();

    const { data, error } = await db
      .from("community_posts")
      .select("*, breeders(username, display_name), offspring(*), photos(*)")
      .eq("visibility", "PUBLIC")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json({ ok: true, posts: data || [] });
  } catch (error) {
    console.error("COMMUNITY_LIST_ERROR", error);
    res.status(500).json({
      ok: false,
      error: "COMMUNITY_LIST_FAILED",
      message: error.message
    });
  }
});

app.post("/api/community/posts", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const db = await requireSupabase();
    const { offspringId, photoId, title, body, visibility } = req.body || {};

    if (!title && !body) {
      return res.status(400).json({
        ok: false,
        error: "POST_CONTENT_REQUIRED"
      });
    }

    await getOrCreateBreeder(user);

    const { data, error } = await db
      .from("community_posts")
      .insert({
        breeder_id: user.id,
        offspring_id: offspringId || null,
        photo_id: photoId || null,
        title: title || null,
        body: body || null,
        visibility: visibility || "PUBLIC"
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ ok: true, post: data });
  } catch (error) {
    console.error("COMMUNITY_CREATE_ERROR", error);
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.statusCode === 401 ? "AUTHENTICATION_REQUIRED" : "COMMUNITY_CREATE_FAILED",
      message: error.message
    });
  }
});

app.post("/api/community/posts/:postId/like", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const db = await requireSupabase();

    const { data, error } = await db
      .from("community_likes")
      .insert({
        post_id: req.params.postId,
        breeder_id: user.id
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ ok: true, like: data });
  } catch (error) {
    console.error("COMMUNITY_LIKE_ERROR", error);
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.statusCode === 401 ? "AUTHENTICATION_REQUIRED" : "COMMUNITY_LIKE_FAILED",
      message: error.message
    });
  }
});

app.post("/api/community/posts/:postId/comments", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const db = await requireSupabase();
    const { comment } = req.body || {};

    if (!comment) {
      return res.status(400).json({
        ok: false,
        error: "COMMENT_REQUIRED"
      });
    }

    const { data, error } = await db
      .from("community_comments")
      .insert({
        post_id: req.params.postId,
        breeder_id: user.id,
        comment
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ ok: true, comment: data });
  } catch (error) {
    console.error("COMMUNITY_COMMENT_ERROR", error);
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.statusCode === 401 ? "AUTHENTICATION_REQUIRED" : "COMMUNITY_COMMENT_FAILED",
      message: error.message
    });
  }
});

/* =========================================================
   TROPHIES
   ========================================================= */

app.get("/api/trophies", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const db = await requireSupabase();

    const { data, error } = await db
      .from("trophies")
      .select("*")
      .eq("breeder_id", user.id)
      .order("awarded_at", { ascending: false });

    if (error) throw error;

    res.json({ ok: true, trophies: data || [] });
  } catch (error) {
    console.error("TROPHY_LIST_ERROR", error);
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.statusCode === 401 ? "AUTHENTICATION_REQUIRED" : "TROPHY_LIST_FAILED",
      message: error.message
    });
  }
});

/* =========================================================
   GENERIC ERROR HANDLER
   ========================================================= */

app.use((err, req, res, next) => {
  console.error("UNHANDLED_SERVER_ERROR", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.statusCode || 500).json({
    ok: false,
    error: "INTERNAL_SERVER_ERROR",
    message: err.message
  });
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
  console.log(" Performance system: V3 standard");
  console.log("==========================================");
  console.log("");
});

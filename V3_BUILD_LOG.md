# 🧬 BREEDING GROUNDS V3 — BUILD LOG

## Project

**Breeding Grounds V3**

Repository:
`B-bot-rgb/BreedingGroundsV3`

Production:
`breedinggrounds.app`

Original application:
`B-bot-rgb/BreedingGrounds`

V3 status:
**BUILDING**

---

# MASTER V3 VISION

Breeding Grounds is an AI automotive laboratory and community platform.

The core experience:

Customer enters two vehicles
→ identify vehicle DNA
→ research missing vehicles when necessary
→ breed the two vehicles
→ generate a unique offspring
→ calculate performance
→ create unique DNA identity
→ create Green Slip
→ save to Garage
→ optionally share with Community / Photo Hub.

---

# V3 CORE SYSTEMS

## 1. Laboratory / Breeding

The main Breeding Grounds experience.

Customer selects:

- Donor Vehicle 01
- Donor Vehicle 02

The system identifies their vehicle data and creates a unique offspring.

---

## 2. Vehicle Research

If a vehicle exists in LIVE vehicle data:

**Use existing data.**

If it does not exist:

**Research with Gemini.**

Research is saved into staging data and can immediately be used for breeding.

Later:

STAGING
→ VERIFY
→ PROMOTE
→ LIVE

---

# PERFORMANCE DATA STANDARD

V3 deliberately uses ONLY:

- Power — bhp
- Torque — Nm
- Weight — kg
- 0–60 mph
- Top speed — mph
- Combined MPG — UK

## IMPORTANT

### 0–62 MPH DOES NOT EXIST IN V3.

Do not add:

- acceleration_0_62_mph
- zero_to_62_mph
- 0–62 mph
- any 0–60 → 0–62 conversion

This decision is LOCKED.

---

# 3. AI OFFSPRING

The breeding engine creates:

- offspring name
- manufacturer
- model
- generation
- variant
- unique DNA
- generation number
- vehicle ID
- performance statistics
- breed rating
- rating class
- generated vehicle image

---

# 4. GREEN SLIPS

Every successful offspring can receive a Green Slip.

Green Slip contains:

- Vehicle name
- Generation
- DNA ID
- Power
- Torque
- Weight
- 0–60 mph
- Top speed
- UK MPG
- Breed Rating
- Rating Class
- Owner

Green Slips are the foundation for the future Breeding Grounds vehicle battle system.

---

# 5. GARAGE

Every breeder has a personal Garage.

Garage stores:

- bred vehicles
- vehicle images
- DNA
- generations
- donor lineage
- Green Slips
- performance
- creation history

---

# 6. COMMUNITY

Community will allow breeders to:

- publish creations
- discover other vehicles
- view other breeders
- like creations
- comment
- share builds
- participate in future battles
- appear on leaderboards

---

# 7. PHOTO HUB

Photo Hub is the visual side of Breeding Grounds.

It will support:

- generated vehicle images
- uploaded vehicle photography
- showroom images
- action images
- Green Slip artwork
- community creations

Images should be linked to the relevant vehicle / DNA where possible.

---

# 8. ACCOUNTS

Breeders will eventually have:

- account
- profile
- Garage
- bred vehicles
- Green Slips
- photographs
- community activity

Account architecture must be designed cleanly rather than patched into the application later.

---

# 9. FUTURE GAME SYSTEM

Green Slips will eventually support vehicle battles.

Concept:

- two vehicles
- three rounds
- performance-based statistics
- opponent does not necessarily see hidden statistics
- losing vehicle/card can be affected according to final game rules

Future systems:

- Battles
- Leaderboard
- Trophy Cabinet
- Milestone Cards
- Founder Card
- Special/Rare Cards

---

# TECHNICAL ARCHITECTURE

V3 is a CLEAN REBUILD.

We are not rebuilding the old application by continually patching server.js.

The old Breeding Grounds application is the reference/prototype.

V3 is the new master application.

---

# V3 CURRENT FILES

## package.json

Created.

Purpose:

- Node application configuration
- Express
- Supabase
- Google Gemini
- environment configuration

---

## server.js

Created.

Current responsibilities:

- Express server
- CORS
- JSON handling
- static frontend
- Supabase connection foundation
- health endpoint
- vehicle search foundation
- breeding endpoint foundation

---

## public/index.html

Created.

Current responsibilities:

- Breeding Grounds V3 Laboratory homepage
- navigation
- breeding interface
- Garage section
- Community section
- Photo Hub section
- Green Slips section
- initial frontend connection to `/api/breed`

---

# V3 AI MODEL PLAN

## Vehicle Research

Model:

`gemini-3.8-flash`

Purpose:

Research vehicle specifications.

---

## Vehicle Image Generation

Model:

`gemini-3.1-flash-image`

Purpose:

Generate the AI offspring vehicle image.

Do not mix the research and image-generation responsibilities.

---

# DATABASE PLAN

V3 will eventually use clearly separated systems for:

- breeders
- vehicle directory
- vehicle specifications
- vehicle specification staging
- research queue
- breedings
- offspring
- Green Slips
- Garage
- photos
- community posts
- future battles
- leaderboard
- trophies

---

# DEVELOPMENT RULES

## Rule 1

Build one system at a time.

## Rule 2

Test each system before adding the next.

## Rule 3

Do not patch unrelated systems to fix a problem.

## Rule 4

Do not duplicate database systems.

## Rule 5

Reuse existing proven concepts where appropriate.

## Rule 6

Never guess vehicle specifications.

## Rule 7

Keep researched data separate from verified LIVE data.

## Rule 8

0–60 mph is the ONLY acceleration metric.

## Rule 9

Do not introduce 0–62 mph.

## Rule 10

Do not modify the original Breeding Grounds production application while V3 is being built.

---

# CURRENT STATUS

Date:
29 September 2026

### Foundation

- [x] V3 GitHub repository created
- [x] package.json created
- [x] server.js created
- [x] public/index.html created
- [x] frontend static serving connected
- [ ] Vercel deployment
- [ ] Supabase V3 database structure
- [ ] Account system
- [ ] Vehicle database
- [ ] Vehicle lookup
- [ ] Gemini research
- [ ] Research staging
- [ ] Breeding engine
- [ ] AI offspring generation
- [ ] Green Slip generation
- [ ] Garage
- [ ] Community
- [ ] Photo Hub
- [ ] Battles
- [ ] Leaderboard
- [ ] Trophy system
- [ ] Full testing
- [ ] Production migration to breedinggrounds.app

---

# CURRENT BUILD POSITION

## NEXT SYSTEM

Create the V3 database architecture.

Before implementing the breeding engine, the database structure must be established cleanly.

---

# PRODUCTION RULE

`breedinggrounds.app` remains on the original Breeding Grounds application until V3 has been fully tested.

V3 will be deployed separately first.

Only after V3 passes testing will the production domain be switched.

---

# CHANGE LOG

## 29 September 2026

V3 rebuild restarted as a clean project.

Decision made to build the complete Breeding Grounds concept as one coherent system rather than continue patching the original application.

0–62 mph permanently removed from V3.

V3 repository established:

`B-bot-rgb/BreedingGroundsV3`

Initial frontend, backend and package foundation created.

Permanent build log established.
---

## CURRENT CHECKPOINT — 29 SEPTEMBER 2026

### V3 infrastructure connection COMPLETE

- GitHub repository: `B-bot-rgb/BreedingGroundsV3`
- Branch: `main`
- Vercel project: `breeding-grounds-v3`
- Vercel Production deployment: ONLINE
- New Supabase project: `The Breeding Grounds V3`
- Supabase connection: **CONNECTED**
- `/api/health`: **PASS**
- Database status: **TRUE**
- V3 database schema: **CREATED**
- Supabase Auth structure: **READY**
- `SUPABASE_URL`: configured in Vercel Production
- `SUPABASE_SERVICE_ROLE_KEY`: configured in Vercel Production
- 0–60 MPH is the only acceleration field used by V3.
- 0–62 MPH is NOT part of V3.

### NEXT BUILD PHASE

Build the V3 application shell and customer flow:

1. V3 homepage
2. Supabase Auth account creation/login
3. Breeder profile
4. Vehicle directory
5. Vehicle research system
6. AI breeding flow
7. Offspring generation
8. Garage
9. Green Slip cards
10. Community/photo hub
11. Trophies and progression

**Current phase: V3 FOUNDATION COMPLETE → APPLICATION BUILD STARTING**
---

## CHECKPOINT — 30 SEPTEMBER 2026

### V3 HOMEPAGE LIVE

- V3 homepage successfully deployed to Vercel.
- `breeding-grounds-v3.vercel.app` is serving the V3 frontend.
- Express homepage route is working.
- `public/index.html` confirmed live.
- V3 dark laboratory visual system is active.
- Breeding interface is present.
- Garage section is present.
- Community section is present.
- Photo Hub section is present.
- Green Slip section is present.
- Performance display uses **0–60 MPH only**.
- Supabase V3 connection remains operational.
- Gemini API key configured in Vercel Production.
- V3 remains completely separate from the original Breeding Grounds application.

### CURRENT BUILD STATUS

**V3 FOUNDATION + LIVE FRONTEND COMPLETE**

### NEXT BUILD PHASE

Build the V3 Vehicle Research Engine:

1. Connect Gemini research system.
2. Research missing vehicles.
3. Return structured vehicle data.
4. Save research into V3 staging.
5. Verify/ratify vehicle data.
6. Promote verified vehicles into `vehicle_specs`.
7. Use verified data in the breeding engine.

**Current phase: VEHICLE RESEARCH ENGINE**

# TrailMap - Independent Israel Hiking Discovery Web Application

**TrailMap** is an independent, open-source Hebrew (RTL) hiking application for Israel, built from 1,783 original hiking trail records. The application puts an interactive **MapLibre GL JS** map at the center of the user experience.

---

## 🔒 100% Free & Open Architecture (Zero Google API Dependency)

* **Map Engine:** MapLibre GL JS (open source).
* **Tile Provider:** OpenStreetMap Standard (genuinely keyless, 100% free and open public tile source).
* **No Google Maps API:** No Google Maps JavaScript API, no Google Maps SDK, no Google Places API, no Google Geocoding API, no Google Directions API.
* **No API Keys Required:** Runs out-of-the-box without requiring any user or developer API key, billing account, or proprietary token.
* **Geocoding Abstraction:** Pluggable `GeocodingProvider` interface backed by a rate-limited, cached OpenStreetMap Nominatim provider.

---

## 🚀 Quick Start Commands

```bash
# 1. Install dependencies
npm install

# 2. Run test suite (Vitest)
npm test

# 3. Start local development server
npm run dev

# 4. Import / re-parse all 1,783 markdown files
npm run import

# 5. Enrich with verified and probable coordinates
npm run enrich

# 6. Validate data quality & generate report.json
npm run validate

# 7. Build production bundle (TypeScript strict check + Vite)
npm run build

# 8. Preview production build locally
npm run preview
```

---

## 📊 Technical & Data Audit Summary

| Metric | Value | Details |
| :--- | :--- | :--- |
| **Total Markdown Files** | **1,783** | Extracted from `maslulim-tracks-markdown.zip` |
| **Successfully Parsed** | **1,783** | 100% of files parsed with 0 crashes |
| **Duplicate IDs / Titles** | **0** | Every single trail has a unique identifier |
| **Missing Titles** | **0** | 100% have decoded titles |
| **Missing Descriptions** | **0** | 100% have overview text |
| **Missing Regions** | **2** (0.1%) | 1,781 trails have verified regions |
| **Missing Distances** | **2** (0.1%) | 1,781 trails have verified distances |
| **Missing Durations** | **3** (0.2%) | 1,780 trails have verified durations |
| **Missing Difficulty** | **2** (0.1%) | 1,781 trails have verified difficulties |
| **Missing GPS Info (Verbal)** | **696** (39.0%) | 1,087 trails have explicit verbal GPS directions |
| **Missing Source Images** | **1,781** (99.9%) | 2 files contain direct image URLs; custom nature placeholders are rendered for all others |

---

## 📍 Coordinate Audit & Evidence-Based Taxonomy

Coordinates are never guessed from regional names or placed at arbitrary centers. Every coordinate strictly adheres to the following taxonomy:

* **Verified Coordinates (`verified`):** **591** trails
  - Connects to exact, meter-level trailhead parking, official national park entrance gates, or explicit verbal street addresses (e.g. "עין רוגל 12, ירושלים", "חניון ממילא", "חניון שער ציון", "חניון נחל אל על באבני איתן").
  - `locationType`: `start` or `destination`
  - `locationConfidence`: 0.90 – 0.98
* **Probable Coordinates (`probable`):** **298** trails
  - Specific nature reserve, stream gorge, or mountain summit POIs where the route takes place, but where the source text did not specify a meter-level parking slot.
  - `locationType`: `poi` or `approximate`
  - `locationConfidence`: 0.65 – 0.85
* **Visible on Map:** **889** trails (49.9% coverage)
* **Missing Coordinates (`missing`):** **894** trails
  - Stored with `coordinatesMissing: true`, `locationStatus: 'missing'`, `locationType: 'missing'`, `locationConfidence: 0.0`.
  - Exported to `data/geocoding-todo.json` and `data/geocoding-review.json` for human verification.
  - Accessible in the app via the **"מסלולים ללא מיקום במפה"** (Trails without map coordinates) toggle.
* **Audit File:** Generated at `data/coordinate-audit.json` with records for all 1,783 trails.

---

## 🗺️ UX & Product Features

1. **Map Experience (MapLibre GL JS):**
   - Centered on Israel (`[35.0, 31.5]`).
   - Cluster support: count indicator, dynamic colors, smooth cluster expansion on click.
   - Marker click: centers map on the trail, zooms in, and opens a floating **Preview Card** with trail name, region, distance, duration, difficulty, tags, "View Trail" button, and "Navigate" button.
   - Map Tile Engine: MapLibre GL JS with keyless OpenStreetMap Standard raster tiles.

2. **Mobile First & Responsive Layout:**
   - **Desktop:** Split-screen layout (side panel for list, expansive map view).
   - **Mobile:** Map takes the full screen with an interactive 3-state Bottom Sheet:
     - **Collapsed:** Floating trail preview bar.
     - **Expanded:** Paginated trail list.
     - **Full:** Full trail details modal.

3. **Viewport Filtering ("מסלולים באזור זה"):**
   - When active, only trails inside or near the current map viewport are displayed.
   - Updates dynamically as the user zooms or pans the map.

4. **"Near Me" (קרוב אליי) Geolocation:**
   - Requests browser location permission **only upon user button click** (never automatically on page load).
   - Shows user location with a pulsing blue marker on the map.
   - Computes straight-line distance via the Haversine formula.
   - Distance radius filters: **5 km, 10 km, 25 km, 50 km, 100 km**.
   - Clear labeling: "X ק"מ ממיקומך" (X km from your location).

5. **Search & Dynamic Filters:**
   - **Hebrew Fuzzy Search:** Normalized search stripping Hebrew vocalization (niqqud) and tolerating minor spelling variations.
   - **Dynamic Filters:** Generated from actual dataset values (Region, Distance, Duration, Difficulty, Water, Shade, and category tags: Views, Blossoms, Green, Desert, Families, Antiquities, Caves).

6. **Full Trail Detail Page:**
   - Title, subtitle, region, category tags.
   - Quick Info Grid: Distance, Duration, Difficulty, Water, Shade, Parking, Opening Hours, Fee, Trail Map code, Accessibility.
   - Tabbed content: Overview, Driving / 4x4 directions, Walking route walkthrough, Historical anecdotes / Did You Know.
   - **Raw Markdown viewer:** Lazy-loads the original `.md` source file.
   - Navigation links: original Waze or external Google Maps web links (using coordinates).
   - Share and Add-to-Favorites buttons.

7. **Internal Admin Audit (`/admin/data`):**
   - Metrics cards: Total trails, Verified coordinates, Probable coordinates, Missing coordinates, Trails with images, Trails with Waze, Trails with external map links.
   - **Location Auditing Table:** Filterable by status (Verified / Probable / Missing) with columns for Trail, Status, Type, Lat, Lng, GPS Name, Location Source, Confidence, and Source File.
   - Export Validation Report button (downloads `trailmap-validation-report.json`).

# DiningLens Beta Test Plan

**Version:** 1.0.0-beta
**Platform:** iOS (TestFlight)
**AI Model:** Claude Haiku (Anthropic)
**Backend:** Render Starter — https://dininglens-api.onrender.com

---

## Important disclaimer

**DiningLens is a beta product for informational purposes only.**

Calorie and macro estimates produced by AI are **approximations** — they are not
medically validated nutritional data. Do not use DiningLens as the sole basis for
medical, dietary, or clinical decisions. If you have a medical condition, consult
a registered dietitian or physician.

---

## Install instructions (iOS TestFlight)

1. You will receive an email from TestFlight with the subject
   "DiningLens is now available to test."
2. If you do not have TestFlight installed, tap **View in TestFlight** in the
   email and install TestFlight from the App Store first.
3. Open the email again and tap **Start Testing** → **Install**.
4. Once installed, open **DiningLens** from your home screen.
5. Complete the setup flow (permissions → goals → profile).

**Required iOS version:** iOS 16 or later.

If you do not receive a TestFlight invite, contact the developer directly.

---

## Known rough edges before you start

- **Cold start delay:** The server spins down after inactivity. The first
  request after a gap may take 5–30 seconds. The app shows a "Server starting
  up…" banner — just wait and try again.
- **Billing is disabled:** The "Subscribe" button does nothing yet.
  Everyone is on a 14-day trial.
- **No cloud backup:** Your meal history is stored on your device only.
  Reinstalling the app or wiping your phone loses all data.
- **JS-rendered restaurant menus may not load:** The menu scanner works best
  on sites with server-side-rendered HTML.
- **AI estimates are estimates:** Portion sizes are guesses. Correct them using
  the portion-size buttons (Tiny / Small / Medium / Large / Huge) or the
  inline edit field.

---

## What to test

### 1. First-run setup

- [ ] Fresh install → permissions screen appears
- [ ] Grant camera permission → proceed
- [ ] Grant location permission → proceed
- [ ] Goal selection screen: tap each goal (Lose Fat, Maintain, Gain Muscle, Recomposition)
- [ ] Profile entry: enter height, weight, age, sex
- [ ] Activity selection: pick a level; verify the calorie target updates
- [ ] Tap "Done" → dashboard loads with calorie/macro ring showing your targets
- [ ] Reopen app → dashboard loads immediately (no setup screens)

**Report:** any step that crashes, freezes, or shows an error.

---

### 2. Scan a meal (AI photo analysis)

- [ ] Tap the **+** button → **Scan Meal** → take a photo of a meal
- [ ] EstimateScreen shows a list of detected items with calories and macros
- [ ] "AI estimated — review before logging" banner is visible
- [ ] Source badge on each item shows "AI estimated" or "Menu matched"
- [ ] Tap the portion buttons (Tiny / Small / Medium / Large / Huge) —
      calories update proportionally
- [ ] Tap an item name → inline calorie/macro edit fields appear → edit and save
- [ ] Swipe left on an item → **Delete** button appears → item removed
- [ ] Tap **"Something wrong? Tell the AI…"** → type a correction
      (e.g. "That's a smaller portion" or "Add a banana") → AI re-analyzes
- [ ] Tap **Log Meal** → meal appears on Dashboard

**Report:** items that are completely wrong, items that are missing, crashes,
or cases where the portion adjustment doesn't scale macros correctly.

---

### 3. Upload a photo from library

- [ ] Tap **+** → **Upload Photo** → pick a food photo from Camera Roll
- [ ] Same flow as scan (EstimateScreen → Log Meal)

---

### 4. Search and manual entry

- [ ] Tap **+** → **Search Foods** → type a food name (e.g. "Greek yogurt")
- [ ] Results appear from the database; tap one to add it
- [ ] Adjust quantity using the selector
- [ ] Tap **Add** → item logged
- [ ] Try a branded item (e.g. "Chobani plain")
- [ ] Try an item not in the database (e.g. a very specific dish) —
      AI fallback should still return a result

**Report:** searches that return no results when they should, wrong nutrition
data for well-known foods, or crashes.

---

### 5. Barcode scan

- [ ] Tap **+** → **Scan Meal** → tap the barcode icon (bottom-left)
- [ ] Scan the barcode of a packaged food (e.g. protein bar, yogurt cup)
- [ ] Product name, serving size, and macros populate
- [ ] Verify the serving size shown matches the product label
- [ ] Tap **Add** → item logged

**Report:** barcodes that are not recognized, serving sizes that are wildly
wrong, or nutrition that doesn't match the product label.

---

### 6. Dining hall mode

*Only relevant if you eat at a supported campus dining hall.*

Supported campuses: Texas A&M, Harvard, University of Pittsburgh,
USF St. Pete, Fitchburg State, Northeastern, University of Florida.

- [ ] Walk into a supported dining hall
- [ ] Tap **+** → **Scan Meal** — the app should auto-detect the dining hall
      (label appears at the top: "Duncan Dining Hall • Dinner")
- [ ] Take a photo of your tray
- [ ] Detected items should show "Menu matched" badges with official calorie data
- [ ] Items that couldn't be matched show "AI estimated" badges

**Report:** wrong dining hall detection, items that should be menu-matched but
show AI estimates, crashes.

---

### 7. Restaurant menu scanning

- [ ] Tap **+** → **Scan Meal** → the app prompts to detect your location
- [ ] Walk near a supported chain restaurant (McDonald's, Chipotle, Subway,
      Starbucks, Chick-fil-A, etc.)
- [ ] App detects the restaurant and loads menu items
- [ ] Take a photo and see items matched to chain menu data

**Also test:** manually selecting a restaurant when you don't want location
detection.

**Report:** wrong restaurant detected, menu not loading, crashes.

---

### 8. Dashboard

- [ ] Calorie ring shows consumed / remaining / goal correctly
- [ ] Macro bars (protein, carbs, fat) track accurately
- [ ] Water tracker: add cups, verify daily total updates
- [ ] Exercise: tap **+** → add an exercise (e.g. "30 min running") →
      calories burned deducted from ring
- [ ] Meals grouped by period (Breakfast / Lunch / Dinner / Snacks)
- [ ] Tap a meal → edit items → verify macros update
- [ ] Tap a meal → delete meal → removed from log and ring updates
- [ ] Scroll to yesterday → all data for that day loads

**Report:** incorrect math in the calorie ring, meals appearing in the wrong
period, data not persisting between app restarts.

---

### 9. AI Coach (chat)

- [ ] Tap the **AI Coach** tab
- [ ] Send a message: "What should I eat for dinner to hit my protein goal?"
- [ ] Response is relevant to your logged food for the day
- [ ] Try tapping a food suggestion in the response — it should open the
      Add flow with that food pre-filled
- [ ] After 3 messages (trial limit), a "Daily limit reached" message appears
- [ ] The reset time is shown correctly

**Report:** responses that are irrelevant to your day, suggestions you can't
tap to add, or the daily limit not enforcing correctly.

---

### 10. Goals and profile

- [ ] Go to **Profile** → tap **Edit Goals** → change calorie target →
      dashboard updates immediately
- [ ] Change body goal (Lose Fat → Gain Muscle) → macro targets update
- [ ] Change weight → TDEE recalculates
- [ ] Use metric units toggle — all inputs switch to kg/cm

---

### 11. Edge cases to specifically try

- [ ] Take a photo in a dark room — app should show a "low image quality" message
      rather than hallucinating food
- [ ] Take a photo of a non-food object (book, chair) — should return "No food detected"
- [ ] Take a photo of a supplement label (protein powder, fiber) — label values
      should be read correctly
- [ ] Rapid tapping (tap Log multiple times quickly) — should not double-log
- [ ] Use app with no internet connection — should show a clear error, not hang

---

## How to report feedback

**What to include in every report:**
1. What you were trying to do
2. What happened instead
3. Phone model and iOS version (Settings → General → About)
4. Whether the issue is reproducible or happened once

**How to submit:**
- Email: [fill in your beta feedback email]
- Or reply to the TestFlight invitation thread

**For crashes:** TestFlight automatically captures crash logs. After a crash,
when the app reopens it will ask "Do you want to send crash data?" — tap **OK**.

---

## What NOT to report (known issues)

- "Subscribe" button does nothing — billing is not implemented yet.
- Server takes 10–30 seconds on first use — this is a cold start.
- Your meal history disappears after reinstall — no cloud sync yet.
- Nutritional numbers are slightly off from the real menu — AI estimation
  is an approximation.
- Restaurant menus don't load for some restaurants — JS-rendered sites
  don't scrape well.

---

## Beta data handling

- All meal data is stored on your device only. No meal data is sent to our
  servers permanently; images are analyzed and immediately discarded.
- Your install ID (a random UUID) is used only to track trial status and
  daily usage limits. It is not linked to your identity.
- This is a beta. Please do not use the app with sensitive health data
  you cannot afford to lose.

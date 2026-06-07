# DiningLens Beta Test Plan

**Version:** 1.0.0-beta  
**Platform:** iOS (TestFlight)  
**AI Model:** Claude Haiku (Anthropic)

---

## ⚠️ Important Disclaimer

**DiningLens is a beta product for informational purposes only.**

Calorie and macro estimates produced by AI are **approximations** — they are not medically validated nutritional data. Do not use DiningLens as the sole basis for medical, dietary, or clinical decisions. If you have a medical condition, consult a registered dietitian or physician.

---

## Install Steps

1. Accept the TestFlight invitation link (sent via email)
2. Install TestFlight from the App Store if not already installed
3. Tap the invitation link → Install DiningLens
4. Open DiningLens and complete the setup flow (or tap "Skip for now")

---

## What to Test

### 1. First-Run Setup
- [ ] Fresh install → goal selection screen appears
- [ ] Complete all steps (goal → profile → activity → AI result) → dashboard loads with correct calorie targets
- [ ] Tap "Skip for now — use default targets" → dashboard loads with 2200 cal goal
- [ ] Open Profile → tap "Edit Goal" → change goals → dashboard updates

### 2. Scan a Meal (AI Photo Analysis)
- [ ] Tap the **+** button → Scan Meal → take a photo
- [ ] EstimateScreen shows detected items with source badge ("AI estimated")
- [ ] "AI estimates — review before logging" banner is visible
- [ ] Adjust portion sizes (Tiny / Small / Medium / Large / Huge)
- [ ] Swipe left on an item to remove it
- [ ] Try "Something wrong? Tell the AI…" feedback box to re-evaluate
- [ ] Change meal period at bottom (Breakfast / Lunch / Dinner / Snacks)
- [ ] Tap **Log Meal** → item appears on Dashboard
- [ ] Try taking a photo of a non-food item — confirm it shows a "No food detected" message, not crashing

### 3. Search for Food Manually
- [ ] Tap **+** → Search Food → type any food name
- [ ] Tap a result → bottom sheet opens with serving size control
- [ ] Adjust amount (structured: 1.5 servings, or describe: "two scoops")
- [ ] Select meal period → tap **Log to Breakfast** (or your chosen period)
- [ ] Item appears on Dashboard
- [ ] Open the "My Foods" filter — previously logged items appear
- [ ] Search something that doesn't exist → "No results" screen shows "Log as custom food" button

### 4. Log a Custom Food
- [ ] Tap **+** → Search Food → tap **+ Custom** chip in filter row
- [ ] Fill in: Name, Calories, Protein, Carbs, Fat, Meal period
- [ ] Tap **Log Custom Food** → item logged, returns to Dashboard
- [ ] Alternatively: search a food, get no results, tap "Log [query] as custom food"

### 5. Correct a Serving Size
- [ ] Log a meal from a photo
- [ ] On Dashboard, tap any food item in the log
- [ ] Edit screen opens → change serving size → tap **Update**
- [ ] Dashboard reflects the updated calories

### 6. Barcode Scan
- [ ] Tap **+** → Scan Barcode → scan any packaged food barcode
- [ ] Product name and nutrition data appear in EstimateScreen
- [ ] Source badge shows "Barcode scanned" (not "AI estimated")
- [ ] Log the item

### 7. Restaurant / Eating Out
- [ ] Tap camera → **Eating Out** button
- [ ] Search for a restaurant or chain (e.g., "Chipotle", "Subway")
- [ ] Venue source label shown: "Chain database — estimated calories"
- [ ] Select items from the menu
- [ ] Log the meal

### 8. AI Coach
- [ ] Tap the **AI Coach** tab
- [ ] Opening message references your calories/protein for the day
- [ ] Tap a quick prompt chip (e.g., "What should I eat next?")
- [ ] Coach responds with relevant advice
- [ ] Try: "Help me hit my protein goal", "Explain today's macros"
- [ ] Disconnect from the internet → error message appears (not a crash)

### 9. Water + Exercise Tracking
- [ ] On Dashboard, tap water cups to log water intake
- [ ] Tap **+** next to Exercise → log an activity → calorie burn appears
- [ ] Calorie ring updates (net = consumed − burned)

### 10. Data Persistence
- [ ] Log a meal → close app completely → reopen → meal still appears
- [ ] Log a meal → tap it on Dashboard → edit it → change persists after restart
- [ ] Check that yesterday's data is NOT shown today (date rollover)

### 11. Backend Status
- [ ] If the banner "Starting analysis server…" appears, wait 30 seconds and try again
- [ ] If "Having trouble reaching the analysis server" appears, tap **Retry**
- [ ] After a long idle period, the first scan may be slow — this is normal (server waking up)

---

## Known Limitations

- **AI calorie estimates can be off by ±20–40%** for complex or homemade meals
- Barcode data depends on Open Food Facts database — some products may be missing or inaccurate
- Restaurant menus from chain database may not reflect your local branch's exact portions
- HealthKit integration is **not active** in this beta — exercise burns are AI estimates only
- No cloud sync — data is stored locally on your device only
- No account/login system — clearing app data is permanent
- Backend server is on Render.com free tier — first request after inactivity may take 20–30 seconds

---

## How to Report Bugs

Please include the following in every bug report:

1. **What you were doing** — step-by-step description
2. **What you expected** — the correct behavior
3. **What actually happened** — what went wrong (screenshot if possible)
4. **Debug info** — open Profile → tap the version label at the bottom 5 times → tap "Copy Debug Info" → paste into your bug report
5. **Device model + iOS version**

Submit reports to: [GitHub Issues](https://github.com/[your-repo]/dininglens/issues) or message Andrew directly.

---

## Suggested Tester Flows

### Flow A — New User Setup
1. Fresh install → complete goal wizard → note calorie targets
2. Log a meal by photo → correct one portion → log it
3. Check Dashboard ring and macro bars reflect the meal

### Flow B — Eating Out
1. Tap camera → Eating Out → search for a restaurant
2. Note the data source label ("Chain database")
3. Select 2–3 items → log them → check Dashboard totals

### Flow C — Custom Food Fallback
1. Search for a very obscure food (e.g., "grandma's pierogi")
2. Get no results → tap "Log as custom food"
3. Enter name + calories → log it → confirm it appears on Dashboard

### Flow D — Correct a Bad AI Guess
1. Take a photo of a complex meal
2. On EstimateScreen, identify any wrong item
3. Swipe left to remove it
4. Use "Something wrong?" box to re-evaluate with a description
5. Or tap "+ Add item" to add the correct food manually

### Flow E — AI Coach Conversation
1. Open AI Coach after logging a full day
2. Ask "Explain today's macros"
3. Ask "What should I eat for dinner to hit protein?"
4. Tap a food suggestion chip → lands in Search

### Flow F — Debug Screen
1. Profile → tap version label 5 times
2. Note backend URL and health status
3. Clear local data (with confirmation) — verify Dashboard resets

---

## What We're NOT Testing Yet

- User accounts or sign-in
- Cloud data sync between devices  
- HealthKit heart rate / steps integration
- Push notifications
- Large-scale restaurant scraping / menu accuracy for independent restaurants

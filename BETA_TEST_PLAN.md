# DiningLens Beta Test Plan

**Version:** 1.1.0-beta
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

## Severity definitions

When a script fails, record one of:

- **Blocker** — crash, data loss, user trapped in a screen, security gate bypassed,
  or core loop (scan → log → dashboard) unusable.
- **Major** — feature gives wrong results or fails, but a workaround exists and
  the app stays usable.
- **Minor** — cosmetic, confusing copy, slow but functional.

---

# Manual test scripts

Each script lists Preconditions, Steps, Expected result, a Pass/fail notes field,
and the Severity to assign if it fails. Run scripts in order on a first pass —
later scripts assume earlier ones logged data.

---

## 1. First launch

### 1.1 Clean install, permissions accepted

- **Preconditions:** App deleted and reinstalled (or first ever install). No prior data.
- **Steps:**
  1. Open the app.
  2. Permissions screen appears. Tap to grant camera permission → accept the iOS prompt.
  3. Grant location permission → accept the iOS prompt.
  4. Tap Continue.
- **Expected result:** App proceeds to the Goals setup screen (not the dashboard,
  not a blank screen). No crash, no infinite spinner.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Blocker

### 1.2 Clean install, permissions skipped

- **Preconditions:** App deleted and reinstalled.
- **Steps:**
  1. Open the app.
  2. On the permissions screen, deny the iOS camera prompt (or tap any "skip"/"not now" affordance).
  3. Deny the location prompt.
  4. Continue.
- **Expected result:** App still proceeds to Goals setup. Camera/venue features
  later show a clear "permission needed" message instead of crashing.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Blocker

### 1.3 App restart after goals saved

- **Preconditions:** Scripts 1.1 and 2.x completed (goals saved).
- **Steps:**
  1. Force-quit the app (swipe up in app switcher).
  2. Reopen the app.
- **Expected result:** App opens directly to the Dashboard. No permissions screen,
  no goals setup, targets unchanged.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Blocker

---

## 2. Goal setup

### 2.1 Each goal type

- **Preconditions:** Fresh install at Goals screen (or Profile → Edit Goals).
- **Steps:**
  1. Select **Lose Fat** (cut). Observe calorie target.
  2. Go back / re-enter and select **Maintain**, then **Gain Muscle** (bulk),
     then **Recomposition**, observing the target each time.
- **Expected result:** Each goal is selectable; calorie/macro targets change
  sensibly (cut < maintain < bulk; recomposition near maintenance with higher protein).
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 2.2 Profile inputs

- **Preconditions:** At the profile-entry step of goal setup.
- **Steps:**
  1. Enter height, weight, sex, and age.
  2. Try an obviously wrong value (e.g. weight 0 or age 999).
- **Expected result:** Valid values accepted; absurd values rejected or clamped
  with a readable message — never a crash or NaN calorie target.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major (Blocker if crash/NaN)

### 2.3 Activity estimate

- **Preconditions:** At the activity step.
- **Steps:**
  1. Provide daily steps, workouts per week, job type, and/or the free-text
     activity description.
  2. Confirm the estimated activity level / TDEE shown.
- **Expected result:** A plausible activity level and calorie target are produced.
  Free-text input does not hang or error the screen.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 2.4 Manual macro override

- **Preconditions:** Goal setup complete; macro targets visible.
- **Steps:**
  1. Use the manual override to set custom calorie/protein/carb/fat targets.
  2. Save.
- **Expected result:** Dashboard ring and macro bars use the overridden numbers.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 2.5 Goals persist across restart

- **Preconditions:** Goals saved (any of the above).
- **Steps:**
  1. Force-quit and reopen the app.
  2. Check the Dashboard targets and Profile → goals.
- **Expected result:** Same targets as before the restart. No reset to defaults,
  no re-onboarding.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Blocker

---

## 3. Dashboard

### 3.1 Calories/macros update after logging

- **Preconditions:** Goals set; at least one meal logged (any method).
- **Steps:**
  1. Note the calorie ring and macro bars.
  2. Log a meal with known approximate macros.
- **Expected result:** Ring and bars increase by the logged amounts immediately,
  without restarting the app.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Blocker

### 3.2 Water logging

- **Steps:** Tap the water tracker + several times; remove one if supported.
- **Expected result:** Count updates each tap; persists after navigating away and back.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Minor

### 3.3 Exercise logging

- **Steps:**
  1. Add an exercise (e.g. "30 min running").
  2. Observe calories-burned and the ring.
- **Expected result:** Burned calories appear and adjust remaining calories. With
  the backend offline this shows a readable error, not a hang.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 3.4 Saved meal quick log

- **Preconditions:** At least one saved meal exists (script 7).
- **Steps:** Use the dashboard's saved-meal quick log to log a saved meal.
- **Expected result:** Meal appears in today's log with correct totals; ring updates.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 3.5 Weight widget for body-change goals

- **Preconditions:** Goal is Lose Fat, Gain Muscle, or Recomposition.
- **Steps:** Open the Dashboard and look for the weight widget.
- **Expected result:** Weight widget is visible for body-change goals (and hidden
  for Maintain, if that is the design).
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Minor

---

## 4. Photo scan

### 4.1 Normal meal photo

- **Preconditions:** Camera permission granted; backend up.
- **Steps:**
  1. Tap **+** → **Scan Meal** → photograph a real plate of food.
  2. Wait for analysis.
- **Expected result:** EstimateScreen lists detected items with calories/macros and
  an "AI estimated — review before logging" banner. Each item has a source badge.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Blocker

### 4.2 Bad/low-quality photo

- **Steps:** Photograph a plate in a dark room or while moving (blurry).
- **Expected result:** A "low image quality" style message or low-confidence result —
  not hallucinated detailed items, not a crash.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 4.3 No-food image

- **Steps:** Photograph a book, chair, or wall.
- **Expected result:** "No food detected" message with a way back to the camera.
  Nothing is logged.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 4.4 Reanalysis / correction

- **Preconditions:** A scan result is on the EstimateScreen.
- **Steps:**
  1. Tap **"Something wrong? Tell the AI…"**.
  2. Enter a correction (e.g. "the rice is a double portion, and add a banana").
  3. Submit.
- **Expected result:** Items update to reflect the correction. The text box closes;
  the screen remains usable.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 4.5 Log the meal

- **Steps:** Tap **Log Meal** from the EstimateScreen.
- **Expected result:** Meal appears on the Dashboard under the right period; the
  save-as-template prompt (if shown) can be dismissed without trapping the user.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Blocker

### 4.6 Correction memory does not crash

- **Steps:** After logging several corrected meals over multiple sessions, scan a
  similar meal again and log it.
- **Expected result:** No crash or freeze on the EstimateScreen or at log time.
  (Correction memory is recorded in the background; failures must be silent.)
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Blocker

---

## 5. Barcode scan

### 5.1 Known barcode

- **Preconditions:** Packaged food with a common barcode (e.g. a protein bar).
- **Steps:** **+** → **Scan Meal** → barcode icon → scan the barcode.
- **Expected result:** Product name, serving size, and macros populate and roughly
  match the label. Item can be added to the log.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 5.2 Unknown barcode

- **Steps:** Scan an obscure or foreign product barcode.
- **Expected result:** A clear "product not found" message with a path to search or
  manual entry. No crash, no infinite spinner.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 5.3 No entitlement / expired entitlement

- **Preconditions:** Expired trial (see script 12) or simulate via backend.
- **Steps:** Attempt a barcode scan.
- **Expected result:** A readable paywall/trial-expired message. No raw error JSON,
  no crash.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 5.4 Fallback to search/manual entry

- **Steps:** From a failed barcode lookup, follow the suggested fallback.
- **Expected result:** Search screen (or manual entry) opens and works.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

---

## 6. Manual search

### 6.1 Common food

- **Steps:** **+** → **Search Foods** → type "banana". Add a result with a quantity.
- **Expected result:** Sensible results; logging updates the Dashboard.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Blocker

### 6.2 Branded food

- **Steps:** Search "Chobani plain" or another brand you know.
- **Expected result:** Branded result appears with plausible label-like macros.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 6.3 USDA result

- **Steps:** Search a whole food ("raw broccoli"); inspect the result source.
- **Expected result:** Database-backed (USDA) values, not an AI guess, where available.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Minor

### 6.4 No result → custom food

- **Steps:**
  1. Search something that returns nothing (e.g. "grandma's secret stew").
  2. Use the create-custom-food path; fill name and macros; save and log it.
- **Expected result:** Custom food is created, logged, and the Dashboard updates.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 6.5 Custom food appears in My Foods

- **Steps:** Open Profile → My Foods (or the custom foods list).
- **Expected result:** The food from 6.4 is listed.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 6.6 Custom food persists after restart

- **Steps:** Force-quit and reopen; check My Foods and search for the custom food.
- **Expected result:** Still present and loggable.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Blocker

---

## 7. Saved meals

### 7.1 Save from history

- **Steps:** In History, choose a logged meal → save it as a saved meal.
- **Expected result:** Confirmation; meal appears in the saved meals list.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 7.2 Save after EstimateScreen logging prompt

- **Steps:** Log a meal from a photo scan; when prompted to save it as a template,
  accept.
- **Expected result:** Saved meal created with the same items; prompt can also be
  declined without side effects.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 7.3 Log saved meal from dashboard

- **Steps:** From the Dashboard quick-log, log the saved meal.
- **Expected result:** Logged under an appropriate period with correct totals.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 7.4 Delete saved meal

- **Steps:** Delete a saved meal from the list.
- **Expected result:** It disappears immediately and stays gone after restart.
  Previously logged meals based on it are unaffected.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 7.5 Venue metadata preserved

- **Preconditions:** A meal logged while a venue (dining hall / restaurant) was
  detected, then saved as a template.
- **Steps:** Log the saved meal again; inspect it in History.
- **Expected result:** The venue name still appears on the newly logged meal.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Minor

---

## 8. History

### 8.1 Group by day

- **Steps:** Open History after logging meals on at least two different days.
- **Expected result:** Meals grouped under correct day headers, newest first.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 8.2 Log again

- **Steps:** Use "log again" on a past meal.
- **Expected result:** A copy is logged for today; today's totals update.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 8.3 Copy previous day

- **Steps:** Use the copy-day action on a previous day.
- **Expected result:** All of that day's meals are logged to today; totals update.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 8.4 Edit individual item

- **Steps:** Open a logged meal; edit one item's calories/macros; save.
- **Expected result:** Item, meal totals, and Dashboard all reflect the edit.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 8.5 Delete item

- **Steps:** Delete a single item from a multi-item meal.
- **Expected result:** Item removed; meal totals shrink; Dashboard updates.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 8.6 Delete meal

- **Steps:** Delete an entire meal.
- **Expected result:** Meal removed from History and Dashboard; ring decreases;
  stays deleted after restart.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

---

## 9. Weight tracking

### 9.1 Seed from profile

- **Steps:** After goal setup, open the weight widget/screen.
- **Expected result:** Starting weight matches the profile weight entered in setup.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Minor

### 9.2 Log new weight

- **Steps:** Log today's weight.
- **Expected result:** Entry appears; widget shows the new current weight.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 9.3 Update same-day weight

- **Steps:** Log a different weight again on the same day.
- **Expected result:** The day's entry is updated (one entry per day), not duplicated.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 9.4 Trend display

- **Steps:** After 3+ entries across different days, view the trend.
- **Expected result:** Trend/chart direction matches the logged values.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Minor

---

## 10. Venue / dining mode

### 10.1 Known dining hall

- **Preconditions:** Physically at a supported campus dining hall
  (Texas A&M, Harvard, Pitt, USF St. Pete, Fitchburg State, Northeastern, UF).
- **Steps:** **+** → **Scan Meal**; observe the venue label; photograph your tray.
- **Expected result:** Correct hall + meal period detected; matched items show
  "Menu matched" badges with official nutrition data.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 10.2 Chain restaurant

- **Preconditions:** Near a supported chain (McDonald's, Chipotle, Subway, etc.).
- **Steps:** Open the camera flow; confirm the detected chain; scan a meal.
- **Expected result:** Chain detected; items matched against the chain menu.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 10.3 Google Places-backed detection

- **Preconditions:** At an independent (non-chain) restaurant.
- **Steps:** Open the camera flow with location on.
- **Expected result:** Restaurant name detected via Places; menu scrape attempted;
  if scrape fails the flow continues with plain AI estimation.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 10.4 Menu load failure fallback

- **Steps:** Trigger a venue whose menu cannot load (airplane-mode the moment after
  venue detection, or a JS-rendered site).
- **Expected result:** Scan still works with AI-only estimates. No crash, no
  permanently stuck "loading menu" state.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Blocker

### 10.5 No overmatching of generic items

- **Steps:** At a venue with a loaded menu, scan a meal containing a generic item
  (plain rice, plain chicken) that is NOT what the menu lists (e.g. menu has
  "Orange Chicken Bowl").
- **Expected result:** Generic single-word items are not force-matched to specific
  menu dishes with very different macros. Mismatched items stay "AI estimated".
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 10.6 Location-specific memory suggestions

- **Steps:** Log meals at the same venue on two occasions; on the second visit,
  check suggestions when adding/searching items.
- **Expected result:** Previously logged items at this venue are suggested.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Minor

---

## 11. AI Coach

### 11.1 Normal chat

- **Steps:** Open AI Coach; ask "What should I eat for dinner to hit my protein goal?"
- **Expected result:** Relevant response referencing today's logged food/goals.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 11.2 Quota remaining display

- **Steps:** Check the messages-remaining indicator before and after sending.
- **Expected result:** Counter decrements per message and matches the trial limit
  (3/day on trial).
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Minor

### 11.3 Quota exhausted

- **Steps:** Send messages until the daily limit is reached, then one more.
- **Expected result:** A clear "daily limit reached" message with the reset time.
  Input is disabled or rejected gracefully — no spinner hang, no crash.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 11.4 Expired trial

- **Preconditions:** Expired trial (script 12).
- **Steps:** Try to send a coach message.
- **Expected result:** Trial-expired/paywall message. No raw 403 JSON shown.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

---

## 12. Paywall / entitlement

> Note: the entitlement store is in-memory on the server. A server restart resets
> trials (KI-001). To test "expired", the developer can manually expire a test
> install ID on the backend, or the tester reports behavior whenever it occurs.

### 12.1 Active trial

- **Steps:** During a fresh trial, use scan, search, barcode, and coach.
- **Expected result:** All gated features work; any trial countdown display is correct.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Blocker

### 12.2 Expired trial

- **Preconditions:** Developer-expired entitlement for this install ID.
- **Steps:** Attempt scan, search, barcode, coach.
- **Expected result:** Each shows a consistent paywall/trial-expired state. No crash.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Blocker

### 12.3 Anonymous / missing install ID (developer test)

- **Steps:** `curl https://dininglens-api.onrender.com/entitlements/me` (no header);
  repeat for `/search?q=x`, `/barcode?code=1`.
- **Expected result:** HTTP 401 with a generic JSON error for all of them.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Blocker

### 12.4 Readable history after expiration

- **Steps:** With an expired entitlement, open Dashboard and History.
- **Expected result:** Previously logged local data is still viewable. Only
  AI/backend features are blocked.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 12.5 Gated features blocked after expiration

- **Steps:** With an expired entitlement, attempt photo scan, barcode, search, chat.
- **Expected result:** All four are blocked with the paywall message — none slips
  through to a successful AI call.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Blocker

---

## 13. Backend offline

### 13.1 Health banner

- **Preconditions:** Backend unreachable (developer: stop local server or use
  airplane mode with Wi-Fi off mid-session).
- **Steps:** Open the app; wait a few seconds.
- **Expected result:** "Server starting up / unavailable" banner appears.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Major

### 13.2 Graceful failed scan/search/chat

- **Steps:** With the backend down, attempt a photo scan, a search, and a coach message.
- **Expected result:** Each fails with a readable error and a way to retry. Local
  features (history, dashboard, water) keep working.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Blocker

### 13.3 No app crash

- **Steps:** While a request is in flight, kill connectivity; navigate around the app.
- **Expected result:** No crash, no permanently frozen screen.
- **Pass/fail notes:** ______________________________________
- **Severity if failed:** Blocker

---

## How to report feedback

**What to include in every report:**
1. Script number (e.g. "4.3 No-food image")
2. What you were trying to do
3. What happened instead
4. Severity (blocker / major / minor per the definitions above)
5. Phone model and iOS version (Settings → General → About)
6. Whether the issue is reproducible or happened once

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
- Trial status may reset after a server restart — known limitation (KI-001).
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

# App Store / TestFlight listing draft

Draft copy for App Store Connect. Character limits are Apple's. Fields in
`[brackets]` need the owner's input. Review the privacy answers yourself before
submitting; they describe what the code does today, not legal advice.

## Basics

| Field | Value |
|---|---|
| Name (30) | DiningLens |
| Subtitle (30) | Snap your plate, see macros |
| Bundle ID | `com.dininglens.app` |
| Primary category | Health & Fitness |
| Secondary category | Food & Drink |
| Age rating | 4+ (no objectionable content; no unrestricted web access) |
| Privacy policy URL | `[GitHub Pages URL]/privacy.html` (source: `docs/privacy.html`) |
| Support URL | `[support page or repo URL]` |
| Copyright | `[year] [owner name]` |

## Promotional text (170)

Point your camera at a dining-hall plate and get calories and macros in seconds. Built for college students eating on a meal plan.

## Description (4000)

DiningLens is a calorie and macro tracker built for students who eat in dining halls.

SNAP YOUR PLATE
Take a photo of your meal and DiningLens identifies each food and estimates calories, protein, carbs, and fat. Adjust portions with one tap before you log.

READ THE POSTED LABEL
Many dining halls post nutrition cards at each station. Switch to label mode and photograph the card. DiningLens reads the printed numbers instead of guessing.

MATCHES YOUR DINING HALL
At supported campuses, DiningLens matches your plate to today's menu so the numbers come from the dining hall's own data.

SCAN, SEARCH, OR ADD YOUR OWN
Scan packaged-food barcodes, search USDA and Open Food Facts, or save your own foods for quick re-logging.

GOALS THAT FIT YOU
Set a goal (lose fat, maintain, build muscle, or recompose) and DiningLens calculates daily targets from your height, weight, age, and activity. Or enter your own.

TRACK THE REST
Log water, exercise, and body weight (lbs or kg). Review history by day, copy yesterday's meals, and undo mistakes.

ASK THE AI COACH
Get quick, practical suggestions based on what you've eaten today.

PRIVATE BY DEFAULT
No account. Your meal log stays on your phone.

DiningLens provides estimates for informational purposes only and is not medical advice.

## Keywords (100, comma-separated, no spaces needed)

calorie,macro,tracker,dining hall,college,protein,nutrition,food log,meal plan,diet,campus

## What to Test (TestFlight, 4000)

Thanks for testing DiningLens! This beta is free.
Please try: photographing meals, the 🏷 nutrition-label mode on the camera, barcode scanning, food search, logging and undoing items in History, and weight logging in lbs or kg.
The first photo after a quiet period can take up to 30 seconds while the server wakes up.
Report bugs to [feedback email] with what you did, what happened, and your phone model.

## App Review notes

- No login or account is required. The app works immediately after onboarding.
- Camera: meal photos and barcode/label scanning. Photo library: analyze an
  existing photo. Location (optional): detect a nearby dining hall/restaurant.
- Photos are sent to our server and analyzed by Anthropic's Claude API; they
  are not stored by us.
- "Subscribe" is not active in this version; all features are free.
- To test without being on campus: use Scan Meal on any food, the 🔍 search,
  or the 📦 barcode scanner on any packaged food.

## App Privacy ("nutrition label") — suggested answers

Data the app sends off the device (from `docs/privacy.html`):

| Apple category | Sent? | Purpose | Linked to user? | Tracking? | Notes |
|---|---|---|---|---|---|
| Identifiers → User ID / Device ID | Yes (random install ID) | App Functionality | No | No | Used for rate limits; kept in server memory only |
| User Content → Photos | Yes (meal/label photos) | App Functionality | No | No | Forwarded to Anthropic; not stored by us. Anthropic may retain API inputs for a limited period under its policy, so declaring it is the conservative choice |
| Location → Precise or Coarse | Yes, if permitted | App Functionality | No | No | Sent to Google Places for nearby venues; not stored |
| Health & Fitness | Yes, coach only | App Functionality | No | No | AI coach requests include the day's meal summary and goals |
| Other User Content | Yes | App Functionality | No | No | Search terms, barcodes, coach messages |

Not collected: name, email, contacts, purchases, browsing history, advertising
data, analytics, crash data (none integrated yet).

## Screenshots needed

iPhone 6.9" (1320 × 2868) — at least 3: Dashboard with ring, Camera with a
meal, Estimate screen with items. iPad screenshots are not needed:
`supportsTablet` is false.

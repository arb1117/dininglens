# Data Provider Roadmap

## Current data sources

| Route | Source | Notes |
|---|---|---|
| `/analyze`, `/reanalyze` | Claude AI (vision) | Primary meal analysis |
| `/lookup` | Open Food Facts → USDA → Claude AI fallback | Branded + generic foods |
| `/search` | Common foods list → Open Food Facts → USDA → Claude AI fallback | Ranked by reliability |
| `/scrape-menu` | HTML scrape + Claude AI parse | Feature-flagged via `SCRAPE_MENU_ENABLED` |
| `/barcode` | Open Food Facts | Barcode lookup |
| `/detect-restaurant` | Google Places API | Location-based restaurant detection |
| `/estimate-exercise` | Claude AI | Calorie burn estimates |
| `/calculate-tdee` | Mifflin-St Jeor BMR + Claude AI multiplier | TDEE calculation |
| `/interpret-quantity` | Claude AI | Natural language → grams/servings |
| `/chat` | Claude AI | Nutrition coach |

## Planned provider abstractions

### Food database providers

A `FoodProvider` interface will allow swapping or layering data sources without changing route logic:

```typescript
interface FoodProvider {
  lookup(query: string): Promise<FoodItem | null>;
  search(query: string): Promise<FoodItem[]>;
}
```

Planned providers (in priority order):
1. **CommonFoods** — local JSON, zero-latency, ~200 staple foods (exists today)
2. **OpenFoodFacts** — free, good branded coverage (exists today)
3. **USDA FoodData Central** — authoritative nutrition data (exists today)
4. **Nutritionix** — premium, better restaurant data (stub in `src/services/providers/NutritionixProvider.ts`; not yet licensed)
5. **Spoonacular** — recipe + ingredient data (planned)
6. **Claude AI fallback** — last resort when no DB match (exists today)

### Exercise providers

| Provider | Coverage | Status |
|---|---|---|
| Claude AI | General estimates | Live today |
| MET table (local) | Standard activities | Planned — eliminates AI call for common exercises |
| Fitbit / Apple Health | User's own data | Long-term / user opt-in |

### Restaurant menu providers

| Provider | Coverage | Status |
|---|---|---|
| HTML scrape + Claude parse | Any public menu URL | Live (feature-flagged) |
| Yelp Fusion API | Structured menu data for ~1M restaurants | Planned |
| SinglePlatform / Locu | Menu aggregator APIs | Evaluated, no decision |

## Provider stub files

- `src/services/providers/types.ts` — `FoodItem` type and `FoodProvider` interface
- `src/services/providers/NutritionixProvider.ts` — stub class implementing `FoodProvider`

Each provider file exports a class implementing the relevant interface so the
router layer stays decoupled from data source details.

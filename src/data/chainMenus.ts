export type ChainMenuItem = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving: string;
};

export const CHAIN_MENUS: Record<string, ChainMenuItem[]> = {
  "McDonald's": [
    { name: "Big Mac",                         calories: 590, protein: 25, carbs: 46, fat: 34, serving: "1 sandwich" },
    { name: "Quarter Pounder with Cheese",     calories: 510, protein: 29, carbs: 41, fat: 25, serving: "1 sandwich" },
    { name: "McDouble",                        calories: 400, protein: 23, carbs: 35, fat: 17, serving: "1 sandwich" },
    { name: "10pc Chicken McNuggets",          calories: 420, protein: 23, carbs: 27, fat: 24, serving: "10 pieces" },
    { name: "Large Fries",                     calories: 490, protein: 6,  carbs: 64, fat: 23, serving: "1 large" },
    { name: "Medium Fries",                    calories: 320, protein: 4,  carbs: 43, fat: 15, serving: "1 medium" },
    { name: "Egg McMuffin",                    calories: 310, protein: 17, carbs: 30, fat: 13, serving: "1 sandwich" },
    { name: "McChicken",                       calories: 400, protein: 14, carbs: 41, fat: 20, serving: "1 sandwich" },
    { name: "Filet-O-Fish",                    calories: 390, protein: 16, carbs: 38, fat: 19, serving: "1 sandwich" },
    { name: "Vanilla McFlurry (Medium)",       calories: 510, protein: 14, carbs: 85, fat: 14, serving: "1 medium" },
  ],

  "Chick-fil-A": [
    { name: "Chicken Sandwich",                calories: 440, protein: 28, carbs: 40, fat: 18, serving: "1 sandwich" },
    { name: "Spicy Deluxe Sandwich",           calories: 540, protein: 32, carbs: 43, fat: 25, serving: "1 sandwich" },
    { name: "8ct Nuggets",                     calories: 250, protein: 26, carbs: 11, fat: 11, serving: "8 pieces" },
    { name: "12ct Grilled Nuggets",            calories: 200, protein: 38, carbs: 2,  fat: 4,  serving: "12 pieces" },
    { name: "Grilled Chicken Sandwich",        calories: 320, protein: 30, carbs: 36, fat: 6,  serving: "1 sandwich" },
    { name: "Waffle Fries (Medium)",           calories: 360, protein: 4,  carbs: 48, fat: 17, serving: "1 medium" },
    { name: "Mac & Cheese (Medium)",           calories: 443, protein: 16, carbs: 49, fat: 21, serving: "1 medium" },
    { name: "Chicken Cool Wrap",               calories: 430, protein: 35, carbs: 40, fat: 10, serving: "1 wrap" },
    { name: "Chocolate Chunk Cookie",          calories: 360, protein: 5,  carbs: 48, fat: 17, serving: "1 cookie" },
    { name: "Frosted Lemonade (Medium)",       calories: 410, protein: 7,  carbs: 77, fat: 9,  serving: "1 medium" },
  ],

  "Chipotle": [
    { name: "Chicken Burrito",                 calories: 855, protein: 51, carbs: 93, fat: 28, serving: "1 burrito" },
    { name: "Chicken Bowl",                    calories: 665, protein: 45, carbs: 73, fat: 22, serving: "1 bowl" },
    { name: "Steak Burrito",                   calories: 850, protein: 47, carbs: 95, fat: 29, serving: "1 burrito" },
    { name: "Barbacoa Bowl",                   calories: 640, protein: 42, carbs: 72, fat: 21, serving: "1 bowl" },
    { name: "Carnitas Burrito",                calories: 840, protein: 47, carbs: 93, fat: 29, serving: "1 burrito" },
    { name: "Veggie Bowl (Sofritas)",          calories: 610, protein: 19, carbs: 76, fat: 21, serving: "1 bowl" },
    { name: "Chicken Quesadilla",              calories: 800, protein: 51, carbs: 77, fat: 32, serving: "1 quesadilla" },
    { name: "Chicken Tacos (3)",               calories: 625, protein: 40, carbs: 72, fat: 19, serving: "3 tacos" },
    { name: "Chips & Guacamole",               calories: 495, protein: 7,  carbs: 58, fat: 27, serving: "1 order" },
    { name: "Burrito Bowl (Rice & Beans Only)",calories: 305, protein: 8,  carbs: 47, fat: 10, serving: "1 bowl" },
  ],

  "Subway": [
    { name: "6\" Italian BMT",                 calories: 410, protein: 21, carbs: 41, fat: 18, serving: "6 inch" },
    { name: "6\" Meatball Marinara",           calories: 480, protein: 23, carbs: 51, fat: 20, serving: "6 inch" },
    { name: "6\" Turkey Breast",               calories: 280, protein: 18, carbs: 40, fat: 5,  serving: "6 inch" },
    { name: "6\" Chicken Teriyaki",            calories: 370, protein: 23, carbs: 54, fat: 6,  serving: "6 inch" },
    { name: "Footlong Italian BMT",            calories: 820, protein: 42, carbs: 82, fat: 36, serving: "12 inch" },
    { name: "6\" Tuna",                        calories: 470, protein: 22, carbs: 40, fat: 25, serving: "6 inch" },
    { name: "Footlong Chicken & Bacon Ranch",  calories: 960, protein: 50, carbs: 78, fat: 44, serving: "12 inch" },
    { name: "6\" Veggie Delite",               calories: 230, protein: 10, carbs: 40, fat: 3,  serving: "6 inch" },
    { name: "Chips",                           calories: 230, protein: 2,  carbs: 30, fat: 11, serving: "1 bag" },
    { name: "Chopped Salad Turkey",            calories: 140, protein: 12, carbs: 13, fat: 4,  serving: "1 salad" },
  ],

  "Taco Bell": [
    { name: "Crunchy Taco",                    calories: 170, protein: 8,  carbs: 13, fat: 9,  serving: "1 taco" },
    { name: "Soft Taco",                       calories: 180, protein: 9,  carbs: 18, fat: 8,  serving: "1 taco" },
    { name: "Crunchwrap Supreme",              calories: 530, protein: 19, carbs: 65, fat: 21, serving: "1 wrap" },
    { name: "Burrito Supreme",                 calories: 400, protein: 16, carbs: 51, fat: 15, serving: "1 burrito" },
    { name: "Quesadilla Chicken",              calories: 470, protein: 27, carbs: 42, fat: 22, serving: "1 quesadilla" },
    { name: "Nachos BellGrande",               calories: 760, protein: 19, carbs: 83, fat: 39, serving: "1 order" },
    { name: "Mexican Pizza",                   calories: 540, protein: 19, carbs: 49, fat: 31, serving: "1 pizza" },
    { name: "Chalupa Supreme",                 calories: 350, protein: 14, carbs: 33, fat: 19, serving: "1 chalupa" },
    { name: "Power Menu Bowl",                 calories: 470, protein: 26, carbs: 51, fat: 18, serving: "1 bowl" },
    { name: "Doritos Locos Taco",              calories: 170, protein: 8,  carbs: 13, fat: 9,  serving: "1 taco" },
  ],

  "Wendy's": [
    { name: "Dave's Single",                   calories: 590, protein: 30, carbs: 40, fat: 33, serving: "1 sandwich" },
    { name: "Dave's Double",                   calories: 860, protein: 48, carbs: 40, fat: 58, serving: "1 sandwich" },
    { name: "Baconator",                       calories: 960, protein: 57, carbs: 35, fat: 63, serving: "1 sandwich" },
    { name: "Spicy Chicken Sandwich",          calories: 530, protein: 35, carbs: 42, fat: 24, serving: "1 sandwich" },
    { name: "Crispy Chicken BLT",              calories: 530, protein: 36, carbs: 40, fat: 26, serving: "1 sandwich" },
    { name: "Grilled Chicken Sandwich",        calories: 370, protein: 34, carbs: 36, fat: 9,  serving: "1 sandwich" },
    { name: "4pc Chicken Nuggets",             calories: 180, protein: 10, carbs: 11, fat: 10, serving: "4 pieces" },
    { name: "Small Chocolate Frosty",          calories: 290, protein: 7,  carbs: 55, fat: 7,  serving: "1 small" },
    { name: "Medium Fries",                    calories: 420, protein: 5,  carbs: 52, fat: 20, serving: "1 medium" },
    { name: "Apple Pecan Salad (Full)",        calories: 540, protein: 35, carbs: 52, fat: 19, serving: "1 salad" },
  ],

  "Burger King": [
    { name: "Whopper",                         calories: 660, protein: 28, carbs: 49, fat: 40, serving: "1 burger" },
    { name: "Double Whopper",                  calories: 900, protein: 48, carbs: 51, fat: 56, serving: "1 burger" },
    { name: "Impossible Whopper",              calories: 630, protein: 25, carbs: 58, fat: 34, serving: "1 burger" },
    { name: "Crispy Chicken Sandwich",         calories: 660, protein: 32, carbs: 56, fat: 36, serving: "1 sandwich" },
    { name: "Chicken Fries (9pc)",             calories: 280, protein: 14, carbs: 19, fat: 16, serving: "9 pieces" },
    { name: "Medium Onion Rings",              calories: 320, protein: 5,  carbs: 40, fat: 16, serving: "1 medium" },
    { name: "Medium Fries",                    calories: 380, protein: 4,  carbs: 49, fat: 18, serving: "1 medium" },
    { name: "Bacon Egg & Cheese Croissan'wich",calories: 330, protein: 16, carbs: 28, fat: 17, serving: "1 sandwich" },
    { name: "Small Soft Serve",                calories: 170, protein: 5,  carbs: 27, fat: 5,  serving: "1 small" },
    { name: "Rodeo Whopper",                   calories: 780, protein: 30, carbs: 66, fat: 45, serving: "1 burger" },
  ],

  "Starbucks": [
    { name: "Caffe Latte Grande (2% milk)",    calories: 190, protein: 13, carbs: 24, fat: 7,  serving: "16 fl oz" },
    { name: "Caramel Macchiato Grande",        calories: 250, protein: 10, carbs: 35, fat: 7,  serving: "16 fl oz" },
    { name: "Mocha Frappuccino Grande",        calories: 410, protein: 5,  carbs: 65, fat: 15, serving: "16 fl oz" },
    { name: "Vanilla Sweet Cream Cold Brew Grande", calories: 200, protein: 2, carbs: 18, fat: 13, serving: "16 fl oz" },
    { name: "Iced Brown Sugar Oat Espresso Grande", calories: 120, protein: 2, carbs: 26, fat: 2, serving: "16 fl oz" },
    { name: "Pumpkin Spice Latte Grande",      calories: 380, protein: 14, carbs: 52, fat: 14, serving: "16 fl oz" },
    { name: "Bacon & Gruyere Egg Bites (2pc)", calories: 310, protein: 19, carbs: 9,  fat: 22, serving: "2 pieces" },
    { name: "Spinach Feta Egg White Wrap",     calories: 290, protein: 20, carbs: 33, fat: 8,  serving: "1 wrap" },
    { name: "Butter Croissant",                calories: 260, protein: 5,  carbs: 30, fat: 14, serving: "1 croissant" },
    { name: "Iced Caramel Macchiato Grande",   calories: 250, protein: 10, carbs: 35, fat: 7,  serving: "16 fl oz" },
  ],

  "Panera Bread": [
    { name: "Broccoli Cheddar Soup (Bowl)",    calories: 360, protein: 15, carbs: 30, fat: 21, serving: "1 bowl" },
    { name: "Broccoli Cheddar in Bread Bowl",  calories: 990, protein: 37, carbs: 136, fat: 34, serving: "1 bread bowl" },
    { name: "Turkey Avocado BLT (Whole)",      calories: 620, protein: 33, carbs: 63, fat: 22, serving: "1 sandwich" },
    { name: "Fuji Apple Salad with Chicken",   calories: 540, protein: 38, carbs: 48, fat: 20, serving: "1 salad" },
    { name: "Mac & Cheese (Large)",            calories: 530, protein: 21, carbs: 66, fat: 21, serving: "1 large" },
    { name: "Frontega Chicken (Whole)",        calories: 850, protein: 46, carbs: 83, fat: 34, serving: "1 sandwich" },
    { name: "Chipotle Chicken Avocado Melt",   calories: 700, protein: 42, carbs: 63, fat: 29, serving: "1 sandwich" },
    { name: "Greek Salad",                     calories: 430, protein: 12, carbs: 24, fat: 33, serving: "1 salad" },
    { name: "Bagel with Cream Cheese",         calories: 430, protein: 13, carbs: 68, fat: 13, serving: "1 bagel" },
    { name: "Green Smoothie",                  calories: 270, protein: 5,  carbs: 63, fat: 1,  serving: "1 smoothie" },
  ],

  "Panda Express": [
    { name: "Orange Chicken",                  calories: 490, protein: 22, carbs: 51, fat: 22, serving: "1 serving" },
    { name: "Beijing Beef",                    calories: 470, protein: 13, carbs: 53, fat: 24, serving: "1 serving" },
    { name: "Broccoli Beef",                   calories: 150, protein: 9,  carbs: 13, fat: 7,  serving: "1 serving" },
    { name: "Kung Pao Chicken",                calories: 290, protein: 22, carbs: 20, fat: 14, serving: "1 serving" },
    { name: "String Bean Chicken Breast",      calories: 170, protein: 14, carbs: 13, fat: 7,  serving: "1 serving" },
    { name: "Honey Sesame Chicken Breast",     calories: 420, protein: 17, carbs: 42, fat: 21, serving: "1 serving" },
    { name: "Chow Mein",                       calories: 510, protein: 13, carbs: 80, fat: 16, serving: "1 serving" },
    { name: "Fried Rice",                      calories: 520, protein: 11, carbs: 85, fat: 16, serving: "1 serving" },
    { name: "Super Greens",                    calories: 90,  protein: 6,  carbs: 11, fat: 3,  serving: "1 serving" },
    { name: "Cream Cheese Rangoon (3pc)",      calories: 190, protein: 5,  carbs: 21, fat: 10, serving: "3 pieces" },
  ],

  "Five Guys": [
    { name: "Cheeseburger",                    calories: 840, protein: 43, carbs: 40, fat: 56, serving: "1 burger" },
    { name: "Little Cheeseburger",             calories: 550, protein: 28, carbs: 39, fat: 32, serving: "1 burger" },
    { name: "Bacon Cheeseburger",              calories: 920, protein: 49, carbs: 40, fat: 63, serving: "1 burger" },
    { name: "Little Hamburger",                calories: 480, protein: 22, carbs: 39, fat: 26, serving: "1 burger" },
    { name: "Grilled Cheese",                  calories: 430, protein: 16, carbs: 41, fat: 24, serving: "1 sandwich" },
    { name: "Little Hot Dog",                  calories: 370, protein: 14, carbs: 27, fat: 21, serving: "1 hot dog" },
    { name: "Veggie Sandwich",                 calories: 440, protein: 20, carbs: 60, fat: 15, serving: "1 sandwich" },
    { name: "Regular Fries",                   calories: 953, protein: 17, carbs: 131, fat: 41, serving: "1 regular" },
    { name: "Cajun Style Fries",               calories: 953, protein: 17, carbs: 130, fat: 41, serving: "1 regular" },
    { name: "Chocolate Milkshake (Regular)",   calories: 1000, protein: 25, carbs: 140, fat: 44, serving: "1 regular" },
  ],

  "Raising Cane's": [
    { name: "Chicken Finger",                  calories: 145, protein: 14, carbs: 10, fat: 5,  serving: "1 finger" },
    { name: "3 Piece Combo",                   calories: 1000, protein: 58, carbs: 96, fat: 36, serving: "1 combo" },
    { name: "Box Combo (4 fingers)",           calories: 1130, protein: 71, carbs: 97, fat: 44, serving: "1 combo" },
    { name: "Caniac Combo (6 fingers)",        calories: 1555, protein: 98, carbs: 121, fat: 66, serving: "1 combo" },
    { name: "Chicken Sandwich",                calories: 795, protein: 42, carbs: 81, fat: 28, serving: "1 sandwich" },
    { name: "Crinkle-Cut Fries (Regular)",     calories: 290, protein: 4,  carbs: 38, fat: 14, serving: "1 regular" },
    { name: "Texas Toast (1 slice)",           calories: 100, protein: 3,  carbs: 18, fat: 2,  serving: "1 slice" },
    { name: "Cole Slaw",                       calories: 130, protein: 1,  carbs: 15, fat: 8,  serving: "1 serving" },
    { name: "Cane's Sauce",                    calories: 190, protein: 0,  carbs: 3,  fat: 20, serving: "2 oz" },
    { name: "Lemonade (22oz)",                 calories: 230, protein: 0,  carbs: 59, fat: 0,  serving: "22 fl oz" },
  ],

  "Whataburger": [
    { name: "Whataburger",                     calories: 590, protein: 31, carbs: 61, fat: 26, serving: "1 burger" },
    { name: "Double Meat Whataburger",         calories: 870, protein: 51, carbs: 61, fat: 46, serving: "1 burger" },
    { name: "Spicy Chicken Sandwich",          calories: 490, protein: 23, carbs: 58, fat: 17, serving: "1 sandwich" },
    { name: "Patty Melt",                      calories: 550, protein: 30, carbs: 47, fat: 27, serving: "1 sandwich" },
    { name: "Honey BBQ Chicken Strip Sandwich",calories: 630, protein: 27, carbs: 76, fat: 23, serving: "1 sandwich" },
    { name: "Breakfast Taquito (Egg & Bacon)", calories: 340, protein: 17, carbs: 28, fat: 18, serving: "1 taquito" },
    { name: "Medium Fries",                    calories: 390, protein: 4,  carbs: 51, fat: 18, serving: "1 medium" },
    { name: "Medium Onion Rings",              calories: 420, protein: 6,  carbs: 59, fat: 19, serving: "1 medium" },
    { name: "Small Chocolate Shake",           calories: 540, protein: 9,  carbs: 83, fat: 20, serving: "1 small" },
    { name: "Apple & Cranberry Salad (no chicken)", calories: 220, protein: 4, carbs: 38, fat: 7, serving: "1 salad" },
  ],

  "Shake Shack": [
    { name: "ShackBurger",                     calories: 530, protein: 26, carbs: 42, fat: 28, serving: "1 burger" },
    { name: "SmokeShack Burger",               calories: 620, protein: 36, carbs: 43, fat: 36, serving: "1 burger" },
    { name: "Double ShackBurger",              calories: 760, protein: 44, carbs: 43, fat: 47, serving: "1 burger" },
    { name: "'Shroom Burger",                  calories: 590, protein: 22, carbs: 51, fat: 34, serving: "1 burger" },
    { name: "Chicken Shack",                   calories: 590, protein: 27, carbs: 56, fat: 28, serving: "1 sandwich" },
    { name: "ShackMeister Burger",             calories: 530, protein: 29, carbs: 41, fat: 28, serving: "1 burger" },
    { name: "Crinkle Cut Fries",               calories: 470, protein: 7,  carbs: 67, fat: 20, serving: "1 regular" },
    { name: "Cheese Fries",                    calories: 640, protein: 15, carbs: 74, fat: 32, serving: "1 regular" },
    { name: "Vanilla Shake",                   calories: 660, protein: 14, carbs: 91, fat: 27, serving: "1 regular" },
    { name: "Chocolate Shake",                 calories: 690, protein: 14, carbs: 98, fat: 26, serving: "1 regular" },
  ],

  "Wingstop": [
    { name: "Lemon Pepper Wings (6pc)",        calories: 420, protein: 36, carbs: 0,  fat: 29, serving: "6 wings" },
    { name: "Original Hot Wings (6pc)",        calories: 400, protein: 34, carbs: 5,  fat: 27, serving: "6 wings" },
    { name: "Garlic Parmesan Wings (6pc)",     calories: 560, protein: 36, carbs: 2,  fat: 45, serving: "6 wings" },
    { name: "Mango Habanero Wings (6pc)",      calories: 480, protein: 34, carbs: 18, fat: 28, serving: "6 wings" },
    { name: "Louisiana Rub Wings (6pc)",       calories: 420, protein: 36, carbs: 0,  fat: 29, serving: "6 wings" },
    { name: "Boneless Wings (10pc)",           calories: 630, protein: 38, carbs: 52, fat: 27, serving: "10 pieces" },
    { name: "Medium Fries",                    calories: 430, protein: 6,  carbs: 62, fat: 18, serving: "1 medium" },
    { name: "Cajun Corn (2 cobs)",             calories: 500, protein: 8,  carbs: 60, fat: 30, serving: "2 cobs" },
    { name: "Ranch Dip",                       calories: 180, protein: 1,  carbs: 2,  fat: 19, serving: "2 oz" },
    { name: "Voodoo Fries",                    calories: 600, protein: 12, carbs: 75, fat: 30, serving: "1 regular" },
  ],
};

// Normalize a restaurant name for fuzzy chain matching
function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

// Case-insensitive partial match — handles "McDonald's #1234", "CHICK-FIL-A", etc.
export function findChainMatch(placeName: string): string | null {
  const normalized = normalizeForMatch(placeName);
  for (const chain of Object.keys(CHAIN_MENUS)) {
    const normalizedChain = normalizeForMatch(chain);
    if (normalized.includes(normalizedChain) || normalizedChain.includes(normalized)) {
      return chain;
    }
  }
  return null;
}

// Returns MenuItem-compatible objects (id, name, calories, protein, carbs, fat)
export function getChainMenuItems(chainName: string): Array<{
  id: string; name: string; calories: number; protein: number; carbs: number; fat: number;
}> {
  const items = CHAIN_MENUS[chainName];
  if (!items) return [];
  const prefix = chainName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return items.map((item, i) => ({
    id: `${prefix}-${i}`,
    name: item.name,
    calories: item.calories,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
  }));
}

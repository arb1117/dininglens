export type FoodItem = {
  name: string;
  serving_size: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source?: string;
};

export interface FoodProvider {
  lookup(query: string): Promise<FoodItem | null>;
  search(query: string): Promise<FoodItem[]>;
}

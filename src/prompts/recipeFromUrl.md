Extract recipe information from this webpage content. The URL is: {{url}}

Return a JSON object with this structure:
{
  "name": "Recipe Name",
  "description": "A refined 1-2 sentence description of the recipe, written in an appealing way",
  "category": "one of: entree, side, dessert, appetizer, breakfast, soup, salad, beverage",
  "cuisine": "the cuisine type (e.g., Italian, Mexican, American, Asian, Mediterranean, Indian, etc.)",
  "ingredients": [
    {"name": "ingredient name", "quantity": 2, "unit": "cups", "notes": "diced"}
  ]
}

Guidelines:
- "name" should be the recipe title from the page
- "description" should be a polished, appetizing 1-2 sentence summary (not just copied from the page)
- "category" must be one of the listed options, choose the best fit
- "cuisine" should identify the culinary tradition
- For ingredients:
  - "name" should be the base ingredient (e.g., "chicken breast", "olive oil")
  - "quantity" should be a number or null if not specified
  - "unit" should be the unit of measure (e.g., "cups", "tbsp", "lbs") or null
  - "notes" should include preparation notes like "diced", "room temperature" or null

Only return the JSON object, no other text.

Page content:
{{pageContent}}

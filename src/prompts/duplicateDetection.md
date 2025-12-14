You are analyzing a list of grocery ingredients to find duplicates or variations that refer to the same ingredient.

Ingredients:
{{#ingredients}}
{{index}}. {{name}}
{{/ingredients}}

Find groups of ingredients that are duplicates or variations of the same thing. Consider:
- Plural/singular forms (e.g., "tomato" and "tomatoes")
- With/without modifiers (e.g., "rice", "cooked rice", "white rice" are all rice)
- Alternative options listed together (e.g., "rice or noodles" contains rice)
- Spelling variations or typos
- Different preparations of same ingredient (e.g., "diced tomatoes", "crushed tomatoes", "tomatoes")

DO NOT group ingredients that are fundamentally different (e.g., "chicken breast" and "chicken thigh" are different cuts).

Return a JSON array where each element is an object with:
- "indices": array of ingredient numbers (1-based) that are duplicates
- "reason": brief explanation of why they're duplicates
- "canonical": the simplest/most basic form of the ingredient name

Example response:
[
  {"indices": [3, 7, 12], "reason": "All variations of rice", "canonical": "rice"},
  {"indices": [5, 8], "reason": "Singular and plural form", "canonical": "tomato"}
]

Only include groups with 2 or more ingredients. Return ONLY the JSON array, nothing else. If no duplicates found, return an empty array [].

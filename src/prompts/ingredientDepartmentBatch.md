For each of these grocery ingredients, assign the most appropriate grocery store department.

Ingredients:
{{#ingredients}}
{{index}}. {{name}}
{{/ingredients}}

Available departments:
{{#departments}}
- {{.}}
{{/departments}}

Respond with a JSON array where each object has "name" (the ingredient name exactly as given) and "department" (one of the departments from the list).

Example response:
[{"name": "chicken breast", "department": "Meat & Seafood"}, {"name": "tomatoes", "department": "Produce"}]

Return ONLY the JSON array, nothing else.

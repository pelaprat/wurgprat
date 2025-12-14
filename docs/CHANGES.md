This document outlines a set of changes for Claude Code to make to this application. Claude should review all of the changes here and ask clarifying questions if necessary.

The changes below focus on the Weekly Plans generated in the Household Manager app.

# The "Create Weekly Meal Plan" page
Quick UI changes:
* Rather than "Describe your preferences," use "What are you in the mood for this week?"

I want to make some changes to the "This week's schedule" section of the page:
* Right now, some days are colored grey and others yellow, depending on whether there's an event for that day or not. Let's change that. All the days should be grey. However, you can highlight events within the "date block" as yellow.
* I noticed that some events are on the wrong date. Please double-check the code that reads from "events" to place them on the right day in "This week's schedule."


# The "Review Meal Plan" page
- Remove "Tip: Drag meals between days to swap them, or click "Replace" to get a new AI suggestion for any meal."
- Have a boundary box around the date, so that the dates are more visually distinct from one another
- Don't use color-coding for the dates; make them all grey. If a date has one or more eents, just visually highlight the event, not the whole day
- The app marked one of the recipes as "AI suggested" when in fact the user had picked it. Double check the business logic that determines whether a recipe was selected by the AI or not

Now let's perhaps make a larger change: for any given day, more than one recipe may be selected. So make sure that a user or the AI can select more than one recipe per day:
- Check the data model to make sure this is supported
- Check the SQl schema to make sure this is supported
- Update the UI to enable more than one recipe per day

# The "Grocery List" page
- We need a more visually-compact view of the grocery list. Make it a table.
- Make the recipes for which the ingredient is used a new column in that table.
- Show the total amount of an ingredient needed in its own column in the table.
- In the new table, show the store from which the ingredient will be sourced. Make the store editable, but set its value to the defaul value for that ingredient

# The "Review & Confirm" page
- Show the dinner schedule as a horizontal calendar-like view, what you might expect as a presentation of a week in Google Calendar or in Apple Calendar
- By restructing the weekly view, you create more real-estate to present the ingredients. Present them as a table, reusing the table in the "Grocery List" page
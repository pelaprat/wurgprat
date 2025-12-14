import Mustache from "mustache";
import fs from "fs";
import path from "path";

// Disable Mustache's HTML escaping since we're generating prompts, not HTML
Mustache.escape = (text) => text;

// Cache for loaded templates
const templateCache = new Map<string, string>();

/**
 * Load a prompt template from a .md file and render it with the given data.
 * Templates are located in src/prompts/ directory.
 */
export function renderPrompt<T extends Record<string, unknown>>(
  templateName: string,
  data: T
): string {
  // Check cache first
  let template = templateCache.get(templateName);

  if (!template) {
    // Load template from file
    const templatePath = path.join(
      process.cwd(),
      "src",
      "prompts",
      `${templateName}.md`
    );

    try {
      template = fs.readFileSync(templatePath, "utf-8");
      templateCache.set(templateName, template);
    } catch (error) {
      throw new Error(
        `Failed to load prompt template "${templateName}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return Mustache.render(template, data);
}

/**
 * Clear the template cache (useful for development/testing)
 */
export function clearTemplateCache(): void {
  templateCache.clear();
}

// figure-helpers.ts
/** Matches <FIGURE>42</FIGURE> etc. */
const FIGURE_TAG = /<FIGURE>([^<]+)<\/FIGURE>/g;

/**
 * Replace every <FIGURE>id</FIGURE> with a normal markdown image:
 *   ![Figure id](url)
 *
 * `urlForFigure` is a resolver that returns the final URL for a given id.
 * Returning an empty string keeps the alt-text while showing a broken link;
 * feel free to throw or substitute a placeholder as you prefer.
 */
export function injectFigures(
  input: string,
  urlForFigure: (id: string) => string
): string {
  if (!input?.length) return input;
  return input.replace(FIGURE_TAG, (_match, id) =>
    `![Figure ${id}](${urlForFigure(id)})`
  );
}

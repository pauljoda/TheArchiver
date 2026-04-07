import { xmlEscape } from "./string";

type NfoFieldValue = string | number | boolean | null | undefined;

interface NfoField {
  tag: string;
  value: NfoFieldValue;
}

/**
 * Build an XML/NFO document from a root element and a list of fields.
 * Fields with null/undefined/empty-string values are omitted.
 *
 * @example
 * ```ts
 * const nfo = buildNfo("post", [
 *   { tag: "title", value: post.title },
 *   { tag: "author", value: post.author },
 *   { tag: "score", value: post.score },
 * ]);
 * ```
 */
export function buildNfo(root: string, fields: NfoField[]): string {
  const lines: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<${root}>`,
  ];

  for (const { tag, value } of fields) {
    if (value === undefined || value === null || value === "") continue;
    lines.push(`  <${tag}>${xmlEscape(String(value))}</${tag}>`);
  }

  lines.push(`</${root}>`);
  return lines.join("\n") + "\n";
}

/**
 * Fluent builder for NFO files. Allows conditionally adding fields
 * and nested sections.
 *
 * @example
 * ```ts
 * const nfo = new NfoBuilder("episodedetails")
 *   .add("title", video.title)
 *   .add("plot", video.description)
 *   .addIf(video.season != null, "season", video.season)
 *   .section("actor", [
 *     { tag: "name", value: actor.name },
 *   ])
 *   .build();
 * ```
 */
export class NfoBuilder {
  private lines: string[] = [];
  private root: string;

  constructor(root: string) {
    this.root = root;
    this.lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    this.lines.push(`<${root}>`);
  }

  /** Add a field. Skips if value is null, undefined, or empty string. */
  add(tag: string, value: NfoFieldValue): this {
    if (value === undefined || value === null || value === "") return this;
    this.lines.push(`  <${tag}>${xmlEscape(String(value))}</${tag}>`);
    return this;
  }

  /** Add a field only if the condition is true. */
  addIf(condition: boolean, tag: string, value: NfoFieldValue): this {
    if (condition) return this.add(tag, value);
    return this;
  }

  /** Add a raw XML line (already formatted). */
  addRaw(line: string): this {
    this.lines.push(line);
    return this;
  }

  /** Add a nested section with its own fields. */
  section(tag: string, fields: NfoField[]): this {
    const nonEmpty = fields.filter(
      (f) => f.value !== undefined && f.value !== null && f.value !== ""
    );
    if (nonEmpty.length === 0) return this;
    this.lines.push(`  <${tag}>`);
    for (const { tag: t, value } of nonEmpty) {
      this.lines.push(`    <${t}>${xmlEscape(String(value))}</${t}>`);
    }
    this.lines.push(`  </${tag}>`);
    return this;
  }

  /** Finalize and return the NFO string. */
  build(): string {
    return [...this.lines, `</${this.root}>`].join("\n") + "\n";
  }
}

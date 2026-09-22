export function parseYamlSubset(text: string): unknown {
  const lines = preprocessYaml(text);
  if (lines.length === 0) return {};
  const first = lines[0];
  if (!first) return {};
  if (first.content.startsWith("- ")) {
    return parseYamlArray(lines, 0, first.indent).value;
  }
  return parseYamlMap(lines, 0, first.indent).value;
}

interface YamlLine {
  indent: number;
  content: string;
  number: number;
}

function preprocessYaml(text: string): YamlLine[] {
  const lines: YamlLine[] = [];
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const stripped = stripYamlComment(raw);
    if (stripped.trim() === "") continue;
    const indent = stripped.match(/^ */)?.[0]?.length ?? 0;
    lines.push({
      indent,
      content: stripped.slice(indent),
      number: index + 1
    });
  }
  return lines;
}

function stripYamlComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (character === '"' && !inSingle) {
      if (index === 0 || line[index - 1] !== "\\") inDouble = !inDouble;
      continue;
    }
    if (character === "#" && !inSingle && !inDouble) {
      return line.slice(0, index).trimEnd();
    }
  }
  return line.trimEnd();
}

function parseYamlMap(
  lines: YamlLine[],
  start: number,
  indent: number
): { value: Record<string, unknown>; next: number } {
  const result: Record<string, unknown> = {};
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    if (!line || line.indent < indent) break;
    if (line.indent > indent) {
      throw new Error(`Unexpected nested YAML indent at line ${line.number}`);
    }
    if (line.content.startsWith("- ")) break;

    const split = splitYamlKeyValue(line.content);
    if (!split) {
      index += 1;
      continue;
    }

    if (split.rest !== undefined && split.rest !== "") {
      result[split.key] = parseYamlScalar(split.rest);
      index += 1;
      continue;
    }

    const next = lines[index + 1];
    if (next && next.indent > indent) {
      const nested = next.content.startsWith("- ")
        ? parseYamlArray(lines, index + 1, next.indent)
        : parseYamlMap(lines, index + 1, next.indent);
      result[split.key] = nested.value;
      index = nested.next;
      continue;
    }

    result[split.key] = null;
    index += 1;
  }
  return { value: result, next: index };
}

function parseYamlArray(
  lines: YamlLine[],
  start: number,
  indent: number
): { value: unknown[]; next: number } {
  const result: unknown[] = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    if (!line || line.indent < indent) break;
    if (line.indent > indent) break;
    if (!line.content.startsWith("- ")) break;

    const rest = line.content.slice(2).trim();
    const next = lines[index + 1];
    if (rest === "") {
      if (next && next.indent > indent) {
        const nested = next.content.startsWith("- ")
          ? parseYamlArray(lines, index + 1, next.indent)
          : parseYamlMap(lines, index + 1, next.indent);
        result.push(nested.value);
        index = nested.next;
        continue;
      }
      result.push(null);
      index += 1;
      continue;
    }

    const split = splitYamlKeyValue(rest);
    if (split && (split.rest === undefined || split.rest === "" || (next !== undefined && next.indent > indent))) {
      const item: Record<string, unknown> = {};
      if (split.rest !== undefined && split.rest !== "") {
        item[split.key] = parseYamlScalar(split.rest);
        index += 1;
      } else {
        item[split.key] = null;
        index += 1;
      }
      if (next && next.indent > indent) {
        const nested = next.content.startsWith("- ")
          ? parseYamlArray(lines, index, next.indent)
          : parseYamlMap(lines, index, next.indent);
        Object.assign(item, nested.value);
        index = nested.next;
      }
      result.push(item);
      continue;
    }

    result.push(parseYamlScalar(rest));
    index += 1;
  }
  return { value: result, next: index };
}

function splitYamlKeyValue(content: string): { key: string; rest?: string } | undefined {
  if (content.startsWith('"') || content.startsWith("'")) {
    const quote = content[0];
    const end = findClosingQuote(content, 0, quote ?? '"');
    if (end === -1) return undefined;
    const key = unquoteYaml(content.slice(0, end + 1));
    const after = content.slice(end + 1).trim();
    if (!after.startsWith(":")) return undefined;
    return { key, rest: after.slice(1).trim() };
  }

  const colon = content.indexOf(":");
  if (colon <= 0) return undefined;
  const after = content.slice(colon + 1);
  if (after !== "" && after[0] !== " " && after[0] !== "\t") return undefined;
  return {
    key: content.slice(0, colon).trim(),
    rest: after.trim()
  };
}

function findClosingQuote(value: string, start: number, quote: string): number {
  for (let index = start + 1; index < value.length; index += 1) {
    if (value[index] === "\\" && quote === '"') {
      index += 1;
      continue;
    }
    if (value[index] === quote) return index;
  }
  return -1;
}

function parseYamlScalar(value: string): unknown {
  if (value === "~" || value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  return unquoteYaml(value);
}

function unquoteYaml(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    const inner = value.slice(1, -1);
    if (value.startsWith('"')) {
      return inner.replace(/\\"/g, '"').replace(/\\n/g, "\n");
    }
    return inner.replace(/''/g, "'");
  }
  return value;
}

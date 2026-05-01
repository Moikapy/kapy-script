// Kapy-script Parse Error

/** Common error shape for both LexError and ParseError */
export interface KapyError {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
}

export class ParseError extends Error implements KapyError {
  constructor(
    public readonly file: string,
    public readonly line: number,
    public readonly column: number,
    message: string,
  ) {
    super(`Error in ${file}:${line}:${column}: ${message}`);
    this.name = "ParseError";
  }
}

/** Create a formatted error message with source context */
export function formatParseError(error: KapyError, source: string): string {
  const lines = source.split("\n");
  const lineNum = error.line;
  const colNum = error.column;

  let output = `\n  Error: ${error.message}\n`;
  output += `  → ${error.file}:${lineNum}:${colNum}\n`;

  if (lineNum >= 1 && lineNum <= lines.length) {
    const line = lines[lineNum - 1];
    output += `   |\n`;
    output += `${String(lineNum).padStart(3)} | ${line}\n`;
    output += `   | ${" ".repeat(colNum - 1)}^\n`;
  }

  return output;
}
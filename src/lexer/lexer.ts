// Kapy-script Lexer
// Tokenizes .kapy source into a token stream with indentation tracking

import { Token, TokenType, KEYWORDS } from "./token";
import type { TokenSpan } from "./token";

/** Error thrown during lexing */
export class LexError extends Error {
  constructor(
    public readonly file: string,
    public readonly line: number,
    public readonly column: number,
    message: string,
  ) {
    super(`Error in ${file}:${line}:${column}: ${message}`);
    this.name = "LexError";
  }
}

export class Lexer {
  private source: string;
  private file: string;
  private tokens: Token[] = [];
  private start = 0;
  private current = 0;
  private line = 1;
  private column = 1;
  private startLine = 1;
  private startColumn = 1;

  // Indentation tracking
  private indentStack: number[] = [0];
  private atLineStart = true;

  constructor(source: string, file: string = "<input>") {
    this.source = source;
    this.file = file;
  }

  /** Tokenize the source and return the complete token list */
  tokenize(): Token[] {
    while (!this.isAtEnd()) {
      this.start = this.current;
      this.startLine = this.line;
      this.startColumn = this.column;

      if (this.isAtEnd()) break;

      if (this.atLineStart) {
        this.handleIndentation();
        if (this.isAtEnd()) break;
        // atLineStart is managed by handleIndentation:
        // - Set to false when a non-blank line's indentation is processed
        // - Kept as true when a blank line is skipped (so we re-enter handleIndentation)
        if (this.atLineStart) continue;
        this.atLineStart = false;
        continue;
      }

      this.scanToken();
    }

    // Close any remaining indent levels
    while (this.indentStack.length > 1) {
      this.indentStack.pop();
      this.tokens.push(this.makeToken(TokenType.DEDENT, "", null));
    }

    this.tokens.push(this.makeToken(TokenType.EOF, "", null));
    return this.tokens;
  }

  // ── Indentation Handling ──

  private handleIndentation(): void {
    // Save position and count leading spaces
    this.start = this.current;
    this.startLine = this.line;
    this.startColumn = 1;

    let spaces = 0;
    while (!this.isAtEnd() && this.peek() === " ") {
      spaces++;
      this.advance();
    }

    // Handle tabs — kapy-script uses spaces only
    if (!this.isAtEnd() && this.peek() === "\t") {
      throw new LexError(
        this.file,
        this.line,
        1,
        "Tabs are not allowed in kapy-script. Use 2 spaces for indentation.",
      );
    }

    // Check if this is a blank or comment-only line
    const isBlankOrComment = this.isAtEnd() || this.peek() === "\n" || this.peek() === "#";

    if (isBlankOrComment) {
      // Skip the comment if present
      if (this.peek() === "#") {
        while (!this.isAtEnd() && this.peek() !== "\n") {
          this.advance();
        }
      }
      // Skip the newline
      if (!this.isAtEnd() && this.peek() === "\n") {
        this.advance();
        this.line++;
        this.column = 1;
      }
      // Keep atLineStart = true so the next line also goes through handleIndentation
      this.atLineStart = true;
      return;
    }

    // Non-blank line: after processing indentation, set atLineStart = false
    this.atLineStart = false;

    // Process indentation change
    const currentIndent = this.indentStack[this.indentStack.length - 1];

    if (spaces > currentIndent) {
      // Check for valid indentation (multiples of 2)
      if (spaces % 2 !== 0) {
        throw new LexError(
          this.file,
          this.line,
          1,
          `Indentation must be a multiple of 2 spaces, got ${spaces}.`,
        );
      }
      // Only allow one level of indentation at a time
      if (spaces > currentIndent + 2) {
        throw new LexError(
          this.file,
          this.line,
          1,
          `Too much indentation. Expected ${currentIndent + 2} spaces, got ${spaces}.`,
        );
      }
      this.indentStack.push(spaces);
      this.tokens.push(this.makeToken(TokenType.INDENT, "  ", null));
    } else if (spaces < currentIndent) {
      // Dedent — may close multiple levels
      while (this.indentStack[this.indentStack.length - 1] > spaces) {
        this.indentStack.pop();
        this.tokens.push(this.makeToken(TokenType.DEDENT, "", null));
      }

      if (this.indentStack[this.indentStack.length - 1] !== spaces) {
        throw new LexError(
          this.file,
          this.line,
          1,
          `Indentation mismatch: expected ${this.indentStack[this.indentStack.length - 1]} spaces, got ${spaces}.`,
        );
      }
    }
    // If spaces === currentIndent, no INDENT/DEDENT needed
  }

  // ── Token Scanning ──

  private scanToken(): void {
    const ch = this.advance();

    switch (ch) {
      // Whitespace (not at line start - that's handled above)
      case " ":
      case "\r":
      case "\t":
        break;

      // Newline
      case "\n":
        this.tokens.push(this.makeToken(TokenType.NEWLINE, "\n", null));
        this.line++;
        this.column = 1;
        this.atLineStart = true;
        break;

      // Comment
      case "#":
        while (!this.isAtEnd() && this.peek() !== "\n") {
          this.advance();
        }
        break;

      // String
      case '"':
        this.string();
        break;

      // Operators (potentially multi-character)
      case "=":
        this.tokens.push(this.match("=") ? this.makeToken(TokenType.EQ, "==", null) : this.makeToken(TokenType.ASSIGN, "=", null));
        break;
      case ":": {
        if (this.match("=")) {
          this.tokens.push(this.makeToken(TokenType.MUTABLE, ":=", null));
        } else if (this.match(":")) {
          this.tokens.push(this.makeToken(TokenType.DOUBLE_COLON, "::", null));
        } else {
          this.tokens.push(this.makeToken(TokenType.COLON, ":", null));
        }
        break;
      }
      case "!":
        this.tokens.push(this.match("=") ? this.makeToken(TokenType.NEQ, "!=", null) : this.makeToken(TokenType.BANG, "!", null));
        break;
      case "<":
        this.tokens.push(this.match("=") ? this.makeToken(TokenType.LTE, "<=", null) : this.makeToken(TokenType.LT, "<", null));
        break;
      case ">":
        this.tokens.push(this.match("=") ? this.makeToken(TokenType.GTE, ">=", null) : this.makeToken(TokenType.GT, ">", null));
        break;
      case "&":
        if (this.match("&")) {
          this.tokens.push(this.makeToken(TokenType.AND, "&&", null));
        } else {
          throw new LexError(this.file, this.startLine, this.startColumn, "Unexpected character '&'. Did you mean '&&'?");
        }
        break;
      case "|":
        if (this.match("|")) {
          this.tokens.push(this.makeToken(TokenType.OR, "||", null));
        } else if (this.match(">")) {
          this.tokens.push(this.makeToken(TokenType.PIPE, "|>", null));
        } else {
          throw new LexError(this.file, this.startLine, this.startColumn, "Unexpected character '|'. Did you mean '||' or '|>'?");
        }
        break;
      case "-":
        this.tokens.push(this.match(">") ? this.makeToken(TokenType.ARROW, "->", null) : this.makeToken(TokenType.MINUS, "-", null));
        break;

      // Single-character tokens
      case "+": this.tokens.push(this.makeToken(TokenType.PLUS, "+", null)); break;
      case "*": this.tokens.push(this.makeToken(TokenType.STAR, "*", null)); break;
      case "/": this.tokens.push(this.makeToken(TokenType.SLASH, "/", null)); break;
      case "%": this.tokens.push(this.makeToken(TokenType.PERCENT, "%", null)); break;
      case ".": this.tokens.push(this.makeToken(TokenType.DOT, ".", null)); break;
      case ",": this.tokens.push(this.makeToken(TokenType.COMMA, ",", null)); break;
      case "?": this.tokens.push(this.makeToken(TokenType.QUESTION, "?", null)); break;
      case "(": this.tokens.push(this.makeToken(TokenType.LPAREN, "(", null)); break;
      case ")": this.tokens.push(this.makeToken(TokenType.RPAREN, ")", null)); break;
      case "[": this.tokens.push(this.makeToken(TokenType.LBRACKET, "[", null)); break;
      case "]": this.tokens.push(this.makeToken(TokenType.RBRACKET, "]", null)); break;
      case "{": this.tokens.push(this.makeToken(TokenType.LBRACE, "{", null)); break;
      case "}": this.tokens.push(this.makeToken(TokenType.RBRACE, "}", null)); break;

      default:
        if (this.isDigit(ch)) {
          this.number();
        } else if (this.isAlpha(ch)) {
          this.identifier();
        } else {
          throw new LexError(this.file, this.startLine, this.startColumn, `Unexpected character '${ch}'.`);
        }
    }
  }

  // ── String Parsing ──

  private string(): void {
    const parts: Array<{ text: string } | { expr: string }> = [];
    let current = "";

    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === "\n") {
        throw new LexError(this.file, this.line, this.column, "Unterminated string. Multi-line strings are not supported in v0.1.");
      }

      if (this.peek() === "{") {
        // String interpolation start
        if (current) {
          parts.push({ text: current });
          current = "";
        }
        this.advance(); // consume {
        let depth = 1;
        let expr = "";
        while (!this.isAtEnd() && depth > 0) {
          const c = this.advance();
          if (c === '"') {
            throw new LexError(
              this.file,
              this.line,
              this.column,
              "String literals inside interpolation are not supported in v0.1. Use a variable instead.",
            );
          }
          if (c === "{") depth++;
          if (c === "}") depth--;
          if (depth > 0) expr += c;
        }
        parts.push({ expr });
      } else if (this.peek() === "\\") {
        this.advance(); // consume backslash
        const esc = this.advance();
        switch (esc) {
          case "n": current += "\n"; break;
          case "t": current += "\t"; break;
          case '"': current += '"'; break;
          case "\\": current += "\\"; break;
          default:
            throw new LexError(this.file, this.line, this.column, `Unknown escape sequence '\\${esc}'.`);
        }
      } else {
        current += this.advance();
      }
    }

    if (this.isAtEnd()) {
      throw new LexError(this.file, this.startLine, this.startColumn, "Unterminated string.");
    }

    this.advance(); // closing "

    // If no interpolation, store as simple string literal
    if (parts.length === 0 && current) {
      this.tokens.push(this.makeToken(TokenType.STRING, `"${current}"`, current));
    } else if (parts.length === 0) {
      // Empty string
      this.tokens.push(this.makeToken(TokenType.STRING, '""', ""));
    } else {
      // String with interpolation - store the full lexeme and parsed parts
      if (current) parts.push({ text: current });
      this.tokens.push(this.makeToken(TokenType.STRING, this.source.slice(this.start, this.current), parts));
    }
  }

  // ── Number Parsing ──

  private number(): void {
    while (this.isDigit(this.peek())) {
      this.advance();
    }

    // Fractional part
    if (this.peek() === "." && this.isDigit(this.peekNext())) {
      this.advance(); // consume the "."
      while (this.isDigit(this.peek())) {
        this.advance();
      }
    }

    // Exponent (e.g., 1e10, 2.5e-3)
    if (this.peek() === "e" || this.peek() === "E") {
      this.advance();
      if (this.peek() === "+" || this.peek() === "-") {
        this.advance();
      }
      if (!this.isDigit(this.peek())) {
        throw new LexError(this.file, this.line, this.column, "Expected digit after exponent.");
      }
      while (this.isDigit(this.peek())) {
        this.advance();
      }
    }

    const text = this.source.slice(this.start, this.current);
    const value = Number(text);
    this.tokens.push(this.makeToken(TokenType.NUMBER, text, value));
  }

  // ── Identifier Parsing ──

  private identifier(): void {
    // Read identifier: letters, digits, and underscores
    // This handles underscored keywords like rate_limit
    while (this.isAlphaNumeric(this.peek()) || this.peek() === "_") {
      this.advance();
    }

    const text = this.source.slice(this.start, this.current);
    const type = KEYWORDS.get(text) ?? TokenType.IDENTIFIER;
    const literal = type === TokenType.TRUE ? true : type === TokenType.FALSE ? false : null;
    this.tokens.push(this.makeToken(type, text, literal));
  }

  // ── Helpers ──

  private makeToken(type: TokenType, lexeme: string, literal: unknown): Token {
    const span: TokenSpan = {
      line: this.startLine,
      column: this.startColumn,
      offset: this.start,
      length: this.current - this.start,
      file: this.file,
    };
    return new Token(type, lexeme, literal, span);
  }

  private advance(): string {
    const ch = this.source[this.current];
    this.current++;
    this.column++;
    return ch;
  }

  private peek(): string {
    if (this.isAtEnd()) return "\0";
    return this.source[this.current];
  }

  private peekNext(): string {
    if (this.current + 1 >= this.source.length) return "\0";
    return this.source[this.current + 1];
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source[this.current] !== expected) return false;
    this.current++;
    this.column++;
    return true;
  }

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
  }

  private isAlpha(ch: string): boolean {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
  }

  private isAlphaNumeric(ch: string): boolean {
    return this.isAlpha(ch) || this.isDigit(ch);
  }
}
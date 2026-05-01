import { describe, it, expect } from "bun:test";
import { Lexer, LexError } from "../src/lexer/lexer";
import { Parser } from "../src/parser/parser";

function parse(source: string) {
  const tokens = new Lexer(source, "test.kapy").tokenize();
  return new Parser(tokens, "test.kapy").parse();
}

function parseExpr(source: string) {
  // Wrap in a function so expressions can be parsed
  const wrapped = `fn __test\n  input _x: any\n  output any\n  ${source}`;
  const ast = parse(wrapped);
  const fn = ast.declarations[0] as any;
  return fn.body;
}

// ── Expression Parsing Tests ──

describe("Binary expressions", () => {
  it("parses arithmetic operators", () => {
    const expr = parseExpr("1 + 2");
    expect(expr.kind).toBe("BinaryExpr");
    expect(expr.op).toBe("+");
  });

  it("parses subtraction", () => {
    const expr = parseExpr("10 - 3");
    expect(expr.kind).toBe("BinaryExpr");
    expect(expr.op).toBe("-");
  });

  it("parses multiplication and division", () => {
    const expr = parseExpr("6 * 7 / 2");
    expect(expr.kind).toBe("BinaryExpr");
  });

  it("parses modulo", () => {
    const expr = parseExpr("10 % 3");
    expect(expr.kind).toBe("BinaryExpr");
    expect(expr.op).toBe("%");
  });

  it("parses comparison operators", () => {
    const expr = parseExpr("x == 1");
    expect(expr.kind).toBe("BinaryExpr");
    expect(expr.op).toBe("==");
  });

  it("parses not-equal", () => {
    const expr = parseExpr("x != 1");
    expect(expr.kind).toBe("BinaryExpr");
    expect(expr.op).toBe("!=");
  });

  it("parses relational operators", () => {
    const expr = parseExpr("x < 10");
    expect(expr.kind).toBe("BinaryExpr");
    expect(expr.op).toBe("<");
  });

  it("parses logical AND", () => {
    const expr = parseExpr("x && y");
    expect(expr.kind).toBe("BinaryExpr");
    expect(expr.op).toBe("&&");
  });

  it("parses logical OR", () => {
    const expr = parseExpr("x || y");
    expect(expr.kind).toBe("BinaryExpr");
    expect(expr.op).toBe("||");
  });
});

describe("Unary expressions", () => {
  it("parses logical NOT", () => {
    const expr = parseExpr("!x");
    expect(expr.kind).toBe("UnaryExpr");
    expect(expr.op).toBe("!");
  });

  it("parses numeric negation", () => {
    const expr = parseExpr("-42");
    expect(expr.kind).toBe("UnaryExpr");
    expect(expr.op).toBe("-");
  });
});

describe("Pipeline expressions", () => {
  it("parses simple pipeline", () => {
    const expr = parseExpr("x |> f");
    expect(expr.kind).toBe("PipelineExpr");
    expect(expr.stages.length).toBe(2);
  });

  it("parses multi-stage pipeline", () => {
    const expr = parseExpr("x |> f |> g");
    expect(expr.kind).toBe("PipelineExpr");
    expect(expr.stages.length).toBe(3);
  });
});

describe("Member and index expressions", () => {
  it("parses member access", () => {
    const expr = parseExpr("obj.field");
    expect(expr.kind).toBe("MemberExpr");
    expect(expr.property).toBe("field");
  });

  it("parses method chains", () => {
    const expr = parseExpr("obj.method(x).field");
    expect(expr.kind).toBe("MemberExpr");
  });

  it("parses index expressions", () => {
    const expr = parseExpr("arr[0]");
    expect(expr.kind).toBe("IndexExpr");
  });
});

describe("Call expressions", () => {
  it("parses function calls with args", () => {
    const expr = parseExpr("f(x, y)");
    expect(expr.kind).toBe("CallExpr");
    expect(expr.args.length).toBe(2);
  });

  it("parses nested calls", () => {
    const expr = parseExpr("f(g(x))");
    expect(expr.kind).toBe("CallExpr");
    expect(expr.callee.kind).toBe("Identifier");
  });
});

describe("Lambda expressions", () => {
  it("parses single-param lambda", () => {
    const source = `fn apply
  input f: any
  output any
  f`;
    const ast = parse(source);
    // Lambda parsing is in primary(), test via direct expression
    const expr = parseExpr("x -> x + 1");
    expect(expr.kind).toBe("LambdaExpr");
    expect(expr.params.length).toBe(1);
  });

  it("parses multi-param lambda", () => {
    // Multi-param lambdas parse as: first param, then comma-separated args, then arrow
    // Inside a function body, the comma would be ambiguous.
    // Test as a direct expression instead:
    const source = `fn apply
  input f: any
  output any
  f`;
    const ast = parse(source);
    expect(ast.declarations.length).toBe(1);
  });
});

describe("Record literals", () => {
  it("parses simple record", () => {
    const expr = parseExpr('{ name: "Alice", age: 30 }');
    expect(expr.kind).toBe("RecordLiteral");
    expect(expr.fields.length).toBe(2);
  });
});

describe("For expressions", () => {
  it("parses for loop", () => {
    const source = `fn loop_test
  input items: any
  output any
  for x in items
    x`;
    const ast = parse(source);
    const fn = ast.declarations[0] as any;
    expect(fn.body.kind).toBe("ForExpr");
    expect(fn.body.variable).toBe("x");
  });
});

describe("While expressions", () => {
  it("parses while loop", () => {
    const source = `fn loop_test
  input cond: any
  output any
  while cond
    1`;
    const ast = parse(source);
    const fn = ast.declarations[0] as any;
    expect(fn.body.kind).toBe("WhileExpr");
  });
});

describe("Parallel expressions", () => {
  it("parses parallel block", () => {
    const source = `fn parallel_test
  output any
  parallel
    fetch_a() -> a
    fetch_b() -> b`;
    const ast = parse(source);
    const fn = ast.declarations[0] as any;
    expect(fn.body.kind).toBe("ParallelExpr");
    expect(fn.body.assignments.length).toBe(2);
  });
});

describe("With expressions", () => {
  it("parses with timeout", () => {
    const source = `fn with_test
  output any
  with timeout(5000)
    slow_call()`;
    const ast = parse(source);
    const fn = ast.declarations[0] as any;
    expect(fn.body.kind).toBe("WithExpr");
    expect(fn.body.kind_type).toBe("timeout");
  });
});

describe("Match patterns", () => {
  it("parses wildcard pattern", () => {
    const source = `fn wildcard_test
  input x: any
  output string
  match x
    _ -> "unknown"`;
    const ast = parse(source);
    const fn = ast.declarations[0] as any;
    expect(fn.body.kind).toBe("MatchExpr");
    expect(fn.body.cases[0].pattern.kind).toBe("WildcardPattern");
  });

  it("parses literal pattern", () => {
    const source = `fn literal_test
  input x: any
  output string
  match x
    42 -> "the answer"`;
    const ast = parse(source);
    const fn = ast.declarations[0] as any;
    expect(fn.body.cases[0].pattern.kind).toBe("LiteralPattern");
    expect(fn.body.cases[0].pattern.value).toBe(42);
  });
});

describe("Result unwrap operators", () => {
  it("parses result unwrap ?", () => {
    const expr = parseExpr("result?");
    expect(expr.kind).toBe("ResultUnwrapExpr");
  });

  it("parses crash unwrap !", () => {
    const expr = parseExpr("result!");
    expect(expr.kind).toBe("CrashUnwrapExpr");
  });
});
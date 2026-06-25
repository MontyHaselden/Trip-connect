/** Safe arithmetic for finance scratch work — no eval(). */
export function evaluateCalculatorExpression(input: string): number | null {
  const expr = input.trim().replace(/,/g, "").replace(/^=/, "");
  if (!expr) return null;

  let i = 0;

  function peek(): string {
    return expr[i] ?? "";
  }

  function consume(): string {
    return expr[i++] ?? "";
  }

  function skipSpace(): void {
    while (peek() === " ") consume();
  }

  function parseNumber(): number {
    skipSpace();
    let start = i;
    if (peek() === "-") consume();
    while (/[0-9.]/.test(peek())) consume();
    const raw = expr.slice(start, i);
    if (!raw || raw === "-" || raw === ".") throw new Error("bad number");
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) throw new Error("bad number");
    return value;
  }

  function parseFactor(): number {
    skipSpace();
    if (peek() === "(") {
      consume();
      const value = parseExpression();
      skipSpace();
      if (peek() !== ")") throw new Error("unclosed paren");
      consume();
      return value;
    }
    if (peek() === "-") {
      consume();
      return -parseFactor();
    }
    if (peek() === "+") {
      consume();
      return parseFactor();
    }
    return parseNumber();
  }

  function parseTerm(): number {
    let value = parseFactor();
    skipSpace();
    while (peek() === "*" || peek() === "/") {
      const op = consume();
      const right = parseFactor();
      value = op === "*" ? value * right : value / right;
      skipSpace();
    }
    return value;
  }

  function parseExpression(): number {
    let value = parseTerm();
    skipSpace();
    while (peek() === "+" || peek() === "-") {
      const op = consume();
      const right = parseTerm();
      value = op === "+" ? value + right : value - right;
      skipSpace();
    }
    return value;
  }

  try {
    const result = parseExpression();
    skipSpace();
    if (i < expr.length) return null;
    if (!Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

export function formatCalculatorResult(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  if (Number.isInteger(rounded)) return rounded.toLocaleString();
  return rounded.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

export function appendCalculatorToken(current: string, token: string): string {
  if (token === "C") return "";
  if (token === "⌫") return current.slice(0, -1);
  if (token === "=") return current;
  return `${current}${token}`;
}

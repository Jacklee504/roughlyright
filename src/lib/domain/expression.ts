/**
 * Deterministic expression evaluator for calculation benchmarks.
 * Supports + - * / unary minus, parentheses and decimal literals over named inputs.
 * Exact arithmetic: everything is a BigInt rational.
 */

import { add, cmp, div, mul, parseDecimalToRat, rat, sub, type Rat } from "./decimal";

export type EvalOk = { ok: true; value: Rat };
export type EvalErr = { ok: false; error: string };
export type EvalResult = EvalOk | EvalErr;

type Tok = { kind: "num" | "ident" | "op" | "lparen" | "rparen"; text: string };

const OPERATORS = new Set(["+", "-", "*", "/"]);

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const text = src.slice(i, j);
      if ((text.match(/\./g) || []).length > 1) throw new Error(`Bad number literal: ${text}`);
      toks.push({ kind: "num", text });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
      toks.push({ kind: "ident", text: src.slice(i, j) });
      i = j;
      continue;
    }
    if (OPERATORS.has(c)) {
      toks.push({ kind: "op", text: c });
      i++;
      continue;
    }
    if (c === "(") {
      toks.push({ kind: "lparen", text: c });
      i++;
      continue;
    }
    if (c === ")") {
      toks.push({ kind: "rparen", text: c });
      i++;
      continue;
    }
    throw new Error(`Unexpected character: ${c}`);
  }
  if (toks.length === 0) throw new Error("Empty expression");
  return toks;
}

export function evaluateExpression(src: string, inputs: Record<string, Rat>): EvalResult {
  try {
    const toks = tokenize(src);
    let pos = 0;
    const peek = () => toks[pos];

    const parseExpr = (): Rat => {
      let left = parseTerm();
      while (peek()?.kind === "op" && (peek().text === "+" || peek().text === "-")) {
        const op = toks[pos++].text;
        const right = parseTerm();
        left = op === "+" ? add(left, right) : sub(left, right);
      }
      return left;
    };

    const parseTerm = (): Rat => {
      let left = parseFactor();
      while (peek()?.kind === "op" && (peek().text === "*" || peek().text === "/")) {
        const op = toks[pos++].text;
        const right = parseFactor();
        if (op === "*") {
          left = mul(left, right);
        } else {
          if (cmp(right, rat(0n)) === 0) throw new Error("Division by zero in expression");
          left = div(left, right);
        }
      }
      return left;
    };

    const parseFactor = (): Rat => {
      const t = peek();
      if (!t) throw new Error("Unexpected end of expression");
      if (t.kind === "op" && t.text === "-") {
        pos++;
        const v = parseFactor();
        return { n: -v.n, d: v.d };
      }
      if (t.kind === "lparen") {
        pos++;
        const v = parseExpr();
        if (peek()?.kind !== "rparen") throw new Error("Missing closing parenthesis");
        pos++;
        return v;
      }
      if (t.kind === "num") {
        pos++;
        const v = parseDecimalToRat(t.text);
        if (!v) throw new Error(`Bad number literal: ${t.text}`);
        return v;
      }
      if (t.kind === "ident") {
        pos++;
        const v = inputs[t.text];
        if (!v) throw new Error(`Unknown input name: ${t.text}`);
        return v;
      }
      throw new Error(`Unexpected token: ${t.text}`);
    };

    const value = parseExpr();
    if (pos !== toks.length) throw new Error("Unexpected trailing tokens in expression");
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Expression error" };
  }
}

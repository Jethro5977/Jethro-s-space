import { readFileSync } from "node:fs";

const file = "styles.css";
const source = readFileSync(file, "utf8");
const rules = collectRules(source);

const guards = [
  { selector: ".library-tabs", expected: 1, label: "共享库 Tab 容器" },
  { selector: ".library-tab", expected: 1, label: "共享库 Tab" },
  { selector: ".library-tab:hover", expected: 1, label: "共享库 Tab 悬停态" },
  { selector: ".library-tab.active", expected: 1, label: "共享库 Tab 激活态" }
];

for (const { selector, expected, label } of guards) {
  const matches = rules.filter((rule) => rule.selector === selector);
  if (matches.length !== expected) {
    throw new Error(`${label}应只有 ${expected} 个规范规则，实际为 ${matches.length} 个：${matches.map(({ line }) => line).join(", ")}`);
  }
}

const globalReducedMotionRules = rules.filter(
  (rule) => rule.selector === "*" && rule.context.includes("prefers-reduced-motion: reduce")
);
if (globalReducedMotionRules.length !== 1) {
  throw new Error(`全局无障碍动效规则应只有 1 个，实际为 ${globalReducedMotionRules.length} 个`);
}

const mobileToolRule = rules.find(
  (rule) => rule.selector === ".tool-btn" && rule.context.includes("max-width: 560px")
);
if (!mobileToolRule || mobileToolRule.declarations !== "padding: 0") {
  throw new Error("≤560px 的工具按钮只应保留未被 ≤700px 规则覆盖的 padding 声明");
}

console.log(`✓ CSS cascade audit passed (${source.split("\n").length} lines, ${rules.length} style rules)`);

function collectRules(css) {
  const rules = [];
  scan(0, css.length, "top");
  return rules;

  function scan(start, end, context) {
    let index = start;
    while (index < end) {
      index = skipWhitespaceAndComments(index, end);
      if (index >= end) break;

      const brace = css.indexOf("{", index);
      if (brace < 0 || brace >= end) break;

      const header = css.slice(index, brace).trim();
      const close = findBlockEnd(brace, end);
      if (close < 0) throw new Error(`未闭合的 CSS 块（第 ${lineAt(index)} 行）`);

      if (header.startsWith("@media") || header.startsWith("@supports") || header.startsWith("@container")) {
        scan(brace + 1, close, `${context} > ${compact(header)}`);
      } else if (header && !header.startsWith("@")) {
        for (const selector of header.split(",").map(compact).filter(Boolean)) {
          rules.push({
            selector,
            context,
            line: lineAt(index),
            declarations: compact(css.slice(brace + 1, close)).replace(/;$/u, "")
          });
        }
      }
      index = close + 1;
    }
  }

  function findBlockEnd(open, end) {
    let depth = 1;
    for (let index = open + 1; index < end; index += 1) {
      if (css.startsWith("/*", index)) {
        const commentEnd = css.indexOf("*/", index + 2);
        if (commentEnd < 0) return -1;
        index = commentEnd + 1;
      } else if (css[index] === "{") depth += 1;
      else if (css[index] === "}" && --depth === 0) return index;
    }
    return -1;
  }

  function skipWhitespaceAndComments(index, end) {
    while (index < end) {
      if (/\s/u.test(css[index])) {
        index += 1;
      } else if (css.startsWith("/*", index)) {
        const commentEnd = css.indexOf("*/", index + 2);
        if (commentEnd < 0) throw new Error(`未闭合的 CSS 注释（第 ${lineAt(index)} 行）`);
        index = commentEnd + 2;
      } else {
        break;
      }
    }
    return index;
  }

  function lineAt(index) {
    return css.slice(0, index).split("\n").length;
  }
}

function compact(value) {
  return value.replace(/\s+/gu, " ").trim();
}

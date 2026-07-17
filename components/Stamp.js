import { GRADE_EMOJI } from "../lib/constants";

function stampStyle(grade, size) {
  const colors =
    grade === "PASS"
      ? { fg: "var(--seal-green)", bg: "var(--seal-green-tint)" }
      : grade === "FAIL"
      ? { fg: "var(--stamp-red)", bg: "var(--stamp-red-tint)" }
      : { fg: "var(--amber)", bg: "var(--amber-tint)" };
  const dims =
    size === "lg"
      ? { padding: "14px 16px", fontSize: "1.3rem" }
      : size === "sm"
      ? { padding: "4px 10px", fontSize: "0.68rem" }
      : { padding: "8px 12px", fontSize: "0.9rem" };
  return {
    ...dims,
    color: colors.fg,
    background: colors.bg,
    border: `var(--stamp-border) solid ${colors.fg}`,
  };
}

export function gradeAccentVar(grade) {
  return grade === "PASS" ? "var(--seal-green)" : grade === "FAIL" ? "var(--stamp-red)" : "var(--amber)";
}

export default function Stamp({ grade, size = "md" }) {
  return (
    <span className="stamp" style={stampStyle(grade, size)}>
      <span className="stamp-emoji" aria-hidden="true">{GRADE_EMOJI[grade] || ""}</span>
      {grade}
    </span>
  );
}

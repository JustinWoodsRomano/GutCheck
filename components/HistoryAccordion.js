import { useState } from "react";
import { detectPests, inspectionReason, sortViolations } from "../lib/pests.mjs";
import { ChevronDown, CheckCircle2, AlertTriangle } from "lucide-react";
import Stamp from "./Stamp";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * "2019-05-30" -> "May 30".
 *
 * The year is dropped because every row already sits under a year heading.
 * Parsed off the string rather than via `new Date()`: an ISO date-only string
 * is treated as UTC midnight, so in any timezone behind UTC the Date object
 * reports the previous day, and inspections would silently show one day early.
 * Falls back to the raw value if the shape is not what we expect.
 */
function formatDay(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || "");
  if (!m) return d || "";
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return d;
  return `${month} ${Number(m[3])}`;
}

export default function HistoryAccordion({ history }) {
  const [openIndex, setOpenIndex] = useState(null);

  // Group into years so a record running back to 2010 stays scannable.
  // History arrives newest-first and the grouping preserves that order,
  // so years descend and inspections descend within each year.
  const years = [];
  const byYear = new Map();
  history.forEach((h, i) => {
    const year = (h.d || "").slice(0, 4) || "Undated";
    if (!byYear.has(year)) {
      byYear.set(year, []);
      years.push(year);
    }
    // Carry the original index so open/closed state survives grouping.
    byYear.get(year).push({ ...h, _i: i });
  });

  return (
    <div>
      {years.map((year) => (
        <div className="history-year" key={year}>
          <div className="history-year-head">
            <span className="history-year-label">{year}</span>
            <span className="history-year-count">
              {byYear.get(year).length}{" "}
              {byYear.get(year).length === 1 ? "inspection" : "inspections"}
            </span>
          </div>
          {byYear.get(year).map((h) => {
            const i = h._i;
            const open = openIndex === i;
            return (
          <div className="accordion-item" key={i}>
            <button
              className="accordion-trigger"
              aria-expanded={open}
              onClick={() => setOpenIndex(open ? null : i)}
            >
              {/* Two columns. Everything used to sit on one flex line, so a
                  long reason like "Complaint re-inspection" squeezed the date
                  until it wrapped a character per line. The date and its tag
                  now stack on the left and the grade sits on the right, which
                  gives the tag a whole row to use and stops it competing with
                  anything. */}
              <span className="hist-left">
                <span className="hist-date">{formatDay(h.d)}</span>
                {inspectionReason(h.it) && (
                  <span className={`reason-tag reason-${inspectionReason(h.it).tone}`}>
                    {inspectionReason(h.it).label}
                  </span>
                )}
              </span>
              <span className="hist-right">
                <Stamp grade={h.g} size="sm" />
                <ChevronDown size={16} className="accordion-chevron" />
              </span>
            </button>
            {open && (
              <div className="accordion-panel">
                {(!h.v || h.v.length === 0) && h.g === "PASS" && (
                  <div className="accordion-clean">
                    <CheckCircle2 size={15} /> No violations recorded at this inspection.
                  </div>
                )}
                {(!h.v || h.v.length === 0) && h.g !== "PASS" && (
                  <div className="accordion-clean" style={{ color: "var(--ink-muted)" }}>
                    <AlertTriangle size={15} style={{ flexShrink: 0 }} /> The city&rsquo;s public record for this
                    inspection doesn&rsquo;t include itemized violation text.
                  </div>
                )}
                {sortViolations(h.v).map((v, vi) => (
                  <div key={vi} className={`violation ${v.s === "c" ? "critical" : "noncritical"}`} style={{ marginTop: vi === 0 ? 0 : 8 }}>
                    <AlertTriangle size={16} color={v.s === "c" ? "var(--stamp-red)" : "var(--amber)"} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div className="violation-body">
                      {detectPests(v.t).length > 0 && (
                        <div className="pest-tags">
                          {detectPests(v.t).map((p) => (
                            <span key={p.key} className="pest-tag">
                              <span aria-hidden="true">{p.emoji}</span> {p.label}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="violation-text">{v.t}</div>
                      <div className="violation-sev">{v.s === "c" ? "priority violation" : "core violation"}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

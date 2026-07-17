import { useState } from "react";
import { ChevronDown, CheckCircle2, AlertTriangle } from "lucide-react";
import Stamp from "./Stamp";

export default function HistoryAccordion({ history }) {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <div>
      {history.map((h, i) => {
        const open = openIndex === i;
        return (
          <div className="accordion-item" key={i}>
            <button
              className="accordion-trigger"
              aria-expanded={open}
              onClick={() => setOpenIndex(open ? null : i)}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, maxWidth: "100%" }}>
                {h.d}
                <Stamp grade={h.g} size="sm" />
              </span>
              <ChevronDown size={16} className="accordion-chevron" />
            </button>
            {open && (
              <div className="accordion-panel">
                {(!h.v || h.v.length === 0) && (
                  <div className="accordion-clean">
                    <CheckCircle2 size={15} /> No violations recorded at this inspection.
                  </div>
                )}
                {h.v?.map((v, vi) => (
                  <div key={vi} className={`violation ${v.s === "c" ? "critical" : "noncritical"}`} style={{ marginTop: vi === 0 ? 0 : 8 }}>
                    <AlertTriangle size={16} color={v.s === "c" ? "var(--stamp-red)" : "var(--amber)"} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div className="violation-body">
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
  );
}

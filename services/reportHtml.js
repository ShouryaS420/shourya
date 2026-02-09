// services/reportHtml.js

/**
 * Build the HTML for the Site Visit Report.
 * The DOM header is NOT used for repeating header — that’s done in Puppeteer headerTemplate.
 * Keep top spacing comfortable to avoid clashes with header.
 */
export function buildReportHtml(visit) {
    const clientName = visit?.client?.name || visit?.clientName || "Client";
    const feName = visit?.assignedTo?.username || "Field Engineer";
    const visitDate = visit?.when ? new Date(visit.when).toDateString() : "—";
    const shortId = String(visit?._id || "").slice(-6).toUpperCase();

    // Light helpers (safe)
    const safe = (v, dash = "—") => (v === undefined || v === null || v === "" ? dash : String(v));

    // Flatten sections (from visit.report)
    const sections = Array.isArray(visit?.report?.sections) ? visit.report.sections : [];

    // Photos
    const photos = Array.isArray(visit?.report?.photos) ? visit.report.photos : [];

    // Build section HTML
    const sectionHtml = sections
        .map((sec, i) => {
            const items = Array.isArray(sec?.items) ? sec.items : [];
            const itemsHtml = items
                .map((it) => {
                    const value = it?.note ? `${safe(it.value)} — <em>${safe(it.note)}</em>` : safe(it.value);
                    return `<div class="kv"><div class="kvl">${safe(it.label)}</div><div class="kvv">${value}</div></div>`;
                })
                .join("");
            return `
        <section class="card avoid-break">
          <h2>${safe(sec?.title || `Section ${i + 1}`)}</h2>
          ${itemsHtml || `<div class="muted">No details</div>`}
        </section>
      `;
        })
        .join("");

    const photosHtml = photos
        .map((u) => `<div class="ph"><img src="${u}" /></div>`)
        .join("");

    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Site Visit Report — ${clientName}</title>
  <style>
    @page { size: A4; }

    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
    html, body { margin:0; padding:0; color:#0F172A; font-family: Inter, Manrope, -apple-system, Segoe UI, Roboto, Arial; }

    /* We leave top/bottom space because header/footer are rendered by Puppeteer */
    body { padding: 18mm 14mm 18mm; }

    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 16px; margin: 0 0 8px; page-break-before: avoid; }
    .muted { color:#64748B; }
    .small { font-size:12px; }
    .lead { font-size: 13px; line-height: 1.5; margin: 8px 0 14px; }

    .ribbon { height:4px; background:#4B5BFF; margin:10px 0 16px; border-radius:4px; }

    .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
    .card { border:1px solid #E7E9FF; border-radius:8px; padding:10px; background:#fff; margin: 10px 0; }

    .kv { display:grid; grid-template-columns: 160px 1fr; gap:6px 12px; font-size:12.5px; padding:4px 0; }
    .kvl { color:#64748B; }

    .photos { display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; margin-top: 8px; }
    .ph { width:100%; aspect-ratio:4/3; border:1px solid #E7E9FF; border-radius:8px; overflow:hidden; }
    .ph img { width:100%; height:100%; object-fit:cover; }

    .avoid-break { break-inside: avoid; }
  </style>
</head>
<body>

  <!-- Cover block -->
  <section>
    <h1>Site Visit Report — ${clientName}</h1>
    <div class="muted">Report ID: SVR-${shortId} · Prepared by ${feName} · ${visitDate}</div>
    <div class="ribbon"></div>
    ${visit?.report?.summary
            ? `<div class="lead">${visit.report.summary}</div>`
            : `<div class="lead muted">Verified observations and must-consider items for your project.</div>`
        }
  </section>

  <!-- Sections -->
  ${sectionHtml || `<div class="muted">No sections added yet.</div>`}

  <!-- Photos -->
  ${photos.length
            ? `
      <section class="card">
        <h2>Photos</h2>
        <div class="photos">${photosHtml}</div>
      </section>
    ` : ""}

  <!-- Notes / Next steps (static block you can customize) -->
  <section class="card avoid-break">
    <h2>Notes & Next Steps</h2>
    <div class="small">
      <div>• Field measurements are approximate unless specified. Final BOQ/design subject to detailed survey/tests & approvals.</div>
      <div>• Choose your next step: Book Geo-tech & Topo · Start Design Kickoff · Request BOQ with guardrails.</div>
    </div>
  </section>

</body>
</html>
`;
}

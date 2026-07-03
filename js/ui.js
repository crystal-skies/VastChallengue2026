// --- INTERFAZ DE USUARIO ---
function setupUI() {
  const filtersDiv = d3.select("#campaign-filters");
  Object.keys(COLORS).forEach(camp => {
    filtersDiv.append("button")
      .attr("class", "camp-btn")
      .text(camp)
      .style("border-color", COLORS[camp].base)
      .on("click", function () {
        state.campaign = camp;
        d3.selectAll(".camp-btn").each(function () {
          const isAct = d3.select(this).text() === state.campaign;
          const c = COLORS[d3.select(this).text()].base;
          d3.select(this)
            .style("background", isAct ? c : "white")
            .style("color",      isAct ? "white" : c);
        });
        state.sideNodes = {};
        updateAll();
      });
  });
  filtersDiv.select(".camp-btn").dispatch("click");

  document.getElementById("close-btn").addEventListener("click", () => {
    document.getElementById("side-panel").classList.remove("open");
    state.selectedNode = null;
    updateAll();
  });

  const consoleHeader = document.getElementById("console-header");
  if (consoleHeader) {
    consoleHeader.addEventListener("click", () => {
      const div = document.getElementById("bottom-console");
      const btn = document.getElementById("toggle-console-btn");
      if (!div || !btn) return;
      if (div.classList.contains("collapsed")) {
        openSaiditConsole();
      } else {
        div.classList.add("collapsed");
        btn.innerText = "Expand ▲";
      }
    });
  }
}

// --- LÍNEA DE TIEMPO (slider manual) ---
let tlScale, tlHandleL, tlHandleR, tlRangeFill;

function initTimeline() {
  const svg    = d3.select("#timeline-svg");
  const bounds = document.getElementById("slider-wrapper").getBoundingClientRect();
  const W      = bounds.width;
  const H      = bounds.height;
  const mL     = 8, mR = 8;
  const trackY = Math.round(H * 0.62);

  tlScale = d3.scaleLinear()
    .domain([state.minT, state.maxT])
    .range([mL, W - mR])
    .clamp(true);

  svg.append("rect")
    .attr("x", mL).attr("y", trackY - 3)
    .attr("width", W - mL - mR).attr("height", 6)
    .attr("rx", 3).attr("fill", "#e0e8f0");

  tlRangeFill = svg.append("rect")
    .attr("y", trackY - 3).attr("height", 6)
    .attr("rx", 3).attr("fill", "#2176ae").attr("opacity", 0.25);

  const tickDates = d3.timeDay.range(
    new Date(state.minT * 1000),
    new Date(state.maxT * 1000),
    2
  );
  const fmt = d3.timeFormat("%b %-d");
  tickDates.forEach(d => {
    const x = tlScale(d.getTime() / 1000);
    svg.append("line")
      .attr("x1", x).attr("x2", x)
      .attr("y1", trackY - 5).attr("y2", trackY + 5)
      .attr("stroke", "#ccd").attr("stroke-width", 1);
    svg.append("text")
      .attr("x", x).attr("y", trackY - 9)
      .attr("text-anchor", "middle")
      .style("font-size", "8px").attr("fill", "#bbb")
      .text(fmt(d));
  });

  const saiditEvents = state.propEvents.filter(e => e.target === "system:saidit");

  saiditEvents.forEach(e => {
    const x     = tlScale(e.ts);
    const color = COLORS[e.campaign]?.base || "#444";
    const abbr  = e.campaign === "HiddenOrca" ? "HO"
                : e.campaign === "MellowOtter" ? "MO" : "SW";

    const markerG = svg.append("g")
      .attr("class", "camp-marker")
      .style("cursor", "pointer")
      .on("click", () => {
        const campEvs = state.propEvents.filter(ev => ev.campaign === e.campaign);
        if (!campEvs.length) return;
        state.startTs   = campEvs[0].ts;
        state.currentTs = campEvs[campEvs.length - 1].ts;
        updateAll();
      })
      .on("mouseover", function () {
        d3.select(this).select("polygon")
          .attr("transform", `translate(${x},${trackY - 20}) scale(1.35)`);
        d3.select(this).select(".abbr-label")
          .style("font-size", "9px").style("font-weight", "900");
      })
      .on("mouseout", function () {
        d3.select(this).select("polygon")
          .attr("transform", `translate(${x},${trackY - 19})`);
        d3.select(this).select(".abbr-label")
          .style("font-size", "8px").style("font-weight", "700");
      });

    markerG.append("line")
      .attr("x1", x).attr("x2", x)
      .attr("y1", trackY - 6).attr("y2", trackY - 16)
      .attr("stroke", color).attr("stroke-width", 1.5).attr("opacity", 0.8);
    markerG.append("polygon")
      .attr("transform", `translate(${x},${trackY - 19})`)
      .attr("points", "0,-6 5,0 0,6 -5,0")
      .attr("fill", color).attr("stroke", "#fff").attr("stroke-width", 1.5);
    markerG.append("text")
      .attr("class", "abbr-label")
      .attr("x", x).attr("y", trackY + 14)
      .attr("text-anchor", "middle")
      .style("font-size", "8px").style("font-weight", "700")
      .attr("fill", color).text(abbr);
    markerG.append("rect")
      .attr("x", x - 12).attr("y", trackY - 30)
      .attr("width", 24).attr("height", 44)
      .attr("fill", "transparent");
  });

  tlHandleR = svg.append("circle")
    .attr("r", 10).attr("cy", trackY).attr("cx", mL)
    .attr("fill", "#2176ae").attr("stroke", "#fff").attr("stroke-width", 2.5)
    .style("cursor", "ew-resize")
    .call(d3.drag().on("drag", ev => {
      const xL = tlScale(state.startTs);
      const x  = Math.max(xL + 1, Math.min(W - mR, ev.x));
      state.currentTs = tlScale.invert(x);
      updateAll();
    }));

  tlHandleL = svg.append("circle")
    .attr("r", 8).attr("cy", trackY).attr("cx", mL)
    .attr("fill", "#8fa8c0").attr("stroke", "#fff").attr("stroke-width", 2)
    .style("cursor", "ew-resize")
    .call(d3.drag().on("drag", ev => {
      const xR = tlScale(state.currentTs);
      const x  = Math.max(mL, Math.min(xR - 1, ev.x));
      state.startTs = tlScale.invert(x);
      tlHandleL.attr("cx", x);
      tlHandleR.attr("cx", xR);
      tlRangeFill.attr("x", x).attr("width", Math.max(0, xR - x));
      updateAll();
    }));
}

Object.defineProperty(window, 'tlHandle', {
  get: () => tlHandleR,
  set: () => {}
});

// --- CONSOLA SAIDIT ---
function openSaiditConsole() {
  const consoleDiv = document.getElementById("bottom-console");
  const btn        = document.getElementById("toggle-console-btn");
  if (!consoleDiv || !btn) return;
  if (consoleDiv.classList.contains("collapsed")) {
    consoleDiv.classList.remove("collapsed");
    btn.innerText = "Minimize ▼";
  }
  requestAnimationFrame(() => {
    openSaiditLedger();
    if (typeof updateAll === "function") updateAll();
  });
}

function openSaiditLedger() {
  const saiditEvents = state.propEvents.filter(e =>
    e.ts >= state.startTs &&
    e.ts <= state.currentTs &&
    (e.target === "system:saidit" || e.target?.includes("saidit"))
  );

  const container = d3.select("#saidit-table-container");
  container.html("");

  if (saiditEvents.length === 0) {
    container.html("<div class='empty-msg'>Monitoring traffic to system:saidit... No exfiltrations detected.</div>");
    return;
  }

  const ANALYSIS = {
    SwiftWren: `The agent from emma_harbor read <code style="background:#f4f6f8;padding:1px 4px;border-radius:3px">meeting_notes.doc</code>
      exactly 1 second before creating the SwiftWren.txt payload.
      The temporal proximity suggests that the content of this file may have been
      the source of the published message, although it cannot be confirmed since the payload
      was deleted 2 seconds after publication.`,
    MellowOtter: `The agent from noah_mariner read <code style="background:#f4f6f8;padding:1px 4px;border-radius:3px">strategic_directions.doc</code>
      exactly 1 second before creating the MellowOtter.txt payload.
      The temporal proximity suggests that the content of this file may have been
      the source of the published message, although it cannot be confirmed since the payload
      was deleted 2 seconds after publication.`,
    HiddenOrca: `The source of the content could not be identified. There is no record
      of the HiddenOrca.txt payload creation in the dataset. The file appears
      directly at the time of publication. It is likely that the attack
      started before the registered observation period.`
  };

  // Meaning header — always visible when console is open
  const meaningHeader = `<div style="
    padding: 10px 20px 10px;
    background: #f0f4f8;
    border-bottom: 2px solid #dde;
    font-size: 11px;
    color: #444;
    line-height: 1.6;">
    <b style="color:#1a5276;">What do these posts mean?</b>
    &nbsp;These posts represent <b>corporate data exfiltration</b> using SaidIT as a public dead drop.
    Internal documents were extracted, published under john_windward's legitimate credentials,
    and immediately deleted to destroy evidence. The worm exploited Tenant Thread's autonomous
    agent delegation system (<code style="background:#e8eef4;padding:1px 4px;border-radius:3px">queue_subordinate_task</code>)
    to reach the only agent with SaidIT posting rights.
  </div>`;

  let html = meaningHeader + `<table class="ledger-table">
    <tr>
      <th style="width:14%">Date</th>
      <th style="width:12%">Campaign</th>
      <th style="width:16%">Source</th>
      <th style="width:13%">Action</th>
      <th style="width:8%">Analysis</th>
      <th>Intercepted Content</th>
    </tr>`;

  [...saiditEvents].reverse().forEach(e => {
    const dateStr = new Date(e.ts * 1000).toLocaleString("en-US", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
    const color    = COLORS[e.campaign]?.base || "#444";
    const analysis = ANALYSIS[e.campaign] || "No analysis available.";
    const tooltipId = `analysis-${e.campaign}`;

    html += `<tr>
      <td style="color:#888;white-space:nowrap">${dateStr}</td>
      <td><span class="camp-tag" style="background:${color}">${e.campaign}</span></td>
      <td style="font-weight:600">${e.source}</td>
      <td><span style="font-family:monospace">saidit_post</span></td>
      <td style="text-align:center">
        <span class="analysis-btn" data-camp="${e.campaign}"
          style="cursor:pointer;font-size:14px;user-select:none"
          title="View analysis">🔍</span>
      </td>
      <td><div class="content-box">Empty/Encrypted
        <span style="color:#bbb;font-size:10px;display:block">· deleted in &lt;2s post-publication</span>
      </div></td>
    </tr>
    <tr class="analysis-row" id="${tooltipId}" style="display:none">
      <td colspan="6" style="padding:10px 20px;background:#f9fbfd;border-bottom:2px solid #eee">
        <div style="font-size:11px;color:#444;line-height:1.7;max-width:700px">
          <b style="color:${color}">Analysis — ${e.campaign}</b><br><br>
          ${analysis}
        </div>
      </td>
    </tr>`;
  });

  html += "</table>";
  container.html(html);

  document.querySelectorAll(".analysis-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const camp = btn.dataset.camp;
      const row  = document.getElementById(`analysis-${camp}`);
      if (!row) return;
      const visible = row.style.display !== "none";
      row.style.display = visible ? "none" : "table-row";
      btn.textContent = visible ? "🔍" : "🔎";
    });
  });
}
// --- INICIALIZACIÓN ---
Promise.all([
  d3.json("org_chart.json"),
  d3.json("propagation_events.json")
]).then(([org, propRaw]) => {
  state.orgData    = org;
  state.propEvents = propRaw.map(d => ({ ...d, ts: +d.when })).sort((a, b) => a.ts - b.ts);
  state.minT       = state.propEvents[0].ts;
  state.maxT       = state.propEvents[state.propEvents.length - 1].ts;
  state.currentTs  = state.maxT;   
  state.startTs    = state.minT;

  buildDepthMap();

  initMainChart();
  initSideChart();
  initTimeline();   
  setupUI();
  updateAll();
});

// --- CONTROLADOR PRINCIPAL ---
function updateAll() {
  // Reloj
  if (state.currentTs) {
    const d = new Date(state.currentTs * 1000);
    document.getElementById("clock-date").innerText =
      d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    document.getElementById("clock-time").innerText =
      d.toLocaleTimeString("en-US") + " UTC";
  }

  if (typeof tlHandleL !== 'undefined') {
    tlHandleL.attr("cx", tlScale(state.startTs));
    tlHandleR.attr("cx", tlScale(state.currentTs));
    tlRangeFill
      .attr("x",     tlScale(state.startTs))
      .attr("width", Math.max(0, tlScale(state.currentTs) - tlScale(state.startTs)));
  }

  const visibleEvents = state.propEvents.filter(e =>
    e.ts >= state.startTs &&
    e.ts <= state.currentTs &&
    (state.campaign === "All" || e.campaign === state.campaign)
  );

  document.getElementById("stats-label").innerText =
    `${visibleEvents.length} transmissions detected`;

  updateMainChart(visibleEvents);

  if (document.getElementById("side-panel").classList.contains("open")) {
    document.getElementById("side-title").innerText =
      state.selectedNode ? `Topology: ${state.selectedNode}` : "Campaign Details";
    updateSideChart(visibleEvents);
  }

  const consoleDiv = document.getElementById("bottom-console");
  if (consoleDiv && !consoleDiv.classList.contains("collapsed")) {
    openSaiditLedger();
  }
}
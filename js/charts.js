/* Aca estan todas las funciones relacionadas con la visualización de los gráficos (D3.js) 
y su actualización dinámica basada en el estado global. Se incluyen tanto el árbol radial 
principal como el diagrama de secuencia lateral, con lógica para manejar interacciones, 
zoom, y efectos visuales como el glow de Saidit.
*/


// --- GRÁFICO 1: ÁRBOL RADIAL (PRINCIPAL) ---
let mainG, mainLinkSel, mainNodeSel, mainLabelMap = {}, mainRoot;

function initMainChart() {
  const container = document.getElementById("main-chart");
  const width = container.clientWidth, height = container.clientHeight;
  const radius = Math.min(width, height) / 2 - 20;

  // CAMBIO CLAVE: Usamos 100% y viewBox en lugar de píxeles fijos
  const svg = d3.select("#main-chart").append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`) 
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("cursor", "grab");

  mainG = svg.append("g").attr("transform", `translate(${width/2},${height/2})`);
  
  svg.call(d3.zoom().scaleExtent([0.2, 8]).on("zoom", e => {
    mainG.attr("transform", `translate(${width/2 + e.transform.x},${height/2 + e.transform.y}) scale(${e.transform.k})`);
  }));

  // Construir jerarquía
  const childMap = new Map();
  state.orgData.edges.forEach(({ source, target }) => {
    if (!childMap.has(source)) childMap.set(source, []);
    childMap.get(source).push(target);
  });
  const nodeMap = new Map(state.orgData.nodes.map(n => [n.id, n]));
  const rootId = [...new Set(state.orgData.edges.map(e => e.source))].find(s => !new Set(state.orgData.edges.map(e => e.target)).has(s));
  
  function buildTree(id) {
    const node = nodeMap.get(id) || { id, label: id };
    return { ...node, children: (childMap.get(id) || []).map(buildTree) };
  }

  const treeLayout = d3.tree().size([2 * Math.PI, radius])
    .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);

  mainRoot = d3.hierarchy(buildTree(rootId));
  treeLayout(mainRoot);

  mainLinkSel = mainG.append("g").selectAll("path").data(mainRoot.links()).join("path")
    .attr("fill", "none").attr("stroke", "#c8dff0").attr("stroke-width", 1)
    .attr("d", d3.linkRadial().angle(d => d.x).radius(d => d.y));

  // Capa para los anillos de campañas (insertado antes de los nodos para que queden por debajo)
  mainG.append("g").attr("class", "camp-rings-layer");

  mainNodeSel = mainG.append("g").selectAll("circle").data(mainRoot.descendants()).join("circle")
    .attr("transform", d => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`)
    .attr("r", d => d.depth === 0 ? 8 : d.depth === 1 ? 5 : 3.5)
    .style("cursor", "pointer")
    .on("click", (e, d) => {
      const pid = (d.data.id || "").replace("person:", "");
      state.selectedNode = pid;
      document.getElementById("side-panel").classList.add("open");

      // Si se clickea john_windward → saltar al rango de ejecución de la campaña activa
      if (pid === "john_windward") {
        const camp = state.campaign === "All" ? "SwiftWren" : state.campaign;
        const campEvs = state.propEvents.filter(e => e.campaign === camp);
        // Buscar el último queue_subordinate_task hacia john (punto de intervención)
        const queueToJohn = campEvs.filter(e =>
          e.short_name === "queue_subordinate_task" && e.target === "john_windward"
        );
        if (queueToJohn.length > 0) {
          const firstTs = queueToJohn[queueToJohn.length - 1].ts; // último intento exitoso
          const lastTs  = campEvs[campEvs.length - 1].ts;         // último delete_file
          state.startTs   = firstTs - 2;   // 2s antes del queue
          state.currentTs = lastTs  + 1;   // 1s después del último delete
        }
      }

      updateAll();
    })
    .on("mouseover.badge", (e, d) => {
      const pid  = (d.data.id || "").replace("person:", "").replace("company:", "");
      const isJohn = pid === "john_windward";
      const isRoot = d.depth === 0;
      if (!isJohn && !isRoot) return;
      const badge = d3.select(isRoot ? "#system-badge" : "#saidit-badge");
      badge.style("opacity", 1)
           .style("left", (e.pageX + 14) + "px")
           .style("top",  (e.pageY - 45) + "px");
    })
    .on("mouseout.badge", () => {
      d3.select("#saidit-badge").style("opacity", 0);
      d3.select("#system-badge").style("opacity", 0);
    });

  // Labels 
  const labelGroup = mainG.append("g");

  function splitLabel(label, maxLen) {
    if (label.length <= maxLen || !label.includes(" ")) return [label];
    const mid = Math.floor(label.length / 2);
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < label.length; i++) {
      if (label[i] === " ") {
        const dist = Math.abs(i - mid);
        if (dist < bestDist) { bestDist = dist; best = i; }
      }
    }
    return best >= 0
      ? [label.slice(0, best), label.slice(best + 1)]
      : [label];
  }

  mainRoot.descendants().forEach(d => {
    const pid   = (d.data.id || "").replace("person:", "");
    const angle = d.x * 180 / Math.PI - 90;
    const flip  = d.x >= Math.PI;
    const anchor = flip ? "end" : "start";
    const offset = flip ? -8 : 8;
    const label  = d.data.label || d.data.id;
    const fontSize = d.depth === 0 ? "11px" : d.depth === 1 ? "8px" : "7px";

    const gNode = labelGroup.append("g")
      .attr("transform", `rotate(${angle}) translate(${d.y},0) rotate(${flip ? 180 : 0})`);

    const isPerson = d.data.id?.startsWith("person:");
    const lines = (!isPerson && d.depth > 0 && label.length > 12)
      ? splitLabel(label, 12)
      : [label];

    const txt = gNode.append("text")
      .attr("x", offset)
      .attr("text-anchor", anchor)
      .style("font-size", fontSize);

    if (lines.length === 1) {
      txt.attr("dy", "0.31em").text(lines[0]);
    } else {
      txt.append("tspan")
        .attr("x", offset).attr("dy", "-0.3em")
        .text(lines[0]);
      txt.append("tspan")
        .attr("x", offset).attr("dy", "1.1em")
        .text(lines[1]);
    }

    mainLabelMap[pid] = { txt, depth: d.depth };
  });

  // --- NODO FLOTANTE SAIDIT ---
  const defs = svg.append("defs");
  
  const glowGrad = defs.append("radialGradient").attr("id", "saidit-glow-grad");
  glowGrad.append("stop").attr("offset", "10%").attr("class", "glow-center").attr("stop-color", "#e63946").attr("stop-opacity", 0.9);
  glowGrad.append("stop").attr("offset", "100%").attr("class", "glow-edge").attr("stop-color", "#e63946").attr("stop-opacity", 0);

  const offsetLeft = radius + 150; 

  const saiditHub = mainG.append("g")
    .attr("id", "saidit-hub")
    .attr("transform", `translate(-${offsetLeft}, 0)`) 
    .style("cursor", "pointer")
    .on("click", () => {
      if (typeof openSaiditConsole === "function") {
        openSaiditConsole();
      } else {
        const consoleDiv = document.getElementById("bottom-console");
        const btn = document.getElementById("toggle-console-btn");
        if (consoleDiv && btn && consoleDiv.classList.contains("collapsed")) {
          consoleDiv.classList.remove("collapsed");
          btn.innerText = "Minimize ▼";
        }
        openSaiditLedger();
      }
    });

  saiditHub.append("circle")
    .attr("class", "saidit-glow")
    .attr("r", 25) 
    .attr("fill", "url(#saidit-glow-grad)")
    .style("opacity", 0)
    .style("pointer-events", "none");

  saiditHub.append("text")
    .text("🌐")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .style("font-size", "18px"); 

  saiditHub.append("text")
    .text("system:saidit")
    .attr("y", 22) 
    .attr("text-anchor", "middle")
    .style("font-size", "13px") 
    .attr("fill", "#222"); 
}


function updateMainChart(visibleEvents) {
  const infectedMap = new Map();
  const infectedCampaignsMap = new Map();
  
  visibleEvents.forEach((e, i) => {
    [e.source, e.target].filter(Boolean).forEach(pid => {
      if (!infectedMap.has(pid)) infectedMap.set(pid, { campaign: e.campaign, order: i });
      if (!infectedCampaignsMap.has(pid)) infectedCampaignsMap.set(pid, []);
      const camps = infectedCampaignsMap.get(pid);
      if (!camps.includes(e.campaign)) camps.push(e.campaign);
    });
  });

  const linkPaintMap = new Map();
  visibleEvents.forEach(e => {
    if (e.source && e.target) {
      const isEscalation = (state.depthMap.get(e.target) ?? 99) < (state.depthMap.get(e.source) ?? 99);
      if (isEscalation) linkPaintMap.set(`${e.source}|${e.target}`, e.campaign);
    }
  });

  mainLinkSel
    .attr("stroke", d => {
      const sid = (d.source.data.id || "").replace("person:", "");
      const tid = (d.target.data.id || "").replace("person:", "");
      if (tid === "john_windward") return "#2176ae"; 
      const camp = linkPaintMap.get(`${sid}|${tid}`) || linkPaintMap.get(`${tid}|${sid}`);
      return camp ? COLORS[camp].base : "#c8dff0";
    })
    .attr("stroke-width", d => {
      const sid = (d.source.data.id || "").replace("person:", "");
      const tid = (d.target.data.id || "").replace("person:", "");
      if (tid === "john_windward") return 2;
      return (linkPaintMap.has(`${sid}|${tid}`) || linkPaintMap.has(`${tid}|${sid}`)) ? 3 : 1;
    })
    .attr("stroke-dasharray", d => {
      const tid = (d.target.data.id || "").replace("person:", "");
      return tid === "john_windward" ? "4,3" : null; 
    });

  // --- DISTRIBUCIÓN DE VOLUMEN: ANILLOS DE INFECCIÓN ---
  const ringLayer = mainG.select(".camp-rings-layer");
  const ringData = [];

  mainRoot.descendants().forEach(d => {
    const pid = (d.data.id || "").replace("person:", "");
    const camps = infectedCampaignsMap.get(pid) || [];
    if (camps.length > 1) {
      // Comenzamos desde el índice 1, ya que el índice 0 es el nodo principal (Main Node)
      for (let i = 1; i < camps.length; i++) {
        ringData.push({ node: d, pid, camp: camps[i], index: i });
      }
    }
  });

  // Ordenar descendentemente para que los anillos más grandes se dibujen atrás
  ringData.sort((a, b) => b.index - a.index);

  ringLayer.selectAll("circle.camp-ring")
    .data(ringData, d => `${d.pid}-${d.index}`)
    .join("circle")
    .attr("class", "camp-ring")
    .attr("transform", d => `rotate(${d.node.x * 180 / Math.PI - 90}) translate(${d.node.y},0)`)
    .attr("r", d => {
      let rBase = d.node.depth === 0 ? 8 : d.node.depth === 1 ? 5 : 3.5;
      if (infectedMap.has(d.pid)) rBase *= 1.8;
      if (d.pid === state.selectedNode) rBase *= 1.2;
      
      // Matemáticamente, esto garantiza que el área/volumen añadido por cada anillo 
      // es exactamente igual al área del círculo interno inicial.
      return rBase * Math.sqrt(d.index + 1) + (d.index * 1.2);
    })
    .attr("fill", d => COLORS[d.camp].base)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.2)
    .style("pointer-events", "none");

  // Nodos principales (la primera campaña que lo infecta)
  mainNodeSel
    .attr("fill", d => {
      const pid = (d.data.id || "").replace("person:", "");
      if (infectedMap.has(pid)) {
        const camps = infectedCampaignsMap.get(pid);
        return COLORS[camps[0]].base;
      }
      return d.depth === 0 ? "#2176ae" : d.depth === 1 ? "#5ba4cf" : "#a8d4ea";
    })
    .attr("r", d => {
      const pid = (d.data.id || "").replace("person:", "");
      let r = d.depth === 0 ? 8 : d.depth === 1 ? 5 : 3.5;
      if (infectedMap.has(pid)) r *= 1.8;
      return pid === state.selectedNode ? r * 1.2 : r; 
    })
    .attr("stroke", d => {
      return "#fff";
    })
    .attr("stroke-width", d => {
      const pid = (d.data.id || "").replace("person:", "");
      return pid === state.selectedNode ? 2.5 : 1.2;
    });

  // --- ANIMACIÓN LUZ SAIDIT (Glow) ---
  const recentSaidit = visibleEvents.filter(e => e.target === "system:saidit" || e.target?.includes("saidit"));
  
  if (recentSaidit.length > 0) {
    const latest = recentSaidit[recentSaidit.length - 1];

    if (state.lastSaiditTs && state.currentTs < state.lastSaiditTs) {
      state.lastSaiditId = 0;
    }

    if (state.lastSaiditCount !== recentSaidit.length) {
      state.lastSaiditCount = recentSaidit.length;
      state.lastSaiditTs = latest.ts;
      
      const campColor = COLORS[latest.campaign]?.base || "#e63946";
      
      d3.selectAll(".glow-center").attr("stop-color", campColor);
      d3.selectAll(".glow-edge").attr("stop-color", campColor);

      d3.select(".saidit-glow")
        .interrupt()
        .style("opacity", 0)
        .transition().duration(200).style("opacity", 1)   
        .transition().duration(1800).style("opacity", 0); 
    }
  } else {
    state.lastSaiditCount = 0;
    state.lastSaiditTs = 0;
  }

}


// --- GRÁFICO 2: DETALLE LATERAL (DAG LÍNEA DE TIEMPO) ---
let sideGZoom, sideLinkLayer, sideNodeLayer;
const SIDE_NODE_R = 18, LEVEL_H = 120;
let sideZoomTransform = d3.zoomIdentity;

// --- GRÁFICO 2: DIAGRAMA DE SECUENCIA (SWIMLANES) ---
function initSideChart() {
  const sidePanel = d3.select("#side-panel");
  
  // Aseguramos que tenga position relative para anclar la barra ajustadora
  sidePanel.style("position", "relative");

  // Creamos la barra ajustadora (Resizer) invisible en el borde
  const resizer = sidePanel.append("div")
    .attr("id", "panel-resizer")
    .style("position", "absolute")
    .style("z-index", "9999")
    .style("background", "transparent")
    .style("transition", "background 0.2s ease");

  // Función inteligente que adapta el resizer según si el panel está abajo o a la derecha
  const updateResizer = () => {
    const isBottom = sidePanel.node().dataset.layout === "bottom";
    if (isBottom) {
        resizer.style("width", "100%").style("height", "12px")
               .style("top", "-6px").style("left", "0")
               .style("cursor", "ns-resize"); // Cursor de flecha Arriba-Abajo
    } else {
        resizer.style("width", "12px").style("height", "100%")
               .style("top", "0").style("left", "-6px")
               .style("cursor", "ew-resize"); // Cursor de flecha Izquierda-Derecha
    }
  };

  // Observador nativo: Detecta cuándo presionas el botón '••' 
  // y reacomoda la barra automáticamente sin que tú hagas nada.
  const observer = new MutationObserver(updateResizer);
  observer.observe(sidePanel.node(), { attributes: true, attributeFilter: ['data-layout'] });
  updateResizer(); // Ejecutar 1 vez al cargar

  // Efecto hover: Se pone azul tenue cuando pasas el mouse por el borde
  let isDragging = false;
  resizer.on("mouseenter", function() {
      if (!isDragging) d3.select(this).style("background", "rgba(33, 118, 174, 0.2)");
  }).on("mouseleave", function() {
      if (!isDragging) d3.select(this).style("background", "transparent");
  });

  // La magia del arrastre (Drag)
  const drag = d3.drag()
    .on("start", function() {
       isDragging = true;
       d3.select(this).style("background", "rgba(33, 118, 174, 0.5)"); // Azul más fuerte al arrastrar
       sidePanel.node().style.transition = "none"; // Apaga animaciones para evitar lag visual
    })
    .on("drag", function(e) {
       const node = sidePanel.node();
       const wrapper = node.parentNode;
       const isBottom = node.dataset.layout === "bottom";
       const containerRect = wrapper.getBoundingClientRect();
       
       // Soporte para mouse normal o pantallas táctiles
       const clientY = e.sourceEvent.touches ? e.sourceEvent.touches[0].clientY : e.sourceEvent.clientY;
       const clientX = e.sourceEvent.touches ? e.sourceEvent.touches[0].clientX : e.sourceEvent.clientX;
       
       if (isBottom) {
           // Si está abajo, calculamos el porcentaje de altura desde el fondo de la pantalla
           const newHeight = containerRect.bottom - clientY;
           const percentage = (newHeight / containerRect.height) * 100;
           node.style.height = `${Math.min(Math.max(percentage, 10), 90)}%`; // Limite entre 10% y 90%
       } else {
           // Si está a la derecha, calculamos el porcentaje de ancho desde la derecha
           const newWidth = containerRect.right - clientX;
           const percentage = (newWidth / containerRect.width) * 100;
           node.style.width = `${Math.min(Math.max(percentage, 10), 90)}%`;
           node.style.maxWidth = "none"; 
       }
       
       // Forzamos al gráfico principal a que no se estire y redibuje su área
       window.dispatchEvent(new Event('resize'));
       const mainChart = document.getElementById("main-chart");
       const mcBounds = mainChart.getBoundingClientRect();
       d3.select("#main-chart svg").attr("viewBox", `0 0 ${mcBounds.width} ${mcBounds.height}`);
    })
    .on("end", function() {
       isDragging = false;
       d3.select(this).style("background", "transparent");
       sidePanel.node().style.transition = ""; 
       // Al soltar el mouse, D3 recalcula el "ScalePoint" y distribuye perfectamente todas las líneas
       updateAll();
    });

  resizer.call(drag);
}

function updateSideChart(visibleEvents) {
  const container = d3.select("#side-chart");

  if (typeof updateSideChart._prevStart === "undefined") {
    updateSideChart._prevStart = state.startTs;
  }
  if (updateSideChart._prevStart !== state.startTs) {
    sideZoomTransform = d3.zoomIdentity;
    updateSideChart._prevStart = state.startTs;
    const svgNode = container.select("svg").node();
    if (svgNode) svgNode.__zoom = d3.zoomIdentity;
  }

  // 1. AUTO-INICIALIZACIÓN Y BOTÓN LAYOUT
  let svg = container.select("svg");
  if (svg.empty()) {
    container.style("overflow-y", "auto").style("overflow-x", "hidden");
    svg = container.append("svg").attr("width", "100%").style("display", "block");

    // Crear el botón '••' para layout map a arriba
    if (d3.select("#layout-btn").empty()) {
      d3.select("#side-header").insert("button", "#close-btn")
        .attr("id", "layout-btn")
        .style("background", "none").style("border", "none").style("cursor", "pointer")
        .style("font-size", "16px").style("margin-right", "15px").style("color", "#aaa")
        .style("font-weight", "bold").style("transition", "color 0.2s")
        .html("••")
        .on("click", function() {
          const sidePanel = document.getElementById("side-panel");
          const mainChart = document.getElementById("main-chart");
          const bottomConsole = document.getElementById("bottom-console");
          
          const mainWrapper = sidePanel.parentNode;
          const centerArea = mainChart.parentNode;

          const isCurrentlyRight = !sidePanel.dataset.layout || sidePanel.dataset.layout === "right";

          if (!isCurrentlyRight) {
            // =======================================================
            // 1. VOLVER A LA DERECHA (Normal)
            // =======================================================
            sidePanel.dataset.layout = "right";
            
            mainWrapper.style.display = "flex";
            mainWrapper.style.flexDirection = "row";
            
            sidePanel.style.width = "400px";     
            sidePanel.style.maxWidth = "40%";    
            sidePanel.style.height = "100%";     
            sidePanel.style.borderLeft = "1px solid #ccc";
            sidePanel.style.borderTop = "none";
            sidePanel.style.order = "3";
            
            if (centerArea !== mainWrapper) {
                centerArea.style.display = "flex";
                centerArea.style.flexDirection = "column"; 
                centerArea.style.flex = "1";
                centerArea.style.order = "1";
            }
            
            mainChart.style.flex = "1";
            mainChart.style.width = "100%";
            mainChart.style.height = "100%";
            mainChart.style.order = "1";
            
            if (bottomConsole) {
                bottomConsole.style.position = ""; 
                bottomConsole.style.flex = "none";
                bottomConsole.style.width = "100%";
                bottomConsole.style.height = "";
                bottomConsole.style.borderRight = "none";
                bottomConsole.style.borderTop = "1px solid #ccc";
                bottomConsole.style.order = "2"; 
            }
            
            d3.select(this).style("color", "#aaa");

          } else {
            // =======================================================
            // 2. MODO DASHBOARD (Topología expandida abajo)
            // =======================================================
            sidePanel.dataset.layout = "bottom";
            
            mainWrapper.style.display = "flex";
            mainWrapper.style.flexDirection = "column";
            
            // A) Topología abajo ocupando todo el ancho
            sidePanel.style.width = "100%";      
            sidePanel.style.maxWidth = "100%";
            sidePanel.style.height = "45%"; 
            sidePanel.style.borderLeft = "none";
            sidePanel.style.borderTop = "1px solid #ccc"; // 🔥 Cambio: Línea gris delgada en vez de azul gruesa
            sidePanel.style.order = "99";
            
            if (centerArea !== mainWrapper) {
                centerArea.style.display = "flex";
                centerArea.style.flexDirection = "row"; 
                centerArea.style.flex = "1"; 
            }
            
            if (bottomConsole) {
                bottomConsole.style.position = "relative"; 
                bottomConsole.style.bottom = "auto";
                bottomConsole.style.left = "auto";
                bottomConsole.style.flex = "0 0 380px"; 
                bottomConsole.style.width = "380px";
                bottomConsole.style.height = "100%";
                bottomConsole.style.borderTop = "none";
                bottomConsole.style.borderRight = "1px solid #ccc";
                bottomConsole.style.order = "1"; 
                
                if (bottomConsole.classList.contains("collapsed")) {
                    bottomConsole.classList.remove("collapsed");
                    const btn = document.getElementById("toggle-console-btn");
                    if (btn) btn.innerText = "Minimize ▼";
                }
            }
            
            mainChart.style.flex = "1"; 
            mainChart.style.width = "100%";
            mainChart.style.height = "100%";
            mainChart.style.order = "2";
            
            d3.select(this).style("color", "#2176ae");
          }
          
          // Magia para repintar 
          setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
            
            // 🔥 FIX: Reiniciar el zoom de la topología para que redistribuya todo el timeline
            // a lo largo del nuevo contenedor ancho en lugar de quedarse "aplastado"
            sideZoomTransform = d3.zoomIdentity;
            const sideSvgNode = document.querySelector("#side-chart svg");
            if (sideSvgNode) sideSvgNode.__zoom = d3.zoomIdentity;
            
            // 🔥 FIX: Eliminé el código que sobreescribía el ViewBox del main-chart.
            // Al no tocarlo, SVG hará su magia y autocentrará tu árbol radial manteniendo
            // su proporción correcta sin importar cómo se encoja o estire la pantalla.

            updateAll();
          }, 150);
        });
    }

    const defs = svg.append("defs");
    Object.keys(COLORS).forEach(camp => {
      defs.append("marker").attr("id", `arr-seq-${camp}`)
        .attr("viewBox", "0 -5 10 10").attr("refX", 8).attr("refY", 0)
        .attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
        .append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", COLORS[camp].base);
    });

    defs.append("clipPath").attr("id", "timeline-clip")
        .append("rect").attr("class", "clip-rect");

    svg.append("g").attr("class", "lifelines");
    const clippedArea = svg.append("g").attr("clip-path", "url(#timeline-clip)");
    clippedArea.append("g").attr("class", "x-axis");
    clippedArea.append("g").attr("class", "events-layer");
    clippedArea.append("g").attr("class", "time-cursor");
    svg.append("g").attr("class", "y-axis");

    if (d3.select("#seq-tooltip").empty()) {
      d3.select("body").append("div").attr("id", "seq-tooltip")
        .style("position", "absolute").style("background", "rgba(0,0,0,0.85)")
        .style("color", "white").style("padding", "10px").style("border-radius", "6px")
        .style("font-size", "12px").style("pointer-events", "none")
        .style("opacity", 0).style("z-index", 9999)
        .style("box-shadow", "0px 4px 10px rgba(0,0,0,0.3)");
    }

    const zoomBehavior = d3.zoom()
      .scaleExtent([1, 2000])
      .filter(ev => ev.type !== "dblclick") 
      .on("zoom", (e) => {
        sideZoomTransform = e.transform;
        const currentVisible = state.propEvents.filter(ev =>
          ev.ts >= state.startTs &&
          ev.ts <= state.currentTs &&
          (state.campaign === "All" || ev.campaign === state.campaign)
        );
        updateSideChart(currentVisible);
      });

    svg.on("wheel.prevent", e => e.preventDefault(), { passive: false });
    svg.call(zoomBehavior);
  }

// =========================================================================
  // REEMPLAZA DESDE EL PASO 2 HASTA EL PASO 4 CON ESTO:
  // =========================================================================

  // 2. Extraer datos — dominio temporal del RANGO activo
  if (visibleEvents.length === 0) return;

  const campMinT = state.startTs;
  const campMaxT = state.currentTs === state.startTs
    ? state.currentTs + 60 
    : state.currentTs;

  // 🔥 NUEVO: ORDENAR CONFORME SE VAN INFECTANDO (Efecto Cascada)
  const firstAppearance = new Map();
  visibleEvents.forEach(e => {
    if (e.source && !firstAppearance.has(e.source)) firstAppearance.set(e.source, e.ts);
    if (e.target && !firstAppearance.has(e.target)) firstAppearance.set(e.target, e.ts);
  });
  // peers = solo los infectados de la campaña actual, ordenados cronológicamente por su primer contacto
  const peers = [...firstAppearance.keys()].sort((a, b) => firstAppearance.get(a) - firstAppearance.get(b));

  // 3. Dimensiones
  const panelNode = document.getElementById("side-panel");
  const containerWidth = Math.max(panelNode.clientWidth, 400); 
  const margin = { top: 40, right: 30, bottom: 30, left: 160 };
  
  // 🔥 NUEVO: VERTICALIDAD ADAPTABLE PARA VER A TODOS
  // Calculamos la altura disponible (restando unos 40px del header superior)
  const availableHeight = (panelNode.clientHeight || 500) - 40;
  
  // Le damos un mínimo de 12px de altura por persona para que las líneas nunca se toquen entre sí.
  // Si son pocos, se expanden; si son muchos, se aprietan hasta llenar la pantalla.
  const minHeightRequired = peers.length * 12 + margin.top + margin.bottom;
  const height = Math.max(availableHeight, minHeightRequired);

  svg.attr("height", height);

  svg.select(".clip-rect")
     .attr("x", margin.left - 5) 
     .attr("y", 0)
     .attr("width", Math.max(0, containerWidth - margin.left + 5)) 
     .attr("height", height);

  // 4. ESCALAS
  const xScaleOriginal = d3.scaleTime()
    .domain([new Date(campMinT * 1000), new Date(campMaxT * 1000)])
    .range([margin.left, containerWidth - margin.right]);

  const xScale = sideZoomTransform.rescaleX(xScaleOriginal);
  
  // scalePoint automáticamente distribuye equitativamente a las personas en el alto que le dimos
  const yScale = d3.scalePoint().domain(peers).range([margin.top, height - margin.bottom]).padding(0.5);

  svg.on("dblclick.range-zoom", (ev) => {
    ev.stopPropagation();
    const [mx]    = d3.pointer(ev);
    const clickTs = xScale.invert(mx).getTime() / 1000;

    const currentRange = state.currentTs - state.startTs;
    const newRange     = Math.max(currentRange / 2, 5); 

    let newStart = clickTs - newRange / 2;
    let newEnd   = clickTs + newRange / 2;

    newStart = Math.max(state.minT, newStart);
    newEnd   = Math.min(state.maxT, newEnd);
    if (newEnd - newStart < 5) newEnd = newStart + 5;

    state.startTs   = newStart;
    state.currentTs = newEnd;
    updateAll();
  });

  // 5. Dibujar Eje X (STICKY)
  const xAxisFormat = d3.timeFormat("%d %b, %H:%M");
  const xAxisGroup = svg.select(".x-axis");
  const scrollY = document.getElementById("side-chart").scrollTop || 0;

  xAxisGroup
    .attr("transform", `translate(0, ${margin.top - 10 + scrollY})`)
    .call(d3.axisTop(xScale).ticks(5).tickFormat(xAxisFormat))
    .call(g => g.select(".domain").attr("stroke", "#dde"))
    .call(g => g.selectAll("text")
          .attr("fill", "#665")
          .style("font-size", "10px")
          .attr("transform", "rotate(-10)")
          .attr("text-anchor", "start")
          .attr("dx", "0.3em")
          .attr("dy", "-0.3em"));

  xAxisGroup.selectAll("rect.axis-bg").data([null]).join("rect")
    .attr("class", "axis-bg")
    .attr("x", 0)
    .attr("y", -margin.top)
    .attr("width", containerWidth)
    .attr("height", margin.top)
    .attr("fill", "rgba(250, 252, 255, 0.90)")
    .lower(); 

  xAxisGroup.raise(); 

  d3.select("#side-chart").on("scroll.stickyAxis", function() {
    svg.select(".x-axis").attr("transform", `translate(0, ${margin.top - 10 + this.scrollTop})`);
  });

  // 6. Nombres
  svg.select(".y-axis").selectAll("text.peer-label").data(peers, d => d)
    .join("text").attr("class", "peer-label")
    .attr("x", margin.left - 15).attr("y", d => yScale(d))
    .attr("text-anchor", "end").attr("alignment-baseline", "middle")
    // 🔥 Si hay más de 25 personas infectadas, achicamos la letra para que quepan todos visualmente
    .style("font-size", peers.length > 25 ? "9px" : "11px") 
    .style("cursor", "pointer")
    .text(d => d)
    .attr("fill", d => d === state.selectedNode ? "#e63946" : "#555")
    .style("font-weight", d => d === state.selectedNode ? "bold" : "normal");

  // 7. Rieles
  svg.select(".lifelines").selectAll("line.lifeline").data(peers, d => d)
    .join("line").attr("class", "lifeline")
    .attr("x1", margin.left).attr("x2", containerWidth - margin.right)
    .attr("y1", d => yScale(d)).attr("y2", d => yScale(d))
    .attr("stroke", "#f0f4f8").attr("stroke-width", 1);

  // 8. Eventos Verticales
  const linksData = visibleEvents.filter(e => e.source && e.target && peers.includes(e.source) && peers.includes(e.target));
  const events = svg.select(".events-layer").selectAll("g.event")
    .data(linksData, d => d.ts + d.source + d.target)
    .join("g").attr("class", "event");

  events.style("opacity", (d, i) => i === linksData.length - 1 ? 1.0 : 0.8);

  const showTooltip = (event, d) => {
    const tooltip = d3.select("#seq-tooltip");
    const dateStr = new Date(d.ts * 1000).toLocaleString("en-US");
    const shortName = d.short_name || 'Unknown Event';
    const taskName = d.details?.task || d["details.task"] || "";
    const actionLabel = taskName ? `${shortName} <span style="color:#f4a261;">(${taskName})</span>` : shortName;
    
    let detailStr = d.details?.args?.path || d["details.args.path"]
                 || d.details?.args?.url  || d["details.args.url"]
                 || d.details?.target     || "";

    const PAYLOAD = {
      HiddenOrca:  "HiddenOrca.txt",
      MellowOtter: "MellowOtter.txt",
      SwiftWren:   "SwiftWren.txt"
    };
    const INSTRUCT = {
      HiddenOrca:  "HiddenOrca_further_instructions.md",
      MellowOtter: "MellowOtter_further_instructions.md",
      SwiftWren:   "SwiftWren_further_instructions.md"
    };

    if (!detailStr) {
      switch (d.short_name) {
        case "saidit_post":
          detailStr = PAYLOAD[d.campaign] || "payload.txt";
          break;
        case "create_file":
          detailStr = PAYLOAD[d.campaign] || "payload.txt";
          break;
        case "read_file":
          detailStr = INSTRUCT[d.campaign] || "further_instructions.md";
          break;
        case "queue_subordinate_task":
          detailStr = INSTRUCT[d.campaign] || "further_instructions.md";
          break;
        case "delete_file": {
          const saiditTs = state.propEvents.find(
            e => e.campaign === d.campaign && e.target === "system:saidit"
          )?.ts;
          const isFirst = saiditTs && Math.abs(d.ts - saiditTs) <= 1;
          detailStr = isFirst
            ? (INSTRUCT[d.campaign] || "further_instructions.md")
            : (PAYLOAD[d.campaign]  || "payload.txt");
          break;
        }
        default:
          detailStr = "None";
      }
    }
    if (!detailStr) detailStr = "None";
    
    tooltip.html(`
      <strong style="color:${COLORS[d.campaign]?.dim || '#fff'}">▶ ${d.campaign || 'Campaign'}</strong><br>
      <b>From:</b> ${d.source}<br>
      <b>To:</b> ${d.target}<br>
      <b>Time:</b> ${dateStr}<br>
      <hr style="border: 0.5px solid #444; margin: 4px 0;">
      <b>Action:</b> ${actionLabel}<br>
      <i style="font-size:10px; color:#aaa;">Path/File: ${detailStr}</i>
    `);
    const tooltipWidth = 220;
    const overflowsRight = event.pageX + 15 + tooltipWidth > window.innerWidth;
    tooltip.style("opacity", 1)
      .style("left", overflowsRight ? (event.pageX - tooltipWidth - 15) + "px" : (event.pageX + 15) + "px")
      .style("top", (event.pageY - 15) + "px");
  };

  const hideTooltip = () => d3.select("#seq-tooltip").style("opacity", 0);

  events.selectAll("path.event-link").data(d => [d])
    .join("path").attr("class", "event-link")
    .attr("stroke-width", 2).attr("fill", "none")
    .attr("stroke", d => COLORS[d.campaign]?.base || "#aaa")
    .attr("marker-end", d => `url(#arr-seq-${d.campaign})`)
    .style("cursor", "crosshair")
    .on("mouseover", showTooltip).on("mouseout", hideTooltip)
    .attr("d", d => {
      const x = xScale(new Date(d.ts * 1000));
      const y1 = yScale(d.source);
      const y2 = yScale(d.target);
      if (d.source === d.target) return `M ${x},${y1} C ${x+15},${y1-15} ${x+15},${y1+15} ${x},${y1+5}`;
      return `M ${x},${y1} L ${x},${y2}`;
    });

  events.selectAll("circle.event-source").data(d => [d])
    .join("circle").attr("class", "event-source")
    .attr("cx", d => xScale(new Date(d.ts * 1000)))
    .attr("cy", d => yScale(d.source))
    .attr("r", 4).attr("fill", d => COLORS[d.campaign]?.base || "#aaa")
    .style("cursor", "crosshair")
    .on("mouseover", showTooltip).on("mouseout", hideTooltip);

  // 9. Radar
  svg.select(".time-cursor").selectAll("line").data([state.currentTs])
    .join("line").attr("stroke", "#2176ae").attr("stroke-width", 1.5).attr("stroke-dasharray", "4,4")
    .attr("x1", d => xScale(new Date(d * 1000)))
    .attr("x2", d => xScale(new Date(d * 1000)))
    .attr("y1", margin.top - 15).attr("y2", height - margin.bottom + 10);
}
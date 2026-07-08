/* graph.js — Motor de visualización Ocean Glass.
   Expone renderGraph(rawGraph, title) que dibuja el grafo en #graph.
   Consume el schema de Graphify (node-link de NetworkX): nodes[] + links[].
   Verificado contra grafos reales de 300+ nodos. */

(function () {
  "use strict";

  // Rampa oceánica coherente (no arcoíris) — misma paleta que el script Python.
  const PALETTE = [
    "#4FD1C5","#F2B84B","#7FB3D5","#68D391","#E08A5B","#9F86C0",
    "#5EC5C0","#E6C86E","#6FA8DC","#82CBA8","#D98C6A","#B79CD6"
  ];

  let sim = null; // simulación activa (para poder pararla al recargar)

  function esc(s){ return String(s==null?"":s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

  // ── Normaliza el schema de Graphify a algo consistente ──
  function normalize(g){
    const rawNodes = g.nodes || [];
    const rawLinks = g.links || g.edges || [];
    const idOf = x => (x && typeof x === "object") ? x.id : x;

    const degree = {};
    rawLinks.forEach(l => {
      const s = idOf(l.source), t = idOf(l.target);
      if (s != null) degree[s] = (degree[s]||0)+1;
      if (t != null) degree[t] = (degree[t]||0)+1;
    });

    const nodes = [];
    rawNodes.forEach(n => {
      if (n.id == null) return;
      nodes.push({
        id: n.id,
        label: n.label || n.norm_label || String(n.id),
        community: n.community != null ? n.community : 0,
        file: n.source_file || "",
        loc: n.source_location || "",
        ftype: n.file_type || "code",
        deg: degree[n.id] || 0
      });
    });

    const links = [];
    rawLinks.forEach(l => {
      const s = idOf(l.source), t = idOf(l.target);
      if (s == null || t == null) return;
      links.push({
        source: s, target: t,
        relation: l.relation || "related",
        conf: l.confidence || "EXTRACTED"
      });
    });
    return { nodes, links };
  }

  function communitySummary(nodes){
    const byComm = {};
    nodes.forEach(n => { (byComm[n.community] = byComm[n.community] || []).push(n); });
    const entries = Object.entries(byComm).sort((a,b)=>b[1].length - a[1].length);
    const summary = [], color = {};
    entries.forEach(([comm, members], i) => {
      const c = PALETTE[i % PALETTE.length];
      const hub = members.reduce((a,b)=> b.deg>a.deg?b:a, members[0]);
      const cid = isNaN(+comm) ? comm : +comm;
      summary.push({ id: cid, color: c, count: members.length, hub: hub.label });
      color[cid] = c;
    });
    return { summary, color };
  }

  // ── Render principal ──
  window.renderGraph = function (rawGraph, title) {
    const { nodes: NODES, links: LINKS } = normalize(rawGraph);
    if (!NODES.length) throw new Error("El grafo no tiene nodos.");
    const { summary: COMMS, color: COLOR } = communitySummary(NODES);

    // actualizar header
    document.getElementById("graph-title").innerHTML =
      esc(title) + ' <span>· Ocean Graph</span>';
    document.getElementById("st-nodes").textContent = NODES.length;
    document.getElementById("st-links").textContent = LINKS.length;
    document.getElementById("st-comms").textContent = COMMS.length;

    const svg = d3.select("#graph");
    svg.selectAll("*").remove();      // limpiar render previo
    if (sim) sim.stop();
    const W = () => window.innerWidth, H = () => window.innerHeight;
    svg.attr("viewBox", [0,0,W(),H()]);

    const maxDeg = Math.max(1, d3.max(NODES, d => d.deg) || 1);
    const rScale = d3.scaleSqrt().domain([0, maxDeg]).range([3.2, 15]);
    NODES.forEach(n => { n.r = rScale(n.deg); });

    const byId = new Map(NODES.map(n => [n.id, n]));
    const adj = new Map(NODES.map(n => [n.id, new Set()]));
    LINKS.forEach(l => {
      if (adj.has(l.source)) adj.get(l.source).add(l.target);
      if (adj.has(l.target)) adj.get(l.target).add(l.source);
    });

    const root = svg.append("g");
    const gLink = root.append("g").attr("stroke-opacity", 0.35);
    const gNode = root.append("g");

    const link = gLink.selectAll("line").data(LINKS).join("line")
      .attr("class", d => "link" + (d.conf === "INFERRED" ? " inferred" : ""))
      .attr("stroke", d => d.conf === "INFERRED" ? "#F2B84B" : "#3d6b6f")
      .attr("stroke-width", d => d.conf === "INFERRED" ? 1.1 : 0.8);

    const node = gNode.selectAll("g").data(NODES).join("g").attr("class","node")
      .call(d3.drag().on("start", dragStart).on("drag", dragged).on("end", dragEnd));

    node.append("circle")
      .attr("r", d => d.r)
      .attr("fill", d => COLOR[d.community] || "#4FD1C5")
      .attr("stroke", "#06181c").attr("stroke-width", 1.5)
      .style("filter", d => d.deg >= maxDeg*0.6
        ? "drop-shadow(0 0 6px " + (COLOR[d.community]||"#4FD1C5") + ")" : "none");

    node.filter(d => d.deg >= Math.max(4, maxDeg*0.35))
      .append("text").attr("x", d => d.r+4).attr("y", 4).attr("font-size","10px")
      .text(d => d.label.length > 22 ? d.label.slice(0,21)+"…" : d.label);

    node.on("click", (ev,d) => { ev.stopPropagation(); onNodeClick(d); });
    node.on("mouseenter", (ev,d) => { if(!pathMode()) hoverFocus(d); });
    node.on("mouseleave", () => { if(!pathMode() && !locked) clearFocus(); });

    sim = d3.forceSimulation(NODES)
      .force("link", d3.forceLink(LINKS).id(d=>d.id)
        .distance(l => l.conf==="INFERRED"?70:45).strength(0.35))
      .force("charge", d3.forceManyBody().strength(d=>-30 - d.deg*8))
      .force("center", d3.forceCenter(W()/2, H()/2))
      .force("collide", d3.forceCollide().radius(d=>d.r+3))
      .on("tick", ticked);

    function ticked(){
      link.attr("x1",d=>d.source.x).attr("y1",d=>d.source.y)
          .attr("x2",d=>d.target.x).attr("y2",d=>d.target.y);
      node.attr("transform", d=>`translate(${d.x},${d.y})`);
    }

    const zoom = d3.zoom().scaleExtent([0.15,6])
      .on("zoom", ev => root.attr("transform", ev.transform));
    svg.call(zoom);
    svg.on("click", () => { locked=false; clearFocus(); });

    function dragStart(ev,d){ if(!ev.active) sim.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; }
    function dragged(ev,d){ d.fx=ev.x; d.fy=ev.y; }
    function dragEnd(ev,d){ if(!ev.active) sim.alphaTarget(0); d.fx=null; d.fy=null; }

    let locked = false;
    function neighborsOf(id){ const s=new Set([id]); (adj.get(id)||[]).forEach(x=>s.add(x)); return s; }
    function applyFocus(idSet){
      node.classed("dim", d=>!idSet.has(d.id)).classed("hot", d=>idSet.has(d.id));
      link.classed("dim", d=>!(idSet.has(d.source.id)&&idSet.has(d.target.id)))
          .classed("hot", d=>idSet.has(d.source.id)&&idSet.has(d.target.id));
    }
    function hoverFocus(d){ applyFocus(neighborsOf(d.id)); }
    function clearFocus(){ node.classed("dim",false).classed("hot",false);
      link.classed("dim",false).classed("hot",false); }

    function showDetail(d){
      const nbrs = [...(adj.get(d.id)||[])].map(id=>byId.get(id)).filter(Boolean);
      const relOf = tid => { const l = LINKS.find(x =>
        (x.source.id===d.id&&x.target.id===tid)||(x.target.id===d.id&&x.source.id===tid));
        return l ? l.relation : ""; };
      let h = `<div class="dlabel">${esc(d.label)}</div>`;
      h += `<div class="dmeta">${esc(d.file||"—")} · <b>${esc(d.loc||"")}</b></div>`;
      const comm = COMMS.find(c=>c.id===d.community) || {};
      h += `<div class="drow"><span>Comunidad</span><b>#${d.community} · ${esc(comm.hub||"")}</b></div>`;
      h += `<div class="drow"><span>Conexiones</span><b>${d.deg}</b></div>`;
      h += `<div class="drow"><span>Tipo</span><b>${esc(d.ftype)}</b></div>`;
      if(nbrs.length){
        h += `<div class="nbtitle">Vecinos (${nbrs.length})</div>`;
        nbrs.slice(0,40).forEach(nb => {
          const c = COLOR[nb.community]||"#4FD1C5";
          h += `<span class="nb" style="border-left-color:${c}" data-id="${esc(nb.id)}">${esc(nb.label)} <span class="rel">${esc(relOf(nb.id))}</span></span>`;
        });
      }
      const det = document.getElementById("detail");
      det.innerHTML = h;
      det.querySelectorAll(".nb").forEach(el =>
        el.addEventListener("click", () => { const t=byId.get(el.dataset.id); if(t) onNodeClick(t); }));
    }

    let pathStart = null;
    function pathMode(){ return pathStart !== null; }
    function bfs(a,b){
      const q=[[a]], seen=new Set([a]);
      while(q.length){
        const p=q.shift(), last=p[p.length-1];
        if(last===b) return p;
        for(const nx of (adj.get(last)||[])){ if(!seen.has(nx)){ seen.add(nx); q.push([...p,nx]); } }
      }
      return null;
    }
    function onNodeClick(d){
      if(pathStart===null){
        pathStart=d.id; locked=true; applyFocus(neighborsOf(d.id)); showDetail(d); focusCamera(d);
      } else if(pathStart===d.id){
        pathStart=null; locked=false; clearFocus(); hidePathbar();
      } else {
        const p = bfs(pathStart, d.id);
        if(p){
          const set = new Set(p);
          node.classed("dim", n=>!set.has(n.id)).classed("hot", n=>set.has(n.id));
          link.classed("dim", l=>{ const i=p.indexOf(l.source.id), j=p.indexOf(l.target.id);
            return !(Math.abs(i-j)===1 && i>=0 && j>=0); })
            .classed("hot", l=>{ const i=p.indexOf(l.source.id), j=p.indexOf(l.target.id);
            return Math.abs(i-j)===1 && i>=0 && j>=0; });
          const labels = p.map(id => (byId.get(id)||{}).label).join(" → ");
          showPathbar(`Camino (${p.length-1} saltos): `, labels);
        } else {
          showPathbar("Sin camino: ", `${(byId.get(pathStart)||{}).label} ⇢ ${d.label}`);
        }
        pathStart=null; locked=true;
      }
    }
    function showPathbar(pre, txt){
      document.getElementById("pathtext").innerHTML = pre + `<span class="ph">${esc(txt)}</span>`;
      document.getElementById("pathbar").style.display="flex";
    }
    function hidePathbar(){ document.getElementById("pathbar").style.display="none"; }

    function focusCamera(d){
      const t = d3.zoomTransform(svg.node());
      const nx = W()/2 - d.x*t.k, ny = H()/2 - d.y*t.k;
      svg.transition().duration(500).call(zoom.transform,
        d3.zoomIdentity.translate(nx,ny).scale(t.k));
    }

    // buscador
    const search = document.getElementById("search");
    const results = document.getElementById("results");
    search.value = "";
    const onSearch = () => {
      const q = search.value.trim().toLowerCase();
      if(!q){ results.style.display="none"; return; }
      const hits = NODES.filter(n => n.label.toLowerCase().includes(q)
        || (n.file||"").toLowerCase().includes(q)).sort((a,b)=>b.deg-a.deg).slice(0,18);
      results.innerHTML = hits.map(n =>
        `<div class="result" data-id="${esc(n.id)}">${esc(n.label)} <span class="rf">${esc(n.file||"")}</span></div>`).join("");
      results.style.display = hits.length ? "block" : "none";
      results.querySelectorAll(".result").forEach(el =>
        el.addEventListener("click", () => {
          const d = byId.get(el.dataset.id);
          if(d){ results.style.display="none"; search.value="";
            locked=true; applyFocus(neighborsOf(d.id)); showDetail(d); focusCamera(d); }
        }));
    };
    search.oninput = onSearch;

    // leyenda filtrable
    const legend = document.getElementById("legend");
    const active = new Set(COMMS.map(c=>c.id));
    function renderLegend(){
      legend.innerHTML = COMMS.map(c =>
        `<div class="leg ${active.has(c.id)?'':'off'}" data-c="${esc(c.id)}">
           <span class="dot" style="color:${c.color};background:${c.color}"></span>
           <span class="lname">${esc(c.hub)}</span>
           <span class="lct">${c.count}</span></div>`).join("");
      legend.querySelectorAll(".leg").forEach(el =>
        el.addEventListener("click", () => {
          const raw = el.dataset.c; const c = isNaN(+raw)?raw:+raw;
          if(active.has(c)) active.delete(c); else active.add(c);
          applyCommunityFilter();
        }));
    }
    function applyCommunityFilter(){
      node.style("display", d => active.has(d.community) ? null : "none");
      link.style("display", d =>
        (active.has(d.source.community)&&active.has(d.target.community)) ? null : "none");
      renderLegend();
    }
    document.getElementById("leg-all").onclick = () => { COMMS.forEach(c=>active.add(c.id)); applyCommunityFilter(); };
    document.getElementById("leg-none").onclick = () => { active.clear(); applyCommunityFilter(); };
    document.getElementById("pathclear").onclick = () => { pathStart=null; locked=false; clearFocus(); hidePathbar(); };
    renderLegend();

    // reset detalle/path al recargar
    document.getElementById("detail").innerHTML =
      '<div class="empty">Clic en un nodo para inspeccionarlo. Clic en dos nodos para trazar el camino más corto entre ellos.</div>';
    hidePathbar();

    // resize (registrar una sola vez)
    if (!window.__oceanResizeBound) {
      window.addEventListener("resize", () => {
        if(!sim) return;
        svg.attr("viewBox", [0,0,W(),H()]);
        sim.force("center", d3.forceCenter(W()/2, H()/2)).alpha(0.15).restart();
      });
      window.__oceanResizeBound = true;
    }
  };
})();

/* app.js — Capa de aplicación: carga de graph.json, drag&drop, demo, navegación. */
(function () {
  "use strict";

  const landing = document.getElementById("landing");
  const app = document.getElementById("app");
  const errBox = document.getElementById("land-error");
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");

  function showError(msg){ errBox.textContent = msg; }
  function clearError(){ errBox.textContent = ""; }

  function looksLikeGraph(obj){
    return obj && typeof obj === "object" &&
      Array.isArray(obj.nodes) &&
      (Array.isArray(obj.links) || Array.isArray(obj.edges));
  }

  function activateGraph(data, title){
    try {
      landing.hidden = true;
      app.hidden = false;
      // dar un frame para que el layout exista antes de medir el SVG
      requestAnimationFrame(() => {
        try { window.renderGraph(data, title || "Grafo"); }
        catch(e){ backToLanding(); showError("No se pudo dibujar: " + e.message); }
      });
    } catch(e){ showError(e.message); }
  }

  function backToLanding(){
    app.hidden = true;
    landing.hidden = false;
  }

  function handleJSONText(text, title){
    clearError();
    let data;
    try { data = JSON.parse(text); }
    catch(e){ showError("El archivo no es JSON válido."); return; }
    if(!looksLikeGraph(data)){
      showError("No parece un graph.json de Graphify (falta nodes/links).");
      return;
    }
    activateGraph(data, title);
  }

  function handleFile(file){
    if(!file) return;
    if(!/\.json$/i.test(file.name) && file.type !== "application/json"){
      showError("Sube un archivo .json"); return;
    }
    const title = file.name.replace(/\.json$/i, "").replace(/[-_]/g," ")
      .replace(/\bgraph\b/i,"").trim() || "Grafo";
    const reader = new FileReader();
    reader.onload = () => handleJSONText(reader.result, title);
    reader.onerror = () => showError("No se pudo leer el archivo.");
    reader.readAsText(file);
  }

  // ── file input ──
  fileInput.addEventListener("change", e => handleFile(e.target.files[0]));
  dropzone.addEventListener("click", () => fileInput.click());

  // ── drag & drop ──
  ["dragenter","dragover"].forEach(ev =>
    dropzone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation();
      dropzone.classList.add("drag"); }));
  ["dragleave","drop"].forEach(ev =>
    dropzone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation();
      dropzone.classList.remove("drag"); }));
  dropzone.addEventListener("drop", e => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    handleFile(f);
  });
  // drop en cualquier parte de la landing también funciona
  ["dragover","drop"].forEach(ev =>
    landing.addEventListener(ev, e => { e.preventDefault(); }));

  // ── demo ──
  document.getElementById("load-demo").addEventListener("click", () => {
    clearError();
    const btn = document.getElementById("load-demo");
    btn.textContent = "Cargando…"; btn.disabled = true;
    fetch("/demo-graph.json")
      .then(r => { if(!r.ok) throw new Error("no se encontró el ejemplo"); return r.json(); })
      .then(data => activateGraph(data, "Graphify Core (ejemplo)"))
      .catch(e => { showError("No se pudo cargar el ejemplo: " + e.message);
        btn.textContent = "Ver grafo de ejemplo →"; btn.disabled = false; });
  });

  // ── botón "＋ Otro" ──
  document.getElementById("btn-new").addEventListener("click", () => {
    clearError();
    fileInput.value = "";
    const btn = document.getElementById("load-demo");
    btn.textContent = "Ver grafo de ejemplo →"; btn.disabled = false;
    backToLanding();
  });

  // ── deep-link opcional: ?graph=<url> carga un JSON remoto ──
  const params = new URLSearchParams(location.search);
  const remote = params.get("graph");
  if(remote){
    fetch(remote).then(r=>r.text())
      .then(t => handleJSONText(t, "Grafo remoto"))
      .catch(()=> showError("No se pudo cargar el grafo remoto."));
  }
})();

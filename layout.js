const currentPage = window.location.pathname.split("/").pop() || "index.html";
const isHome = currentPage === "index.html" || currentPage === "";

const PAGE_META = {
  "index.html":        { label:"Home",             id:"00" },
  "mechanism.html":    { label:"Mechanism",         id:"01" },
  "setae.html":        { label:"Setae Model",       id:"02" },
  "simulation.html":   { label:"Simulation",        id:"03" },
  "applications.html": { label:"Applications",      id:"04" },
  "timeline.html":     { label:"Timeline",          id:"05" },
  "future.html":       { label:"Future Potential",  id:"06" },
  "research.html":     { label:"Research",          id:"07" },
  "about.html":        { label:"About",             id:"08" },
};

const meta = PAGE_META[currentPage] || { label:"", id:"" };

// Build layout WITHOUT wiping body (avoids killing subsequent script tags)
const wrapper = document.createElement('div');
wrapper.className = 'main-wrapper';

const backBtn = !isHome
  ? `<a class="back-btn" href="index.html">← Back</a>`
  : '';
const breadcrumb = !isHome
  ? `<span class="breadcrumb">${meta.label}</span>`
  : '';

wrapper.innerHTML = `
  <nav class="topbar">
    <div class="nav-left">
      ${backBtn}
      <a class="brand" href="index.html">
        <span class="brand-dot"></span>
        Gecko Lab
      </a>
      ${breadcrumb}
    </div>
    <div class="nav-right">
      <span class="nav-pill">Biology / Biomimicry</span>
    </div>
  </nav>

  <div class="main-content" id="main-content">
    <div id="page-content"></div>
  </div>
`;

document.body.appendChild(wrapper);

// Scroll reveal
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if(e.isIntersecting) e.target.classList.add("visible") });
}, { threshold: 0.12 });
setTimeout(() => document.querySelectorAll(".reveal").forEach(el => io.observe(el)), 100);

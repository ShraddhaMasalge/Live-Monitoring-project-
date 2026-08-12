let dashboardData = null;
let currentLayout = 'grid';
let autoRefreshTimer = null;

const totalValEl = document.getElementById('summary-total-val');
const healthyValEl = document.getElementById('summary-healthy-val');
const healthyPctEl = document.getElementById('summary-healthy-pct');
const degradedValEl = document.getElementById('summary-degraded-val');
const degradedPctEl = document.getElementById('summary-degraded-pct');
const unhealthyValEl = document.getElementById('summary-unhealthy-val');
const unhealthyPctEl = document.getElementById('summary-unhealthy-pct');

const gridContainer = document.getElementById('resources-grid-container');
const healthCheckTbody = document.getElementById('health-check-tbody');

const searchInput = document.getElementById('search-input');
const serviceFilter = document.getElementById('service-filter');
const regionFilter = document.getElementById('region-filter');
const statusFilter = document.getElementById('status-filter');

const layoutGridBtn = document.getElementById('layout-grid-btn');
const layoutListBtn = document.getElementById('layout-list-btn');

const manualRefreshBtn = document.getElementById('manual-refresh-btn');
const autoRefreshSelect = document.getElementById('auto-refresh-select');
const regionGlobalSelect = document.getElementById('region-global-select');
const darkModeInput = document.getElementById('dark-mode-input');

const serviceIcons = {
  EC2: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="15" x2="23" y2="15"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="15" x2="4" y2="15"></line></svg>`,
  RDS: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5"></path><path d="M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6"></path></svg>`,
  Lambda: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3l14 9-14 9V3z"></path></svg>`,
  S3: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>`,
  DynamoDB: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>`,
  ElastiCache: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path><line x1="3" y1="12" x2="21" y2="12"></line></svg>`,
  ECS: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"></polygon><line x1="12" y1="22" x2="12" y2="12"></line><line x1="12" y1="12" x2="22" y2="8.5"></line><line x1="12" y1="12" x2="2" y2="8.5"></line></svg>`,
  CloudFront: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`
};

const serviceColors = {
  EC2: '#FF9900',
  RDS: '#3B82F6',
  Lambda: '#F59E0B',
  S3: '#10B981',
  DynamoDB: '#8B5CF6',
  ElastiCache: '#3B82F6',
  ECS: '#FF9900',
  CloudFront: '#8B5CF6'
};

async function fetchDashboard() {
  try {
    const response = await fetch('/api/dashboard');
    if (!response.ok) throw new Error('API fetch failed');
    
    dashboardData = await response.json();
    
    updateSummaryUI(dashboardData.summary);
    filterAndRenderResources();
    renderHealthChecks(dashboardData.healthChecks);
  } catch (err) {
    console.error('Error fetching dashboard metrics:', err);
    gridContainer.innerHTML = `<div class="table-loading" style="grid-column: 1/-1;">Error connecting to monitoring backend. Please make sure server is running.</div>`;
  }
}

function updateSummaryUI(summary) {
  totalValEl.textContent = summary.total;
  healthyValEl.textContent = summary.healthy;
  healthyPctEl.textContent = `${summary.healthyPct}%`;
  degradedValEl.textContent = summary.degraded;
  degradedPctEl.textContent = `${summary.degradedPct}%`;
  unhealthyValEl.textContent = summary.unhealthy;
  unhealthyPctEl.textContent = `${summary.unhealthyPct}%`;
}

function generateSparkline(history, status) {
  if (!history || history.length === 0) return '';
  
  const width = 100;
  const height = 35;
  const padding = 2;
  
  const minVal = Math.min(...history);
  const maxVal = Math.max(...history);
  const range = maxVal - minVal || 1;
  
  const points = history.map((val, idx) => {
    const x = (idx / (history.length - 1)) * width;
    const y = height - padding - ((val - minVal) / range) * (height - 2 * padding);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  
  const pathData = `M ${points.join(' L ')}`;
  
  let strokeClass = 'healthy';
  if (status === 'Degraded') strokeClass = 'degraded';
  if (status === 'Unhealthy') strokeClass = 'unhealthy';
  
  return `
    <svg class="sparkline-svg" viewBox="0 0 ${width} ${height}">
      <path class="sparkline-path ${strokeClass}" d="${pathData}"></path>
    </svg>
  `;
}

function filterAndRenderResources() {
  if (!dashboardData) return;

  const searchQuery = searchInput.value.toLowerCase();
  const selectedService = serviceFilter.value;
  const selectedRegion = regionFilter.value;
  const selectedStatus = statusFilter.value;
  const selectedGlobalRegion = regionGlobalSelect.value;

  const filtered = dashboardData.resources.filter(r => {
    const matchesSearch = r.service.toLowerCase().includes(searchQuery) || r.key.toLowerCase().includes(searchQuery);
    const matchesService = selectedService === 'all' || r.key === selectedService;
    const matchesRegion = selectedRegion === 'all' || r.region === selectedRegion;
    const matchesStatus = selectedStatus === 'all' || r.status === selectedStatus;
    const matchesGlobalRegion = selectedGlobalRegion === 'all' || r.region === selectedGlobalRegion;

    return matchesSearch && matchesService && matchesRegion && matchesStatus && matchesGlobalRegion;
  });

  renderResourceCards(filtered);
}

function renderResourceCards(resources) {
  gridContainer.innerHTML = '';
  
  if (resources.length === 0) {
    gridContainer.innerHTML = `<div class="table-loading" style="grid-column: 1/-1;">No resources match selected filters.</div>`;
    return;
  }

  resources.forEach(r => {
    const card = document.createElement('article');
    card.className = 'resource-card';
    
    const iconColor = serviceColors[r.key] || '#94A3B8';
    const statusClass = r.status.toLowerCase();
    const sparklineSvg = generateSparkline(r.history, r.status);

    card.innerHTML = `
      <div class="resource-card-header">
        <div class="resource-title-block">
          <div class="resource-card-icon" style="background-color: ${iconColor}15; color: ${iconColor};">
            ${serviceIcons[r.key] || ''}
          </div>
          <span class="resource-title">${r.service}</span>
        </div>
        <button class="card-options-btn" aria-label="More options">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
        </button>
      </div>

      <div class="resource-card-content">
        <div class="resource-metrics">
          <span class="resource-count">${r.count} <span class="resource-subcount">${r.key === 'S3' || r.key === 'DynamoDB' || r.key === 'CloudFront' ? 'Active' : 'Running'}</span></span>
          <span class="resource-meta">${r.region}</span>
        </div>
        
        <div class="resource-sparkline">
          ${sparklineSvg}
        </div>

        <div class="status-badge ${statusClass}">
          <span class="status-dot ${statusClass}"></span>
          ${r.status}
        </div>
      </div>
    `;
    gridContainer.appendChild(card);
  });
}

function renderHealthChecks(checks) {
  healthCheckTbody.innerHTML = '';
  
  const selectedGlobalRegion = regionGlobalSelect.value;
  const filtered = checks.filter(c => selectedGlobalRegion === 'all' || c.region === selectedGlobalRegion);

  if (filtered.length === 0) {
    healthCheckTbody.innerHTML = `<tr><td colspan="7" class="table-loading">No health check logs found for this region.</td></tr>`;
    return;
  }

  filtered.forEach(c => {
    const tr = document.createElement('tr');
    tr.id = `row-${c.id}`;
    const statusClass = c.status.toLowerCase();

    tr.innerHTML = `
      <td>
        <span style="display:inline-flex; align-items:center; gap: 8px; font-weight:600;">
          <span class="status-dot ${statusClass}" style="width: 8px; height: 8px;"></span>
          ${c.name}
        </span>
      </td>
      <td>${c.service}</td>
      <td>${c.region}</td>
      <td>
        <div class="status-badge ${statusClass}">
          ${c.status}
        </div>
      </td>
      <td>${c.lastCheck}</td>
      <td class="table-details">${c.details}</td>
      <td class="table-action">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </td>
    `;
    
    tr.addEventListener('click', () => {
      alert(`Resource Details:\nName: ${c.name}\nService: ${c.service}\nRegion: ${c.region}\nStatus: ${c.status}\nLast Checked: ${c.lastCheck}\nMessage: ${c.details}`);
    });

    healthCheckTbody.appendChild(tr);
  });
}

async function triggerManualRefresh() {
  manualRefreshBtn.classList.add('loading');
  manualRefreshBtn.style.transform = 'rotate(360deg)';
  manualRefreshBtn.style.transition = 'transform 0.5s ease';
  
  try {
    await fetch('/api/refresh', { method: 'POST' });
    await fetchDashboard();
  } catch (err) {
    console.error('Manual refresh failed', err);
  } finally {
    setTimeout(() => {
      manualRefreshBtn.style.transform = 'none';
      manualRefreshBtn.style.transition = 'none';
      manualRefreshBtn.classList.remove('loading');
    }, 500);
  }
}

function setAutoRefresh(seconds) {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  
  if (seconds > 0) {
    autoRefreshTimer = setInterval(fetchDashboard, seconds * 1000);
  }
}

function initTheme() {
  const localTheme = localStorage.getItem('theme');
  if (localTheme === 'dark') {
    document.body.classList.add('dark-theme');
    darkModeInput.checked = true;
  }
}

function setupEventListeners() {
  searchInput.addEventListener('input', filterAndRenderResources);
  serviceFilter.addEventListener('change', filterAndRenderResources);
  regionFilter.addEventListener('change', filterAndRenderResources);
  statusFilter.addEventListener('change', filterAndRenderResources);
  regionGlobalSelect.addEventListener('change', () => {
    filterAndRenderResources();
    if (dashboardData) renderHealthChecks(dashboardData.healthChecks);
  });

  layoutGridBtn.addEventListener('click', () => {
    currentLayout = 'grid';
    layoutGridBtn.classList.add('active');
    layoutListBtn.classList.remove('active');
    gridContainer.classList.remove('list-view');
  });

  layoutListBtn.addEventListener('click', () => {
    currentLayout = 'list';
    layoutListBtn.classList.add('active');
    layoutGridBtn.classList.remove('active');
    gridContainer.classList.add('list-view');
  });

  manualRefreshBtn.addEventListener('click', triggerManualRefresh);

  autoRefreshSelect.addEventListener('change', (e) => {
    const val = parseInt(e.target.value);
    setAutoRefresh(val);
  });

  darkModeInput.addEventListener('change', (e) => {
    if (e.target.checked) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
    }
  });

  document.getElementById('health-view-all-btn').addEventListener('click', () => {
    alert('Listing all cloud resource health checkpoints...');
  });

  document.querySelector('.hamburger-btn').addEventListener('click', () => {
    document.querySelector('.sidebar-menu').classList.toggle('active');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupEventListeners();
  fetchDashboard();
  setAutoRefresh(15);
});

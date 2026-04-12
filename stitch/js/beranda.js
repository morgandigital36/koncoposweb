// ===================================================
// BERANDA — Dashboard, Chart
// ===================================================

let berandaChart = null;

function initChart() {
  const ctx = document.getElementById('salesChart');
  if (!ctx || berandaChart) return;
  const { labels, data } = getChartData();
  berandaChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Penjualan',
        data,
        backgroundColor: 'rgba(232,99,122,0.25)',
        borderColor: 'rgba(232,99,122,0.8)',
        borderWidth: 2,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => 'Rp ' + c.parsed.y.toLocaleString('id-ID') } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#999' } },
        y: {
          beginAtZero: true,
          grid: { color: '#f0f0f0' },
          ticks: { font: { size: 9 }, color: '#999', callback: v => v === 0 ? '0' : 'Rp' + (v / 1000) + 'k' }
        }
      }
    }
  });
}

function getChartData() {
  const trxList = DB.get('transaksi');
  const today = new Date();
  const labels = [], data = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    labels.push(d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));
    const dayTotal = trxList
      .filter(t => new Date(t.tanggal).toDateString() === d.toDateString())
      .reduce((s, t) => s + t.total, 0);
    data.push(dayTotal);
  }
  return { labels, data };
}

function renderBeranda() {
  const filter = document.getElementById('beranda-filter')?.value || 'hari';
  const now = new Date();
  const trxList = DB.get('transaksi');

  const inRange = (tgl) => {
    const d = new Date(tgl);
    if (filter === 'hari') return d.toDateString() === now.toDateString();
    if (filter === 'minggu') {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      return d >= start;
    }
    if (filter === 'bulan') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (filter === 'tahun') return d.getFullYear() === now.getFullYear();
    return true;
  };

  const filtered = trxList.filter(t => inRange(t.tanggal));
  const lunas = filtered.filter(t => t.metodePembayaran !== 'Piutang');
  const belumLunas = filtered.filter(t => t.metodePembayaran === 'Piutang');
  const totalLunas = lunas.reduce((s, t) => s + t.total, 0);
  const totalBelum = belumLunas.reduce((s, t) => s + t.total, 0);

  const tbody = document.getElementById('beranda-sales-tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr><td>Lunas</td><td>${lunas.length}</td><td>${fmt(totalLunas)}</td></tr>
      <tr><td>Belum Lu...</td><td>${belumLunas.length}</td><td>${fmt(totalBelum)}</td></tr>
      <tr class="total-row"><td>Total</td><td>${filtered.length}</td><td>${fmt(totalLunas + totalBelum)}</td></tr>`;
  }

  // Init or update chart
  if (!berandaChart) {
    initChart();
  } else {
    const { labels, data } = getChartData();
    berandaChart.data.labels = labels;
    berandaChart.data.datasets[0].data = data;
    berandaChart.update();
  }
}

// ===== SCREEN INIT LISTENER =====
document.addEventListener('screenInit', (e) => {
  if (e.detail.name === 'beranda') renderBeranda();
});

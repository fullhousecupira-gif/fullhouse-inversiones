/**
 * FullHouse Inversiones C.A - Módulo de Reportes, Gráficos y Exportación CSV
 * Generación de reportes locales, exportación compatible con Excel y gráficos nativos.
 */

import { getAll } from './db.js';
import { getCurrentRate, usdToBs, formatUSD, formatBs } from './bcv.js';

// Descargar archivo de texto/CSV con soporte UTF-8 (BOM para Excel)
export function downloadCSV(filename, csvContent) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 1. Exportar Inventario Actual a CSV
export async function exportInventoryToCSV() {
  const products = await getAll('products');
  const rate = getCurrentRate();
  const dateStr = new Date().toISOString().split('T')[0];

  const headers = ['Código', 'Producto', 'Categoría', 'Stock Actual', 'Stock Mínimo', 'Costo USD', 'Precio USD', 'Precio Bs (BCV)', 'Estado Stock'];
  const rows = products.map(p => {
    const priceBs = usdToBs(p.priceUSD);
    let status = 'Normal';
    if (p.stock <= 0) status = 'Agotado';
    else if (p.stock <= p.minStock) status = 'Bajo Stock';

    return [
      `"${p.code || ''}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${p.category || 'General'}"`,
      p.stock,
      p.minStock,
      (p.costUSD || 0).toFixed(2),
      (p.priceUSD || 0).toFixed(2),
      priceBs.toFixed(2),
      `"${status}"`
    ].join(';');
  });

  const csv = [headers.join(';'), ...rows].join('\r\n');
  downloadCSV(`Inventario_FullHouse_${dateStr}.csv`, csv);
}

// 2. Exportar Historial de Ventas a CSV
export async function exportSalesToCSV(periodSales = null) {
  const sales = periodSales || (await getAll('sales'));
  const dateStr = new Date().toISOString().split('T')[0];

  const headers = [
    'N° Venta',
    'Fecha',
    'Hora',
    'Vendedor',
    'Cliente',
    'Método Pago',
    'Total USD',
    'Total Bs',
    'Tasa BCV',
    'Cant. Artículos',
    'Detalle de Productos',
    'Estado'
  ];

  const rows = sales.map(s => {
    const itemsDetail = (s.items || [])
      .map(i => `${i.quantity}x ${i.name} ($${i.unitPriceUSD})`)
      .join(' | ')
      .replace(/"/g, '""');

    return [
      `"${s.saleNumber}"`,
      `"${s.dateFormatted}"`,
      `"${s.timeFormatted}"`,
      `"${(s.sellerName || '').replace(/"/g, '""')}"`,
      `"${(s.clientName || '').replace(/"/g, '""')}"`,
      `"${s.paymentMethod || ''}"`,
      (s.totalUSD || 0).toFixed(2),
      (s.totalBs || 0).toFixed(2),
      (s.exchangeRate || 0).toFixed(2),
      s.totalItemsCount || 0,
      `"${itemsDetail}"`,
      s.cancelled ? '"ANULADA"' : '"COMPLETADA"'
    ].join(';');
  });

  const csv = [headers.join(';'), ...rows].join('\r\n');
  downloadCSV(`Ventas_FullHouse_${dateStr}.csv`, csv);
}

// 3. Exportar Movimientos de Inventario a CSV
export async function exportMovementsToCSV() {
  const movements = await getAll('movements');
  const dateStr = new Date().toISOString().split('T')[0];

  const headers = ['Fecha y Hora', 'Tipo', 'Código', 'Producto', 'Cantidad', 'Stock Anterior', 'Stock Nuevo', 'Motivo', 'Responsable', 'Observaciones'];
  const rows = movements.map(m => {
    const dateFormatted = new Date(m.date || m.timestamp).toLocaleString('es-VE');
    return [
      `"${dateFormatted}"`,
      `"${m.type}"`,
      `"${m.productCode || ''}"`,
      `"${(m.productName || '').replace(/"/g, '""')}"`,
      m.quantity,
      m.previousStock,
      m.newStock,
      `"${(m.reason || '').replace(/"/g, '""')}"`,
      `"${(m.user || '').replace(/"/g, '""')}"`,
      `"${(m.notes || '').replace(/"/g, '""')}"`
    ].join(';');
  });

  const csv = [headers.join(';'), ...rows].join('\r\n');
  downloadCSV(`Movimientos_Inventario_FullHouse_${dateStr}.csv`, csv);
}

// Gráfico de Ventas en Canvas nativo de alta resolución
export function renderSalesChart(canvasElement, salesData) {
  if (!canvasElement) return;
  const ctx = canvasElement.getContext('2d');
  if (!ctx) return;

  const width = canvasElement.clientWidth || 600;
  const height = canvasElement.clientHeight || 260;

  // Adaptar para pantallas Retina/HiDPI
  const dpr = window.devicePixelRatio || 1;
  canvasElement.width = width * dpr;
  canvasElement.height = height * dpr;
  ctx.scale(dpr, dpr);

  // Limpiar
  ctx.clearRect(0, 0, width, height);

  // Agrupar ventas de los últimos 7 días
  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric' });
    days.push({ key, label, totalUSD: 0, count: 0 });
  }

  (salesData || []).forEach(sale => {
    if (sale.cancelled) return;
    const dayEntry = days.find(d => d.key === sale.dateKey);
    if (dayEntry) {
      dayEntry.totalUSD += (sale.totalUSD || 0);
      dayEntry.count += 1;
    }
  });

  const maxVal = Math.max(...days.map(d => d.totalUSD), 50);
  const paddingLeft = 60;
  const paddingRight = 25;
  const paddingTop = 25;
  const paddingBottom = 40;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Líneas de cuadrícula horizontales
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';

  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const yVal = (maxVal / gridSteps) * i;
    const yPos = paddingTop + chartHeight - (chartHeight * (i / gridSteps));

    ctx.beginPath();
    ctx.moveTo(paddingLeft, yPos);
    ctx.lineTo(width - paddingRight, yPos);
    ctx.stroke();

    ctx.fillText('$' + Math.round(yVal), paddingLeft - 8, yPos + 4);
  }

  // Dibujar barras y etiquetas
  const barSpacing = chartWidth / days.length;
  const barWidth = Math.min(barSpacing * 0.55, 48);

  days.forEach((day, index) => {
    const x = paddingLeft + (index * barSpacing) + (barSpacing - barWidth) / 2;
    const barH = (day.totalUSD / maxVal) * chartHeight;
    const y = paddingTop + chartHeight - barH;

    // Gradiente de barra
    const grad = ctx.createLinearGradient(0, y, 0, paddingTop + chartHeight);
    grad.addColorStop(0, '#10b981'); // Emerald
    grad.addColorStop(1, 'rgba(16, 185, 129, 0.15)');

    // Barra redondeada
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, barWidth, barH, 6);
    ctx.fill();

    // Borde superior
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 4, y);
    ctx.lineTo(x + barWidth - 4, y);
    ctx.stroke();

    // Etiqueta del día
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'center';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillText(day.label, x + barWidth / 2, height - 12);

    // Valor sobre la barra si > 0
    if (day.totalUSD > 0) {
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 10px Inter, system-ui, sans-serif';
      ctx.fillText('$' + Math.round(day.totalUSD), x + barWidth / 2, y - 6);
    }
  });
}

function roundRect(ctx, x, y, width, height, radius) {
  if (height < 2) height = 2;
  if (radius > height / 2) radius = height / 2;
  if (radius > width / 2) radius = width / 2;

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

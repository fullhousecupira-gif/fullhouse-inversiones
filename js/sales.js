/**
 * FullHouse Inversiones C.A - Módulo de Historial de Ventas y Totales
 * Filtros diarios, semanales, mensuales, por vendedor, y anulación con reintegro de stock.
 */

import { getAll, getById, putItem } from './db.js';
import { formatUSD, formatBs } from './bcv.js';
import { registerMovement } from './inventory.js';

// Filtrar ventas por período y vendedor
export async function filterSales({
  period = 'TODAY',
  customStart = null,
  customEnd = null,
  sellerId = 'ALL',
  searchQuery = ''
} = {}) {
  const allSales = await getAll('sales');
  const now = new Date();

  // Fechas de corte
  const todayKey = now.toISOString().split('T')[0];

  // Inicio de la semana (Lunes de la semana en curso)
  const dayOfWeek = now.getDay() || 7; // 1 = Lunes, 7 = Domingo
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  // Inicio del mes (Día 1 del mes actual)
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  firstDayOfMonth.setHours(0, 0, 0, 0);

  let filtered = allSales.filter(sale => {
    // Si está anulada, la mantenemos pero la marcamos
    const saleDate = new Date(sale.timestamp || sale.isoDate);

    // Filtro por período
    if (period === 'TODAY') {
      if (sale.dateKey !== todayKey) return false;
    } else if (period === 'WEEK') {
      if (saleDate < monday) return false;
    } else if (period === 'MONTH') {
      if (saleDate < firstDayOfMonth) return false;
    } else if (period === 'CUSTOM') {
      if (customStart) {
        const start = new Date(customStart + 'T00:00:00');
        if (saleDate < start) return false;
      }
      if (customEnd) {
        const end = new Date(customEnd + 'T23:59:59');
        if (saleDate > end) return false;
      }
    }

    // Filtro por vendedor
    if (sellerId && sellerId !== 'ALL') {
      if (sale.sellerId !== sellerId) return false;
    }

    // Búsqueda por texto (número de venta, cliente, nombre de producto)
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      const matchNumber = sale.saleNumber && sale.saleNumber.toLowerCase().includes(q);
      const matchClient = sale.clientName && sale.clientName.toLowerCase().includes(q);
      const matchSeller = sale.sellerName && sale.sellerName.toLowerCase().includes(q);
      const matchItem = sale.items && sale.items.some(i => i.name && i.name.toLowerCase().includes(q));
      if (!matchNumber && !matchClient && !matchSeller && !matchItem) return false;
    }

    return true;
  });

  // Ordenar por fecha descendente (la más reciente primero)
  filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  // Calcular métricas acumuladas (solo ventas activas no anuladas)
  const activeSales = filtered.filter(s => !s.cancelled);
  const totalUSD = activeSales.reduce((acc, s) => acc + (s.totalUSD || 0), 0);
  const totalBs = activeSales.reduce((acc, s) => acc + (s.totalBs || 0), 0);
  const totalUnits = activeSales.reduce((acc, s) => acc + (s.totalItemsCount || 0), 0);
  const salesCount = activeSales.length;
  const averageTicketUSD = salesCount > 0 ? (totalUSD / salesCount) : 0;
  const averageTicketBs = salesCount > 0 ? (totalBs / salesCount) : 0;

  return {
    sales: filtered,
    metrics: {
      totalUSD: Number(totalUSD.toFixed(2)),
      totalBs: Number(totalBs.toFixed(2)),
      salesCount: salesCount,
      totalUnits: totalUnits,
      averageTicketUSD: Number(averageTicketUSD.toFixed(2)),
      averageTicketBs: Number(averageTicketBs.toFixed(2)),
      cancelledCount: filtered.length - activeSales.length
    }
  };
}

// Anular una venta y devolver el stock al inventario
export async function voidSale(saleId, user = 'Administrador', reason = 'Anulación de venta') {
  const sale = await getById('sales', saleId);
  if (!sale) throw new Error('Venta no encontrada.');

  if (sale.cancelled) {
    throw new Error('Esta venta ya se encuentra anulada.');
  }

  // Devolver cada artículo al stock y registrar entrada
  if (Array.isArray(sale.items)) {
    for (const item of sale.items) {
      const prod = await getById('products', item.productId);
      if (prod) {
        const previousStock = prod.stock;
        const newStock = previousStock + item.quantity;
        prod.stock = newStock;
        prod.updatedAt = new Date().toISOString();
        await putItem('products', prod);

        // Movimiento de restitución
        await registerMovement({
          productId: prod.id,
          productCode: prod.code,
          productName: prod.name,
          type: 'ENTRADA',
          quantity: item.quantity,
          previousStock: previousStock,
          newStock: newStock,
          reason: `Reintegro por Anulación ${sale.saleNumber}`,
          user: user,
          notes: reason
        });
      }
    }
  }

  sale.cancelled = true;
  sale.cancelledAt = new Date().toISOString();
  sale.cancelledBy = user;
  sale.cancelReason = reason;
  await putItem('sales', sale);

  return sale;
}

// Formatear Ticket para vista previa e impresión
export function generateTicketHTML(sale, companyInfo = {}) {
  const isCancelled = sale.cancelled ? '<div class="ticket-watermark">VENTA ANULADA</div>' : '';

  const itemsRows = (sale.items || []).map(item => `
    <tr>
      <td style="text-align: left;">
        <div style="font-weight: 600;">${item.name}</div>
        <small style="color: #666;">${item.quantity} x ${formatUSD(item.unitPriceUSD)} (${formatBs(item.unitPriceBs)})</small>
      </td>
      <td style="text-align: right; vertical-align: top;">
        <div>${formatUSD(item.subtotalUSD)}</div>
        <small style="color: #666;">${formatBs(item.subtotalBs)}</small>
      </td>
    </tr>
  `).join('');

  return `
    <div class="ticket-receipt" id="printable-ticket">
      ${isCancelled}
      <div class="ticket-header">
        <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800;">${companyInfo.businessName || 'FullHouse Inversiones C.A'}</h3>
        <p style="margin: 2px 0; font-size: 0.8rem; color: #555;">RIF: ${companyInfo.rif || 'J-50123456-7'}</p>
        <p style="margin: 2px 0; font-size: 0.8rem; color: #555;">${companyInfo.address || 'Venezuela'}</p>
        <p style="margin: 2px 0; font-size: 0.8rem; color: #555;">Tel: ${companyInfo.phone || '0414-1234567'}</p>
        <div style="border-top: 1px dashed #aaa; margin: 8px 0;"></div>
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
          <strong>Ticket: ${sale.saleNumber}</strong>
          <span>${sale.dateFormatted} ${sale.timeFormatted}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #444; margin-top: 3px;">
          <span>Vendedor: <strong>${sale.sellerName}</strong></span>
          <span>Cliente: ${sale.clientName}</span>
        </div>
        <div style="font-size: 0.8rem; color: #444; text-align: left; margin-top: 3px;">
          <span>Método: <strong>${sale.paymentMethod}</strong></span>
        </div>
      </div>

      <div style="border-top: 1px dashed #aaa; margin: 8px 0;"></div>

      <table class="ticket-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
        <thead>
          <tr style="border-bottom: 1px solid #ddd;">
            <th style="text-align: left; padding-bottom: 4px;">Descripción</th>
            <th style="text-align: right; padding-bottom: 4px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <div style="border-top: 1px dashed #aaa; margin: 8px 0;"></div>

      <div class="ticket-totals" style="font-size: 0.95rem;">
        <div style="display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 4px;">
          <span>TOTAL USD:</span>
          <span style="color: #059669;">${formatUSD(sale.totalUSD)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: 700;">
          <span>TOTAL BS:</span>
          <span>${formatBs(sale.totalBs)}</span>
        </div>
        <div style="text-align: center; font-size: 0.75rem; color: #666; margin-top: 8px;">
          Tasa BCV aplicada: ${Number(sale.exchangeRate || 0).toFixed(2)} Bs./USD
        </div>
      </div>

      <div style="border-top: 1px dashed #aaa; margin: 10px 0;"></div>

      <div style="text-align: center; font-size: 0.8rem; color: #555;">
        <p style="margin: 2px 0; font-weight: 600;">¡Gracias por su compra!</p>
        <p style="margin: 2px 0;">Conserve este comprobante</p>
      </div>
    </div>
  `;
}

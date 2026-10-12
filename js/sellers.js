/**
 * FullHouse Inversiones C.A - Módulo de Gestión de Vendedores
 * Control de cajeros/vendedores y análisis de rendimiento de ventas por empleado.
 */

import { getAll, getById, putItem, deleteItem } from './db.js';

export async function getSellers() {
  const sellers = await getAll('sellers');
  return sellers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function saveSeller({ id, name, role = 'Vendedor', active = true }) {
  if (!name || !name.trim()) {
    throw new Error('El nombre del vendedor es obligatorio.');
  }

  const seller = {
    id: id || ('sel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
    name: name.trim(),
    role: role.trim() || 'Vendedor',
    active: active !== false,
    createdAt: new Date().toISOString()
  };

  await putItem('sellers', seller);
  return seller;
}

export async function deleteSeller(sellerId) {
  const sales = await getAll('sales');
  const hasSales = sales.some(s => s.sellerId === sellerId);
  if (hasSales) {
    throw new Error('No se puede eliminar un vendedor con ventas registradas. Puede desactivarlo en su lugar.');
  }
  await deleteItem('sellers', sellerId);
  return true;
}

// Obtener métricas y rendimiento por cada vendedor
export async function getSellersPerformance(period = 'MONTH') {
  const sellers = await getAll('sellers');
  const allSales = await getAll('sales');
  const now = new Date();
  const todayKey = now.toISOString().split('T')[0];

  const dayOfWeek = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  firstDayOfMonth.setHours(0, 0, 0, 0);

  // Filtrar ventas activas según período
  const periodSales = allSales.filter(s => {
    if (s.cancelled) return false;
    const saleDate = new Date(s.timestamp || s.isoDate);
    if (period === 'TODAY') return s.dateKey === todayKey;
    if (period === 'WEEK') return saleDate >= monday;
    if (period === 'MONTH') return saleDate >= firstDayOfMonth;
    return true; // ALL
  });

  const performance = sellers.map(seller => {
    const sellerSales = periodSales.filter(s => s.sellerId === seller.id);
    const totalUSD = sellerSales.reduce((sum, s) => sum + (s.totalUSD || 0), 0);
    const totalBs = sellerSales.reduce((sum, s) => sum + (s.totalBs || 0), 0);
    const totalItems = sellerSales.reduce((sum, s) => sum + (s.totalItemsCount || 0), 0);

    return {
      ...seller,
      salesCount: sellerSales.length,
      totalUSD: Number(totalUSD.toFixed(2)),
      totalBs: Number(totalBs.toFixed(2)),
      totalItems: totalItems,
      avgTicketUSD: sellerSales.length > 0 ? Number((totalUSD / sellerSales.length).toFixed(2)) : 0
    };
  });

  // Ordenar por total vendido en USD descendente
  return performance.sort((a, b) => b.totalUSD - a.totalUSD);
}

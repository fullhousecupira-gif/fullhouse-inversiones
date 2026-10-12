/**
 * FullHouse Inversiones C.A - Módulo de Punto de Venta (POS / Caja)
 * Control del carrito, cobro rápido, descuento automático de stock y ticket.
 */

import { getAll, getById, putItem } from './db.js';
import { getCurrentRate, usdToBs, formatUSD, formatBs } from './bcv.js';
import { registerMovement } from './inventory.js';

let cart = []; // [{ product, quantity, subtotalUSD, subtotalBs }]
let currentSeller = null;

// Efectos de sonido sintetizados con Web Audio API (100% offline, sin dependencias)
const audioCtx = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext))
  ? new (window.AudioContext || window.webkitAudioContext)()
  : null;

export function playSound(type = 'beep') {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'beep') {
      // Pitido agradable de escaneo
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'success') {
      // Acorde de caja registradora / venta completada
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.24); // C6
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.45);
    } else if (type === 'error') {
      // Tono de advertencia
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (e) {
    // Silencioso en caso de bloqueo de autoplay
  }
}

// Operaciones del Carrito
export function getCart() {
  return cart;
}

export function clearCart() {
  cart = [];
}

export async function addToCart(productId, quantity = 1) {
  const product = await getById('products', productId);
  if (!product) {
    playSound('error');
    throw new Error('Producto no encontrado.');
  }

  const existingIndex = cart.findIndex(item => item.product.id === productId);
  const currentInCart = existingIndex > -1 ? cart[existingIndex].quantity : 0;
  const requestedTotal = currentInCart + quantity;

  if (requestedTotal > product.stock) {
    playSound('error');
    throw new Error(`Stock insuficiente. Solo quedan ${product.stock} unidades de "${product.name}".`);
  }

  if (existingIndex > -1) {
    cart[existingIndex].quantity = requestedTotal;
  } else {
    cart.push({
      product: { ...product },
      quantity: quantity
    });
  }

  playSound('beep');
  return cart;
}

export function updateCartItemQuantity(productId, newQuantity) {
  const qty = parseInt(newQuantity);
  const itemIndex = cart.findIndex(item => item.product.id === productId);
  if (itemIndex === -1) return;

  if (qty <= 0) {
    cart.splice(itemIndex, 1);
    return;
  }

  const product = cart[itemIndex].product;
  if (qty > product.stock) {
    playSound('error');
    throw new Error(`Solo hay ${product.stock} unidades en existencia.`);
  }

  cart[itemIndex].quantity = qty;
}

export function removeFromCart(productId) {
  cart = cart.filter(item => item.product.id !== productId);
}

// Calcular Totales del Carrito
export function getCartTotals() {
  const rate = getCurrentRate();
  let totalUSD = 0;
  let totalItemsCount = 0;

  const items = cart.map(item => {
    const unitPriceUSD = item.product.priceUSD || 0;
    const unitPriceBs = usdToBs(unitPriceUSD);
    const subtotalUSD = Number((unitPriceUSD * item.quantity).toFixed(2));
    const subtotalBs = Number((unitPriceBs * item.quantity).toFixed(2));

    totalUSD += subtotalUSD;
    totalItemsCount += item.quantity;

    return {
      productId: item.product.id,
      code: item.product.code,
      name: item.product.name,
      quantity: item.quantity,
      unitPriceUSD: unitPriceUSD,
      unitPriceBs: unitPriceBs,
      subtotalUSD: subtotalUSD,
      subtotalBs: subtotalBs
    };
  });

  totalUSD = Number(totalUSD.toFixed(2));
  const totalBs = Number((totalUSD * rate).toFixed(2));

  return {
    items,
    totalItemsCount,
    totalUSD,
    totalBs,
    rate
  };
}

// Generar número correlativo de venta (ej: V-0001, V-0002)
async function generateNextSaleNumber() {
  const sales = await getAll('sales');
  const count = sales.length + 1;
  return 'V-' + String(count).padStart(4, '0');
}

// Finalizar la venta y descontar stock automáticamente
export async function checkoutSale({ sellerId, sellerName, clientName = 'Consumidor Final', paymentMethod = 'Dólares Efectivo', notes = '' }) {
  if (cart.length === 0) {
    playSound('error');
    throw new Error('El carrito está vacío. Agregue productos antes de cobrar.');
  }

  if (!sellerId || !sellerName) {
    playSound('error');
    throw new Error('Debe seleccionar el vendedor que realiza la venta.');
  }

  const rate = getCurrentRate();
  const totals = getCartTotals();
  const saleNumber = await generateNextSaleNumber();

  const now = new Date();
  const dateKey = now.toISOString().split('T')[0]; // "2026-10-12"
  const dateFormatted = now.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeFormatted = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  // 1. Verificar stock actual de cada producto antes de confirmar
  for (const item of cart) {
    const currentProd = await getById('products', item.product.id);
    if (!currentProd) {
      throw new Error(`El producto "${item.product.name}" ya no existe.`);
    }
    if (currentProd.stock < item.quantity) {
      throw new Error(`Stock insuficiente para "${currentProd.name}". Disponibles: ${currentProd.stock}, en carrito: ${item.quantity}.`);
    }
  }

  // 2. Descontar el stock y registrar el movimiento de SALIDA de cada producto
  for (const item of cart) {
    const currentProd = await getById('products', item.product.id);
    const previousStock = currentProd.stock;
    const newStock = previousStock - item.quantity;

    currentProd.stock = newStock;
    currentProd.updatedAt = now.toISOString();
    await putItem('products', currentProd);

    // Movimiento de inventario
    await registerMovement({
      productId: currentProd.id,
      productCode: currentProd.code,
      productName: currentProd.name,
      type: 'SALIDA',
      quantity: item.quantity,
      previousStock: previousStock,
      newStock: newStock,
      reason: `Venta ${saleNumber}`,
      user: sellerName,
      notes: `Vendido a ${clientName} por ${sellerName}`
    });
  }

  // 3. Crear el registro oficial de la Venta
  const saleRecord = {
    id: 'sale_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    saleNumber: saleNumber,
    timestamp: now.getTime(),
    isoDate: now.toISOString(),
    dateKey: dateKey,
    dateFormatted: dateFormatted,
    timeFormatted: timeFormatted,
    sellerId: sellerId,
    sellerName: sellerName,
    clientName: clientName.trim() || 'Consumidor Final',
    paymentMethod: paymentMethod,
    items: totals.items,
    totalItemsCount: totals.totalItemsCount,
    totalUSD: totals.totalUSD,
    totalBs: totals.totalBs,
    exchangeRate: rate,
    notes: notes ? notes.trim() : ''
  };

  await putItem('sales', saleRecord);

  // 4. Vaciar carrito y emitir sonido de éxito
  clearCart();
  playSound('success');

  return saleRecord;
}

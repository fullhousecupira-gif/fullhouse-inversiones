/**
 * FullHouse Inversiones C.A - Módulo de Gestión de Inventario y Movimientos
 * Control de stock, modificación de precios en $ y Bs., entradas y salidas.
 */

import { getAll, getById, putItem, deleteItem } from './db.js';
import { getCurrentRate, usdToBs, formatUSD, formatBs } from './bcv.js';

// Crear o actualizar un producto
export async function saveProduct(productData) {
  if (!productData.name || !productData.name.trim()) {
    throw new Error('El nombre del producto es obligatorio.');
  }

  const allProducts = await getAll('products');
  const code = (productData.code || '').trim().toUpperCase();

  if (!code) {
    throw new Error('El código o SKU del producto es obligatorio.');
  }

  // Verificar código único excepto si es edición del mismo producto
  const existingCode = allProducts.find(p => p.code === code && p.id !== productData.id);
  if (existingCode) {
    throw new Error(`El código "${code}" ya está registrado para otro producto.`);
  }

  const isNew = !productData.id;
  const productId = productData.id || ('prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4));
  
  const product = {
    id: productId,
    code: code,
    name: productData.name.trim(),
    category: productData.category ? productData.category.trim() : 'General',
    stock: parseInt(productData.stock) || 0,
    minStock: parseInt(productData.minStock) || 5,
    costUSD: parseFloat(productData.costUSD) || 0,
    priceUSD: parseFloat(productData.priceUSD) || 0,
    notes: productData.notes ? productData.notes.trim() : '',
    updatedAt: new Date().toISOString()
  };

  await putItem('products', product);

  // Si es nuevo y tiene stock inicial > 0, registrar movimiento de Entrada inicial
  if (isNew && product.stock > 0) {
    await registerMovement({
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      type: 'ENTRADA',
      quantity: product.stock,
      previousStock: 0,
      newStock: product.stock,
      reason: 'Inventario Inicial',
      user: productData.user || 'Administrador',
      notes: 'Creación de nuevo producto con stock inicial'
    });
  }

  return product;
}

// Modificar precio rápido (en USD o calculado desde Bs.)
export async function updateProductPrice(productId, newPriceUSD, user = 'Administrador') {
  const product = await getById('products', productId);
  if (!product) throw new Error('Producto no encontrado.');

  const oldPrice = product.priceUSD;
  const parsedPrice = parseFloat(newPriceUSD);
  if (isNaN(parsedPrice) || parsedPrice < 0) {
    throw new Error('El precio debe ser un número válido igual o mayor a cero.');
  }

  product.priceUSD = parsedPrice;
  product.updatedAt = new Date().toISOString();
  await putItem('products', product);

  // Registrar en historial de movimientos como Ajuste de Precio
  await registerMovement({
    productId: product.id,
    productCode: product.code,
    productName: product.name,
    type: 'AJUSTE',
    quantity: 0,
    previousStock: product.stock,
    newStock: product.stock,
    reason: `Cambio de Precio: de ${formatUSD(oldPrice)} a ${formatUSD(product.priceUSD)}`,
    user: user,
    notes: `Tasa BCV del momento: ${getCurrentRate().toFixed(2)} Bs.`
  });

  return product;
}

// Registrar Entrada o Salida de mercancía
export async function registerStockMovement({ productId, type, quantity, reason, user, notes }) {
  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) {
    throw new Error('La cantidad debe ser un número entero mayor a 0.');
  }

  const product = await getById('products', productId);
  if (!product) throw new Error('Producto no encontrado.');

  const previousStock = product.stock;
  let newStock = previousStock;

  if (type === 'ENTRADA') {
    newStock = previousStock + qty;
  } else if (type === 'SALIDA') {
    if (qty > previousStock) {
      throw new Error(`Stock insuficiente. Solo quedan ${previousStock} unidades disponibles.`);
    }
    newStock = previousStock - qty;
  } else if (type === 'AJUSTE') {
    newStock = qty; // En ajuste se fija la cantidad real contada
  } else {
    throw new Error('Tipo de movimiento no válido.');
  }

  product.stock = newStock;
  product.updatedAt = new Date().toISOString();
  await putItem('products', product);

  const movementRecord = await registerMovement({
    productId: product.id,
    productCode: product.code,
    productName: product.name,
    type: type,
    quantity: qty,
    previousStock: previousStock,
    newStock: newStock,
    reason: reason || (type === 'ENTRADA' ? 'Entrada de mercancía' : 'Salida de mercancía'),
    user: user || 'Administrador',
    notes: notes || ''
  });

  return { product, movement: movementRecord };
}

// Guardar registro en store 'movements'
export async function registerMovement(movData) {
  const mov = {
    id: 'mov_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    date: new Date().toISOString(),
    timestamp: Date.now(),
    productId: movData.productId,
    productCode: movData.productCode,
    productName: movData.productName,
    type: movData.type, // 'ENTRADA' | 'SALIDA' | 'AJUSTE'
    quantity: movData.quantity,
    previousStock: movData.previousStock,
    newStock: movData.newStock,
    reason: movData.reason || '',
    user: movData.user || 'Administrador',
    notes: movData.notes || ''
  };

  await putItem('movements', mov);
  return mov;
}

// Eliminar producto
export async function removeProduct(productId) {
  const product = await getById('products', productId);
  if (!product) throw new Error('El producto no existe.');

  await deleteItem('products', productId);
  return true;
}

// Obtener categorías únicas
export async function getCategories() {
  const products = await getAll('products');
  const cats = new Set(products.map(p => p.category || 'General'));
  return Array.from(cats).sort();
}

// Búsqueda y filtrado de productos
export async function searchProducts({ query = '', category = '', stockFilter = 'ALL' } = {}) {
  let products = await getAll('products');
  const q = query.trim().toLowerCase();

  if (q) {
    products = products.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  }

  if (category && category !== 'ALL') {
    products = products.filter(p => p.category === category);
  }

  if (stockFilter === 'LOW') {
    products = products.filter(p => p.stock > 0 && p.stock <= p.minStock);
  } else if (stockFilter === 'OUT') {
    products = products.filter(p => p.stock <= 0);
  } else if (stockFilter === 'AVAILABLE') {
    products = products.filter(p => p.stock > 0);
  }

  // Ordenar alfabéticamente por nombre
  return products.sort((a, b) => a.name.localeCompare(b.name));
}

// Obtener historial de movimientos ordenados por fecha descendente
export async function getMovementsHistory(limit = 200) {
  const movements = await getAll('movements');
  return movements
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, limit);
}

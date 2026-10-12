/**
 * FullHouse Inversiones C.A - Módulo de Tasa de Cambio BCV
 * Consulta en tiempo real, cálculo de precios duales (USD / Bs.) y soporte offline.
 */

import { getById, putItem } from './db.js';

let currentRate = 875.65;
let lastUpdateDate = null;
let listeners = [];

export function onBCVRateChange(callback) {
  listeners.push(callback);
}

function notifyRateChanged() {
  listeners.forEach(cb => {
    try { cb(currentRate, lastUpdateDate); } catch (e) { console.error(e); }
  });
}

// Inicializa la tasa cargando de la base de datos local
export async function initBCV() {
  try {
    const config = await getById('settings', 'app_config');
    if (config && config.bcvRate) {
      currentRate = parseFloat(config.bcvRate) || 875.65;
      lastUpdateDate = config.lastBcvUpdate || null;
    }
    notifyRateChanged();
  } catch (err) {
    console.warn('No se pudo cargar la tasa guardada, usando predeterminada:', err);
  }

  // Intentar actualizar automáticamente si hay conexión a internet
  await fetchBCVRateFromAPI(false);
  return currentRate;
}

// Obtener la tasa activa actual
export function getCurrentRate() {
  return currentRate;
}

export function getLastUpdateDate() {
  return lastUpdateDate;
}

// Actualizar la tasa desde la API de DolarApi (BCV Oficial)
export async function fetchBCVRateFromAPI(showNotifications = true) {
  try {
    // Endpoint oficial libre con CORS habilitado
    const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-cache'
    });

    if (!response.ok) {
      throw new Error(`Error en el servidor BCV (${response.status})`);
    }

    const data = await response.json();
    const rateValue = parseFloat(data.promedio || data.venta || data.compra);

    if (rateValue && rateValue > 0) {
      currentRate = rateValue;
      lastUpdateDate = data.fechaActualizacion || new Date().toISOString();

      // Guardar en base de datos local
      const config = (await getById('settings', 'app_config')) || { key: 'app_config' };
      config.bcvRate = currentRate;
      config.lastBcvUpdate = lastUpdateDate;
      config.bcvSource = 'Banco Central de Venezuela (BCV)';
      await putItem('settings', config);

      notifyRateChanged();
      return { success: true, rate: currentRate, date: lastUpdateDate, source: 'API Oficial BCV' };
    } else {
      throw new Error('La respuesta del BCV no contiene un valor numérico válido.');
    }
  } catch (error) {
    console.warn('Error al consultar API BCV en línea:', error.message);
    // Modo offline: mantenemos la última tasa guardada
    return {
      success: false,
      rate: currentRate,
      date: lastUpdateDate,
      error: error.message,
      isOffline: true
    };
  }
}

// Modificar la tasa manualmente por el usuario
export async function setManualRate(newRate) {
  const parsed = parseFloat(newRate);
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error('La tasa debe ser un número mayor a cero.');
  }

  currentRate = parsed;
  lastUpdateDate = new Date().toISOString();

  const config = (await getById('settings', 'app_config')) || { key: 'app_config' };
  config.bcvRate = currentRate;
  config.lastBcvUpdate = lastUpdateDate;
  config.bcvSource = 'Manual (Usuario)';
  await putItem('settings', config);

  notifyRateChanged();
  return { success: true, rate: currentRate, date: lastUpdateDate };
}

// Convertidores de moneda
export function usdToBs(amountUSD) {
  const val = parseFloat(amountUSD) || 0;
  return Number((val * currentRate).toFixed(2));
}

export function bsToUSD(amountBs) {
  const val = parseFloat(amountBs) || 0;
  if (currentRate <= 0) return 0;
  return Number((val / currentRate).toFixed(2));
}

// Formateadores visuales para montos
export function formatUSD(amount) {
  const num = parseFloat(amount) || 0;
  return '$ ' + num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatBs(amount) {
  const num = parseFloat(amount) || 0;
  return num.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' Bs.';
}

export function formatDualPrice(amountUSD) {
  const usd = parseFloat(amountUSD) || 0;
  const bs = usdToBs(usd);
  return `${formatUSD(usd)} / ${formatBs(bs)}`;
}

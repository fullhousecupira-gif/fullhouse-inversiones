/**
 * FullHouse Inversiones C.A - Módulo de Base de Datos Local (IndexedDB)
 * Almacenamiento 100% local, persistente y seguro en la PC.
 */

const DB_NAME = 'FullHouseInversionesDB';
const DB_VERSION = 1;

let dbInstance = null;

export async function getDB() {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Catálogo de Productos e Inventario
      if (!db.objectStoreNames.contains('products')) {
        const prodStore = db.createObjectStore('products', { keyPath: 'id' });
        prodStore.createIndex('code', 'code', { unique: true });
        prodStore.createIndex('name', 'name', { unique: false });
        prodStore.createIndex('category', 'category', { unique: false });
      }

      // 2. Registro de Entradas y Salidas de Inventario
      if (!db.objectStoreNames.contains('movements')) {
        const movStore = db.createObjectStore('movements', { keyPath: 'id' });
        movStore.createIndex('productId', 'productId', { unique: false });
        movStore.createIndex('type', 'type', { unique: false });
        movStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // 3. Registro de Ventas
      if (!db.objectStoreNames.contains('sales')) {
        const salesStore = db.createObjectStore('sales', { keyPath: 'id' });
        salesStore.createIndex('saleNumber', 'saleNumber', { unique: false });
        salesStore.createIndex('sellerId', 'sellerId', { unique: false });
        salesStore.createIndex('timestamp', 'timestamp', { unique: false });
        salesStore.createIndex('dateKey', 'dateKey', { unique: false });
      }

      // 4. Registro de Vendedores
      if (!db.objectStoreNames.contains('sellers')) {
        const sellersStore = db.createObjectStore('sellers', { keyPath: 'id' });
        sellersStore.createIndex('name', 'name', { unique: false });
      }

      // 5. Configuración del Sistema (Tasa BCV, Datos Empresa, etc.)
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('Error al abrir IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Operaciones CRUD genéricas
export async function getAll(storeName) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getById(storeName, id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putItem(storeName, item) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(item);
    request.onsuccess = () => resolve(item);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteItem(storeName, id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// Respaldo completo en formato JSON
export async function exportDatabaseBackup() {
  const products = await getAll('products');
  const movements = await getAll('movements');
  const sales = await getAll('sales');
  const sellers = await getAll('sellers');
  const settings = await getAll('settings');

  return {
    version: 1,
    appName: 'FullHouse Inversiones C.A',
    backupDate: new Date().toISOString(),
    data: {
      products,
      movements,
      sales,
      sellers,
      settings
    }
  };
}

// Restauración de Base de Datos desde archivo JSON
export async function importDatabaseBackup(backupJson) {
  if (!backupJson || !backupJson.data) {
    throw new Error('El archivo de respaldo no tiene un formato válido.');
  }

  const db = await getDB();
  const stores = ['products', 'movements', 'sales', 'sellers', 'settings'];

  for (const storeName of stores) {
    const items = backupJson.data[storeName] || [];
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear(); // Limpia los registros actuales
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  return true;
}

// Datos iniciales demostrativos para arrancar de inmediato si está vacío
export async function seedInitialDataIfEmpty() {
  const products = await getAll('products');
  const sellers = await getAll('sellers');

  if (sellers.length === 0) {
    const defaultSellers = [
      { id: 'sel_1', name: 'Administrador / Principal', role: 'Administrador', active: true, createdAt: new Date().toISOString() },
      { id: 'sel_2', name: 'Carlos Mendoza', role: 'Vendedor', active: true, createdAt: new Date().toISOString() },
      { id: 'sel_3', name: 'Mariana Silva', role: 'Vendedor', active: true, createdAt: new Date().toISOString() }
    ];
    for (const s of defaultSellers) {
      await putItem('sellers', s);
    }
  }

  if (products.length === 0) {
    const defaultProducts = [
      {
        id: 'prod_1',
        code: 'FH-001',
        name: 'Arroz Primor Tradicional 1kg',
        category: 'Alimentos',
        stock: 45,
        minStock: 10,
        costUSD: 1.10,
        priceUSD: 1.50,
        notes: 'Arroz blanco grano largo',
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod_2',
        code: 'FH-002',
        name: 'Harina PAN Blanca 1kg',
        category: 'Alimentos',
        stock: 60,
        minStock: 15,
        costUSD: 1.15,
        priceUSD: 1.45,
        notes: 'Harina de maíz precocida',
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod_3',
        code: 'FH-003',
        name: 'Aceite de Maíz Mazeite 1L',
        category: 'Alimentos',
        stock: 28,
        minStock: 8,
        costUSD: 3.20,
        priceUSD: 4.10,
        notes: 'Aceite 100% puro de maíz',
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod_4',
        code: 'FH-004',
        name: 'Pasta Capri Plumitas 500g',
        category: 'Alimentos',
        stock: 5,
        minStock: 12,
        costUSD: 0.90,
        priceUSD: 1.25,
        notes: 'Pasta corta (Alerta stock bajo)',
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod_5',
        code: 'FH-005',
        name: 'Café Fama de América 250g',
        category: 'Bebidas',
        stock: 35,
        minStock: 10,
        costUSD: 2.20,
        priceUSD: 2.95,
        notes: 'Café molido gourmet',
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod_6',
        code: 'FH-006',
        name: 'Refresco Coca Cola 1.5L',
        category: 'Bebidas',
        stock: 24,
        minStock: 6,
        costUSD: 1.50,
        priceUSD: 2.00,
        notes: 'Bebida gaseosa',
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod_7',
        code: 'FH-007',
        name: 'Detergente Las Llaves 1kg',
        category: 'Limpieza',
        stock: 18,
        minStock: 5,
        costUSD: 2.10,
        priceUSD: 2.80,
        notes: 'Detergente en polvo multiuso',
        updatedAt: new Date().toISOString()
      },
      {
        id: 'prod_8',
        code: 'FH-008',
        name: 'Jabón Protex Avena 110g',
        category: 'Cuidado Personal',
        stock: 3,
        minStock: 8,
        costUSD: 0.85,
        priceUSD: 1.20,
        notes: 'Jabón antibacterial (Stock crítico)',
        updatedAt: new Date().toISOString()
      }
    ];

    for (const p of defaultProducts) {
      await putItem('products', p);
      // Registrar movimiento inicial
      await putItem('movements', {
        id: 'mov_init_' + p.code,
        date: new Date().toISOString(),
        timestamp: Date.now(),
        type: 'ENTRADA',
        productId: p.id,
        productCode: p.code,
        productName: p.name,
        quantity: p.stock,
        previousStock: 0,
        newStock: p.stock,
        reason: 'Inventario Inicial',
        user: 'Sistema',
        notes: 'Carga inicial del sistema'
      });
    }
  }

  // Configuración inicial
  const savedSettings = await getById('settings', 'app_config');
  if (!savedSettings) {
    await putItem('settings', {
      key: 'app_config',
      businessName: 'FullHouse Inversiones C.A',
      rif: 'J-50123456-7',
      phone: '0414-1234567 / 0212-9876543',
      address: 'Caracas, Venezuela',
      bcvRate: 875.65, // Tasa de respaldo inicial
      lastBcvUpdate: new Date().toISOString(),
      bcvSource: 'Banco Central de Venezuela (BCV)',
      currencySymbolUSD: '$',
      currencySymbolBs: 'Bs.'
    });
  }
}

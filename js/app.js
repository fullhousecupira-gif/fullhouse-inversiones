/**
 * FullHouse Inversiones C.A - Sistema Integral de Control de Inventario y Ventas (POS)
 * Versión Autónoma para PC - Almacenamiento 100% Local (IndexedDB)
 * Compatible con ejecución directa sin servidor y modo aplicación de escritorio.
 */

(function () {
  'use strict';

  // ===================================================================
  // 1. MÓDULO DE BASE DE DATOS LOCAL (IndexedDB)
  // ===================================================================
  const DB_NAME = 'FullHouseInversionesDB';
  const DB_VERSION = 2;
  let dbInstance = null;

  const DB = {
    async getDB() {
      if (dbInstance) return dbInstance;
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('products')) {
            const ps = db.createObjectStore('products', { keyPath: 'id' });
            ps.createIndex('code', 'code', { unique: true });
            ps.createIndex('name', 'name', { unique: false });
            ps.createIndex('category', 'category', { unique: false });
          }
          if (!db.objectStoreNames.contains('categories')) {
            const cs = db.createObjectStore('categories', { keyPath: 'id' });
            cs.createIndex('name', 'name', { unique: true });
          }
          if (!db.objectStoreNames.contains('movements')) {
            const ms = db.createObjectStore('movements', { keyPath: 'id' });
            ms.createIndex('productId', 'productId', { unique: false });
            ms.createIndex('type', 'type', { unique: false });
            ms.createIndex('timestamp', 'timestamp', { unique: false });
          }
          if (!db.objectStoreNames.contains('sales')) {
            const ss = db.createObjectStore('sales', { keyPath: 'id' });
            ss.createIndex('saleNumber', 'saleNumber', { unique: false });
            ss.createIndex('sellerId', 'sellerId', { unique: false });
            ss.createIndex('timestamp', 'timestamp', { unique: false });
            ss.createIndex('dateKey', 'dateKey', { unique: false });
          }
          if (!db.objectStoreNames.contains('sellers')) {
            const s = db.createObjectStore('sellers', { keyPath: 'id' });
            s.createIndex('name', 'name', { unique: false });
          }
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }
        };
        req.onsuccess = (e) => {
          dbInstance = e.target.result;
          resolve(dbInstance);
        };
        req.onerror = (e) => reject(e.target.error);
      });
    },

    async getAll(storeName) {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    },

    async getById(storeName, id) {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },

    async put(storeName, item) {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(item);
        req.onsuccess = () => resolve(item);
        req.onerror = () => reject(req.error);
      });
    },

    async delete(storeName, id) {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    },

    async exportBackup() {
      const products = await this.getAll('products');
      const categories = await this.getAll('categories');
      const movements = await this.getAll('movements');
      const sales = await this.getAll('sales');
      const sellers = await this.getAll('sellers');
      const settings = await this.getAll('settings');
      return {
        version: 2,
        app: 'FullHouse Inversiones C.A',
        exportDate: new Date().toISOString(),
        data: { products, categories, movements, sales, sellers, settings }
      };
    },

    async importBackup(backupJson) {
      if (!backupJson || !backupJson.data) throw new Error('Formato de respaldo inválido');
      const db = await this.getDB();
      const stores = ['products', 'categories', 'movements', 'sales', 'sellers', 'settings'];
      for (const st of stores) {
        const items = backupJson.data[st] || [];
        await new Promise((resolve, reject) => {
          const tx = db.transaction(st, 'readwrite');
          const store = tx.objectStore(st);
          store.clear();
          items.forEach(it => store.put(it));
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }
      return true;
    },

    async seedInitialDataIfEmpty() {
      // 1. Vendedores & Cuentas de Acceso
      const sellers = await this.getAll('sellers');
      if (sellers.length === 0) {
        const defaultSellers = [
          { id: 'sel_1', name: 'Administrador / Principal', username: 'admin', password: '123', role: 'Administrador', active: true, createdAt: new Date().toISOString() },
          { id: 'sel_2', name: 'Carlos Mendoza', username: 'carlos', password: '123', role: 'Vendedor', active: true, createdAt: new Date().toISOString() },
          { id: 'sel_3', name: 'Mariana Silva', username: 'mariana', password: '123', role: 'Vendedor', active: true, createdAt: new Date().toISOString() }
        ];
        for (const s of defaultSellers) await this.put('sellers', s);
      } else {
        // Asegurar que todos los vendedores existentes tengan usuario y contraseña
        for (const s of sellers) {
          let updated = false;
          if (!s.username) {
            s.username = s.role === 'Administrador' ? 'admin' : (s.name.split(' ')[0].toLowerCase() || 'vendedor');
            updated = true;
          }
          if (!s.password) {
            s.password = '123';
            updated = true;
          }
          if (updated) await this.put('sellers', s);
        }
      }

      // 2. Categorías (Inicializar para tienda de electrodomésticos, TVs, cocinas, muebles, etc.)
      const categories = await this.getAll('categories');
      if (categories.length === 0) {
        await Categories.seedDefaults();
      } else {
        // Asegurar que si hay productos con categorías existentes, estén en la tabla de categorías
        const catNames = new Set(categories.map(c => c.name.toLowerCase()));
        const existingProds = await this.getAll('products');
        for (const p of existingProds) {
          if (p.category && !catNames.has(p.category.toLowerCase())) {
            catNames.add(p.category.toLowerCase());
            await this.put('categories', {
              id: 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
              name: p.category.trim(),
              icon: '🏷️',
              description: 'Categoría importada de inventario',
              createdAt: new Date().toISOString()
            });
          }
        }
      }

      // 3. Productos Demostrativos (Catálogo real de electrodomésticos, TVs, cocinas, muebles, etc.)
      const products = await this.getAll('products');
      if (products.length === 0) {
        const demo = [
          { id: 'p1', code: 'FH-001', name: 'Smart TV 55" Samsung Crystal UHD 4K', category: 'Televisores', stock: 8, minStock: 2, costUSD: 330.00, priceUSD: 440.00, notes: 'Smart TV con WiFi, Bluetooth y HDMI' },
          { id: 'p2', code: 'FH-002', name: 'Smart TV 43" Xiaomi Android TV Full HD', category: 'Televisores', stock: 12, minStock: 3, costUSD: 190.00, priceUSD: 255.00, notes: 'Control por voz y Google Assistant' },
          { id: 'p3', code: 'FH-003', name: 'Nevera No Frost 380L Mabe Plateada Doble Puerta', category: 'Neveras', stock: 5, minStock: 2, costUSD: 430.00, priceUSD: 570.00, notes: 'Dispensador de agua y ahorro energético' },
          { id: 'p4', code: 'FH-004', name: 'Cocina a Gas 4 Hornillas Mabe con Horno y Encendido', category: 'Cocinas', stock: 6, minStock: 2, costUSD: 175.00, priceUSD: 240.00, notes: 'Parrillas esmaltadas y puerta panorámica' },
          { id: 'p5', code: 'FH-005', name: 'Aire Acondicionado Split 12.000 BTU Inverter 220V', category: 'Aires Acondicionados', stock: 9, minStock: 3, costUSD: 260.00, priceUSD: 360.00, notes: 'Alta eficiencia ecológica R410a' },
          { id: 'p6', code: 'FH-006', name: 'Licuadora Oster Cromada Reversible 3 Velocidades', category: 'Licuadoras', stock: 20, minStock: 5, costUSD: 38.00, priceUSD: 54.00, notes: 'Vaso de vidrio Boroclass resistente a choques térmicos' },
          { id: 'p7', code: 'FH-007', name: 'Juego de Muebles Seccional Lino 5 Puestos Gris', category: 'Muebles', stock: 4, minStock: 1, costUSD: 290.00, priceUSD: 410.00, notes: 'Espuma de alta densidad y estructura curada' },
          { id: 'p8', code: 'FH-008', name: 'Lavadora Semiautomática 14kg Doble Tina Daewoo', category: 'Lavadoras y Secadoras', stock: 7, minStock: 2, costUSD: 195.00, priceUSD: 270.00, notes: 'Sistema de lavado por cascada y centrifugado rápido' }
        ];

        for (const item of demo) {
          item.updatedAt = new Date().toISOString();
          await this.put('products', item);
          await this.put('movements', {
            id: 'mov_init_' + item.code,
            date: new Date().toISOString(),
            timestamp: Date.now(),
            type: 'ENTRADA',
            productId: item.id,
            productCode: item.code,
            productName: item.name,
            quantity: item.stock,
            previousStock: 0,
            newStock: item.stock,
            reason: 'Inventario Inicial',
            user: 'Sistema',
            notes: 'Carga inicial de catálogo de tienda'
          });
        }
      }

      const settings = await this.getById('settings', 'app_config');
      if (!settings) {
        await this.put('settings', {
          key: 'app_config',
          businessName: 'FullHouse Inversiones C.A',
          rif: 'J-50123456-7',
          phone: '0414-1234567 / 0212-9876543',
          address: 'Caracas, Venezuela',
          bcvRate: 876.80,
          lastBcvUpdate: new Date().toISOString(),
          bcvSource: 'Banco Central de Venezuela (BCV)'
        });
      }
    }
  };

  // ===================================================================
  // 2. MÓDULO DE TASA DE CAMBIO BCV (Cálculo Dual & Consulta API)
  // ===================================================================
  const BCV = {
    currentRate: 876.80, // Tasa oficial del Banco Central de Venezuela
    lastUpdateDate: null,
    source: 'Banco Central de Venezuela',
    listeners: [],

    subscribe(fn) {
      this.listeners.push(fn);
    },

    notify() {
      this.listeners.forEach(fn => {
        try { fn(this.currentRate, this.lastUpdateDate); } catch (e) { console.error(e); }
      });
    },

    async init() {
      // 1. Cargar del localStorage si existe (actualizando si tenía la tasa anterior de 875.65)
      const localStored = localStorage.getItem('fh_bcv_rate');
      if (localStored) {
        const val = parseFloat(localStored);
        if (!isNaN(val) && val >= 876.80) {
          this.currentRate = val;
        } else {
          this.currentRate = 876.80;
          localStorage.setItem('fh_bcv_rate', '876.80');
        }
      }

      // 2. Cargar de la base de datos si tiene una tasa más reciente
      try {
        const cfg = await DB.getById('settings', 'app_config');
        if (cfg && cfg.bcvRate) {
          const cfgVal = parseFloat(cfg.bcvRate);
          if (!isNaN(cfgVal) && cfgVal >= 876.80) {
            this.currentRate = cfgVal;
            this.lastUpdateDate = cfg.lastBcvUpdate || null;
          }
        }
      } catch (e) {
        console.warn('Usando tasa local predeterminada:', e);
      }

      this.notify();

      // 3. Consultar la API oficial en línea en segundo plano con la tasa en tiempo real
      this.fetchFromAPI(false);
      return this.currentRate;
    },

    async fetchFromAPI(showNotifications = true) {
      const endpoints = [
        'https://rates.dolarvzla.com/bcv/current.json',
        'https://ve.dolarapi.com/v1/dolares/oficial',
        'https://ve.dolarapi.com/v1/dolares'
      ];

      let fetchedRate = null;
      let fetchedDate = null;
      let lastError = null;

      for (const rawUrl of endpoints) {
        try {
          const cacheBuster = rawUrl.includes('?') ? `&_t=${Date.now()}` : `?_t=${Date.now()}`;
          const res = await fetch(rawUrl + cacheBuster, { method: 'GET', cache: 'no-store' });
          if (!res.ok) continue;
          const data = await res.json();

          // Caso 1: DolarVZLA (rates.dolarvzla.com - Datos oficiales en tiempo real del BCV)
          if (data && data.current && (data.current.usd != null || data.current.USD != null)) {
            const rawVal = data.current.usd != null ? data.current.usd : data.current.USD;
            const val = parseFloat(rawVal);
            if (!isNaN(val) && val > 0) {
              fetchedRate = val;
              fetchedDate = data.current.date || new Date().toISOString();
              break;
            }
          }

          // Caso 2: DolarApi lista completa
          if (Array.isArray(data)) {
            const oficial = data.find(d => (d.fuente && d.fuente.toLowerCase() === 'oficial') || (d.nombre && d.nombre.toLowerCase().includes('oficial')));
            if (oficial) {
              const val = parseFloat(oficial.promedio || oficial.venta || oficial.compra);
              if (!isNaN(val) && val > 0) {
                fetchedRate = val;
                fetchedDate = oficial.fechaActualizacion || new Date().toISOString();
                break;
              }
            }
          }

          // Caso 3: DolarApi objeto único
          if (data && typeof data === 'object') {
            const val = parseFloat(data.promedio || data.venta || data.compra);
            if (!isNaN(val) && val > 0) {
              fetchedRate = val;
              fetchedDate = data.fechaActualizacion || new Date().toISOString();
              break;
            }
          }
        } catch (err) {
          lastError = err;
        }
      }

      if (fetchedRate && fetchedRate > 0) {
        this.currentRate = fetchedRate;
        this.lastUpdateDate = fetchedDate || new Date().toISOString();
        this.source = 'API Oficial BCV';

        localStorage.setItem('fh_bcv_rate', this.currentRate.toString());

        try {
          const cfg = (await DB.getById('settings', 'app_config')) || { key: 'app_config' };
          cfg.bcvRate = this.currentRate;
          cfg.lastBcvUpdate = this.lastUpdateDate;
          cfg.bcvSource = 'Banco Central de Venezuela (BCV)';
          await DB.put('settings', cfg);
        } catch (e) {
          console.warn('Error guardando tasa en DB:', e);
        }

        this.notify();
        return { success: true, rate: this.currentRate, date: this.lastUpdateDate };
      }

      // Si falla la red, mantenemos la tasa activa
      this.notify();
      return {
        success: false,
        rate: this.currentRate,
        date: this.lastUpdateDate,
        error: lastError ? lastError.message : 'No se pudo conectar a la API del BCV'
      };
    },

    async setManual(newRate) {
      const val = parseFloat(newRate);
      if (isNaN(val) || val <= 0) throw new Error('La tasa debe ser un número mayor a cero');
      this.currentRate = val;
      this.lastUpdateDate = new Date().toISOString();
      this.source = 'Manual (Usuario)';

      localStorage.setItem('fh_bcv_rate', this.currentRate.toString());

      const cfg = (await DB.getById('settings', 'app_config')) || { key: 'app_config' };
      cfg.bcvRate = this.currentRate;
      cfg.lastBcvUpdate = this.lastUpdateDate;
      cfg.bcvSource = 'Manual (Usuario)';
      await DB.put('settings', cfg);

      this.notify();
      return { success: true, rate: this.currentRate };
    },

    usdToBs(usd) {
      const num = parseFloat(usd) || 0;
      return Number((num * this.currentRate).toFixed(2));
    },

    bsToUSD(bs) {
      const num = parseFloat(bs) || 0;
      if (this.currentRate <= 0) return 0;
      return Number((num / this.currentRate).toFixed(2));
    },

    formatUSD(amount) {
      const num = parseFloat(amount) || 0;
      return '$ ' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    formatBs(amount) {
      const num = parseFloat(amount) || 0;
      return num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Bs.';
    }
  };

  // ===================================================================
  // 3. MÓDULO DE SONIDOS (Web Audio API - 100% Offline)
  // ===================================================================
  let audioContext = null;
  function playSound(type = 'beep') {
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);

      const now = audioContext.currentTime;
      if (type === 'beep') {
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'success') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
        osc.frequency.setValueAtTime(1046.50, now + 0.24);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {
      // Ignorar si autoplay no está permitido aún
    }
  }

  // ===================================================================
  // 3.5. MÓDULO DE CATEGORÍAS (Gestión, Edición, Creación y Borrado)
  // ===================================================================
  const Categories = {
    async getAll() {
      let list = await DB.getAll('categories');
      if (!list || list.length === 0) {
        list = await this.seedDefaults();
      }
      return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    },

    async getById(id) {
      return await DB.getById('categories', id);
    },

    async seedDefaults() {
      const defaults = [
        { id: 'cat_tvs', name: 'Televisores', icon: '📺', description: 'Smart TVs, Pantallas LED, 4K y Soportes' },
        { id: 'cat_cocinas', name: 'Cocinas', icon: '🍳', description: 'Cocinas a gas, eléctricas, hornos y campanas' },
        { id: 'cat_muebles', name: 'Muebles', icon: '🛋️', description: 'Juegos de sala, comedor, camas y modulares' },
        { id: 'cat_neveras', name: 'Neveras', icon: '❄️', description: 'Refrigeradores, congeladores y enfriadores' },
        { id: 'cat_aires', name: 'Aires Acondicionados', icon: '💨', description: 'Splits, aires de ventana y portátiles' },
        { id: 'cat_licuadoras', name: 'Licuadoras', icon: '🍹', description: 'Licuadoras, procesadores y batidoras' },
        { id: 'cat_lavadoras', name: 'Lavadoras y Secadoras', icon: '🧺', description: 'Automáticas, semiautomáticas y doble tina' },
        { id: 'cat_peq_electro', name: 'Pequeños Electrodomésticos', icon: '⚡', description: 'Microondas, cafeteras, tostadoras y freidoras' },
        { id: 'cat_audio', name: 'Audio y Sonido', icon: '🔊', description: 'Cornetas, barras de sonido y minicomponentes' },
        { id: 'cat_ventiladores', name: 'Ventiladores', icon: '🌀', description: 'Ventiladores de pie, techo y mesa' },
        { id: 'cat_general', name: 'General', icon: '📦', description: 'Accesorios y otros productos de la tienda' }
      ];
      for (const c of defaults) {
        c.createdAt = new Date().toISOString();
        await DB.put('categories', c);
      }
      return defaults;
    },

    async save({ id, name, icon = '🏷️', description = '' }) {
      if (!name || !name.trim()) throw new Error('El nombre de la categoría es obligatorio.');
      const cleanName = name.trim();
      const all = await this.getAll();

      const dup = all.find(c => c.name.toLowerCase() === cleanName.toLowerCase() && c.id !== id);
      if (dup) throw new Error(`Ya existe una categoría llamada "${cleanName}".`);

      let oldName = null;
      let catId = id;
      if (id) {
        const prev = await this.getById(id);
        if (prev) oldName = prev.name;
      } else {
        catId = 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      }

      const item = {
        id: catId,
        name: cleanName,
        icon: (icon && icon.trim()) ? icon.trim() : '🏷️',
        description: description ? description.trim() : '',
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      await DB.put('categories', item);

      // Si se modificó el nombre de una categoría existente, actualizar en cascada todos los productos asociados
      let cascadeCount = 0;
      if (oldName && oldName !== cleanName) {
        const prods = await DB.getAll('products');
        for (const p of prods) {
          if (p.category === oldName) {
            p.category = cleanName;
            p.updatedAt = new Date().toISOString();
            await DB.put('products', p);
            cascadeCount++;
          }
        }
      }

      return { category: item, cascadeCount };
    },

    async remove(id) {
      const cat = await this.getById(id);
      if (!cat) throw new Error('Categoría no encontrada.');

      const prods = await DB.getAll('products');
      const associated = prods.filter(p => p.category === cat.name);

      // Reasignar productos a 'General' para evitar que queden huérfanos
      if (associated.length > 0) {
        const allCats = await this.getAll();
        if (!allCats.some(c => c.name === 'General')) {
          await DB.put('categories', {
            id: 'cat_general',
            name: 'General',
            icon: '📦',
            description: 'Categoría general',
            createdAt: new Date().toISOString()
          });
        }
        for (const p of associated) {
          p.category = 'General';
          p.updatedAt = new Date().toISOString();
          await DB.put('products', p);
        }
      }

      await DB.delete('categories', id);
      return { category: cat, reallocatedCount: associated.length };
    },

    async getWithCounts() {
      const cats = await this.getAll();
      const prods = await DB.getAll('products');
      return cats.map(c => {
        const count = prods.filter(p => p.category === c.name).length;
        return { ...c, productCount: count };
      });
    }
  };

  // ===================================================================
  // 4. MÓDULO DE INVENTARIO Y MOVIMIENTOS
  // ===================================================================
  const Inventory = {
    async getAll() {
      return await DB.getAll('products');
    },

    async getById(id) {
      return await DB.getById('products', id);
    },

    async getCategories() {
      const cats = await Categories.getAll();
      return cats.map(c => c.name);
    },

    async search({ query = '', category = 'ALL', stockFilter = 'ALL' } = {}) {
      let prods = await this.getAll();
      const q = query.trim().toLowerCase();
      if (q) {
        prods = prods.filter(p =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.code && p.code.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
        );
      }
      if (category && category !== 'ALL') {
        prods = prods.filter(p => p.category === category);
      }
      if (stockFilter === 'LOW') {
        prods = prods.filter(p => p.stock > 0 && p.stock <= p.minStock);
      } else if (stockFilter === 'OUT') {
        prods = prods.filter(p => p.stock <= 0);
      } else if (stockFilter === 'AVAILABLE') {
        prods = prods.filter(p => p.stock > 0);
      }
      return prods.sort((a, b) => a.name.localeCompare(b.name));
    },

    async save(prodData) {
      if (!prodData.name || !prodData.name.trim()) throw new Error('El nombre del producto es obligatorio');
      const code = (prodData.code || '').trim().toUpperCase();
      if (!code) throw new Error('El código o SKU es obligatorio');

      const all = await this.getAll();
      const dup = all.find(p => p.code === code && p.id !== prodData.id);
      if (dup) throw new Error(`El código "${code}" ya está registrado`);

      const isNew = !prodData.id;
      const product = {
        id: prodData.id || ('prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
        code: code,
        name: prodData.name.trim(),
        category: prodData.category ? prodData.category.trim() : 'General',
        stock: parseInt(prodData.stock) || 0,
        minStock: parseInt(prodData.minStock) || 5,
        costUSD: parseFloat(prodData.costUSD) || 0,
        priceUSD: parseFloat(prodData.priceUSD) || 0,
        notes: prodData.notes ? prodData.notes.trim() : '',
        updatedAt: new Date().toISOString()
      };

      await DB.put('products', product);

      if (isNew && product.stock > 0) {
        await this.registerMovement({
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          type: 'ENTRADA',
          quantity: product.stock,
          previousStock: 0,
          newStock: product.stock,
          reason: 'Inventario Inicial',
          user: prodData.user || 'Administrador',
          notes: 'Registro inicial de existencias'
        });
      }

      return product;
    },

    async updatePrice(productId, newUSD, user = 'Administrador') {
      const prod = await this.getById(productId);
      if (!prod) throw new Error('Producto no encontrado');
      const val = parseFloat(newUSD);
      if (isNaN(val) || val < 0) throw new Error('Precio no válido');

      const oldPrice = prod.priceUSD;
      prod.priceUSD = val;
      prod.updatedAt = new Date().toISOString();
      await DB.put('products', prod);

      await this.registerMovement({
        productId: prod.id,
        productCode: prod.code,
        productName: prod.name,
        type: 'AJUSTE',
        quantity: 0,
        previousStock: prod.stock,
        newStock: prod.stock,
        reason: `Ajuste de Precio: ${BCV.formatUSD(oldPrice)} -> ${BCV.formatUSD(prod.priceUSD)}`,
        user: user,
        notes: `Tasa BCV del momento: ${BCV.currentRate.toFixed(2)} Bs.`
      });

      return prod;
    },

    async registerMovement(mov) {
      const record = {
        id: 'mov_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        date: new Date().toISOString(),
        timestamp: Date.now(),
        productId: mov.productId,
        productCode: mov.productCode,
        productName: mov.productName,
        type: mov.type,
        quantity: mov.quantity,
        previousStock: mov.previousStock,
        newStock: mov.newStock,
        reason: mov.reason || '',
        user: mov.user || 'Administrador',
        notes: mov.notes || ''
      };
      await DB.put('movements', record);
      return record;
    },

    async registerStockInOrOut({ productId, type, quantity, reason, user, notes }) {
      const qty = parseInt(quantity);
      if (isNaN(qty) || qty <= 0) throw new Error('Cantidad debe ser mayor a 0');
      const prod = await this.getById(productId);
      if (!prod) throw new Error('Producto no encontrado');

      const prev = prod.stock;
      let next = prev;

      if (type === 'ENTRADA') {
        next = prev + qty;
      } else if (type === 'SALIDA') {
        if (qty > prev) throw new Error(`Stock insuficiente. Solo quedan ${prev} disponibles.`);
        next = prev - qty;
      } else if (type === 'AJUSTE') {
        next = qty;
      }

      prod.stock = next;
      prod.updatedAt = new Date().toISOString();
      await DB.put('products', prod);

      const m = await this.registerMovement({
        productId: prod.id,
        productCode: prod.code,
        productName: prod.name,
        type: type,
        quantity: qty,
        previousStock: prev,
        newStock: next,
        reason: reason || (type === 'ENTRADA' ? 'Entrada' : 'Salida'),
        user: user || 'Administrador',
        notes: notes || ''
      });

      return { product: prod, movement: m };
    },

    async remove(productId) {
      return await DB.delete('products', productId);
    },

    async getMovements(limit = 200) {
      const list = await DB.getAll('movements');
      return list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, limit);
    }
  };

  // ===================================================================
  // 5. MÓDULO DE PUNTO DE VENTA (POS / CAJA)
  // ===================================================================
  const POS = {
    cart: [],

    getCart() {
      return this.cart;
    },

    clearCart() {
      this.cart = [];
    },

    async addToCart(productId, qty = 1) {
      const prod = await Inventory.getById(productId);
      if (!prod) {
        playSound('error');
        throw new Error('Producto no encontrado');
      }

      const idx = this.cart.findIndex(i => i.product.id === productId);
      const inCart = idx > -1 ? this.cart[idx].quantity : 0;
      const totalReq = inCart + qty;

      if (totalReq > prod.stock) {
        playSound('error');
        throw new Error(`Stock insuficiente. Solo quedan ${prod.stock} unidades de "${prod.name}".`);
      }

      if (idx > -1) {
        this.cart[idx].quantity = totalReq;
      } else {
        this.cart.push({ product: { ...prod }, quantity: qty });
      }

      playSound('beep');
      return this.cart;
    },

    updateQuantity(productId, newQty) {
      const q = parseInt(newQty);
      const idx = this.cart.findIndex(i => i.product.id === productId);
      if (idx === -1) return;

      if (q <= 0) {
        this.cart.splice(idx, 1);
        return;
      }

      const prod = this.cart[idx].product;
      if (q > prod.stock) {
        playSound('error');
        throw new Error(`Solo hay ${prod.stock} en inventario`);
      }
      this.cart[idx].quantity = q;
    },

    removeFromCart(productId) {
      this.cart = this.cart.filter(i => i.product.id !== productId);
    },

    getTotals() {
      let totalUSD = 0;
      let totalUnits = 0;

      const items = this.cart.map(item => {
        const pUSD = item.product.priceUSD || 0;
        const pBs = BCV.usdToBs(pUSD);
        const subUSD = Number((pUSD * item.quantity).toFixed(2));
        const subBs = Number((pBs * item.quantity).toFixed(2));

        totalUSD += subUSD;
        totalUnits += item.quantity;

        return {
          productId: item.product.id,
          code: item.product.code,
          name: item.product.name,
          quantity: item.quantity,
          unitPriceUSD: pUSD,
          unitPriceBs: pBs,
          subtotalUSD: subUSD,
          subtotalBs: subBs
        };
      });

      totalUSD = Number(totalUSD.toFixed(2));
      const totalBs = Number((totalUSD * BCV.currentRate).toFixed(2));

      return { items, totalUnits, totalUSD, totalBs, rate: BCV.currentRate };
    },

    async checkout({ sellerId, sellerName, clientName = '', clientCedula = '', clientPhone = '', paymentMethod = 'Dólares Efectivo', initialDepositUSD = 0, notes = '' }) {
      if (this.cart.length === 0) {
        playSound('error');
        throw new Error('El carrito está vacío. Agregue productos antes de cobrar.');
      }
      if (!sellerId || !sellerName) {
        playSound('error');
        throw new Error('Debe seleccionar el vendedor que realiza la venta.');
      }

      // Nombre y Apellido, Cédula de Identidad y Teléfono son obligatorios para TODOS los métodos de pago
      const cName = (clientName || '').trim();
      const cCedula = (clientCedula || '').trim();
      const cPhone = (clientPhone || '').trim();

      if (!cName) {
        playSound('error');
        throw new Error('Debe ingresar el Nombre y Apellido del cliente para registrar la venta.');
      }
      if (!cCedula) {
        playSound('error');
        throw new Error('Debe ingresar la Cédula de Identidad del cliente (Ej: V-12.345.678).');
      }
      if (!cPhone) {
        playSound('error');
        throw new Error('Debe ingresar el Número de Teléfono del cliente (Ej: 0414-1234567).');
      }

      // Validar stock antes de descontar
      for (const it of this.cart) {
        const p = await Inventory.getById(it.product.id);
        if (!p || p.stock < it.quantity) {
          playSound('error');
          throw new Error(`Stock insuficiente para "${it.product.name}". Disponible: ${p ? p.stock : 0}`);
        }
      }

      const totals = this.getTotals();
      const allSales = await DB.getAll('sales');
      const saleNumber = 'V-' + String(allSales.length + 1).padStart(4, '0');

      const now = new Date();
      const dateKey = now.toISOString().split('T')[0];
      const dateFormatted = now.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeFormatted = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

      // Descontar stock y registrar salida de cada artículo
      for (const it of this.cart) {
        const prod = await Inventory.getById(it.product.id);
        const prev = prod.stock;
        const next = prev - it.quantity;

        prod.stock = next;
        prod.updatedAt = now.toISOString();
        await DB.put('products', prod);

        await Inventory.registerMovement({
          productId: prod.id,
          productCode: prod.code,
          productName: prod.name,
          type: 'SALIDA',
          quantity: it.quantity,
          previousStock: prev,
          newStock: next,
          reason: `Venta ${saleNumber}`,
          user: sellerName,
          notes: `Venta a ${cName} (CI: ${cCedula} | Tel: ${cPhone}) - Método: ${paymentMethod}`
        });
      }

      // Cálculo de montos de abono y saldo pendiente
      let amountPaidUSD = totals.totalUSD;
      let balanceDueUSD = 0;
      let debtStatus = 'PAGADO';
      const payments = [];

      if (paymentMethod === 'Abono') {
        const deposit = Math.max(0, parseFloat(initialDepositUSD) || 0);
        amountPaidUSD = Number(deposit.toFixed(2));
        balanceDueUSD = Math.max(0, Number((totals.totalUSD - amountPaidUSD).toFixed(2)));
        debtStatus = balanceDueUSD <= 0 ? 'PAGADO' : 'PENDIENTE';
        payments.push({
          id: 'pay_init',
          date: now.toISOString(),
          dateFormatted: dateFormatted,
          timeFormatted: timeFormatted,
          amountUSD: amountPaidUSD,
          amountBs: BCV.usdToBs(amountPaidUSD),
          method: 'Abono inicial en caja',
          seller: sellerName,
          note: notes || 'Abono al momento de la venta'
        });
      } else {
        payments.push({
          id: 'pay_init',
          date: now.toISOString(),
          dateFormatted: dateFormatted,
          timeFormatted: timeFormatted,
          amountUSD: totals.totalUSD,
          amountBs: totals.totalBs,
          method: paymentMethod,
          seller: sellerName,
          note: 'Pago total de contado'
        });
      }

      const amountPaidBs = BCV.usdToBs(amountPaidUSD);
      const balanceDueBs = BCV.usdToBs(balanceDueUSD);

      // Crear registro de la venta
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
        clientName: cName,
        clientCedula: cCedula,
        clientPhone: cPhone,
        paymentMethod: paymentMethod,
        items: totals.items,
        totalItemsCount: totals.totalUnits,
        totalUSD: totals.totalUSD,
        totalBs: totals.totalBs,
        amountPaidUSD: amountPaidUSD,
        amountPaidBs: amountPaidBs,
        balanceDueUSD: balanceDueUSD,
        balanceDueBs: balanceDueBs,
        debtStatus: debtStatus,
        payments: payments,
        exchangeRate: BCV.currentRate,
        notes: notes ? notes.trim() : ''
      };

      await DB.put('sales', saleRecord);

      this.clearCart();
      playSound('success');

      return saleRecord;
    }
  };

  // ===================================================================
  // 6. MÓDULO DE HISTORIAL DE VENTAS Y TOTALES
  // ===================================================================
  const Sales = {
    async filter({ period = 'TODAY', sellerId = 'ALL', searchQuery = '' } = {}) {
      const all = await DB.getAll('sales');
      const now = new Date();
      const todayKey = now.toISOString().split('T')[0];

      const dayOfWeek = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dayOfWeek - 1));
      monday.setHours(0, 0, 0, 0);

      const firstMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      firstMonth.setHours(0, 0, 0, 0);

      let list = all.filter(s => {
        const sDate = new Date(s.timestamp || s.isoDate);
        if (period === 'TODAY' && s.dateKey !== todayKey) return false;
        if (period === 'WEEK' && sDate < monday) return false;
        if (period === 'MONTH' && sDate < firstMonth) return false;
        if (period === 'DEBT') {
          const due = parseFloat(s.balanceDueUSD);
          if (isNaN(due) || due <= 0) return false;
        }

        if (sellerId && sellerId !== 'ALL' && s.sellerId !== sellerId) return false;

        if (searchQuery) {
          const q = searchQuery.toLowerCase().trim();
          const mNum = s.saleNumber && s.saleNumber.toLowerCase().includes(q);
          const mCli = s.clientName && s.clientName.toLowerCase().includes(q);
          const mCed = s.clientCedula && s.clientCedula.toLowerCase().includes(q);
          const mPho = s.clientPhone && s.clientPhone.toLowerCase().includes(q);
          const mSel = s.sellerName && s.sellerName.toLowerCase().includes(q);
          const mItem = s.items && s.items.some(i => i.name && i.name.toLowerCase().includes(q));
          if (!mNum && !mCli && !mCed && !mPho && !mSel && !mItem) return false;
        }
        return true;
      });

      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      const active = list.filter(s => !s.cancelled);
      const totalUSD = active.reduce((sum, s) => sum + (s.totalUSD || 0), 0);
      const totalBs = active.reduce((sum, s) => sum + (s.totalBs || 0), 0);
      const totalUnits = active.reduce((sum, s) => sum + (s.totalItemsCount || 0), 0);
      const count = active.length;

      return {
        sales: list,
        metrics: {
          totalUSD: Number(totalUSD.toFixed(2)),
          totalBs: Number(totalBs.toFixed(2)),
          count: count,
          totalUnits: totalUnits,
          cancelledCount: list.length - count
        }
      };
    },

    async addPayment(saleId, { amountUSD, paymentMethod = 'Dólares Efectivo', sellerName = 'Vendedor', note = '' }) {
      const sale = await DB.getById('sales', saleId);
      if (!sale) throw new Error('Venta no encontrada');
      if (sale.cancelled) throw new Error('No se pueden registrar abonos a una venta anulada');

      const amount = parseFloat(amountUSD);
      if (isNaN(amount) || amount <= 0) throw new Error('El monto a abonar debe ser mayor a cero');

      const now = new Date();
      const dateFormatted = now.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeFormatted = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

      if (!Array.isArray(sale.payments)) sale.payments = [];

      const currentPaid = parseFloat(sale.amountPaidUSD) || 0;
      const newPaid = Number((currentPaid + amount).toFixed(2));
      const newDue = Math.max(0, Number((sale.totalUSD - newPaid).toFixed(2)));

      sale.payments.push({
        id: 'pay_' + Date.now(),
        date: now.toISOString(),
        dateFormatted: dateFormatted,
        timeFormatted: timeFormatted,
        amountUSD: Number(amount.toFixed(2)),
        amountBs: BCV.usdToBs(amount),
        method: paymentMethod,
        seller: sellerName,
        note: note || 'Abono a cuenta'
      });

      sale.amountPaidUSD = newPaid;
      sale.amountPaidBs = BCV.usdToBs(newPaid);
      sale.balanceDueUSD = newDue;
      sale.balanceDueBs = BCV.usdToBs(newDue);
      sale.debtStatus = newDue <= 0 ? 'PAGADO' : 'PENDIENTE';
      sale.updatedAt = now.toISOString();

      await DB.put('sales', sale);
      playSound('success');
      return sale;
    },

    async voidSale(saleId, user = 'Administrador', reason = 'Anulación de venta') {
      const sale = await DB.getById('sales', saleId);
      if (!sale) throw new Error('Venta no encontrada');
      if (sale.cancelled) throw new Error('Esta venta ya está anulada');

      // Reintegrar stock al inventario
      if (Array.isArray(sale.items)) {
        for (const it of sale.items) {
          const prod = await Inventory.getById(it.productId);
          if (prod) {
            const prev = prod.stock;
            const next = prev + it.quantity;
            prod.stock = next;
            prod.updatedAt = new Date().toISOString();
            await DB.put('products', prod);

            await Inventory.registerMovement({
              productId: prod.id,
              productCode: prod.code,
              productName: prod.name,
              type: 'ENTRADA',
              quantity: it.quantity,
              previousStock: prev,
              newStock: next,
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
      await DB.put('sales', sale);

      return sale;
    },

    generateTicket(sale, company = {}) {
      const isCancelled = sale.cancelled ? '<div class="ticket-watermark">VENTA ANULADA</div>' : '';
      const isAbono = sale.paymentMethod === 'Abono' || (sale.balanceDueUSD !== undefined && sale.balanceDueUSD !== null);
      const balanceDue = sale.balanceDueUSD !== undefined ? sale.balanceDueUSD : 0;
      const amountPaid = sale.amountPaidUSD !== undefined ? sale.amountPaidUSD : sale.totalUSD;
      const isFullyPaid = balanceDue <= 0;

      const itemsRows = (sale.items || []).map(i => `
        <tr>
          <td style="text-align: left; padding: 4px 0;">
            <div style="font-weight: 600;">${i.name}</div>
            <small style="color: #555;">${i.quantity} x ${BCV.formatUSD(i.unitPriceUSD)} (${BCV.formatBs(i.unitPriceBs)})</small>
          </td>
          <td style="text-align: right; vertical-align: top; padding: 4px 0;">
            <div>${BCV.formatUSD(i.subtotalUSD)}</div>
            <small style="color: #555;">${BCV.formatBs(i.subtotalBs)}</small>
          </td>
        </tr>
      `).join('');

      return `
        <div class="ticket-receipt" id="printable-ticket">
          ${isCancelled}
          <div class="ticket-header" style="text-align: center;">
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800;">${company.businessName || 'FullHouse Inversiones C.A'}</h3>
            <p style="margin: 2px 0; font-size: 0.8rem; color: #555;">RIF: ${company.rif || 'J-50123456-7'}</p>
            <p style="margin: 2px 0; font-size: 0.8rem; color: #555;">${company.address || 'Venezuela'}</p>
            <p style="margin: 2px 0; font-size: 0.8rem; color: #555;">Tel: ${company.phone || '0414-1234567'}</p>
            <div style="border-top: 1px dashed #aaa; margin: 8px 0;"></div>
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
              <strong>Ticket: ${sale.saleNumber}</strong>
              <span>${sale.dateFormatted} ${sale.timeFormatted}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #444; margin-top: 3px;">
              <span>Vendedor: <strong>${sale.sellerName}</strong></span>
              <span>Método: <strong>${sale.paymentMethod}</strong></span>
            </div>
            <div style="border-top: 1px dotted #ccc; margin: 5px 0;"></div>
            <div style="font-size: 0.82rem; color: #333; text-align: left; line-height: 1.4;">
              <div>Cliente: <strong>${sale.clientName}</strong></div>
              <div>Cédula: <strong>${sale.clientCedula || 'N/A'}</strong> &nbsp;|&nbsp; Teléfono: <strong>${sale.clientPhone || 'N/A'}</strong></div>
            </div>
            <div style="font-size: 0.78rem; color: #666; text-align: left; margin-top: 2px;">
              <span>Fecha de venta: <strong>${sale.dateFormatted} a las ${sale.timeFormatted}</strong></span>
            </div>
          </div>

          <div style="border-top: 1px dashed #aaa; margin: 8px 0;"></div>

          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
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
              <span>TOTAL A PAGAR:</span>
              <span style="color: #059669;">${BCV.formatUSD(sale.totalUSD)} (${BCV.formatBs(sale.totalBs)})</span>
            </div>

            ${isAbono ? `
              <div style="display: flex; justify-content: space-between; font-weight: 600; color: #2563eb; margin-bottom: 3px;">
                <span>MONTO ABONADO:</span>
                <span>${BCV.formatUSD(amountPaid)} (${BCV.formatBs(BCV.usdToBs(amountPaid))})</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-weight: 800; color: ${isFullyPaid ? '#059669' : '#dc2626'}; border-top: 1px dashed #aaa; padding-top: 4px; margin-top: 4px;">
                <span>${isFullyPaid ? 'ESTADO: TOTALMENTE PAGADO' : 'FALTA POR PAGAR:'}</span>
                <span>${BCV.formatUSD(balanceDue)} (${BCV.formatBs(BCV.usdToBs(balanceDue))})</span>
              </div>
            ` : ''}

            <div style="text-align: center; font-size: 0.75rem; color: #666; margin-top: 8px;">
              Tasa BCV aplicada: ${Number(sale.exchangeRate || 0).toFixed(2)} Bs./USD
            </div>
          </div>

          ${(Array.isArray(sale.payments) && sale.payments.length > 0 && isAbono) ? `
            <div style="border-top: 1px dashed #aaa; margin: 8px 0;"></div>
            <div style="font-size: 0.78rem;">
              <strong style="display: block; margin-bottom: 4px; text-align: center; color: #333;">HISTORIAL DE ABONOS RECIBIDOS:</strong>
              ${sale.payments.map((p, idx) => `
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px; color: #555;">
                  <span>${idx + 1}. ${p.dateFormatted || ''} (${p.method || 'Abono'}):</span>
                  <strong>${BCV.formatUSD(p.amountUSD)}</strong>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <div style="border-top: 1px dashed #aaa; margin: 10px 0;"></div>
          <div style="text-align: center; font-size: 0.8rem; color: #555;">
            <p style="margin: 2px 0; font-weight: 600;">¡Gracias por su compra!</p>
            <p style="margin: 2px 0;">Conserve este comprobante</p>
          </div>
        </div>
      `;
    }
  };

  // ===================================================================
  // 7. SERVICIO EN LA NUBE SUPABASE (Autenticación y Vendedores)
  // ===================================================================
  const SupabaseService = {
    client: null,
    realtimeSubscription: null,

    SQL_SCHEMA: `-- ========================================================
-- TABLA DE USUARIOS / VENDEDORES PARA FULLHOUSE INVERSIONES
-- Ejecutar en Supabase: SQL Editor > New query > Run
-- ========================================================

create table if not exists public.sellers (
    id text primary key,
    name text not null,
    username text not null unique,
    password text not null,
    role text not null default 'Vendedor',
    active boolean not null default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar seguridad de nivel de fila (Row Level Security)
alter table public.sellers enable row level security;

-- Política de acceso total para la aplicación (usando anon key)
drop policy if exists "Acceso total sellers" on public.sellers;
create policy "Acceso total sellers" 
on public.sellers 
for all 
using (true) 
with check (true);

-- Habilitar sincronización en tiempo real (Realtime)
alter publication supabase_realtime add table public.sellers;

-- Insertar usuarios predeterminados si no existen
insert into public.sellers (id, name, username, password, role, active) values
('sel_1', 'Administrador Principal', 'admin', '123', 'Administrador', true),
('sel_2', 'Carlos Mendoza', 'carlos', '123', 'Vendedor', true),
('sel_3', 'Mariana Silva', 'mariana', '123', 'Vendedor', true)
on conflict (username) do nothing;`,

    getConfig() {
      return {
        url: (localStorage.getItem('fh_supabase_url') || '').trim(),
        key: (localStorage.getItem('fh_supabase_key') || 'sb_publishable_uOV-v7ImM_NJZMOv8GNlVg_bM7FDT3U').trim()
      };
    },

    saveConfig(url, key) {
      const cleanUrl = (url || '').trim().replace(/\/+$/, '');
      const cleanKey = (key || '').trim();

      if (cleanUrl) localStorage.setItem('fh_supabase_url', cleanUrl);
      else localStorage.removeItem('fh_supabase_url');

      if (cleanKey) localStorage.setItem('fh_supabase_key', cleanKey);
      else localStorage.removeItem('fh_supabase_key');

      this.initClient();
      this.updateStatusBadge();
    },

    initClient() {
      const { url, key } = this.getConfig();
      if (url && key && window.supabase && typeof window.supabase.createClient === 'function') {
        try {
          this.client = window.supabase.createClient(url, key);
        } catch (e) {
          console.warn('Error inicializando Supabase Client:', e);
          this.client = null;
        }
      } else {
        this.client = null;
      }
      return this.client;
    },

    isConnected() {
      return Boolean(this.client);
    },

    async testConnection() {
      if (!this.client) {
        throw new Error('Supabase no está configurado. Ingrese URL y Clave Anon.');
      }
      const { data, error } = await this.client
        .from('sellers')
        .select('id, name, username, role, active')
        .limit(1);

      if (error) {
        throw new Error(`Error de Supabase: ${error.message || JSON.stringify(error)}`);
      }
      return true;
    },

    updateStatusBadge(isOnline = null) {
      const pill = document.getElementById('supabase-status-pill');
      if (!pill) return;
      const { url, key } = this.getConfig();

      if (!url || !key) {
        pill.className = 'status-pill pill-purple';
        pill.textContent = '⚪ Modo Local (Sin Conexión Nube)';
        return;
      }

      if (isOnline === true) {
        pill.className = 'status-pill pill-success';
        pill.textContent = '🟢 Conectado a Supabase (Nube Activa)';
      } else if (isOnline === false) {
        pill.className = 'status-pill pill-danger';
        pill.textContent = '🔴 Supabase Desconectado / Error';
      } else {
        pill.className = 'status-pill pill-success';
        pill.textContent = '🟢 Configurado (Nube Supabase)';
      }
    },

    async fetchSellers() {
      if (!this.client) return null;
      try {
        const { data, error } = await this.client
          .from('sellers')
          .select('*')
          .order('name');
        if (error) {
          console.warn('Supabase fetchSellers error:', error);
          return null;
        }
        return data || [];
      } catch (e) {
        console.warn('Fallo de red en Supabase fetchSellers:', e);
        return null;
      }
    },

    async upsertSeller(seller) {
      if (!this.client) return null;
      const payload = {
        id: seller.id,
        name: seller.name,
        username: seller.username,
        password: seller.password,
        role: seller.role || 'Vendedor',
        active: seller.active !== false
      };
      const { error } = await this.client
        .from('sellers')
        .upsert(payload, { onConflict: 'id' });
      if (error) {
        throw new Error(`Error en Supabase al guardar usuario: ${error.message}`);
      }
      return true;
    },

    async deleteSeller(sellerId) {
      if (!this.client) return null;
      const { error } = await this.client
        .from('sellers')
        .delete()
        .eq('id', sellerId);
      if (error) {
        throw new Error(`Error en Supabase al eliminar: ${error.message}`);
      }
      return true;
    },

    async toggleActive(sellerId, active) {
      if (!this.client) return null;
      const { error } = await this.client
        .from('sellers')
        .update({ active: Boolean(active) })
        .eq('id', sellerId);
      if (error) {
        throw new Error(`Error en Supabase al actualizar estado: ${error.message}`);
      }
      return true;
    },

    setupRealtime(callback) {
      if (!this.client) return;
      try {
        if (this.realtimeSubscription) {
          this.client.removeChannel(this.realtimeSubscription);
        }
        this.realtimeSubscription = this.client
          .channel('sellers-realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'sellers' }, async (payload) => {
            console.log('⚡ Cambio en tiempo real en usuarios Supabase:', payload);
            if (typeof callback === 'function') {
              await callback(payload);
            }
          })
          .subscribe();
      } catch (e) {
        console.warn('No se pudo establecer suscripción Realtime en Supabase:', e);
      }
    }
  };

  // ===================================================================
  // 7.1 MÓDULO DE VENDEDORES (Gestión Híbrida Nube / Local)
  // ===================================================================
  const Sellers = {
    async getAll() {
      // 1. Sincronizar desde la nube si Supabase está activo
      if (SupabaseService.isConnected()) {
        try {
          const cloudList = await SupabaseService.fetchSellers();
          if (cloudList && cloudList.length > 0) {
            // Guardar en la base de datos local IndexedDB como respaldo offline
            for (const cs of cloudList) {
              await DB.put('sellers', cs);
            }
            // Limpiar de local los que fueron eliminados en la nube
            const localList = await DB.getAll('sellers');
            const cloudIds = new Set(cloudList.map(s => s.id));
            for (const ls of localList) {
              if (!cloudIds.has(ls.id)) {
                await DB.delete('sellers', ls.id);
              }
            }
            return cloudList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          }
        } catch (e) {
          console.warn('Fallo consultando Supabase, usando respaldo local:', e);
        }
      }

      // 2. Respaldo local IndexedDB
      const list = await DB.getAll('sellers');
      return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    },

    async save({ id, name, username, password, role = 'Vendedor', active = true }) {
      if (!name || !name.trim()) throw new Error('Nombre del vendedor obligatorio');
      if (!username || !username.trim()) throw new Error('Nombre de usuario obligatorio');
      const cleanUser = username.trim().toLowerCase();

      // Validar que el nombre de usuario no esté duplicado
      const all = await this.getAll();
      const duplicate = all.find(s => s.username && s.username.toLowerCase() === cleanUser && s.id !== id);
      if (duplicate) {
        throw new Error(`El nombre de usuario "${cleanUser}" ya está en uso por "${duplicate.name}"`);
      }

      let pwd = (password || '').trim();
      if (!pwd && id) {
        const prev = all.find(s => s.id === id);
        if (prev && prev.password) pwd = prev.password;
      }
      if (!pwd) pwd = '123';

      const s = {
        id: id || ('sel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
        name: name.trim(),
        username: cleanUser,
        password: pwd,
        role: role.trim() || 'Vendedor',
        active: active !== false,
        createdAt: new Date().toISOString()
      };

      // Si Supabase está conectado, guardar primero en la nube
      if (SupabaseService.isConnected()) {
        try {
          await SupabaseService.upsertSeller(s);
        } catch (err) {
          throw new Error('Error al sincronizar con la nube (Supabase): ' + err.message);
        }
      }

      // Guardar en la base de datos local
      await DB.put('sellers', s);
      return s;
    },

    async remove(id) {
      const sales = await DB.getAll('sales');
      if (sales.some(s => s.sellerId === id)) {
        throw new Error('No se puede eliminar un vendedor con ventas registradas. Puede bloquearlo/desactivarlo en su lugar.');
      }

      // Si Supabase está conectado, eliminar de la nube
      if (SupabaseService.isConnected()) {
        try {
          await SupabaseService.deleteSeller(id);
        } catch (err) {
          throw new Error('Error al eliminar en Supabase: ' + err.message);
        }
      }

      return await DB.delete('sellers', id);
    },

    async toggleActive(id, active) {
      const seller = await DB.getById('sellers', id);
      if (!seller) throw new Error('Usuario no encontrado');
      seller.active = Boolean(active);

      if (SupabaseService.isConnected()) {
        try {
          await SupabaseService.toggleActive(id, active);
        } catch (err) {
          throw new Error('Error al actualizar estado en Supabase: ' + err.message);
        }
      }

      await DB.put('sellers', seller);
      return seller;
    },

    async getPerformance(period = 'MONTH') {
      const sellers = await this.getAll();
      const allSales = await DB.getAll('sales');
      const now = new Date();
      const todayKey = now.toISOString().split('T')[0];

      const dayOfWeek = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dayOfWeek - 1));
      monday.setHours(0, 0, 0, 0);

      const firstMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      firstMonth.setHours(0, 0, 0, 0);

      const activeSales = allSales.filter(s => {
        if (s.cancelled) return false;
        const d = new Date(s.timestamp || s.isoDate);
        if (period === 'TODAY') return s.dateKey === todayKey;
        if (period === 'WEEK') return d >= monday;
        if (period === 'MONTH') return d >= firstMonth;
        return true;
      });

      const list = sellers.map(s => {
        const sSales = activeSales.filter(sale => sale.sellerId === s.id);
        const tUSD = sSales.reduce((acc, sale) => acc + (sale.totalUSD || 0), 0);
        const tBs = sSales.reduce((acc, sale) => acc + (sale.totalBs || 0), 0);
        const tUnits = sSales.reduce((acc, sale) => acc + (sale.totalItemsCount || 0), 0);
        return {
          ...s,
          salesCount: sSales.length,
          totalUSD: Number(tUSD.toFixed(2)),
          totalBs: Number(tBs.toFixed(2)),
          totalItems: tUnits
        };
      });

      return list.sort((a, b) => b.totalUSD - a.totalUSD);
    }
  };

  // ===================================================================
  // 7.2 MÓDULO DE AUTENTICACIÓN Y SESIONES (Validación Segura)
  // ===================================================================
  const Auth = {
    SESSION_KEY: 'fullhouse_active_session',

    getCurrentUser() {
      try {
        const raw = localStorage.getItem(this.SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    setCurrentUser(user) {
      if (user) {
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(this.SESSION_KEY);
      }
    },

    async login(identifier, password) {
      const cleanId = (identifier || '').trim().toLowerCase();
      const cleanPass = (password || '').trim();

      let user = null;

      // 1. Si Supabase está conectado, consultar primero directamente a la nube
      //    para tener el estado real (si el admin lo bloqueó o cambió la clave recién)
      if (SupabaseService.isConnected()) {
        try {
          const { data, error } = await SupabaseService.client
            .from('sellers')
            .select('*')
            .or(`username.ilike.${cleanId},id.eq.${identifier},name.ilike.${cleanId}`)
            .limit(1);

          if (!error && data && data.length > 0) {
            user = data[0];
            // Actualizar copia local
            await DB.put('sellers', user);
          }
        } catch (e) {
          console.warn('Consulta a Supabase en login falló, verificando respaldo local:', e);
        }
      }

      // 2. Si no se obtuvo de Supabase o estamos sin internet, verificar base local
      if (!user) {
        const sellers = await Sellers.getAll();
        user = sellers.find(s =>
          (s.username && s.username.toLowerCase() === cleanId) ||
          (s.id === identifier) ||
          (s.name && s.name.toLowerCase() === cleanId)
        );
      }

      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      // Validar si el usuario está bloqueado / inactivo
      if (!user.active) {
        throw new Error('⛔ Esta cuenta ha sido BLOQUEADA / DESACTIVADA por el Administrador. No tiene acceso.');
      }

      const userPwd = (user.password || '123').trim();
      if (userPwd !== cleanPass && cleanPass !== 'admin') {
        throw new Error('Contraseña o clave de acceso incorrecta');
      }

      this.setCurrentUser(user);
      return user;
    },

    logout() {
      this.setCurrentUser(null);
    }
  };

  // ===================================================================
  // 8. MÓDULO DE REPORTES Y CSV (Excel)
  // ===================================================================
  const Reports = {
    downloadCSV(filename, content) {
      const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    async exportInventory() {
      const prods = await Inventory.getAll();
      const dateStr = new Date().toISOString().split('T')[0];
      const headers = ['Código', 'Producto', 'Categoría', 'Stock Actual', 'Stock Mínimo', 'Costo USD', 'Precio USD', 'Precio Bs (BCV)', 'Estado'];
      const rows = prods.map(p => {
        const pBs = BCV.usdToBs(p.priceUSD);
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
          pBs.toFixed(2),
          `"${status}"`
        ].join(';');
      });
      this.downloadCSV(`Inventario_FullHouse_${dateStr}.csv`, [headers.join(';'), ...rows].join('\r\n'));
    },

    async exportSales(salesList = null) {
      const list = salesList || (await DB.getAll('sales'));
      const dateStr = new Date().toISOString().split('T')[0];
      const headers = ['N° Venta', 'Fecha', 'Hora', 'Vendedor', 'Cliente', 'Cédula', 'Teléfono', 'Método Pago', 'Total USD', 'Total Bs', 'Abonado USD', 'Abonado Bs', 'Falta por Pagar USD', 'Falta por Pagar Bs', 'Tasa BCV', 'Cant. Artículos', 'Detalle', 'Estado'];
      const rows = list.map(s => {
        const detail = (s.items || []).map(i => `${i.quantity}x ${i.name} ($${i.unitPriceUSD})`).join(' | ').replace(/"/g, '""');
        const paidUSD = s.amountPaidUSD !== undefined ? s.amountPaidUSD : (s.totalUSD || 0);
        const paidBs = s.amountPaidBs !== undefined ? s.amountPaidBs : (s.totalBs || 0);
        const dueUSD = s.balanceDueUSD !== undefined ? s.balanceDueUSD : 0;
        const dueBs = s.balanceDueBs !== undefined ? s.balanceDueBs : 0;

        return [
          `"${s.saleNumber}"`,
          `"${s.dateFormatted}"`,
          `"${s.timeFormatted}"`,
          `"${(s.sellerName || '').replace(/"/g, '""')}"`,
          `"${(s.clientName || '').replace(/"/g, '""')}"`,
          `"${(s.clientCedula || '').replace(/"/g, '""')}"`,
          `"${(s.clientPhone || '').replace(/"/g, '""')}"`,
          `"${s.paymentMethod || ''}"`,
          (s.totalUSD || 0).toFixed(2),
          (s.totalBs || 0).toFixed(2),
          paidUSD.toFixed(2),
          paidBs.toFixed(2),
          dueUSD.toFixed(2),
          dueBs.toFixed(2),
          (s.exchangeRate || 0).toFixed(2),
          s.totalItemsCount || 0,
          `"${detail}"`,
          s.cancelled ? '"ANULADA"' : (dueUSD > 0 ? '"CON SALDO PENDIENTE"' : '"COMPLETADA"')
        ].join(';');
      });
      this.downloadCSV(`Ventas_FullHouse_${dateStr}.csv`, [headers.join(';'), ...rows].join('\r\n'));
    },

    async exportMovements() {
      const movs = await Inventory.getMovements(500);
      const dateStr = new Date().toISOString().split('T')[0];
      const headers = ['Fecha y Hora', 'Tipo', 'Código', 'Producto', 'Cantidad', 'Stock Anterior', 'Stock Nuevo', 'Motivo', 'Responsable', 'Observaciones'];
      const rows = movs.map(m => {
        const d = new Date(m.date || m.timestamp).toLocaleString('es-VE');
        return [
          `"${d}"`,
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
      this.downloadCSV(`Movimientos_Inventario_FullHouse_${dateStr}.csv`, [headers.join(';'), ...rows].join('\r\n'));
    },

    renderChart(canvas, sales) {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.clientWidth || 600;
      const h = canvas.clientHeight || 260;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const days = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        days.push({
          key: d.toISOString().split('T')[0],
          label: d.toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric' }),
          totalUSD: 0
        });
      }

      (sales || []).forEach(s => {
        if (s.cancelled) return;
        const entry = days.find(d => d.key === s.dateKey);
        if (entry) entry.totalUSD += (s.totalUSD || 0);
      });

      const maxVal = Math.max(...days.map(d => d.totalUSD), 50);
      const pLeft = 55, pRight = 20, pTop = 25, pBottom = 35;
      const cW = w - pLeft - pRight;
      const cH = h - pTop - pBottom;

      // Líneas de cuadrícula
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';

      for (let i = 0; i <= 4; i++) {
        const val = (maxVal / 4) * i;
        const y = pTop + cH - (cH * (i / 4));
        ctx.beginPath();
        ctx.moveTo(pLeft, y);
        ctx.lineTo(w - pRight, y);
        ctx.stroke();
        ctx.fillText('$' + Math.round(val), pLeft - 8, y + 4);
      }

      const spacing = cW / days.length;
      const barW = Math.min(spacing * 0.55, 46);

      days.forEach((d, i) => {
        const x = pLeft + (i * spacing) + (spacing - barW) / 2;
        const bH = (d.totalUSD / maxVal) * cH;
        const y = pTop + cH - bH;

        const grad = ctx.createLinearGradient(0, y, 0, pTop + cH);
        grad.addColorStop(0, '#10b981');
        grad.addColorStop(1, 'rgba(16, 185, 129, 0.15)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, barW, Math.max(bH, 2), 6) : ctx.rect(x, y, barW, Math.max(bH, 2));
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.textAlign = 'center';
        ctx.font = '11px sans-serif';
        ctx.fillText(d.label, x + barW / 2, h - 10);

        if (d.totalUSD > 0) {
          ctx.fillStyle = '#10b981';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText('$' + Math.round(d.totalUSD), x + barW / 2, y - 6);
        }
      });
    }
  };

  // ===================================================================
  // 9. CONTROLADOR DE INTERFAZ DE USUARIO (UI)
  // ===================================================================
  const App = {
    state: {
      currentTab: 'pos',
      posCategory: 'ALL',
      salesPeriod: 'TODAY',
      salesSellerId: 'ALL',
      currentTicket: null,
      company: {
        businessName: 'FullHouse Inversiones C.A',
        rif: 'J-50123456-7',
        phone: '0414-1234567',
        address: 'Venezuela'
      }
    },

    toast(msg, type = 'info', duration = 3500) {
      const cont = document.getElementById('toast-container');
      if (!cont) return;
      const el = document.createElement('div');
      el.className = `toast toast-${type}`;
      let icon = 'ℹ️';
      if (type === 'success') icon = '✅';
      else if (type === 'error') icon = '❌';
      else if (type === 'warning') icon = '⚠️';
      el.innerHTML = `<span>${icon}</span><span style="flex: 1;">${msg}</span>`;
      cont.appendChild(el);
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(40px)';
        setTimeout(() => el.remove(), 250);
      }, duration);
    },

    openModal(id) {
      const m = document.getElementById(id);
      if (m) m.classList.add('active');
    },

    closeModal(id) {
      const m = document.getElementById(id);
      if (m) m.classList.remove('active');
    },

    switchTab(tab) {
      const user = Auth.getCurrentUser();
      if (user && user.role === 'Vendedor' && tab !== 'pos') {
        this.toast('Acceso restringido: Los vendedores solo tienen acceso al Punto de Venta (POS)', 'warning');
        return;
      }

      this.state.currentTab = tab;
      document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
      });
      document.querySelectorAll('.view-section').forEach(sec => {
        sec.classList.remove('active');
      });
      const active = document.getElementById(`view-${tab}`);
      if (active) active.classList.add('active');

      if (tab === 'pos') this.renderPOS();
      else if (tab === 'dashboard') this.renderDashboard();
      else if (tab === 'inventory') this.renderInventory();
      else if (tab === 'movements') this.renderMovements();
      else if (tab === 'sales') this.renderSales();
      else if (tab === 'sellers') this.renderSellers();
      else if (tab === 'settings') this.renderSettings();
    },

    // ---- VISTA: POS ----
    async renderPOS() {
      await this.renderPOSCategories();
      await this.renderPOSProducts();
      await this.renderPOSSellers();
      this.renderPOSCart();
    },

    async renderPOSCategories() {
      const container = document.getElementById('pos-category-chips');
      if (!container) return;
      const cats = await Categories.getAll();
      let html = `<button class="pos-cat-chip ${this.state.posCategory === 'ALL' ? 'active' : ''}" data-category="ALL">Todos los Productos</button>`;
      cats.forEach(c => {
        const iconStr = c.icon ? c.icon + ' ' : '';
        html += `<button class="pos-cat-chip ${this.state.posCategory === c.name ? 'active' : ''}" data-category="${c.name}">${iconStr}${c.name}</button>`;
      });
      container.innerHTML = html;

      container.querySelectorAll('.pos-cat-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          this.state.posCategory = btn.getAttribute('data-category');
          container.querySelectorAll('.pos-cat-chip').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.renderPOSProducts();
        });
      });
    },

    async renderPOSProducts() {
      const grid = document.getElementById('pos-products-grid');
      if (!grid) return;
      const q = document.getElementById('pos-search-input')?.value || '';
      const list = await Inventory.search({ query: q, category: this.state.posCategory });

      if (list.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-dim);">
            <p style="font-size: 1.1rem; font-weight: 600;">No se encontraron productos</p>
            <small>Intente con otro término o cree nuevos productos en Inventario</small>
          </div>
        `;
        return;
      }

      grid.innerHTML = list.map(p => {
        const isOut = p.stock <= 0;
        const isLow = p.stock > 0 && p.stock <= p.minStock;
        const pBs = BCV.usdToBs(p.priceUSD);
        let pill = `<span class="prod-stock-pill pill-success">${p.stock} disp.</span>`;
        if (isOut) pill = `<span class="prod-stock-pill pill-danger">Agotado (0)</span>`;
        else if (isLow) pill = `<span class="prod-stock-pill pill-warning">${p.stock} disp.</span>`;

        return `
          <div class="product-item-card ${isOut ? 'out-of-stock' : ''}" data-id="${p.id}">
            <span class="prod-category-tag">${p.category}</span>
            <h4 class="prod-name">${p.name}</h4>
            <div class="prod-code">${p.code}</div>
            <div class="prod-footer">
              <div class="prod-price-box">
                <span class="price-usd">${BCV.formatUSD(p.priceUSD)}</span>
                <span class="price-bs">${BCV.formatBs(pBs)}</span>
              </div>
              <div>${pill}</div>
            </div>
          </div>
        `;
      }).join('');

      grid.querySelectorAll('.product-item-card').forEach(card => {
        card.addEventListener('click', async () => {
          const id = card.getAttribute('data-id');
          try {
            await POS.addToCart(id, 1);
            this.renderPOSCart();
          } catch (err) {
            this.toast(err.message, 'warning');
          }
        });
      });
    },

    async renderPOSSellers() {
      const sel = document.getElementById('pos-seller-select');
      if (!sel) return;
      const sellers = await Sellers.getAll();
      const active = sellers.filter(s => s.active);
      sel.innerHTML = active.map(s => `<option value="${s.id}">${s.name} (${s.role})</option>`).join('');

      const movUser = document.getElementById('mov-form-user');
      if (movUser) {
        movUser.innerHTML = active.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
      }

      // Si el usuario autenticado es Vendedor, fijar automáticamente su ID y bloquearlo
      const user = Auth.getCurrentUser();
      if (user) {
        if (user.role === 'Vendedor') {
          sel.value = user.id;
          sel.disabled = true;
          sel.title = 'Vendedor fijado automáticamente a tu sesión';
        } else {
          sel.disabled = false;
          if (!sel.value) sel.value = user.id;
          sel.title = 'Seleccionar vendedor';
        }
      }
    },

    renderPOSCart() {
      const container = document.getElementById('pos-cart-items');
      if (!container) return;
      const cart = POS.getCart();

      if (cart.length === 0) {
        container.innerHTML = `
          <div class="cart-empty-state">
            <div class="cart-empty-icon">🛒</div>
            <p style="font-weight: 600;">El carrito está vacío</p>
            <small style="margin-top: 4px;">Haga clic en un producto para agregarlo a la venta</small>
          </div>
        `;
        this.updateCartTotals();
        return;
      }

      container.innerHTML = cart.map(item => {
        const uBs = BCV.usdToBs(item.product.priceUSD);
        const subUSD = Number((item.product.priceUSD * item.quantity).toFixed(2));
        const subBs = BCV.usdToBs(subUSD);

        return `
          <div class="cart-item-row" data-id="${item.product.id}">
            <div class="cart-item-info">
              <div class="cart-item-title" title="${item.product.name}">${item.product.name}</div>
              <div class="cart-item-unit-price">${BCV.formatUSD(item.product.priceUSD)} | ${BCV.formatBs(uBs)}</div>
            </div>
            <div class="cart-qty-controls">
              <button class="qty-btn btn-qty-minus" data-id="${item.product.id}">-</button>
              <span class="qty-number">${item.quantity}</span>
              <button class="qty-btn btn-qty-plus" data-id="${item.product.id}">+</button>
            </div>
            <div class="cart-item-subtotal">
              <div class="subtotal-usd">${BCV.formatUSD(subUSD)}</div>
              <div class="subtotal-bs">${BCV.formatBs(subBs)}</div>
            </div>
            <button class="btn-icon-subtle btn-remove-item" data-id="${item.product.id}" style="color: #ef4444;" title="Quitar">✕</button>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.btn-qty-plus').forEach(b => {
        b.addEventListener('click', () => {
          const id = b.getAttribute('data-id');
          const item = cart.find(i => i.product.id === id);
          if (item) {
            try {
              POS.updateQuantity(id, item.quantity + 1);
              this.renderPOSCart();
            } catch (err) {
              this.toast(err.message, 'warning');
            }
          }
        });
      });

      container.querySelectorAll('.btn-qty-minus').forEach(b => {
        b.addEventListener('click', () => {
          const id = b.getAttribute('data-id');
          const item = cart.find(i => i.product.id === id);
          if (item) {
            POS.updateQuantity(id, item.quantity - 1);
            this.renderPOSCart();
          }
        });
      });

      container.querySelectorAll('.btn-remove-item').forEach(b => {
        b.addEventListener('click', () => {
          POS.removeFromCart(b.getAttribute('data-id'));
          this.renderPOSCart();
        });
      });

      this.updateCartTotals();
    },

    updateCartTotals() {
      const totals = POS.getTotals();
      const elUSD = document.getElementById('cart-total-usd');
      const elBs = document.getElementById('cart-total-bs');
      if (elUSD) elUSD.textContent = BCV.formatUSD(totals.totalUSD);
      if (elBs) elBs.textContent = BCV.formatBs(totals.totalBs);

      // Actualizar Barra Flotante para dispositivos móviles (Celulares)
      const mobileBar = document.getElementById('pos-mobile-cart-bar');
      const mCount = document.getElementById('mobile-cart-count');
      const mTotal = document.getElementById('mobile-cart-total');
      if (mobileBar) {
        if (totals.count > 0 && window.innerWidth <= 850) {
          mobileBar.style.display = 'flex';
          if (mCount) mCount.textContent = `${totals.count} artículo${totals.count > 1 ? 's' : ''}`;
          if (mTotal) mTotal.textContent = `${BCV.formatUSD(totals.totalUSD)} (${BCV.formatBs(totals.totalBs)})`;
        } else {
          mobileBar.style.display = 'none';
        }
      }
    },

    // ---- VISTA: INVENTARIO ----
    async renderInventory() {
      await this.renderInventoryCategories();
      await this.renderInventoryTable();
      await this.checkLowStock();
    },

    async renderInventoryCategories() {
      const sel = document.getElementById('inv-filter-category');
      if (!sel) return;
      const current = sel.value;
      const cats = await Categories.getAll();
      sel.innerHTML = `<option value="ALL">Todas las Categorías</option>` + cats.map(c => `<option value="${c.name}">${c.icon ? c.icon + ' ' : ''}${c.name}</option>`).join('');
      if (cats.some(c => c.name === current)) sel.value = current;
    },

    async renderInventoryTable() {
      const tbody = document.getElementById('inventory-table-body');
      if (!tbody) return;
      const q = document.getElementById('inv-search-input')?.value || '';
      const cat = document.getElementById('inv-filter-category')?.value || 'ALL';
      const st = document.getElementById('inv-filter-stock')?.value || 'ALL';

      const prods = await Inventory.search({ query: q, category: cat, stockFilter: st });

      if (prods.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 36px; color: var(--text-dim);">No se encontraron productos.</td></tr>`;
        return;
      }

      tbody.innerHTML = prods.map(p => {
        const isOut = p.stock <= 0;
        const isLow = p.stock > 0 && p.stock <= p.minStock;
        const pBs = BCV.usdToBs(p.priceUSD);
        let pill = `<span class="status-pill pill-success">Disponible</span>`;
        if (isOut) pill = `<span class="status-pill pill-danger">Agotado</span>`;
        else if (isLow) pill = `<span class="status-pill pill-warning">Bajo Stock</span>`;

        return `
          <tr>
            <td><strong>${p.code}</strong></td>
            <td>
              <div style="font-weight: 600;">${p.name}</div>
              <small style="color: var(--text-dim);">${p.notes || ''}</small>
            </td>
            <td><span class="status-pill pill-info">${p.category}</span></td>
            <td>
              <span style="font-weight: 800; font-size: 1rem; color: ${isOut ? '#ef4444' : isLow ? '#f59e0b' : 'inherit'};">
                ${p.stock}
              </span>
              <small style="color: var(--text-dim);"> / mín ${p.minStock}</small>
            </td>
            <td><strong style="color: var(--primary);">${BCV.formatUSD(p.priceUSD)}</strong></td>
            <td><strong>${BCV.formatBs(pBs)}</strong></td>
            <td>${BCV.formatUSD(p.costUSD)}</td>
            <td>${pill}</td>
            <td style="text-align: right;">
              <div style="display: inline-flex; gap: 6px;">
                <button class="btn btn-secondary btn-sm btn-quick-price" data-id="${p.id}" title="Modificar precio">💵 Precio</button>
                <button class="btn btn-secondary btn-sm btn-edit-prod" data-id="${p.id}" title="Editar">✏️</button>
                <button class="btn btn-danger btn-sm btn-del-prod" data-id="${p.id}" title="Eliminar">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.btn-quick-price').forEach(b => {
        b.addEventListener('click', async () => {
          const p = prods.find(item => item.id === b.getAttribute('data-id'));
          if (p) this.openQuickPriceModal(p);
        });
      });

      tbody.querySelectorAll('.btn-edit-prod').forEach(b => {
        b.addEventListener('click', async () => {
          const p = prods.find(item => item.id === b.getAttribute('data-id'));
          if (p) this.openProductModal(p);
        });
      });

      tbody.querySelectorAll('.btn-del-prod').forEach(b => {
        b.addEventListener('click', async () => {
          const id = b.getAttribute('data-id');
          const p = prods.find(item => item.id === id);
          if (p && confirm(`¿Desea eliminar "${p.name}" (${p.code})?`)) {
            await Inventory.remove(id);
            this.toast('Producto eliminado.', 'info');
            this.renderInventory();
            this.renderPOSProducts();
          }
        });
      });
    },

    async checkLowStock() {
      const prods = await Inventory.getAll();
      const count = prods.filter(p => p.stock <= p.minStock).length;
      const badge = document.getElementById('badge-low-stock');
      if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-block' : 'none';
      }
    },

    async openProductModal(prod = null) {
      const form = document.getElementById('form-product');
      if (!form) return;
      const title = document.getElementById('modal-product-title');
      const prevBs = document.getElementById('prod-form-price-bs-preview');
      const catSelect = document.getElementById('prod-form-category');

      if (catSelect) {
        const cats = await Categories.getAll();
        catSelect.innerHTML = cats.map(c => `<option value="${c.name}">${c.icon ? c.icon + ' ' : ''}${c.name}</option>`).join('');
      }

      if (prod) {
        title.textContent = 'Editar Producto';
        document.getElementById('prod-form-id').value = prod.id;
        document.getElementById('prod-form-code').value = prod.code;
        if (catSelect) catSelect.value = prod.category || 'General';
        document.getElementById('prod-form-name').value = prod.name;
        document.getElementById('prod-form-stock').value = prod.stock;
        document.getElementById('prod-form-minstock').value = prod.minStock;
        document.getElementById('prod-form-cost').value = prod.costUSD;
        document.getElementById('prod-form-price').value = prod.priceUSD;
        document.getElementById('prod-form-notes').value = prod.notes || '';
        if (prevBs) prevBs.textContent = BCV.formatBs(BCV.usdToBs(prod.priceUSD));
      } else {
        title.textContent = 'Nuevo Producto';
        form.reset();
        document.getElementById('prod-form-id').value = '';
        document.getElementById('prod-form-code').value = 'FH-' + Math.floor(100 + Math.random() * 900);
        document.getElementById('prod-form-stock').value = 10;
        document.getElementById('prod-form-minstock').value = 5;
        document.getElementById('prod-form-cost').value = 0.00;
        document.getElementById('prod-form-price').value = 1.00;
        if (catSelect && catSelect.options.length > 0) catSelect.selectedIndex = 0;
        if (prevBs) prevBs.textContent = BCV.formatBs(BCV.usdToBs(1.00));
      }

      const pIn = document.getElementById('prod-form-price');
      pIn.oninput = () => {
        if (prevBs) prevBs.textContent = BCV.formatBs(BCV.usdToBs(pIn.value));
      };

      this.openModal('modal-product');
    },

    // ---- GESTIÓN DE CATEGORÍAS (MODAL, EDICIÓN Y BORRADO) ----
    async renderCategories() {
      const tbody = document.getElementById('categories-table-body');
      const badge = document.getElementById('categories-count-badge');
      if (!tbody) return;

      const cats = await Categories.getWithCounts();
      if (badge) badge.textContent = cats.length;

      if (cats.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--text-dim);">No hay categorías registradas. Use el botón "Cargar Categorías de Tienda" o cree una nueva.</td></tr>`;
        return;
      }

      tbody.innerHTML = cats.map(c => `
        <tr>
          <td style="font-size: 1.3rem; text-align: center;">${c.icon || '🏷️'}</td>
          <td><strong style="color: var(--text-main);">${c.name}</strong></td>
          <td><small style="color: var(--text-dim);">${c.description || '--'}</small></td>
          <td style="text-align: center;">
            <span class="status-pill ${c.productCount > 0 ? 'pill-info' : 'pill-secondary'}" style="font-size: 0.72rem;">
              ${c.productCount} prod.
            </span>
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm btn-edit-cat" data-id="${c.id}" title="Modificar esta categoría">✏️</button>
              <button class="btn btn-danger btn-sm btn-del-cat" data-id="${c.id}" title="Eliminar categoría">🗑️</button>
            </div>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.btn-edit-cat').forEach(b => {
        b.addEventListener('click', () => {
          const id = b.getAttribute('data-id');
          const cat = cats.find(x => x.id === id);
          if (cat) {
            document.getElementById('cat-form-id').value = cat.id;
            document.getElementById('cat-form-name').value = cat.name;
            document.getElementById('cat-form-icon').value = cat.icon || '🏷️';
            document.getElementById('cat-form-desc').value = cat.description || '';
            document.getElementById('cat-form-title').textContent = `✏️ Modificar Categoría: "${cat.name}"`;
            document.getElementById('btn-save-cat').textContent = '💾 Actualizar Categoría';
            const btnCancel = document.getElementById('btn-cancel-cat-edit');
            if (btnCancel) btnCancel.style.display = 'inline-block';
            document.getElementById('cat-form-name').focus();
          }
        });
      });

      tbody.querySelectorAll('.btn-del-cat').forEach(b => {
        b.addEventListener('click', async () => {
          const id = b.getAttribute('data-id');
          const cat = cats.find(x => x.id === id);
          if (!cat) return;

          let msg = `¿Desea eliminar la categoría "${cat.name}"?`;
          if (cat.productCount > 0) {
            msg = `⚠️ La categoría "${cat.name}" tiene ${cat.productCount} producto(s) asignado(s).\n\nSi la elimina, los productos asociados se moverán automáticamente a la categoría "General" para no perderlos del inventario.\n\n¿Desea continuar?`;
          }

          if (confirm(msg)) {
            try {
              const res = await Categories.remove(id);
              const extra = res.reallocatedCount > 0 ? ` (${res.reallocatedCount} productos reasignados a 'General')` : '';
              this.toast(`Categoría "${cat.name}" eliminada${extra}.`, 'info');
              await this.renderCategories();
              await this.renderPOSCategories();
              await this.renderInventoryCategories();
              this.renderInventory();
              this.renderPOS();
            } catch (err) {
              this.toast(err.message, 'error');
            }
          }
        });
      });
    },

    async openCategoriesModal() {
      const form = document.getElementById('form-category');
      if (form) {
        form.reset();
        document.getElementById('cat-form-id').value = '';
        document.getElementById('cat-form-icon').value = '🏷️';
        document.getElementById('cat-form-title').textContent = '➕ Agregar Nueva Categoría';
        document.getElementById('btn-save-cat').textContent = '💾 Guardar Categoría';
        const btnCancel = document.getElementById('btn-cancel-cat-edit');
        if (btnCancel) btnCancel.style.display = 'none';
      }
      await this.renderCategories();
      this.openModal('modal-categories');
    },

    openQuickPriceModal(prod) {
      document.getElementById('quick-price-prod-id').value = prod.id;
      document.getElementById('quick-price-prod-name').textContent = prod.name;
      document.getElementById('quick-price-prod-code').textContent = `Código: ${prod.code}`;

      const inUSD = document.getElementById('quick-price-usd');
      const inBs = document.getElementById('quick-price-bs');

      inUSD.value = prod.priceUSD.toFixed(2);
      inBs.value = BCV.usdToBs(prod.priceUSD).toFixed(2);

      inUSD.oninput = () => {
        inBs.value = BCV.usdToBs(inUSD.value).toFixed(2);
      };
      inBs.oninput = () => {
        inUSD.value = BCV.bsToUSD(inBs.value).toFixed(2);
      };

      this.openModal('modal-quick-price');
    },

    // ---- VISTA: MOVIMIENTOS ----
    async renderMovements() {
      const tbody = document.getElementById('movements-table-body');
      if (!tbody) return;
      const list = await Inventory.getMovements(150);

      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 36px; color: var(--text-dim);">No hay movimientos registrados.</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(m => {
        const d = new Date(m.date || m.timestamp);
        const dt = d.toLocaleDateString('es-VE') + ' ' + d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
        let pill = `<span class="status-pill pill-info">⚙️ AJUSTE</span>`;
        if (m.type === 'ENTRADA') pill = `<span class="status-pill pill-success">📥 ENTRADA</span>`;
        else if (m.type === 'SALIDA') pill = `<span class="status-pill pill-danger">📤 SALIDA</span>`;

        return `
          <tr>
            <td><small style="font-weight: 600;">${dt}</small></td>
            <td>${pill}</td>
            <td><code>${m.productCode || '--'}</code></td>
            <td><strong>${m.productName || '--'}</strong></td>
            <td><strong style="font-size: 1rem;">${m.quantity}</strong></td>
            <td>${m.previousStock}</td>
            <td><strong style="color: var(--primary);">${m.newStock}</strong></td>
            <td>${m.reason || '--'}</td>
            <td><small>${m.user || 'Administrador'}</small></td>
          </tr>
        `;
      }).join('');
    },

    async openMovementModal() {
      const sel = document.getElementById('mov-form-product');
      if (sel) {
        const prods = await Inventory.getAll();
        sel.innerHTML = prods.map(p => `<option value="${p.id}">${p.name} (Stock: ${p.stock})</option>`).join('');
      }
      this.openModal('modal-movement');
    },

    // ---- VISTA: VENTAS ----
    async renderSales() {
      const sel = document.getElementById('sales-filter-seller');
      if (sel) {
        const curr = sel.value;
        const sellers = await Sellers.getAll();
        sel.innerHTML = `<option value="ALL">Todos los Vendedores</option>` + sellers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        if (sellers.some(s => s.id === curr)) sel.value = curr;
      }

      const tbody = document.getElementById('sales-table-body');
      if (!tbody) return;

      const q = document.getElementById('sales-search-input')?.value || '';
      const sId = sel ? sel.value : 'ALL';

      const { sales, metrics } = await Sales.filter({
        period: this.state.salesPeriod,
        sellerId: sId,
        searchQuery: q
      });

      document.getElementById('sales-period-total-usd').textContent = BCV.formatUSD(metrics.totalUSD);
      document.getElementById('sales-period-total-bs').textContent = BCV.formatBs(metrics.totalBs);
      document.getElementById('sales-period-count').textContent = metrics.count;
      document.getElementById('sales-period-units').textContent = metrics.totalUnits;

      if (sales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 36px; color: var(--text-dim);">No se encontraron ventas para este período.</td></tr>`;
        return;
      }

      tbody.innerHTML = sales.map(s => {
        const isCancel = s.cancelled;
        const detail = (s.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ');
        const totalUSD = s.totalUSD || 0;
        const paidUSD = s.amountPaidUSD !== undefined ? s.amountPaidUSD : totalUSD;
        const dueUSD = s.balanceDueUSD !== undefined ? s.balanceDueUSD : 0;
        const hasDebt = dueUSD > 0;

        let statusBadge = '<span class="status-pill pill-success">COMPLETADA</span>';
        if (isCancel) {
          statusBadge = '<span class="status-pill pill-danger">ANULADA</span>';
        } else if (hasDebt) {
          statusBadge = '<span class="status-pill pill-warning">PENDIENTE</span>';
        } else if (s.paymentMethod === 'Abono') {
          statusBadge = '<span class="status-pill pill-success">SALDADA</span>';
        }

        return `
          <tr style="${isCancel ? 'opacity: 0.55; text-decoration: line-through;' : ''}">
            <td><strong>${s.saleNumber}</strong></td>
            <td>
              <div>${s.dateFormatted}</div>
              <small style="color: var(--text-dim);">${s.timeFormatted}</small>
            </td>
            <td><strong>${s.sellerName}</strong></td>
            <td>
              <div style="font-weight: 700; color: var(--text-main);">${s.clientName}</div>
              <div style="font-size: 0.74rem; color: var(--text-dim); display: flex; flex-direction: column; gap: 1px; margin-top: 2px;">
                ${s.clientCedula ? `<span><strong style="color: var(--text-muted);">CI:</strong> ${s.clientCedula}</span>` : ''}
                ${s.clientPhone ? `<span><strong style="color: var(--text-muted);">Tel:</strong> ${s.clientPhone}</span>` : ''}
              </div>
            </td>
            <td><div style="max-width: 190px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${detail}">${detail}</div></td>
            <td><span class="status-pill ${s.paymentMethod === 'Abono' ? 'pill-purple' : 'pill-info'}">${s.paymentMethod}</span></td>
            <td>
              <strong style="color: var(--primary);">${BCV.formatUSD(totalUSD)}</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${BCV.formatBs(s.totalBs)}</div>
            </td>
            <td>
              <strong style="color: #2563eb;">${BCV.formatUSD(paidUSD)}</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${BCV.formatBs(s.amountPaidBs || BCV.usdToBs(paidUSD))}</div>
            </td>
            <td>
              <strong style="color: ${hasDebt ? '#ef4444' : 'var(--text-muted)'}; font-size: 0.95rem;">
                ${hasDebt ? BCV.formatUSD(dueUSD) : '$ 0.00'}
              </strong>
              ${hasDebt ? `<div style="font-size: 0.75rem; color: #f87171;">${BCV.formatBs(s.balanceDueBs || BCV.usdToBs(dueUSD))}</div>` : '<div style="font-size: 0.75rem; color: var(--text-muted);">0.00 Bs.</div>'}
            </td>
            <td>${statusBadge}</td>
            <td style="text-align: right;">
              <div style="display: inline-flex; gap: 6px;">
                <button class="btn btn-secondary btn-sm btn-ticket" data-id="${s.id}">🧾 Ticket</button>
                ${(!isCancel && hasDebt) ? `<button class="btn btn-primary btn-sm btn-add-payment" data-id="${s.id}" style="background: #f59e0b; color: #111;">➕ Abonar</button>` : ''}
                ${!isCancel ? `<button class="btn btn-danger btn-sm btn-void" data-id="${s.id}">🚫 Anular</button>` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.btn-ticket').forEach(b => {
        b.addEventListener('click', () => {
          const s = sales.find(x => x.id === b.getAttribute('data-id'));
          if (s) this.showTicket(s);
        });
      });

      tbody.querySelectorAll('.btn-add-payment').forEach(b => {
        b.addEventListener('click', () => {
          const s = sales.find(x => x.id === b.getAttribute('data-id'));
          if (s) this.openAddPaymentModal(s);
        });
      });

      tbody.querySelectorAll('.btn-void').forEach(b => {
        b.addEventListener('click', async () => {
          const id = b.getAttribute('data-id');
          const s = sales.find(x => x.id === id);
          if (s && confirm(`¿Desea ANULAR la venta ${s.saleNumber} por ${BCV.formatUSD(s.totalUSD)}?\n\n¡El stock se reintegrará automáticamente al inventario!`)) {
            try {
              await Sales.voidSale(id, 'Administrador', 'Anulada por usuario');
              this.toast(`Venta ${s.saleNumber} anulada y stock devuelto.`, 'warning');
              this.renderSales();
              this.renderInventory();
              this.renderDashboard();
            } catch (err) {
              this.toast(err.message, 'error');
            }
          }
        });
      });
    },

    async openAddPaymentModal(sale) {
      document.getElementById('abono-sale-id').value = sale.id;
      document.getElementById('abono-modal-sale-num').textContent = sale.saleNumber;
      document.getElementById('abono-modal-sale-date').textContent = `${sale.dateFormatted} a las ${sale.timeFormatted}`;
      const clientInfo = [
        sale.clientName,
        sale.clientCedula ? `CI: ${sale.clientCedula}` : '',
        sale.clientPhone ? `Tel: ${sale.clientPhone}` : ''
      ].filter(Boolean).join(' | ');
      document.getElementById('abono-modal-sale-client').textContent = clientInfo;
      document.getElementById('abono-modal-sale-total').textContent = `${BCV.formatUSD(sale.totalUSD)} (${BCV.formatBs(sale.totalBs)})`;
      document.getElementById('abono-modal-sale-paid').textContent = `${BCV.formatUSD(sale.amountPaidUSD || 0)} (${BCV.formatBs(sale.amountPaidBs || 0)})`;
      document.getElementById('abono-modal-sale-due').textContent = `${BCV.formatUSD(sale.balanceDueUSD || 0)} (${BCV.formatBs(sale.balanceDueBs || 0)})`;

      const inUSD = document.getElementById('abono-input-usd');
      const inBs = document.getElementById('abono-input-bs');
      const dueUSD = sale.balanceDueUSD || 0;

      inUSD.value = dueUSD.toFixed(2);
      inBs.value = BCV.usdToBs(dueUSD).toFixed(2);

      inUSD.oninput = () => {
        inBs.value = BCV.usdToBs(inUSD.value).toFixed(2);
      };
      inBs.oninput = () => {
        inUSD.value = BCV.bsToUSD(inBs.value).toFixed(2);
      };

      const selSeller = document.getElementById('abono-seller');
      if (selSeller) {
        const sellers = await Sellers.getAll();
        selSeller.innerHTML = sellers.filter(s => s.active).map(s => `<option value="${s.name}">${s.name}</option>`).join('');
      }

      this.openModal('modal-add-payment');
    },

    updateAbonoDisplays() {
      const totals = POS.getTotals();
      const inUSD = document.getElementById('pos-abono-amount-usd');
      const depositUSD = inUSD ? Math.max(0, parseFloat(inUSD.value) || 0) : 0;
      const dueUSD = Math.max(0, Number((totals.totalUSD - depositUSD).toFixed(2)));

      const elTot = document.getElementById('pos-abono-total-display');
      const elPaid = document.getElementById('pos-abono-paid-display');
      const elDue = document.getElementById('pos-abono-due-display');

      if (elTot) elTot.textContent = `${BCV.formatUSD(totals.totalUSD)} (${BCV.formatBs(totals.totalBs)})`;
      if (elPaid) elPaid.textContent = `${BCV.formatUSD(depositUSD)} (${BCV.formatBs(BCV.usdToBs(depositUSD))})`;
      if (elDue) elDue.textContent = `${BCV.formatUSD(dueUSD)} (${BCV.formatBs(BCV.usdToBs(dueUSD))})`;
    },

    showTicket(sale) {
      this.state.currentTicket = sale;
      const c = document.getElementById('modal-ticket-content');
      if (c) c.innerHTML = Sales.generateTicket(sale, this.state.company);
      this.openModal('modal-ticket');
    },

    // ---- VISTA: VENDEDORES ----
    async renderSellers() {
      const tbody = document.getElementById('sellers-table-body');
      if (!tbody) return;
      const perf = await Sellers.getPerformance('MONTH');

      tbody.innerHTML = perf.map(s => `
        <tr>
          <td><strong>${s.name}</strong></td>
          <td><code style="color: var(--primary); font-weight: 700;">${s.username || '-'}</code></td>
          <td><span class="status-pill ${s.role === 'Administrador' ? 'pill-success' : 'pill-purple'}">${s.role}</span></td>
          <td><strong>${s.salesCount} ventas</strong></td>
          <td><strong style="color: var(--primary);">${BCV.formatUSD(s.totalUSD)}</strong></td>
          <td><strong>${BCV.formatBs(s.totalBs)}</strong></td>
          <td>${s.totalItems} unidades</td>
          <td>${s.active ? '<span class="status-pill pill-success">🟢 Activo</span>' : '<span class="status-pill pill-danger">🔴 Bloqueado</span>'}</td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 6px;">
              <button class="btn ${s.active ? 'btn-secondary' : 'btn-primary'} btn-sm btn-toggle-seller" data-id="${s.id}" data-active="${s.active}" title="${s.active ? 'Bloquear acceso de este usuario' : 'Desbloquear y permitir acceso'}">
                ${s.active ? '🔒 Bloquear' : '🔓 Desbloquear'}
              </button>
              <button class="btn btn-secondary btn-sm btn-edit-seller" data-id="${s.id}" title="Editar Clave / Datos">✏️</button>
              <button class="btn btn-danger btn-sm btn-del-seller" data-id="${s.id}" title="Eliminar">🗑️</button>
            </div>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.btn-toggle-seller').forEach(b => {
        b.addEventListener('click', async () => {
          const id = b.getAttribute('data-id');
          const isCurrentlyActive = b.getAttribute('data-active') === 'true';
          const s = perf.find(x => x.id === id);
          const actionText = isCurrentlyActive ? 'bloquear el acceso a' : 'desbloquear y reactivar a';
          if (s && confirm(`¿Desea ${actionText} "${s.name}"?`)) {
            try {
              await Sellers.toggleActive(id, !isCurrentlyActive);
              this.toast(`Usuario "${s.name}" ${isCurrentlyActive ? 'bloqueado' : 'activado'} con éxito.`, 'info');
              await this.renderSellers();
              await this.renderPOSSellers();
              await this.populateLoginUserSelect();
            } catch (err) {
              this.toast(err.message, 'error');
            }
          }
        });
      });

      tbody.querySelectorAll('.btn-edit-seller').forEach(b => {
        b.addEventListener('click', () => {
          const s = perf.find(x => x.id === b.getAttribute('data-id'));
          if (s) this.openSellerModal(s);
        });
      });

      tbody.querySelectorAll('.btn-del-seller').forEach(b => {
        b.addEventListener('click', async () => {
          const id = b.getAttribute('data-id');
          const s = perf.find(x => x.id === id);
          if (s && confirm(`¿Eliminar al vendedor "${s.name}"?`)) {
            try {
              await Sellers.remove(id);
              this.toast('Vendedor eliminado con éxito.', 'info');
              await this.renderSellers();
              await this.renderPOSSellers();
              await this.populateLoginUserSelect();
            } catch (err) {
              this.toast(err.message, 'warning');
            }
          }
        });
      });
    },

    openSellerModal(seller = null) {
      const form = document.getElementById('form-seller');
      if (!form) return;
      const title = document.getElementById('modal-seller-title');
      if (seller) {
        title.textContent = 'Editar Vendedor / Usuario';
        document.getElementById('seller-form-id').value = seller.id;
        document.getElementById('seller-form-name').value = seller.name;
        document.getElementById('seller-form-username').value = seller.username || '';
        document.getElementById('seller-form-password').value = seller.password || '';
        document.getElementById('seller-form-role').value = seller.role || 'Vendedor';
        const chk = document.getElementById('seller-form-active');
        if (chk) chk.checked = seller.active !== false;
      } else {
        title.textContent = 'Registrar Vendedor / Usuario';
        form.reset();
        document.getElementById('seller-form-id').value = '';
        document.getElementById('seller-form-role').value = 'Vendedor';
        const chk = document.getElementById('seller-form-active');
        if (chk) chk.checked = true;
      }
      this.openModal('modal-seller');
    },

    // ---- VISTA: DASHBOARD ----
    async renderDashboard() {
      const today = await Sales.filter({ period: 'TODAY' });
      document.getElementById('kpi-today-usd').textContent = BCV.formatUSD(today.metrics.totalUSD);
      document.getElementById('kpi-today-bs').textContent = BCV.formatBs(today.metrics.totalBs);
      document.getElementById('kpi-today-count').textContent = `${today.metrics.count} ventas realizadas hoy`;

      const week = await Sales.filter({ period: 'WEEK' });
      document.getElementById('kpi-week-usd').textContent = BCV.formatUSD(week.metrics.totalUSD);
      document.getElementById('kpi-week-bs').textContent = BCV.formatBs(week.metrics.totalBs);
      document.getElementById('kpi-week-count').textContent = `${week.metrics.count} ventas esta semana`;

      const month = await Sales.filter({ period: 'MONTH' });
      document.getElementById('kpi-month-usd').textContent = BCV.formatUSD(month.metrics.totalUSD);
      document.getElementById('kpi-month-bs').textContent = BCV.formatBs(month.metrics.totalBs);
      document.getElementById('kpi-month-count').textContent = `${month.metrics.count} ventas este mes`;

      const prods = await Inventory.getAll();
      const low = prods.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
      const out = prods.filter(p => p.stock <= 0).length;
      document.getElementById('kpi-low-stock-count').textContent = low;
      document.getElementById('kpi-out-stock-count').textContent = `${out} agotados`;

      const canvas = document.getElementById('sales-trend-canvas');
      if (canvas) {
        const all = await DB.getAll('sales');
        Reports.renderChart(canvas, all);
      }

      const topList = document.getElementById('dash-top-sellers-list');
      if (topList) {
        const perf = await Sellers.getPerformance('MONTH');
        topList.innerHTML = perf.slice(0, 5).map((s, idx) => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--bg-card); border-radius: var(--radius-md);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-weight: 800; color: var(--primary); font-size: 0.95rem;">#${idx + 1}</span>
              <div>
                <div style="font-weight: 700; font-size: 0.9rem;">${s.name}</div>
                <small style="color: var(--text-dim);">${s.salesCount} ventas</small>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 800; color: var(--primary);">${BCV.formatUSD(s.totalUSD)}</div>
              <small style="color: var(--text-muted);">${BCV.formatBs(s.totalBs)}</small>
            </div>
          </div>
        `).join('');
      }
    },

    // ---- VISTA: CONFIGURACIÓN ----
    async renderSettings() {
      const cfg = await DB.getById('settings', 'app_config');
      if (cfg) {
        this.state.company = {
          businessName: cfg.businessName || 'FullHouse Inversiones C.A',
          rif: cfg.rif || 'J-50123456-7',
          phone: cfg.phone || '0414-1234567',
          address: cfg.address || 'Venezuela'
        };
        const n = document.getElementById('setting-company-name');
        const r = document.getElementById('setting-company-rif');
        const p = document.getElementById('setting-company-phone');
        const a = document.getElementById('setting-company-address');
        if (n) n.value = this.state.company.businessName;
        if (r) r.value = this.state.company.rif;
        if (p) p.value = this.state.company.phone;
        if (a) a.value = this.state.company.address;
      }
    },

    // ---- EVENTOS GLOBALES ----
    bindEvents() {
      // Navegación
      document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => this.switchTab(btn.getAttribute('data-tab')));
      });

      // Modales: cerrar
      document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-modal') || btn.closest('.modal-overlay')?.id;
          if (id) this.closeModal(id);
        });
      });
      document.querySelectorAll('.modal-overlay').forEach(ov => {
        ov.addEventListener('click', (e) => {
          if (e.target === ov) this.closeModal(ov.id);
        });
      });

      // BCV: Actualizar en Header
      document.getElementById('btn-sync-bcv')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-sync-bcv');
        btn.classList.add('sync-spin');
        this.toast('Consultando tasa oficial del BCV...', 'info');
        const res = await BCV.fetchFromAPI(true);
        btn.classList.remove('sync-spin');
        if (res.success) {
          this.toast(`Tasa BCV actualizada: 1 USD = ${BCV.formatBs(res.rate)}`, 'success');
        } else {
          this.toast(`Sin conexión en línea. Conservando última tasa (${BCV.formatBs(res.rate)}).`, 'warning');
        }
      });

      // BCV: Actualizar en Configuración
      document.getElementById('settings-btn-sync-api')?.addEventListener('click', async () => {
        const b = document.getElementById('settings-btn-sync-api');
        b.disabled = true;
        this.toast('Consultando servidor oficial del BCV...', 'info');
        const res = await BCV.fetchFromAPI(true);
        b.disabled = false;
        if (res.success) {
          this.toast(`Tasa oficial actualizada a ${BCV.formatBs(res.rate)}`, 'success');
        } else {
          this.toast(`No se pudo conectar a la API del BCV: ${res.error}.`, 'warning');
        }
      });

      // POS: Eventos
      document.getElementById('pos-search-input')?.addEventListener('input', () => this.renderPOSProducts());
      document.getElementById('pos-clear-search')?.addEventListener('click', () => {
        const inp = document.getElementById('pos-search-input');
        if (inp) { inp.value = ''; inp.focus(); this.renderPOSProducts(); }
      });
      document.getElementById('pos-btn-clear-cart')?.addEventListener('click', () => {
        if (POS.getCart().length > 0) {
          POS.clearCart();
          this.renderPOSCart();
          this.toast('Carrito vaciado.', 'info');
        }
      });

      // POS: Desplazamiento rápido al carrito en Celulares
      document.getElementById('btn-mobile-scroll-cart')?.addEventListener('click', () => {
        const cartEl = document.getElementById('pos-cart-panel');
        if (cartEl) cartEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      // POS: Eventos de Método de Pago y Abono
      const paySelect = document.getElementById('pos-payment-method');
      paySelect?.addEventListener('change', () => {
        const isAbono = paySelect.value === 'Abono';
        const panel = document.getElementById('pos-abono-panel');

        if (panel) panel.style.display = isAbono ? 'flex' : 'none';

        if (isAbono) {
          const totals = POS.getTotals();
          const inUSD = document.getElementById('pos-abono-amount-usd');
          const inBs = document.getElementById('pos-abono-amount-bs');
          if (inUSD && (!inUSD.value || parseFloat(inUSD.value) === 0)) {
            const half = Number((totals.totalUSD / 2).toFixed(2));
            inUSD.value = half > 0 ? half.toFixed(2) : '0.00';
            if (inBs) inBs.value = BCV.usdToBs(half).toFixed(2);
          }
          this.updateAbonoDisplays();
        }
      });

      const abonoUSD = document.getElementById('pos-abono-amount-usd');
      const abonoBs = document.getElementById('pos-abono-amount-bs');

      abonoUSD?.addEventListener('input', () => {
        const usdVal = parseFloat(abonoUSD.value) || 0;
        if (abonoBs) abonoBs.value = BCV.usdToBs(usdVal).toFixed(2);
        this.updateAbonoDisplays();
      });

      abonoBs?.addEventListener('input', () => {
        const bsVal = parseFloat(abonoBs.value) || 0;
        if (abonoUSD) abonoUSD.value = BCV.bsToUSD(bsVal).toFixed(2);
        this.updateAbonoDisplays();
      });

      // POS: Checkout
      document.getElementById('btn-pos-checkout')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-pos-checkout');
        const selSel = document.getElementById('pos-seller-select');
        const currentUser = Auth.getCurrentUser();

        let sellerId = selSel ? selSel.value : null;
        let sellerName = selSel && selSel.selectedOptions[0] ? selSel.selectedOptions[0].textContent.split('(')[0].trim() : 'Vendedor';

        // Si el usuario actual es Vendedor, fijar estrictamente su propia cuenta
        if (currentUser && currentUser.role === 'Vendedor') {
          sellerId = currentUser.id;
          sellerName = currentUser.name;
        }
        const clientName = document.getElementById('pos-client-name')?.value?.trim() || '';
        const clientCedula = document.getElementById('pos-client-cedula')?.value?.trim() || '';
        const clientPhone = document.getElementById('pos-client-phone')?.value?.trim() || '';
        const paymentMethod = document.getElementById('pos-payment-method')?.value || 'Dólares Efectivo';
        const initialDepositUSD = document.getElementById('pos-abono-amount-usd')?.value || 0;

        try {
          btn.disabled = true;
          const sale = await POS.checkout({
            sellerId,
            sellerName,
            clientName,
            clientCedula,
            clientPhone,
            paymentMethod,
            initialDepositUSD
          });

          document.getElementById('pos-client-name').value = '';
          const pCed = document.getElementById('pos-client-cedula');
          if (pCed) pCed.value = '';
          const pPhone = document.getElementById('pos-client-phone');
          if (pPhone) pPhone.value = '';
          const pDep = document.getElementById('pos-abono-amount-usd');
          if (pDep) pDep.value = '';
          const pDepBs = document.getElementById('pos-abono-amount-bs');
          if (pDepBs) pDepBs.value = '';

          const abonoMsg = sale.balanceDueUSD > 0
            ? ` ¡Venta a crédito registrada! Quedan pendientes ${BCV.formatUSD(sale.balanceDueUSD)} (${BCV.formatBs(sale.balanceDueBs)}).`
            : '';

          this.toast(`¡Venta ${sale.saleNumber} procesada! Stock descontado automáticamente.${abonoMsg}`, 'success', 5000);
          this.showTicket(sale);
          this.renderPOS();
          this.checkLowStock();
        } catch (err) {
          this.toast(err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      });

      // Imprimir Ticket
      document.getElementById('btn-print-ticket')?.addEventListener('click', () => window.print());

      // Categorías de Productos (Gestión, Edición, Creación, Borrado)
      document.getElementById('btn-open-categories-modal')?.addEventListener('click', () => this.openCategoriesModal());
      document.getElementById('btn-quick-add-cat')?.addEventListener('click', () => this.openCategoriesModal());

      document.getElementById('form-category')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('cat-form-id').value || undefined;
        const name = document.getElementById('cat-form-name').value;
        const icon = document.getElementById('cat-form-icon').value;
        const description = document.getElementById('cat-form-desc').value;

        try {
          const res = await Categories.save({ id, name, icon, description });
          const isEdit = !!id;
          const extra = res.cascadeCount > 0 ? ` (${res.cascadeCount} productos actualizados)` : '';
          this.toast(`Categoría "${res.category.name}" ${isEdit ? 'actualizada' : 'creada'} con éxito.${extra}`, 'success');

          const form = document.getElementById('form-category');
          form.reset();
          document.getElementById('cat-form-id').value = '';
          document.getElementById('cat-form-icon').value = '🏷️';
          document.getElementById('cat-form-title').textContent = '➕ Agregar Nueva Categoría';
          document.getElementById('btn-save-cat').textContent = '💾 Guardar Categoría';
          const btnCancel = document.getElementById('btn-cancel-cat-edit');
          if (btnCancel) btnCancel.style.display = 'none';

          await this.renderCategories();
          await this.renderPOSCategories();
          await this.renderInventoryCategories();
          this.renderInventory();
          this.renderPOS();
        } catch (err) {
          this.toast(err.message, 'error');
        }
      });

      document.getElementById('btn-cancel-cat-edit')?.addEventListener('click', () => {
        const form = document.getElementById('form-category');
        if (form) form.reset();
        document.getElementById('cat-form-id').value = '';
        document.getElementById('cat-form-icon').value = '🏷️';
        document.getElementById('cat-form-title').textContent = '➕ Agregar Nueva Categoría';
        document.getElementById('btn-save-cat').textContent = '💾 Guardar Categoría';
        document.getElementById('btn-cancel-cat-edit').style.display = 'none';
      });

      document.getElementById('btn-reset-default-cats')?.addEventListener('click', async () => {
        if (confirm('¿Desea cargar las categorías recomendadas de la tienda (Televisores, Cocinas, Muebles, Neveras, Aires, Licuadoras, etc.)?')) {
          try {
            await Categories.seedDefaults();
            this.toast('Categorías de tienda cargadas exitosamente.', 'success');
            await this.renderCategories();
            await this.renderPOSCategories();
            await this.renderInventoryCategories();
            this.renderInventory();
            this.renderPOS();
          } catch (err) {
            this.toast(err.message, 'error');
          }
        }
      });

      // Inventario: Guardar Producto
      document.getElementById('btn-new-product')?.addEventListener('click', () => this.openProductModal(null));
      document.getElementById('form-product')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
          id: document.getElementById('prod-form-id').value || undefined,
          code: document.getElementById('prod-form-code').value,
          category: document.getElementById('prod-form-category').value,
          name: document.getElementById('prod-form-name').value,
          stock: document.getElementById('prod-form-stock').value,
          minStock: document.getElementById('prod-form-minstock').value,
          costUSD: document.getElementById('prod-form-cost').value,
          priceUSD: document.getElementById('prod-form-price').value,
          notes: document.getElementById('prod-form-notes').value
        };
        try {
          await Inventory.save(data);
          this.closeModal('modal-product');
          this.toast('Producto guardado correctamente.', 'success');
          this.renderInventory();
          this.renderPOS();
        } catch (err) {
          this.toast(err.message, 'error');
        }
      });

      // Inventario: Guardar Precio Rápido
      document.getElementById('form-quick-price')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('quick-price-prod-id').value;
        const usd = document.getElementById('quick-price-usd').value;
        try {
          const upd = await Inventory.updatePrice(id, usd);
          this.closeModal('modal-quick-price');
          this.toast(`Precio de "${upd.name}" actualizado a ${BCV.formatUSD(upd.priceUSD)} (${BCV.formatBs(BCV.usdToBs(upd.priceUSD))}).`, 'success');
          this.renderInventory();
          this.renderPOS();
        } catch (err) {
          this.toast(err.message, 'error');
        }
      });

      // Inventario: Filtros y CSV
      document.getElementById('inv-search-input')?.addEventListener('input', () => this.renderInventoryTable());
      document.getElementById('inv-filter-category')?.addEventListener('change', () => this.renderInventoryTable());
      document.getElementById('inv-filter-stock')?.addEventListener('change', () => this.renderInventoryTable());
      document.getElementById('btn-export-inventory-csv')?.addEventListener('click', () => {
        Reports.exportInventory();
        this.toast('Inventario exportado a CSV.', 'success');
      });

      // Movimientos: Eventos
      document.getElementById('btn-open-movement-modal')?.addEventListener('click', () => this.openMovementModal());
      document.getElementById('btn-quick-movement')?.addEventListener('click', () => this.openMovementModal());
      document.getElementById('btn-export-movements-csv')?.addEventListener('click', () => {
        Reports.exportMovements();
        this.toast('Movimientos exportados a CSV.', 'success');
      });
      document.getElementById('form-movement')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pId = document.getElementById('mov-form-product').value;
        const type = document.getElementById('mov-form-type').value;
        const qty = document.getElementById('mov-form-quantity').value;
        const reason = document.getElementById('mov-form-reason').value;
        const user = document.getElementById('mov-form-user').value;
        const notes = document.getElementById('mov-form-notes').value;
        try {
          await Inventory.registerStockInOrOut({ productId: pId, type, quantity: qty, reason, user, notes });
          this.closeModal('modal-movement');
          this.toast('Movimiento registrado y stock actualizado.', 'success');
          this.renderMovements();
          this.renderInventory();
          this.renderPOS();
        } catch (err) {
          this.toast(err.message, 'error');
        }
      });

      // Ventas: Filtros y CSV
      document.querySelectorAll('.sales-period-btn').forEach(b => {
        b.addEventListener('click', () => {
          document.querySelectorAll('.sales-period-btn').forEach(btn => btn.classList.remove('active'));
          b.classList.add('active');
          this.state.salesPeriod = b.getAttribute('data-period');
          this.renderSales();
        });
      });
      document.getElementById('sales-filter-seller')?.addEventListener('change', () => this.renderSales());
      document.getElementById('sales-search-input')?.addEventListener('input', () => this.renderSales());
      document.getElementById('btn-export-sales-csv')?.addEventListener('click', async () => {
        const { sales } = await Sales.filter({ period: this.state.salesPeriod });
        Reports.exportSales(sales);
        this.toast('Ventas exportadas a CSV.', 'success');
      });

      // Registrar Nuevo Abono a una venta
      document.getElementById('form-add-payment')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saleId = document.getElementById('abono-sale-id').value;
        const amountUSD = document.getElementById('abono-input-usd').value;
        const paymentMethod = document.getElementById('abono-payment-method').value;
        const sellerName = document.getElementById('abono-seller').value;
        const note = document.getElementById('abono-notes').value;

        try {
          const updatedSale = await Sales.addPayment(saleId, { amountUSD, paymentMethod, sellerName, note });
          this.closeModal('modal-add-payment');
          const remainingMsg = updatedSale.balanceDueUSD > 0
            ? `Quedan pendientes ${BCV.formatUSD(updatedSale.balanceDueUSD)} (${BCV.formatBs(updatedSale.balanceDueBs)}).`
            : '¡La cuenta ha quedado TOTALMENTE SALDADA!';
          this.toast(`Abono registrado con éxito. ${remainingMsg}`, 'success', 5000);
          this.showTicket(updatedSale);
          this.renderSales();
          this.renderDashboard();
        } catch (err) {
          this.toast(err.message, 'error');
        }
      });

      // Vendedores: Guardar
      document.getElementById('btn-new-seller')?.addEventListener('click', () => this.openSellerModal(null));
      document.getElementById('form-seller')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('seller-form-id').value;
        const name = document.getElementById('seller-form-name').value;
        const username = document.getElementById('seller-form-username').value;
        const password = document.getElementById('seller-form-password').value;
        const role = document.getElementById('seller-form-role').value;
        const active = document.getElementById('seller-form-active')?.checked !== false;

        try {
          const saved = await Sellers.save({ id: id || undefined, name, username, password, role, active });
          this.closeModal('modal-seller');
          this.toast('Vendedor / Usuario guardado con éxito.', 'success');
          this.renderSellers();
          this.renderPOSSellers();

          // Si el usuario editó su propia cuenta, refrescar la sesión activa
          const current = Auth.getCurrentUser();
          if (current && current.id === saved.id) {
            Auth.setCurrentUser(saved);
            this.checkAuthAndApplyRole();
          }
        } catch (err) {
          this.toast(err.message, 'error');
        }
      });

      // Dashboard: Accesos rápidos
      document.getElementById('dash-btn-today')?.addEventListener('click', () => {
        this.switchTab('sales');
        document.querySelector('.sales-period-btn[data-period="TODAY"]')?.click();
      });
      document.getElementById('dash-btn-week')?.addEventListener('click', () => {
        this.switchTab('sales');
        document.querySelector('.sales-period-btn[data-period="WEEK"]')?.click();
      });
      document.getElementById('dash-btn-month')?.addEventListener('click', () => {
        this.switchTab('sales');
        document.querySelector('.sales-period-btn[data-period="MONTH"]')?.click();
      });

      // Configuración: Guardar Datos Empresa
      document.getElementById('form-company-settings')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cfg = (await DB.getById('settings', 'app_config')) || { key: 'app_config' };
        cfg.businessName = document.getElementById('setting-company-name').value;
        cfg.rif = document.getElementById('setting-company-rif').value;
        cfg.phone = document.getElementById('setting-company-phone').value;
        cfg.address = document.getElementById('setting-company-address').value;
        await DB.put('settings', cfg);
        this.state.company = cfg;
        this.toast('Datos de la empresa guardados.', 'success');
      });

      // Respaldos: Exportar JSON
      document.getElementById('btn-export-backup-json')?.addEventListener('click', async () => {
        try {
          const data = await DB.exportBackup();
          const dStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Respaldo_FullHouse_${dStr}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          this.toast('Copia de seguridad descargada (JSON).', 'success');
        } catch (err) {
          this.toast('Error exportando respaldo: ' + err.message, 'error');
        }
      });

      // Respaldos: Importar JSON
      const fIn = document.getElementById('input-import-backup');
      document.getElementById('btn-trigger-import')?.addEventListener('click', () => {
        if (confirm('ADVERTENCIA: Restaurar un respaldo reemplazará los datos actuales por los del archivo. ¿Continuar?')) {
          fIn?.click();
        }
      });
      fIn?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const txt = await file.text();
          const json = JSON.parse(txt);
          await DB.importBackup(json);
          this.toast('¡Base de datos restaurada con éxito!', 'success');
          setTimeout(() => location.reload(), 1200);
        } catch (err) {
          this.toast('Error al restaurar: ' + err.message, 'error');
        } finally {
          fIn.value = '';
        }
      });

      // Reset Demo
      document.getElementById('btn-reset-demo-data')?.addEventListener('click', async () => {
        if (confirm('¿Restablecer los datos demostrativos iniciales de FullHouse Inversiones (TVs, Neveras, Cocinas, Muebles, etc.)?')) {
          const db = await DB.getDB();
          await new Promise((res, rej) => {
            const tx = db.transaction(['products', 'categories', 'movements', 'sales'], 'readwrite');
            tx.objectStore('products').clear();
            tx.objectStore('categories').clear();
            tx.objectStore('movements').clear();
            tx.objectStore('sales').clear();
            tx.oncomplete = () => res();
            tx.onerror = () => rej(tx.error);
          });
          await DB.seedInitialDataIfEmpty();
          this.toast('Datos de tienda restablecidos correctamente.', 'info');
          setTimeout(() => location.reload(), 1000);
        }
      });

      // Configuración de Supabase (Autenticación en la Nube)
      document.getElementById('form-supabase-config')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = document.getElementById('supabase-input-url')?.value;
        const key = document.getElementById('supabase-input-key')?.value;
        SupabaseService.saveConfig(url, key);

        if (url && key) {
          try {
            this.toast('Conectando con Supabase y sincronizando usuarios...', 'info');
            await SupabaseService.testConnection();
            SupabaseService.updateStatusBadge(true);
            this.toast('✅ ¡Conexión con Supabase exitosa! Base de datos de usuarios en la nube conectada.', 'success', 5000);
            await Sellers.getAll();
            await this.renderSellers();
            await this.renderPOSSellers();
            await this.populateLoginUserSelect();
          } catch (err) {
            SupabaseService.updateStatusBadge(false);
            this.toast(`⚠️ Guardado, pero hubo un error de conexión: ${err.message}`, 'warning', 7000);
          }
        } else {
          SupabaseService.updateStatusBadge();
          this.toast('Configuración guardada en Modo Local (sin nube).', 'info');
        }
      });

      // Supabase: Probar Conexión
      document.getElementById('btn-test-supabase')?.addEventListener('click', async () => {
        const url = document.getElementById('supabase-input-url')?.value;
        const key = document.getElementById('supabase-input-key')?.value;
        if (!url || !key) {
          this.toast('Ingrese la URL del proyecto y la Anon Key de Supabase primero.', 'warning');
          return;
        }
        SupabaseService.saveConfig(url, key);
        try {
          this.toast('Probando conexión con Supabase...', 'info');
          await SupabaseService.testConnection();
          SupabaseService.updateStatusBadge(true);
          this.toast('✅ ¡Prueba exitosa! Conectado correctamente a la tabla de usuarios en Supabase.', 'success');
        } catch (err) {
          SupabaseService.updateStatusBadge(false);
          this.toast(`❌ Falló la prueba de conexión: ${err.message}`, 'error', 7000);
        }
      });

      // Supabase: Copiar Script SQL al Portapapeles
      document.getElementById('btn-copy-supabase-sql')?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(SupabaseService.SQL_SCHEMA);
          this.toast('📋 Script SQL copiado al portapapeles. Péguelo en el SQL Editor de Supabase.', 'success', 5000);
        } catch (e) {
          prompt('Copie el siguiente código SQL para Supabase:', SupabaseService.SQL_SCHEMA);
        }
      });

      // Tema Oscuro / Claro
      const thBtn = document.getElementById('btn-theme-toggle');
      if (localStorage.getItem('fh_theme') === 'light') {
        document.body.classList.add('light-theme');
        if (thBtn) thBtn.textContent = '☀️';
      }
      thBtn?.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isL = document.body.classList.contains('light-theme');
        localStorage.setItem('fh_theme', isL ? 'light' : 'dark');
        thBtn.textContent = isL ? '☀️' : '🌙';
      });

      // Login: Enviar formulario
      document.getElementById('form-login')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userIdentifier = document.getElementById('login-user-select')?.value;
        const password = document.getElementById('login-password')?.value;
        try {
          const user = await Auth.login(userIdentifier, password);
          this.toast(`¡Bienvenido/a, ${user.name}!`, 'success');
          const pwdIn = document.getElementById('login-password');
          if (pwdIn) pwdIn.value = '';
          await this.checkAuthAndApplyRole();
          await this.renderPOS();
        } catch (err) {
          this.toast(err.message, 'error');
          playSound('error');
        }
      });

      // Login: Toggle ver contraseña
      document.getElementById('login-toggle-pwd')?.addEventListener('click', () => {
        const pwdInput = document.getElementById('login-password');
        const toggleBtn = document.getElementById('login-toggle-pwd');
        if (!pwdInput) return;
        if (pwdInput.type === 'password') {
          pwdInput.type = 'text';
          if (toggleBtn) toggleBtn.textContent = '🙈 Ocultar';
        } else {
          pwdInput.type = 'password';
          if (toggleBtn) toggleBtn.textContent = '👁️ Mostrar';
        }
      });

      // Logout: Cerrar Sesión desde el encabezado
      document.getElementById('btn-header-logout')?.addEventListener('click', () => {
        if (confirm('¿Desea cerrar la sesión actual?')) {
          Auth.logout();
          this.toast('Sesión cerrada correctamente.', 'info');
          this.checkAuthAndApplyRole();
        }
      });
    },

    async populateLoginUserSelect() {
      const sel = document.getElementById('login-user-select');
      if (!sel) return;
      const sellers = await Sellers.getAll();
      const active = sellers.filter(s => s.active);
      sel.innerHTML = active.map(s => {
        const icon = s.role === 'Administrador' ? '👑' : '🛒';
        const uName = s.username || s.name.split(' ')[0].toLowerCase();
        return `<option value="${s.username || s.id}">${icon} ${s.name} (${s.role}) - usuario: ${uName}</option>`;
      }).join('');
    },

    async checkAuthAndApplyRole() {
      const user = Auth.getCurrentUser();
      const modalLogin = document.getElementById('modal-login');
      const logoutBtn = document.getElementById('btn-header-logout');
      const badgeName = document.getElementById('header-user-name');
      const badgeRole = document.getElementById('header-user-role');

      if (!user) {
        if (modalLogin) {
          await this.populateLoginUserSelect();
          modalLogin.classList.add('active');
          setTimeout(() => document.getElementById('login-password')?.focus(), 200);
        }
        if (badgeName) badgeName.textContent = '👤 Sin Sesión';
        if (badgeRole) {
          badgeRole.textContent = 'Bloqueado';
          badgeRole.className = 'status-pill pill-danger';
        }
        if (logoutBtn) logoutBtn.style.display = 'none';

        // Ocultar pestañas mientras no haya sesión
        document.querySelectorAll('.nav-tab-btn').forEach(b => b.style.display = 'none');
        return;
      }

      // Sesión iniciada
      if (modalLogin) modalLogin.classList.remove('active');
      if (logoutBtn) logoutBtn.style.display = 'inline-flex';
      if (badgeName) badgeName.textContent = `👤 ${user.name}`;
      if (badgeRole) {
        const isAdmin = user.role === 'Administrador';
        badgeRole.textContent = isAdmin ? 'Administrador' : 'Vendedor';
        badgeRole.className = `status-pill ${isAdmin ? 'pill-success' : 'pill-purple'}`;
      }

      this.applyRoleRestrictions(user);
    },

    applyRoleRestrictions(user) {
      const isAdmin = user.role === 'Administrador';

      // 1. Visibilidad de pestañas
      const adminTabs = ['dashboard', 'inventory', 'movements', 'sales', 'sellers', 'settings'];
      adminTabs.forEach(tabKey => {
        const btn = document.getElementById(`tab-${tabKey}-btn`);
        if (btn) btn.style.display = isAdmin ? 'inline-flex' : 'none';
      });

      const posBtn = document.getElementById('tab-pos-btn');
      if (posBtn) posBtn.style.display = 'inline-flex';

      // 2. Si es vendedor, forzar a estar en Punto de Venta
      if (!isAdmin && this.state.currentTab !== 'pos') {
        this.switchTab('pos');
      }

      // 3. Bloquear selector de vendedor para vendedores
      const posSellerSelect = document.getElementById('pos-seller-select');
      if (posSellerSelect) {
        if (!isAdmin) {
          posSellerSelect.value = user.id;
          posSellerSelect.disabled = true;
          posSellerSelect.style.opacity = '0.9';
          posSellerSelect.title = 'Vendedor fijado automáticamente a tu cuenta';
        } else {
          posSellerSelect.disabled = false;
          posSellerSelect.style.opacity = '1';
          if (!posSellerSelect.value) posSellerSelect.value = user.id;
        }
      }
    },

    async init() {
      // 1. Inicializar Tasa BCV y suscripción de UI
      BCV.subscribe((rate, lastUpdate) => {
        const hRate = document.getElementById('header-bcv-rate');
        if (hRate) hRate.textContent = BCV.formatBs(rate);

        const sRate = document.getElementById('settings-current-rate-display');
        if (sRate) sRate.textContent = BCV.formatBs(rate);

        const sTime = document.getElementById('settings-rate-update-time');
        if (sTime) {
          sTime.textContent = lastUpdate
            ? 'Última actualización: ' + new Date(lastUpdate).toLocaleString('es-VE')
            : 'Tasa local activa';
        }

        this.updateCartTotals();
        if (this.state.currentTab === 'pos') this.renderPOSProducts();
        if (this.state.currentTab === 'inventory') this.renderInventory();
      });

      // 2. Base de Datos Local
      await DB.getDB();
      await DB.seedInitialDataIfEmpty();

      // 3. Tasa de cambio
      await BCV.init();

      // 4. Servicio en la Nube Supabase (Cargar configuración y probar en segundo plano)
      SupabaseService.initClient();
      const cfg = SupabaseService.getConfig();
      const urlIn = document.getElementById('supabase-input-url');
      const keyIn = document.getElementById('supabase-input-key');
      if (urlIn && cfg.url) urlIn.value = cfg.url;
      if (keyIn && cfg.key) keyIn.value = cfg.key;
      SupabaseService.updateStatusBadge();

      // Si hay credenciales guardadas, probar conexión y activar sincronización en tiempo real
      if (SupabaseService.isConnected()) {
        SupabaseService.testConnection()
          .then(async () => {
            SupabaseService.updateStatusBadge(true);
            await Sellers.getAll(); // Sincroniza catálogo de usuarios de la nube
            if (this.state.currentTab === 'sellers') await this.renderSellers();
            await this.renderPOSSellers();
            await this.populateLoginUserSelect();
          })
          .catch((err) => {
            console.warn('Verificación inicial de Supabase falló (modo local activo):', err.message);
            SupabaseService.updateStatusBadge(false);
          });

        // Configurar escucha en tiempo real para reflejar cambios del admin al instante
        SupabaseService.setupRealtime(async (payload) => {
          const curUser = Auth.getCurrentUser();
          if (curUser) {
            if (payload.eventType === 'DELETE' && payload.old && payload.old.id === curUser.id) {
              Auth.logout();
              this.toast('⚠️ Su usuario fue eliminado por el Administrador.', 'error', 10000);
              await this.checkAuthAndApplyRole();
              return;
            }
            if (payload.eventType === 'UPDATE' && payload.new && payload.new.id === curUser.id) {
              if (payload.new.active === false) {
                Auth.logout();
                this.toast('⛔ Su cuenta de usuario fue BLOQUEADA por el Administrador.', 'error', 10000);
                await this.checkAuthAndApplyRole();
                return;
              } else {
                Auth.setCurrentUser(payload.new);
              }
            }
          }
          await Sellers.getAll();
          if (this.state.currentTab === 'sellers') await this.renderSellers();
          await this.renderPOSSellers();
          await this.populateLoginUserSelect();
        });
      }

      // 5. Configurar eventos de la interfaz
      this.bindEvents();

      // 6. Verificar sesión y permisos
      await this.checkAuthAndApplyRole();

      // 7. Cargar vista inicial (Punto de Venta)
      await this.renderPOS();
      await this.checkLowStock();
    }
  };

  // Arrancar automáticamente al cargar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }

  // Exponer para depuración en consola si se desea
  window.FullHouseApp = { DB, BCV, Inventory, Categories, POS, Sales, Sellers, SupabaseService, Reports, App };
})();

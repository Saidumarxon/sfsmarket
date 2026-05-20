/* ========================================
   EMIRATE CO — Admin Panel Logic
   ======================================== */

// ===== AUTH CHECK =====
function parseAdminSession() {
  const raw = localStorage.getItem('emirate_admin');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

const adminSession = parseAdminSession();
if (!adminSession) {
  window.location.href = 'login.html';
}

const adminIdentity = String(adminSession?.role || adminSession?.user || '').toLowerCase();
const canManageBanners = /admin/.test(adminIdentity);
const ADMIN_SUPPLIERS_KEY = 'emirate_admin_suppliers';

// ===== SIDEBAR NAV =====
const sidebarLinks = document.querySelectorAll('.sidebar-link[data-page]');
const pages = document.querySelectorAll('.admin-page');
const pageTitle = document.getElementById('pageTitle');

const pageTitles = {
  dashboard: 'Дашборд',
  orders: 'CRM / Заказы',
  clients: 'Клиенты',
  suppliers: 'Поставщики',
  products: 'Продукты',
  banners: 'Баннеры',
  finance: 'Финансы',
  'product-editor': 'Продукты › Добавить',
};

function switchPage(pageName) {
  pages.forEach(p => p.classList.remove('active'));
  sidebarLinks.forEach(l => l.classList.remove('active'));

  const target = document.getElementById('page-' + pageName);
  const link = document.querySelector(`.sidebar-link[data-page="${pageName}"]`);

  if (target) target.classList.add('active');
  if (link) link.classList.add('active');

  // For product-editor, highlight the products sidebar link
  if (pageName === 'product-editor') {
    const prodLink = document.querySelector('.sidebar-link[data-page="products"]');
    if (prodLink) prodLink.classList.add('active');
  }

  if (pageTitle) pageTitle.textContent = pageTitles[pageName] || pageName;

  // Scroll to top
  window.scrollTo(0, 0);
}

sidebarLinks.forEach(link => {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    switchPage(this.dataset.page);
  });
});

// ===== LOGOUT =====
document.getElementById('logoutBtn').addEventListener('click', async function() {
  if (window.emirateSupabaseApi?.isConfigured?.() && window.emirateSupabase) {
    try {
      await window.emirateSupabase.auth.signOut();
    } catch (_) {
      // ignore
    }
  }
  localStorage.removeItem('emirate_admin');
  window.location.href = 'login.html';
});

// ===== DEMO DATA =====

// --- Orders ---
let ordersData = [
  { id: '#10048', client: 'Алишер Каримов', phone: '+998 90 123 45 67', items: 'iPhone 15 Pro Max', amount: '15 490 000 сум', status: 'processing', date: '09.04.2026' },
  { id: '#10047', client: 'Дилноза Рахимова', phone: '+998 91 234 56 78', items: 'Samsung Galaxy S24', amount: '4 250 000 сум', status: 'processing', date: '09.04.2026' },
  { id: '#10046', client: 'Бехзод Усмонов', phone: '+998 93 345 67 89', items: 'MacBook Air M3, AirPods Pro', amount: '22 900 000 сум', status: 'successful', date: '08.04.2026' },
  { id: '#10045', client: 'Малика Назарова', phone: '+998 94 456 78 90', items: 'Xiaomi 14 Ultra', amount: '8 350 000 сум', status: 'ready_to_ship', date: '08.04.2026' },
  { id: '#10044', client: 'Шахзод Мирзаев', phone: '+998 97 567 89 01', items: 'AirPods Max', amount: '3 200 000 сум', status: 'out_of_stock', date: '07.04.2026' },
  { id: '#10043', client: 'Азиза Турсунова', phone: '+998 90 678 90 12', items: 'Samsung TV 55"', amount: '12 100 000 сум', status: 'ready_to_ship', date: '07.04.2026' },
  { id: '#10042', client: 'Жавохир Холматов', phone: '+998 99 789 01 23', items: 'PlayStation 5', amount: '7 500 000 сум', status: 'successful', date: '06.04.2026' },
  { id: '#10041', client: 'Нодира Эргашева', phone: '+998 95 890 12 34', items: 'Dyson V15', amount: '6 800 000 сум', status: 'processing', date: '06.04.2026' },
  { id: '#10040', client: 'Фаррух Исмаилов', phone: '+998 93 901 23 45', items: 'iPad Pro 12.9', amount: '18 200 000 сум', status: 'ready_to_ship', date: '05.04.2026' },
  { id: '#10039', client: 'Зарина Мухаммедова', phone: '+998 91 012 34 56', items: 'LG OLED 65"', amount: '28 400 000 сум', status: 'processing', date: '05.04.2026' },
];

const statusMap = {
  processing: 'В обработке',
  ready_to_ship: 'Готов к перевозке',
  out_of_stock: 'Нет товара',
  successful: 'Успешный',
};

function renderOrders(data = ordersData) {
  const tbody = document.getElementById('ordersBody');
  const count = document.getElementById('ordersCount');
  tbody.innerHTML = data.map(o => `
    <tr>
      <td>${o.id}</td>
      <td>${o.client}</td>
      <td>${o.phone}</td>
      <td style="max-width:160px">${o.items}</td>
      <td>${o.amount}</td>
      <td><span class="status-badge ${o.status}"><span class="status-dot"></span>${statusMap[o.status]}</span></td>
      <td>${o.date}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn" title="Просмотр" data-action="view-order" data-order-id="${o.id}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
          <button class="action-btn" title="Редактировать" data-action="edit-order" data-order-id="${o.id}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        </div>
      </td>
    </tr>
  `).join('');
  if (count) count.textContent = `Показано ${data.length} из ${ordersData.length}`;
}

function getFilteredOrdersByStatus() {
  const statusFilter = document.getElementById('ordersStatusFilter')?.value || 'all';
  if (statusFilter === 'all') return ordersData;
  return ordersData.filter((order) => order.status === statusFilter);
}

function applyOrdersStatusFilter() {
  renderOrders(getFilteredOrdersByStatus());
}

// --- Clients ---
let clientsData = [
  { id: 1, name: 'Алишер Каримов', phone: '+998 90 123 45 67', email: 'alisher@mail.uz', orders: 5, total: '45 200 000 сум', date: '15.01.2026' },
  { id: 2, name: 'Дилноза Рахимова', phone: '+998 91 234 56 78', email: 'dilnoza@mail.uz', orders: 3, total: '12 800 000 сум', date: '22.02.2026' },
  { id: 3, name: 'Бехзод Усмонов', phone: '+998 93 345 67 89', email: 'behzod@gmail.com', orders: 8, total: '78 500 000 сум', date: '10.11.2025' },
  { id: 4, name: 'Малика Назарова', phone: '+998 94 456 78 90', email: 'malika@mail.uz', orders: 2, total: '9 350 000 сум', date: '05.03.2026' },
  { id: 5, name: 'Шахзод Мирзаев', phone: '+998 97 567 89 01', email: 'shahzod@gmail.com', orders: 1, total: '3 200 000 сум', date: '01.04.2026' },
  { id: 6, name: 'Азиза Турсунова', phone: '+998 90 678 90 12', email: 'aziza@mail.uz', orders: 4, total: '32 100 000 сум', date: '28.12.2025' },
  { id: 7, name: 'Жавохир Холматов', phone: '+998 99 789 01 23', email: 'javohir@inbox.uz', orders: 6, total: '55 400 000 сум', date: '14.09.2025' },
  { id: 8, name: 'Нодира Эргашева', phone: '+998 95 890 12 34', email: 'nodira@mail.uz', orders: 2, total: '14 600 000 сум', date: '20.03.2026' },
  { id: 9, name: 'Фаррух Исмаилов', phone: '+998 93 901 23 45', email: 'farrukh@gmail.com', orders: 10, total: '125 000 000 сум', date: '03.06.2025' },
  { id: 10, name: 'Зарина Мухаммедова', phone: '+998 91 012 34 56', email: 'zarina@mail.uz', orders: 7, total: '89 200 000 сум', date: '18.08.2025' },
];

function renderClients(data = clientsData) {
  const tbody = document.getElementById('clientsBody');
  const count = document.getElementById('clientsCount');
  tbody.innerHTML = data.map(c => `
    <tr>
      <td>${c.id}</td>
      <td><strong>${c.name}</strong></td>
      <td>${c.phone}</td>
      <td>${c.email}</td>
      <td>${c.orders}</td>
      <td>${c.total}</td>
      <td>${c.date}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn" title="Просмотр" data-action="view-client" data-client-id="${c.id}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
          <button class="action-btn" title="Редактировать" data-action="edit-client" data-client-id="${c.id}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="action-btn delete" title="Удалить" data-action="delete-client" data-client-id="${c.id}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
        </div>
      </td>
    </tr>
  `).join('');
  if (count) count.textContent = `Показано ${data.length} из ${clientsData.length}`;
}

function getDateTimeString() {
  return new Date()
    .toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    .replace(',', '');
}

function defaultSuppliersData() {
  return [
    { id: 'SUP-1001', name: 'Samsung Electronics', phone: '+998 90 111 22 33', status: 'active', lat: '41.311081', lng: '69.240562', updatedAt: '09.04.2026 10:20' },
    { id: 'SUP-1002', name: 'Apple Distribution', phone: '+998 90 222 33 44', status: 'active', lat: '41.299496', lng: '69.240074', updatedAt: '09.04.2026 10:25' },
    { id: 'SUP-1003', name: 'Xiaomi Partner Group', phone: '+998 90 333 44 55', status: 'inactive', lat: '', lng: '', updatedAt: '08.04.2026 18:10' }
  ];
}

function normalizeSupplierRecord(record) {
  const supplier = record || {};
  return {
    id: supplier.id || `SUP-${Math.floor(Math.random() * 9000 + 1000)}`,
    name: String(supplier.name || '').trim(),
    phone: String(supplier.phone || '').trim(),
    status: supplier.status === 'inactive' ? 'inactive' : 'active',
    lat: String(supplier.lat || '').trim(),
    lng: String(supplier.lng || '').trim(),
    updatedAt: supplier.updatedAt || getDateTimeString()
  };
}

function loadSuppliersData() {
  try {
    const raw = localStorage.getItem(ADMIN_SUPPLIERS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed) || !parsed.length) {
      return defaultSuppliersData();
    }
    return parsed;
  } catch (_) {
    return defaultSuppliersData();
  }
}

let suppliersData = loadSuppliersData().map(normalizeSupplierRecord);
let supplierFeedbackTimer = null;

function persistSuppliersData() {
  localStorage.setItem(ADMIN_SUPPLIERS_KEY, JSON.stringify(suppliersData));
}

function showSupplierFeedback(message, type = 'success', timeoutMs = 2800) {
  const node = document.getElementById('supplierFeedback');
  if (!node) return;
  node.textContent = message;
  node.classList.remove('success', 'error');
  node.classList.add(type === 'error' ? 'error' : 'success');
  node.removeAttribute('hidden');
  if (supplierFeedbackTimer) clearTimeout(supplierFeedbackTimer);
  supplierFeedbackTimer = setTimeout(() => {
    node.setAttribute('hidden', 'hidden');
    node.classList.remove('success', 'error');
  }, timeoutMs);
}

function renderSuppliers(data = suppliersData) {
  const tbody = document.getElementById('suppliersBody');
  const count = document.getElementById('suppliersCount');
  if (!tbody || !count) return;

  tbody.innerHTML = data.map((supplier) => `
    <tr>
      <td><strong>${escapeHtml(supplier.name)}</strong><div class="product-sku">${escapeHtml(supplier.id)}</div></td>
      <td>${escapeHtml(supplier.phone || '—')}</td>
      <td><span class="status-badge ${supplier.status}"><span class="status-dot"></span>${supplier.status === 'active' ? 'Активный' : 'Неактивный'}</span></td>
      <td>${escapeHtml((supplier.lat && supplier.lng) ? `${supplier.lat}, ${supplier.lng}` : '—')}</td>
      <td>${escapeHtml(supplier.updatedAt)}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn" title="Редактировать" data-action="edit-supplier" data-supplier-id="${escapeHtml(supplier.id)}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="action-btn" title="Вкл/выкл" data-action="toggle-supplier" data-supplier-id="${escapeHtml(supplier.id)}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/></svg></button>
          <button class="action-btn delete" title="Удалить" data-action="delete-supplier" data-supplier-id="${escapeHtml(supplier.id)}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
        </div>
      </td>
    </tr>
  `).join('');

  count.textContent = `Показано ${data.length} из ${suppliersData.length}`;
}

function resetSupplierForm() {
  const form = document.getElementById('supplierForm');
  const idInput = document.getElementById('supplierId');
  const statusInput = document.getElementById('supplierStatus');
  const saveBtn = document.getElementById('supplierSaveBtn');
  form?.reset();
  if (idInput) idInput.value = '';
  if (statusInput) statusInput.value = 'active';
  if (saveBtn) saveBtn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg> Создать поставщика';
  document.getElementById('supplierName')?.closest('.form-group')?.classList.remove('error');
}

function fillSupplierForm(supplierId) {
  const supplier = suppliersData.find((item) => item.id === supplierId);
  if (!supplier) return;
  document.getElementById('supplierId').value = supplier.id;
  document.getElementById('supplierName').value = supplier.name;
  document.getElementById('supplierPhone').value = supplier.phone;
  document.getElementById('supplierStatus').value = supplier.status;
  document.getElementById('supplierLat').value = supplier.lat;
  document.getElementById('supplierLng').value = supplier.lng;
  const saveBtn = document.getElementById('supplierSaveBtn');
  if (saveBtn) saveBtn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg> Сохранить изменения';
}

function saveSupplier(event) {
  event.preventDefault();
  const id = document.getElementById('supplierId').value.trim();
  const name = document.getElementById('supplierName').value.trim();
  const phone = document.getElementById('supplierPhone').value.trim();
  const status = document.getElementById('supplierStatus').value === 'inactive' ? 'inactive' : 'active';
  const lat = document.getElementById('supplierLat').value.trim();
  const lng = document.getElementById('supplierLng').value.trim();
  const nameGroup = document.getElementById('supplierName').closest('.form-group');
  nameGroup?.classList.remove('error');

  if (name.length < 2) {
    nameGroup?.classList.add('error');
    showSupplierFeedback('Введите корректное название поставщика.', 'error', 3200);
    return;
  }

  const draft = normalizeSupplierRecord({
    id: id || undefined,
    name,
    phone,
    status,
    lat,
    lng,
    updatedAt: getDateTimeString()
  });

  const existingIndex = suppliersData.findIndex((item) => item.id === draft.id);
  if (existingIndex === -1) {
    suppliersData.unshift(draft);
    showSupplierFeedback('Поставщик успешно создан.', 'success');
  } else {
    suppliersData[existingIndex] = draft;
    showSupplierFeedback('Данные поставщика обновлены.', 'success');
  }

  persistSuppliersData();
  renderSuppliers();
  syncIntakeCounterpartyControls();
  fillSupplierForm(draft.id);
}

function toggleSupplierStatus(supplierId) {
  const supplier = suppliersData.find((item) => item.id === supplierId);
  if (!supplier) return;
  supplier.status = supplier.status === 'active' ? 'inactive' : 'active';
  supplier.updatedAt = getDateTimeString();
  persistSuppliersData();
  renderSuppliers();
  syncIntakeCounterpartyControls();
  showSupplierFeedback(`Поставщик ${supplier.status === 'active' ? 'активирован' : 'деактивирован'}.`, 'success');
}

function deleteSupplier(supplierId) {
  const supplier = suppliersData.find((item) => item.id === supplierId);
  if (!supplier) return;
  if (!confirm(`Удалить поставщика "${supplier.name}"?`)) return;
  suppliersData = suppliersData.filter((item) => item.id !== supplierId);
  persistSuppliersData();
  renderSuppliers();
  syncIntakeCounterpartyControls();
  resetSupplierForm();
  showSupplierFeedback('Поставщик удален.', 'success');
}

const ADMIN_PRODUCTS_KEY = 'emirate_admin_products';
const ADMIN_BANNERS_KEY = 'emirate_home_banners';
const BANNER_TITLE_MIN = 8;
const BANNER_TITLE_MAX = 90;
const BANNER_DESC_MIN = 20;
const BANNER_DESC_MAX = 220;
const BANNER_TAG_MAX = 40;
const BANNER_BTN_MAX = 30;
const BANNER_IMAGE_RATIO_MIN = 2.2;
const BANNER_IMAGE_RATIO_MAX = 3.4;
const BANNER_BLOCKED_PHRASES = [
  'всем пока',
  'нету скидок',
  'пошел',
  'идиот',
  'дурак'
];

function defaultProductsData() {
  return [
  { id: 'T97106', nameRu: 'iPhone 15 Pro Max 256GB', nameUz: 'iPhone 15 Pro Max 256GB', category: 'Смартфоны', price: '15 490 000', oldPrice: '16 900 000', status: 'active', brand: 'Apple', model: 'A3108', date: '08.04.2026' },
  { id: 'T97105', nameRu: 'Samsung Galaxy S24 Ultra', nameUz: 'Samsung Galaxy S24 Ultra', category: 'Смартфоны', price: '14 200 000', oldPrice: '15 500 000', status: 'active', brand: 'Samsung', model: 'SM-S928B', date: '08.04.2026' },
  { id: 'T97104', nameRu: 'MacBook Air M3 15"', nameUz: 'MacBook Air M3 15"', category: 'Ноутбуки', price: '18 900 000', oldPrice: '20 500 000', status: 'active', brand: 'Apple', model: 'MXDU3', date: '07.04.2026' },
  { id: 'T97103', nameRu: 'Sony WH-1000XM5', nameUz: 'Sony WH-1000XM5', category: 'Аксессуары', price: '3 890 000', oldPrice: '4 200 000', status: 'active', brand: 'Sony', model: 'WH1000XM5', date: '07.04.2026' },
  { id: 'T97102', nameRu: 'LG OLED C4 65"', nameUz: 'LG OLED C4 65"', category: 'ТВ и аудио', price: '28 400 000', oldPrice: '31 000 000', status: 'active', brand: 'LG', model: 'OLED65C4', date: '06.04.2026' },
  { id: 'T97101', nameRu: 'Dyson V15 Detect', nameUz: 'Dyson V15 Detect', category: 'Бытовая техника', price: '6 800 000', oldPrice: '7 500 000', status: 'inactive', brand: 'Dyson', model: 'V15', date: '06.04.2026' },
  { id: 'T97100', nameRu: 'Xiaomi 14 Ultra', nameUz: 'Xiaomi 14 Ultra', category: 'Смартфоны', price: '8 350 000', oldPrice: '9 100 000', status: 'active', brand: 'Xiaomi', model: '24030PN60G', date: '05.04.2026' },
  { id: 'T97099', nameRu: 'iPad Pro 12.9" M4', nameUz: 'iPad Pro 12.9" M4', category: 'Ноутбуки', price: '18 200 000', oldPrice: '', status: 'active', brand: 'Apple', model: 'MWR13', date: '05.04.2026' },
  { id: 'T97098', nameRu: 'Samsung TV 55" QLED', nameUz: 'Samsung TV 55" QLED', category: 'ТВ и аудио', price: '12 100 000', oldPrice: '13 500 000', status: 'active', brand: 'Samsung', model: 'QN55Q80C', date: '04.04.2026' },
  { id: 'T97097', nameRu: 'AirPods Pro 2', nameUz: 'AirPods Pro 2', category: 'Аксессуары', price: '2 890 000', oldPrice: '3 200 000', status: 'active', brand: 'Apple', model: 'MTJV3', date: '04.04.2026' },
  ];
}

function loadProductsData() {
  if (window.emirateSupabaseApi?.isConfigured?.()) {
    return [];
  }
  try {
    const raw = localStorage.getItem(ADMIN_PRODUCTS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed) || !parsed.length) {
      return defaultProductsData();
    }
    return parsed;
  } catch (_) {
    return defaultProductsData();
  }
}

const PRODUCTS_STORAGE_SOFT_LIMIT = 4_300_000;
let activeAssetUploads = 0;

function setAssetUploadState(isUploading) {
  activeAssetUploads += isUploading ? 1 : -1;
  if (activeAssetUploads < 0) activeAssetUploads = 0;
  const saveBtn = document.getElementById('productSaveBtn');
  if (!saveBtn) return;
  saveBtn.disabled = activeAssetUploads > 0;
  saveBtn.textContent = activeAssetUploads > 0 ? 'Загрузка фото...' : 'Сохранить товар';
}

function collectProductMediaUrls(product) {
  const urls = [];
  if (Array.isArray(product?.photos)) {
    urls.push(...product.photos.filter(Boolean));
  }
  if (Array.isArray(product?.colors)) {
    product.colors.forEach((variant) => {
      if (Array.isArray(variant?.photos)) {
        urls.push(...variant.photos.filter(Boolean));
      }
    });
  }
  return Array.from(new Set(urls.filter((value) => /^https?:\/\//i.test(String(value)))));
}

async function deleteProductAndSync(id) {
  if (!confirm('РЈРґР°Р»РёС‚СЊ СЌС‚РѕС‚ С‚РѕРІР°СЂ?')) return;
  const removedProduct = productsData.find((p) => p.id === id) || null;
  productsData = productsData.filter((p) => p.id !== id);
  if (!await persistProductsData()) return;
  const deleteRes = await window.emirateSupabaseApi?.deleteAdminProduct?.(id);
  if (deleteRes && deleteRes.ok === false) {
    console.warn('[Supabase] delete product', deleteRes.error);
    alert('Товар удален локально, но запись в Supabase не удалось удалить. Проверьте admin_users и policies.');
  }
  if (removedProduct) {
    void window.emirateSupabaseApi?.removeAdminAssetsByUrls?.(collectProductMediaUrls(removedProduct));
  }
  renderProducts();
}

function cloneProductsData(data) {
  return JSON.parse(JSON.stringify(Array.isArray(data) ? data : []));
}

function trimProductMediaForStorage(sourceData, focusProductId = null) {
  const data = cloneProductsData(sourceData).map((item, index) => ({ ...item, __order: index }));
  const byPriority = (a, b) => {
    if (focusProductId && a.id === focusProductId) return -1;
    if (focusProductId && b.id === focusProductId) return 1;
    return 0;
  };
  data.sort(byPriority);

  const dropToLimit = (targetChars) => {
    let payload = JSON.stringify(data);
    if (payload.length <= targetChars) return true;

    // Step 1: keep only first photos for each color.
    data.forEach((product) => {
      if (!Array.isArray(product.colors)) return;
      product.colors.forEach((variant) => {
        if (Array.isArray(variant.photos) && variant.photos.length > 2) {
          variant.photos = variant.photos.slice(0, 2);
        }
      });
    });
    payload = JSON.stringify(data);
    if (payload.length <= targetChars) return true;

    // Step 2: keep fewer general photos.
    data.forEach((product) => {
      if (Array.isArray(product.photos) && product.photos.length > 3) {
        product.photos = product.photos.slice(0, 3);
      }
    });
    payload = JSON.stringify(data);
    if (payload.length <= targetChars) return true;

    // Step 3: keep one photo per color.
    data.forEach((product) => {
      if (!Array.isArray(product.colors)) return;
      product.colors.forEach((variant) => {
        if (Array.isArray(variant.photos) && variant.photos.length > 1) {
          variant.photos = variant.photos.slice(0, 1);
        }
      });
    });
    payload = JSON.stringify(data);
    if (payload.length <= targetChars) return true;

    // Step 4: drop photos from inactive colors first.
    data.forEach((product) => {
      if (!Array.isArray(product.colors)) return;
      product.colors.forEach((variant) => {
        if (variant.status === 'inactive') {
          variant.photos = [];
        }
      });
    });
    payload = JSON.stringify(data);
    if (payload.length <= targetChars) return true;

    // Step 5: clear extra product photos on non-focused items.
    data.forEach((product) => {
      if (focusProductId && product.id === focusProductId) return;
      if (Array.isArray(product.photos) && product.photos.length > 1) {
        product.photos = product.photos.slice(0, 1);
      }
    });
    payload = JSON.stringify(data);
    if (payload.length <= targetChars) return true;

    // Step 6: keep only first color variant photo on non-focused items.
    data.forEach((product) => {
      if (focusProductId && product.id === focusProductId) return;
      if (!Array.isArray(product.colors)) return;
      product.colors.forEach((variant) => {
        variant.photos = [];
      });
    });
    payload = JSON.stringify(data);
    if (payload.length <= targetChars) return true;

    // Step 7: emergency mode - keep single cover, but preserve focused product variants.
    data.forEach((product) => {
      const isFocused = focusProductId && product.id === focusProductId;
      if (Array.isArray(product.photos) && product.photos.length > (isFocused ? 3 : 1)) {
        product.photos = product.photos.slice(0, isFocused ? 3 : 1);
      }
      if (Array.isArray(product.colors)) {
        product.colors.forEach((variant) => {
          if (!Array.isArray(variant.photos)) return;
          variant.photos = isFocused ? variant.photos.slice(0, 1) : [];
        });
      }
    });
    payload = JSON.stringify(data);
    return payload.length <= targetChars;
  };

  dropToLimit(PRODUCTS_STORAGE_SOFT_LIMIT);
  data.sort((a, b) => (a.__order || 0) - (b.__order || 0));
  return data.map((item) => {
    const clone = { ...item };
    delete clone.__order;
    return clone;
  });
}

async function persistProductsData(focusProductId = null) {
  const optimizedData = trimProductMediaForStorage(productsData, focusProductId);
  const syncRes = await verifyProductsSupabaseSync(optimizedData);
  if (!syncRes?.ok) {
    console.warn('[Supabase] strict product sync failed', syncRes?.error);
    const reason = String(syncRes?.error || 'unknown_error');
    alert(`Товар не сохранён в Supabase.\n\nПричина: ${reason}\n\nПроверьте вход через Supabase, таблицу products и RLS policies.`);
    return false;
  }
  try {
    localStorage.setItem(ADMIN_PRODUCTS_KEY, JSON.stringify(optimizedData));
    productsData = optimizedData.map(normalizeProductRecord);
    return true;
  } catch (error) {
    console.error('Failed to update local mirror after Supabase sync', error);
    productsData = optimizedData.map(normalizeProductRecord);
    alert('Товар записан в Supabase, но локальный кэш браузера не обновился. Это не мешает общей базе, но локальный список может устареть до перезагрузки.');
    return true;
  }
}

async function verifyProductsSupabaseSync(data) {
  if (!window.emirateSupabaseApi?.isConfigured?.()) {
    return { ok: false, error: 'no_client' };
  }
  try {
    return await window.emirateSupabaseApi.pushAdminProductsPayload(data);
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

function normalizeProductRecord(product) {
  const p = product || {};
  const priority = Number(p.priority);
  const specs = Array.isArray(p.specs) ? p.specs : [];
  const colors = Array.isArray(p.colors) ? p.colors : [];
  const colorMeta = p.colorMeta && typeof p.colorMeta === 'object' ? p.colorMeta : {};
  return {
    ...p,
    status: p.status === 'inactive' ? 'inactive' : 'active',
    installmentStatus: p.installmentStatus === 'inactive' ? 'inactive' : 'active',
    promo: p.promo === 'yes' ? 'yes' : 'no',
    express: p.express === 'yes' ? 'yes' : 'no',
    condition: p.condition || 'Есть в наличии',
    deliveryArea: p.deliveryArea || '',
    priority: Number.isFinite(priority) ? priority : 300,
    photos: Array.isArray(p.photos) ? p.photos : [],
    descUz: String(p.descUz || '').trim(),
    descRu: String(p.descRu || '').trim(),
    specs: specs
      .map((item) => ({
        keyRu: String(item?.keyRu || item?.key || '').trim(),
        keyUz: String(item?.keyUz || '').trim(),
        valueRu: String(item?.valueRu || item?.value || '').trim(),
        valueUz: String(item?.valueUz || '').trim()
      }))
      .filter((item) => (item.keyRu || item.keyUz) && (item.valueRu || item.valueUz))
      .map((item) => ({
        ...item,
        key: item.keyRu || item.keyUz,
        value: item.valueRu || item.valueUz
      })),
    colors: colors
      .map((item, index) => ({
        id: String(item?.id || `color_${Date.now()}_${index}`),
        nameRu: String(item?.nameRu || item?.name || '').trim(),
        nameUz: String(item?.nameUz || '').trim(),
        status: item?.status === 'inactive' ? 'inactive' : 'active',
        swatch: /^#?[0-9a-f]{3,8}$/i.test(String(item?.swatch || '').trim())
          ? `#${String(item?.swatch || '').trim().replace(/^#/, '')}`
          : '',
        photos: Array.isArray(item?.photos) ? item.photos.filter(Boolean) : []
      }))
      .filter((item) => (item.nameRu || item.nameUz))
      .map((item) => ({
        ...item,
        name: item.nameRu || item.nameUz
      })),
    colorMeta: {
      nameRu: String(colorMeta.nameRu || 'Цвет').trim() || 'Цвет',
      nameUz: String(colorMeta.nameUz || 'rang').trim() || 'rang',
      status: colorMeta.status === 'inactive' ? 'inactive' : 'active',
      type: colorMeta.type === 'text' ? 'text' : 'image'
    }
  };
}

let productsData = loadProductsData().map(normalizeProductRecord);

function renderProducts() {
  const tbody = document.getElementById('productsBody');
  tbody.innerHTML = productsData.map(renderProductRow).join('');
  document.getElementById('productsCount').textContent = `Показано ${productsData.length} товаров`;
}

function renderProductRow(p) {
  return `
    <tr>
      <td>
        <div class="product-cell">
          <div class="product-thumb">
            ${p.photos?.[0]
              ? `<img src="${p.photos[0]}" alt="Фото товара">`
              : `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`
            }
          </div>
          <div>
            <div class="product-name">${p.nameRu}</div>
            <div class="product-sku">${p.id} · ${p.brand || ''}</div>
          </div>
        </div>
      </td>
      <td>${p.category}</td>
      <td><strong>${p.price} сум</strong></td>
      <td style="color: #94a3b8; text-decoration: line-through;">${p.oldPrice ? p.oldPrice + ' сум' : '—'}</td>
      <td><span class="status-badge ${p.status}"><span class="status-dot"></span>${p.status === 'active' ? 'Включено' : 'Отключено'}</span></td>
      <td>${p.date}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn" title="Просмотр"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
          <button class="action-btn" title="Редактировать" data-action="edit-product" data-product-id="${p.id}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="action-btn delete" title="Удалить" data-action="delete-product" data-product-id="${p.id}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
        </div>
      </td>
    </tr>
  `;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeBannerUrl(value) {
  return String(value || '').trim();
}

function isAllowedBannerUrl(value) {
  const url = sanitizeBannerUrl(value);
  if (!url || url === '#') return true;
  if (url.startsWith('/')) return true;
  if (/^(https?:)?\/\//i.test(url)) return false;
  if (/^(javascript|data|vbscript):/i.test(url)) return false;
  return /^[a-z0-9/_-]+(\.html)?([?#][\w\-./=&%]*)?$/i.test(url);
}

function hasBlockedPhrases(...values) {
  const joined = values
    .map((value) => String(value || '').toLowerCase())
    .join(' ');
  return BANNER_BLOCKED_PHRASES.some((phrase) => joined.includes(phrase));
}

function countActiveBanners(excludeId = null) {
  return bannersData.filter((item) => item.isActive && item.id !== excludeId).length;
}

function defaultBannersData() {
  return [
    {
      id: 'banner_default_1',
      tag: '🔥 Акция недели',
      title: 'Скидки до 30% на электронику',
      desc: 'Рассрочка 0-0-12 месяцев без переплат. Бесплатная доставка по Ташкенту.',
      primaryText: 'Смотреть предложения',
      primaryUrl: '#',
      secondaryText: 'Перейти в каталог',
      secondaryUrl: 'catalog.html',
      image: '',
      isActive: true,
      priority: 100
    }
  ];
}

function normalizeBannerRecord(record) {
  const banner = record || {};
  const priority = Number(banner.priority);
  return {
    id: banner.id || `banner_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tag: String(banner.tag || '').trim() || '🔥 Акция',
    title: String(banner.title || '').trim() || 'Акционный баннер',
    desc: String(banner.desc || '').trim() || '',
    primaryText: String(banner.primaryText || '').trim() || '',
    primaryUrl: String(banner.primaryUrl || '').trim() || '#',
    secondaryText: String(banner.secondaryText || '').trim() || '',
    secondaryUrl: String(banner.secondaryUrl || '').trim() || '#',
    image: typeof banner.image === 'string' ? banner.image : '',
    isActive: banner.isActive !== false,
    priority: Number.isFinite(priority) ? priority : 100
  };
}

function loadBannersData() {
  try {
    const raw = localStorage.getItem(ADMIN_BANNERS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed) || !parsed.length) {
      return defaultBannersData();
    }
    return parsed;
  } catch (_) {
    return defaultBannersData();
  }
}

let bannersData = loadBannersData().map(normalizeBannerRecord);

function persistBannersData() {
  localStorage.setItem(ADMIN_BANNERS_KEY, JSON.stringify(bannersData));
}

function sortBanners() {
  bannersData.sort((a, b) => Number(a.priority) - Number(b.priority));
}

function getBannerPreviewDataFromForm() {
  const bannerIdInput = document.getElementById('bannerId');
  const bannerTagInput = document.getElementById('bannerTag');
  const bannerTitleInput = document.getElementById('bannerTitle');
  const bannerDescInput = document.getElementById('bannerDesc');
  const bannerPrimaryTextInput = document.getElementById('bannerPrimaryText');
  const bannerPrimaryUrlInput = document.getElementById('bannerPrimaryUrl');
  const bannerSecondaryTextInput = document.getElementById('bannerSecondaryText');
  const bannerSecondaryUrlInput = document.getElementById('bannerSecondaryUrl');
  const bannerPriorityInput = document.getElementById('bannerPriority');
  const bannerActiveSelect = document.getElementById('bannerActive');

  const existing = bannersData.find((item) => item.id === bannerIdInput?.value);
  const priority = Number(bannerPriorityInput?.value);

  return normalizeBannerRecord({
    id: bannerIdInput?.value || undefined,
    tag: bannerTagInput?.value || '',
    title: bannerTitleInput?.value || '',
    desc: bannerDescInput?.value || '',
    primaryText: bannerPrimaryTextInput?.value || '',
    primaryUrl: sanitizeBannerUrl(bannerPrimaryUrlInput?.value || '#'),
    secondaryText: bannerSecondaryTextInput?.value || '',
    secondaryUrl: sanitizeBannerUrl(bannerSecondaryUrlInput?.value || '#'),
    image: bannerFormImage || existing?.image || '',
    isActive: bannerActiveSelect?.value !== 'false',
    priority: Number.isFinite(priority) ? priority : 100
  });
}

function validateBannerDraft(draft) {
  const tag = String(draft.tag || '').trim();
  const title = String(draft.title || '').trim();
  const desc = String(draft.desc || '').trim();
  const primaryText = String(draft.primaryText || '').trim();
  const secondaryText = String(draft.secondaryText || '').trim();
  const primaryUrl = sanitizeBannerUrl(draft.primaryUrl || '#');
  const secondaryUrl = sanitizeBannerUrl(draft.secondaryUrl || '#');

  if (tag.length > BANNER_TAG_MAX) {
    return `Метка слишком длинная. Максимум ${BANNER_TAG_MAX} символов.`;
  }
  if (title.length < BANNER_TITLE_MIN || title.length > BANNER_TITLE_MAX) {
    return `Заголовок должен быть от ${BANNER_TITLE_MIN} до ${BANNER_TITLE_MAX} символов.`;
  }
  if (desc.length < BANNER_DESC_MIN || desc.length > BANNER_DESC_MAX) {
    return `Описание должно быть от ${BANNER_DESC_MIN} до ${BANNER_DESC_MAX} символов.`;
  }
  if (primaryText.length > BANNER_BTN_MAX || secondaryText.length > BANNER_BTN_MAX) {
    return `Текст кнопки должен быть не длиннее ${BANNER_BTN_MAX} символов.`;
  }
  if (!isAllowedBannerUrl(primaryUrl) || !isAllowedBannerUrl(secondaryUrl)) {
    return 'Разрешены только внутренние ссылки: #, /path, catalog.html, product.html.';
  }
  if (hasBlockedPhrases(tag, title, desc)) {
    return 'Обнаружены запрещенные фразы в тексте баннера.';
  }
  if (!draft.isActive && countActiveBanners(draft.id) < 1) {
    return 'Должен остаться хотя бы один активный баннер.';
  }
  return '';
}

function renderBannerPreview(data) {
  const preview = document.getElementById('bannerLivePreview');
  if (!preview) return;

  const banner = normalizeBannerRecord(data);
  const firstButton = banner.primaryText || 'Смотреть предложения';
  const secondButton = banner.secondaryText || 'Перейти в каталог';
  const imageStyle = banner.image
    ? `background-image: linear-gradient(115deg, rgba(11,17,32,0.65), rgba(12,61,107,0.66)), url('${banner.image}'); background-size: cover; background-position: center;`
    : '';

  preview.setAttribute('style', imageStyle);
  preview.innerHTML = `
    <div class="banner-preview-tag">${escapeHtml(banner.tag)}</div>
    <h4>${escapeHtml(banner.title)}</h4>
    <p>${escapeHtml(banner.desc)}</p>
    <div class="banner-preview-buttons">
      <span>${escapeHtml(firstButton)}</span>
      <span>${escapeHtml(secondButton)}</span>
    </div>
  `;
}

function renderBanners() {
  const tbody = document.getElementById('bannersBody');
  const count = document.getElementById('bannersCount');
  if (!tbody || !count) return;

  sortBanners();

  tbody.innerHTML = bannersData.map((banner) => {
    const buttonsText = [banner.primaryText, banner.secondaryText].filter(Boolean).length;
    return `
      <tr>
        <td>
          <strong>${escapeHtml(banner.title)}</strong>
          <p>${escapeHtml(banner.tag)}</p>
        </td>
        <td>${buttonsText ? `${buttonsText} кноп.` : '—'}</td>
        <td><span class="status-badge ${banner.isActive ? 'active' : 'inactive'}"><span class="status-dot"></span>${banner.isActive ? 'Включен' : 'Отключен'}</span></td>
        <td>${banner.priority}</td>
        <td>
          <div class="action-btns">
            <button class="action-btn" title="Редактировать" data-action="edit-banner" data-banner-id="${escapeHtml(banner.id)}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            <button class="action-btn" title="Вкл/выкл" data-action="toggle-banner" data-banner-id="${escapeHtml(banner.id)}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/></svg></button>
            <button class="action-btn delete" title="Удалить" data-action="delete-banner" data-banner-id="${escapeHtml(banner.id)}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  count.textContent = `Показано ${bannersData.length} слайдов`;
}

let bannerFormImage = '';
let bannerFeedbackTimer = null;

function showBannerFeedback(message, type = 'info', timeoutMs = 2600) {
  const node = document.getElementById('bannerFeedback');
  if (!node) return;
  node.textContent = message;
  node.classList.remove('success', 'error');
  if (type === 'success' || type === 'error') {
    node.classList.add(type);
  }
  node.removeAttribute('hidden');
  if (bannerFeedbackTimer) clearTimeout(bannerFeedbackTimer);
  if (timeoutMs > 0) {
    bannerFeedbackTimer = setTimeout(() => {
      node.setAttribute('hidden', 'hidden');
      node.classList.remove('success', 'error');
    }, timeoutMs);
  }
}

function setBannerReadonlyMode() {
  const notice = document.getElementById('bannerAccessNote');
  const editorContent = document.querySelector('.banner-editor-content');
  const listCard = document.querySelector('.banner-list-card');

  if (canManageBanners) {
    notice?.setAttribute('hidden', 'hidden');
    editorContent?.classList.remove('is-readonly');
    listCard?.classList.remove('is-readonly');
    return;
  }

  if (notice) {
    notice.textContent = 'У вас нет прав на изменение баннеров. Обратитесь к администратору.';
    notice.removeAttribute('hidden');
  }
  editorContent?.classList.add('is-readonly');
  listCard?.classList.add('is-readonly');
}

function restoreDefaultBanners() {
  if (!canManageBanners) return;
  if (!confirm('Вернуть дефолтный баннер и удалить текущие слайды?')) return;
  bannersData = defaultBannersData().map(normalizeBannerRecord);
  persistBannersData();
  renderBanners();
  fillBannerForm(bannersData[0].id);
  showBannerFeedback('Баннеры сброшены к дефолтному варианту.', 'success');
}

function getImageMeta(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = function() {
      resolve({ width: img.width, height: img.height, ratio: img.width / Math.max(1, img.height) });
    };
    img.onerror = function() {
      reject(new Error('Не удалось прочитать изображение.'));
    };
    img.src = dataUrl;
  });
}

function resetBannerForm() {
  const bannerForm = document.getElementById('bannerForm');
  const bannerIdInput = document.getElementById('bannerId');
  const bannerPriorityInput = document.getElementById('bannerPriority');
  const bannerActiveSelect = document.getElementById('bannerActive');
  const bannerImageMeta = document.getElementById('bannerImageMeta');
  const bannerImageInput = document.getElementById('bannerImageInput');

  bannerForm?.reset();
  if (bannerIdInput) bannerIdInput.value = '';
  if (bannerPriorityInput) bannerPriorityInput.value = '100';
  if (bannerActiveSelect) bannerActiveSelect.value = 'true';
  if (bannerImageMeta) bannerImageMeta.textContent = 'Изображение не выбрано';
  if (bannerImageInput) bannerImageInput.value = '';

  bannerFormImage = '';
  renderBannerPreview(defaultBannersData()[0]);
}

function fillBannerForm(bannerId) {
  const banner = bannersData.find((item) => item.id === bannerId);
  if (!banner) return;

  const bannerIdInput = document.getElementById('bannerId');
  const bannerTagInput = document.getElementById('bannerTag');
  const bannerTitleInput = document.getElementById('bannerTitle');
  const bannerDescInput = document.getElementById('bannerDesc');
  const bannerPrimaryTextInput = document.getElementById('bannerPrimaryText');
  const bannerPrimaryUrlInput = document.getElementById('bannerPrimaryUrl');
  const bannerSecondaryTextInput = document.getElementById('bannerSecondaryText');
  const bannerSecondaryUrlInput = document.getElementById('bannerSecondaryUrl');
  const bannerPriorityInput = document.getElementById('bannerPriority');
  const bannerActiveSelect = document.getElementById('bannerActive');
  const bannerImageMeta = document.getElementById('bannerImageMeta');

  if (bannerIdInput) bannerIdInput.value = banner.id;
  if (bannerTagInput) bannerTagInput.value = banner.tag;
  if (bannerTitleInput) bannerTitleInput.value = banner.title;
  if (bannerDescInput) bannerDescInput.value = banner.desc;
  if (bannerPrimaryTextInput) bannerPrimaryTextInput.value = banner.primaryText;
  if (bannerPrimaryUrlInput) bannerPrimaryUrlInput.value = banner.primaryUrl;
  if (bannerSecondaryTextInput) bannerSecondaryTextInput.value = banner.secondaryText;
  if (bannerSecondaryUrlInput) bannerSecondaryUrlInput.value = banner.secondaryUrl;
  if (bannerPriorityInput) bannerPriorityInput.value = String(banner.priority);
  if (bannerActiveSelect) bannerActiveSelect.value = banner.isActive ? 'true' : 'false';
  if (bannerImageMeta) bannerImageMeta.textContent = banner.image ? 'Текущее изображение загружено' : 'Изображение не выбрано';

  bannerFormImage = banner.image || '';
  renderBannerPreview(banner);
}

function saveBanner(event) {
  event.preventDefault();
  if (!canManageBanners) {
    showBannerFeedback('Недостаточно прав для изменения баннера.', 'error');
    alert('Недостаточно прав для изменения баннера.');
    return;
  }
  const draft = getBannerPreviewDataFromForm();
  const validationError = validateBannerDraft(draft);
  if (validationError) {
    showBannerFeedback(validationError, 'error', 3500);
    alert(validationError);
    return;
  }

  const existingIndex = bannersData.findIndex((item) => item.id === draft.id);
  const isNew = existingIndex === -1;
  if (existingIndex === -1) {
    bannersData.push(draft);
  } else {
    bannersData[existingIndex] = draft;
  }

  persistBannersData();
  renderBanners();
  fillBannerForm(draft.id);
  showBannerFeedback(isNew ? 'Новый слайд успешно добавлен.' : 'Слайд успешно сохранен.', 'success');
}

function deleteBanner(bannerId) {
  if (!canManageBanners) return;
  const banner = bannersData.find((item) => item.id === bannerId);
  if (!banner) return;
  if (bannersData.length <= 1) {
    showBannerFeedback('Нельзя удалить единственный слайд.', 'error', 3200);
    alert('Нельзя удалить единственный слайд. Создайте новый или верните дефолт.');
    return;
  }
  if (!confirm(`Удалить слайд "${banner.title}"?`)) return;

  bannersData = bannersData.filter((item) => item.id !== bannerId);
  persistBannersData();
  renderBanners();
  resetBannerForm();
  showBannerFeedback('Слайд удален.', 'success');
}

function toggleBannerStatus(bannerId) {
  if (!canManageBanners) return;
  const banner = bannersData.find((item) => item.id === bannerId);
  if (!banner) return;
  if (banner.isActive && countActiveBanners(banner.id) < 1) {
    showBannerFeedback('Нельзя отключить последний активный баннер.', 'error', 3200);
    alert('Нельзя отключить последний активный баннер.');
    return;
  }
  banner.isActive = !banner.isActive;
  persistBannersData();
  renderBanners();
  showBannerFeedback(`Слайд ${banner.isActive ? 'включен' : 'отключен'}.`, 'success');
}

// --- Finance / Intake ---
const intakeData = [
  {
    id: 'INT-001',
    invoice: 'P252167',
    counterparty: 'Samsung Electronics',
    counterpartyType: 'Поставщик',
    type: 'income',
    description: 'Поступление: смартфоны и аксессуары',
    value1: '156 000 000 сум',
    value2: '+1 248 000 000 UZS',
    pin: 'T104846',
    date: '05.04.2026 09:40'
  },
  {
    id: 'INT-002',
    invoice: 'P252162',
    counterparty: 'Apple Inc.',
    counterpartyType: 'Поставщик',
    type: 'income',
    description: 'Поступление: MacBook и iPad',
    value1: '285 000 000 сум',
    value2: '+2 280 000 000 UZS',
    pin: 'T113410',
    date: '04.04.2026 14:20'
  },
  {
    id: 'INT-003',
    invoice: 'P252158',
    counterparty: 'Xiaomi Corp.',
    counterpartyType: 'Поставщик',
    type: 'transfer',
    description: 'Перемещение между складами',
    value1: '98 000 000 сум',
    value2: '0 UZS',
    pin: 'T103807',
    date: '03.04.2026 12:15'
  },
  {
    id: 'INT-004',
    invoice: 'P252154',
    counterparty: 'LG Electronics',
    counterpartyType: 'Сервис',
    type: 'expense',
    description: 'Списание: брак и возвраты',
    value1: '-47 200 000 сум',
    value2: '-377 600 000 UZS',
    pin: 'T113025',
    date: '02.04.2026 17:00'
  },
  {
    id: 'INT-005',
    invoice: 'P252151',
    counterparty: 'Dyson Ltd.',
    counterpartyType: 'Логистика',
    type: 'expense',
    description: 'Транспортные и складские расходы',
    value1: '-16 500 000 сум',
    value2: '-132 000 000 UZS',
    pin: 'T117051',
    date: '01.04.2026 10:35'
  }
];

const intakeTypeMap = {
  income: 'Приёмка',
  expense: 'Списание',
  transfer: 'Перемещение'
};

function getCounterpartiesByType(counterpartyType) {
  const type = String(counterpartyType || '').trim();
  const fromSuppliers = suppliersData
    .filter((supplier) => (type ? type === 'Поставщик' : true))
    .map((supplier) => supplier.name);
  const fromIntake = intakeData
    .filter((item) => !type || item.counterpartyType === type)
    .map((item) => item.counterparty);
  return Array.from(new Set([...fromSuppliers, ...fromIntake].filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ru'));
}

function syncIntakeCounterpartyFilterOptions() {
  const typeFilter = document.getElementById('intakeCounterpartyTypeFilter');
  const counterpartyFilter = document.getElementById('intakeCounterpartyFilter');
  if (!counterpartyFilter) return;
  const selectedType = typeFilter?.value || 'all';
  const previous = counterpartyFilter.value || 'all';
  const counterparties = selectedType === 'all'
    ? Array.from(new Set(intakeData.map((item) => item.counterparty).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ru'))
    : getCounterpartiesByType(selectedType);

  counterpartyFilter.innerHTML = '<option value="all">Контрагент: все</option>' + counterparties
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join('');
  counterpartyFilter.value = counterparties.includes(previous) ? previous : 'all';
}

function syncIntakeCreateCounterpartyOptions() {
  const typeSelect = document.getElementById('intakeCreateCounterpartyType');
  const counterpartySelect = document.getElementById('intakeCreateCounterparty');
  const manualWrap = document.getElementById('intakeCreateCounterpartyManualWrap');
  if (!typeSelect || !counterpartySelect || !manualWrap) return;
  const type = typeSelect.value || 'Поставщик';
  const counterparties = getCounterpartiesByType(type);
  const previous = counterpartySelect.value || '';
  counterpartySelect.innerHTML = counterparties
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join('') + '<option value="__manual__">Другое (вручную)</option>';
  counterpartySelect.value = counterparties.includes(previous) ? previous : (counterparties[0] || '__manual__');
  manualWrap.hidden = counterpartySelect.value !== '__manual__';
}

function syncIntakeCounterpartyControls() {
  syncIntakeCounterpartyFilterOptions();
  syncIntakeCreateCounterpartyOptions();
}

function resetIntakeCreateForm() {
  const form = document.getElementById('intakeCreateForm');
  const panel = document.getElementById('intakeCreatePanel');
  if (!form || !panel) return;
  form.reset();
  document.getElementById('intakeCreateInvoice').value = `P${Math.floor(Math.random() * 900000 + 100000)}`;
  document.getElementById('intakeCreateCounterpartyType').value = 'Поставщик';
  document.getElementById('intakeCreateType').value = 'income';
  document.getElementById('intakeCreateDescription').value = 'Новая приёмка';
  document.getElementById('intakeCreateValue1').value = '0 сум';
  document.getElementById('intakeCreateValue2').value = '0 UZS';
  document.getElementById('intakeCreatePin').value = `T${Math.floor(Math.random() * 900000 + 100000)}`;
  document.getElementById('intakeCreateCounterpartyManual').value = '';
  panel.hidden = false;
  syncIntakeCreateCounterpartyOptions();
}

function renderIntake(data = intakeData) {
  const tbody = document.getElementById('intakeBody');
  const countLabel = document.getElementById('intakeCountText');

  tbody.innerHTML = data.map((i, index) => `
    <tr class="${i.type === 'expense' ? 'intake-row-alert' : ''}">
      <td>${index + 1}</td>
      <td><span class="intake-invoice">${i.invoice}</span></td>
      <td><strong>${i.counterparty}</strong></td>
      <td>${i.counterpartyType}</td>
      <td><span class="intake-type-badge ${i.type}">${intakeTypeMap[i.type] || 'Операция'}</span></td>
      <td>${i.description}</td>
      <td class="${i.type === 'expense' ? 'intake-amount-negative' : 'intake-amount-positive'}">${i.value1}</td>
      <td class="${i.type === 'expense' ? 'intake-amount-negative' : ''}">${i.value2}</td>
      <td>${i.date}</td>
      <td>${i.pin}</td>
      <td>
        <div class="action-btns intake-actions">
          <button class="action-btn" title="Просмотр"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
          <button class="action-btn" title="Редактировать"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="action-btn" title="Печать"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button>
        </div>
      </td>
    </tr>
  `).join('');

  countLabel.textContent = `Показано ${data.length} записей`;
  syncIntakeCounterpartyFilterOptions();
}

function applyIntakeFilters() {
  const searchInput = document.getElementById('intakeSearch');
  const counterpartyTypeFilter = document.getElementById('intakeCounterpartyTypeFilter');
  const counterpartyFilter = document.getElementById('intakeCounterpartyFilter');
  const typeFilter = document.getElementById('intakeTypeFilter');

  const searchValue = (searchInput?.value || '').trim().toLowerCase();
  const counterpartyType = counterpartyTypeFilter?.value || 'all';
  const counterparty = counterpartyFilter?.value || 'all';
  const type = typeFilter?.value || 'all';

  const filtered = intakeData.filter(item => {
    const bySearch = !searchValue
      || item.invoice.toLowerCase().includes(searchValue)
      || item.counterparty.toLowerCase().includes(searchValue);
    const byCounterpartyType = counterpartyType === 'all' || item.counterpartyType === counterpartyType;
    const byCounterparty = counterparty === 'all' || item.counterparty === counterparty;
    const byType = type === 'all' || item.type === type;
    return bySearch && byCounterpartyType && byCounterparty && byType;
  });

  renderIntake(filtered);
}

function setupIntakeFilters() {
  ['intakeSearch', 'intakeCounterpartyTypeFilter', 'intakeCounterpartyFilter', 'intakeTypeFilter'].forEach(id => {
    const control = document.getElementById(id);
    if (!control) return;
    const eventName = id === 'intakeSearch' ? 'input' : 'change';
    control.addEventListener(eventName, applyIntakeFilters);
  });

  document.getElementById('intakeCounterpartyTypeFilter')?.addEventListener('change', function() {
    syncIntakeCounterpartyFilterOptions();
    applyIntakeFilters();
  });

  document.getElementById('intakeCreateCounterpartyType')?.addEventListener('change', syncIntakeCreateCounterpartyOptions);
  document.getElementById('intakeCreateCounterparty')?.addEventListener('change', function() {
    const manualWrap = document.getElementById('intakeCreateCounterpartyManualWrap');
    if (manualWrap) manualWrap.hidden = this.value !== '__manual__';
  });
}

function getNextClientId() {
  const maxId = clientsData.reduce((max, client) => Math.max(max, Number(client.id) || 0), 0);
  return maxId + 1;
}

function addClient() {
  const name = prompt('Имя клиента');
  if (!name) return;
  const phone = prompt('Телефон клиента', '+998 ');
  if (!phone) return;
  const email = prompt('Email клиента', '');
  const now = new Date();
  const date = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
  clientsData.unshift({
    id: getNextClientId(),
    name: name.trim(),
    phone: phone.trim(),
    email: (email || '').trim(),
    orders: 0,
    total: '0 сум',
    date
  });
  renderClients();
}

function editClient(clientId) {
  const client = clientsData.find(item => String(item.id) === String(clientId));
  if (!client) return;
  const name = prompt('Изменить имя клиента', client.name);
  if (!name) return;
  const phone = prompt('Изменить телефон клиента', client.phone);
  if (!phone) return;
  const email = prompt('Изменить email клиента', client.email);
  client.name = name.trim();
  client.phone = phone.trim();
  client.email = (email || '').trim();
  renderClients();
}

function deleteClient(clientId) {
  const client = clientsData.find(item => String(item.id) === String(clientId));
  if (!client) return;
  if (!confirm(`Удалить клиента "${client.name}"?`)) return;
  clientsData = clientsData.filter(item => String(item.id) !== String(clientId));
  renderClients();
}

function viewClient(clientId) {
  const client = clientsData.find(item => String(item.id) === String(clientId));
  if (!client) return;
  alert(`Клиент: ${client.name}\nТелефон: ${client.phone}\nEmail: ${client.email}\nЗаказов: ${client.orders}\nСумма: ${client.total}`);
}

function viewOrder(orderId) {
  const order = ordersData.find(item => item.id === orderId);
  if (!order) return;
  alert(`Заказ: ${order.id}\nКлиент: ${order.client}\nТовары: ${order.items}\nСумма: ${order.amount}\nСтатус: ${statusMap[order.status]}`);
}

function setOrderStatus(orderId) {
  const order = ordersData.find(item => item.id === orderId);
  if (!order) return;
  const variants = ['processing', 'ready_to_ship', 'out_of_stock', 'successful'];
  const current = order.status || 'processing';
  const raw = prompt(
    'Укажите статус заказа:\nprocessing — В обработке\nready_to_ship — Готов к перевозке\nout_of_stock — Нет товара\nsuccessful — Успешный',
    current
  );
  if (raw === null) return;
  const normalized = String(raw).trim().toLowerCase();
  if (!variants.includes(normalized)) {
    alert('Неверный статус. Допустимо: processing, ready_to_ship, out_of_stock, successful.');
    return;
  }
  order.status = normalized;
  applyOrdersStatusFilter();
}

// ===== RENDER ALL =====
renderOrders();
renderClients();
renderSuppliers();
renderProducts();
renderBanners();
renderIntake();
setupIntakeFilters();
syncIntakeCounterpartyControls();
resetBannerForm();
setBannerReadonlyMode();
resetSupplierForm();

void (async () => {
  try {
    const raw = await window.emirateSupabaseApi?.pullAdminProductsRaw?.();
    if (!raw || !raw.length) return;
    productsData = raw
      .map((item) => normalizeProductRecord(item))
      .filter((item) => item && item.id);
    try {
      localStorage.setItem(ADMIN_PRODUCTS_KEY, JSON.stringify(productsData));
    } catch (error) {
      // quota: keep in-memory only
    }
    renderProducts();
  } catch (err) {
    console.warn('[Supabase] admin products pull', err);
  }
})();

document.getElementById('addClientBtn')?.addEventListener('click', addClient);
document.getElementById('supplierForm')?.addEventListener('submit', saveSupplier);

document.getElementById('addSupplierBtn')?.addEventListener('click', function() {
  switchPage('suppliers');
  resetSupplierForm();
  document.getElementById('supplierName')?.focus();
  showSupplierFeedback('Режим создания поставщика включен.', 'success');
});

document.getElementById('supplierResetBtn')?.addEventListener('click', function() {
  resetSupplierForm();
  showSupplierFeedback('Форма очищена.', 'success');
});

document.getElementById('clientsBody')?.addEventListener('click', function(e) {
  const button = e.target.closest('button[data-action]');
  if (!button) return;
  const action = button.getAttribute('data-action');
  const clientId = button.getAttribute('data-client-id');
  if (!clientId) return;

  if (action === 'view-client') viewClient(clientId);
  if (action === 'edit-client') editClient(clientId);
  if (action === 'delete-client') deleteClient(clientId);
});

document.getElementById('ordersBody')?.addEventListener('click', function(e) {
  const button = e.target.closest('button[data-action]');
  if (!button) return;
  const action = button.getAttribute('data-action');
  const orderId = button.getAttribute('data-order-id');
  if (!orderId) return;

  if (action === 'view-order') viewOrder(orderId);
  if (action === 'edit-order') setOrderStatus(orderId);
});

document.getElementById('suppliersBody')?.addEventListener('click', function(e) {
  const button = e.target.closest('button[data-action]');
  if (!button) return;
  const action = button.getAttribute('data-action');
  const supplierId = button.getAttribute('data-supplier-id');
  if (!supplierId) return;

  if (action === 'edit-supplier') {
    switchPage('suppliers');
    fillSupplierForm(supplierId);
    showSupplierFeedback('Поставщик загружен в форму для редактирования.', 'success');
    return;
  }
  if (action === 'toggle-supplier') {
    toggleSupplierStatus(supplierId);
    return;
  }
  if (action === 'delete-supplier') {
    deleteSupplier(supplierId);
  }
});

document.getElementById('clientsFilterBtn')?.addEventListener('click', function() {
  const minOrdersRaw = prompt('Показать клиентов с количеством заказов не меньше:', '1');
  if (minOrdersRaw === null) return;
  const minOrders = Number(minOrdersRaw);
  if (!Number.isFinite(minOrders)) {
    alert('Введите число');
    return;
  }
  renderClients(clientsData.filter(item => Number(item.orders) >= minOrders));
});

document.getElementById('ordersStatusFilter')?.addEventListener('change', applyOrdersStatusFilter);

document.getElementById('addIntakeBtn')?.addEventListener('click', function() {
  resetIntakeCreateForm();
});

document.getElementById('intakeCreateCancelBtn')?.addEventListener('click', function() {
  const panel = document.getElementById('intakeCreatePanel');
  if (panel) panel.hidden = true;
});

document.getElementById('intakeCreateForm')?.addEventListener('submit', function(e) {
  e.preventDefault();
  const invoice = document.getElementById('intakeCreateInvoice')?.value.trim();
  const counterpartyType = document.getElementById('intakeCreateCounterpartyType')?.value || 'Поставщик';
  const counterpartySelect = document.getElementById('intakeCreateCounterparty')?.value || '';
  const counterpartyManual = document.getElementById('intakeCreateCounterpartyManual')?.value.trim() || '';
  const counterparty = counterpartySelect === '__manual__' ? counterpartyManual : counterpartySelect;
  const type = document.getElementById('intakeCreateType')?.value || 'income';
  const description = document.getElementById('intakeCreateDescription')?.value.trim() || 'Новая приёмка';
  const value1 = document.getElementById('intakeCreateValue1')?.value.trim() || '0 сум';
  const value2 = document.getElementById('intakeCreateValue2')?.value.trim() || '0 UZS';
  const pin = document.getElementById('intakeCreatePin')?.value.trim() || `T${Math.floor(Math.random() * 900000 + 100000)}`;

  if (!invoice) {
    alert('Введите номер накладной.');
    return;
  }
  if (!counterparty) {
    alert('Выберите или введите контрагента.');
    return;
  }

  intakeData.unshift({
    id: `INT-${String(Date.now()).slice(-6)}`,
    invoice,
    counterparty,
    counterpartyType,
    type,
    description,
    value1,
    value2,
    pin,
    date: getDateTimeString()
  });

  const panel = document.getElementById('intakeCreatePanel');
  if (panel) panel.hidden = true;
  syncIntakeCounterpartyControls();
  applyIntakeFilters();
});

document.getElementById('bannerForm')?.addEventListener('submit', saveBanner);

document.getElementById('bannerResetBtn')?.addEventListener('click', function() {
  if (!canManageBanners) return;
  resetBannerForm();
  showBannerFeedback('Форма очищена. Можно создавать новый слайд.');
});

document.getElementById('addBannerBtn')?.addEventListener('click', function() {
  if (!canManageBanners) {
    showBannerFeedback('Недостаточно прав для изменения баннеров.', 'error');
    alert('Недостаточно прав для изменения баннеров.');
    return;
  }
  switchPage('banners');
  resetBannerForm();
  document.getElementById('bannerTag')?.focus();
  showBannerFeedback('Режим создания нового слайда включен.', 'success');
});

document.getElementById('bannerRestoreDefaultBtn')?.addEventListener('click', function() {
  restoreDefaultBanners();
});

['bannerTag', 'bannerTitle', 'bannerDesc', 'bannerPrimaryText', 'bannerSecondaryText', 'bannerActive'].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  const eventName = id === 'bannerActive' ? 'change' : 'input';
  el.addEventListener(eventName, function() {
    renderBannerPreview(getBannerPreviewDataFromForm());
  });
});

document.getElementById('bannerImageInput')?.addEventListener('change', function() {
  if (!canManageBanners) return;
  const file = this.files?.[0];
  const bannerImageMeta = document.getElementById('bannerImageMeta');
  if (!file) {
    if (!bannerFormImage && bannerImageMeta) bannerImageMeta.textContent = 'Изображение не выбрано';
    showBannerFeedback('Изображение не выбрано.');
    return;
  }
  if (!file.type.startsWith('image/')) {
    showBannerFeedback('Можно загрузить только изображение.', 'error', 3200);
    alert('Можно загрузить только изображение.');
    this.value = '';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showBannerFeedback('Файл больше 5MB и не был добавлен.', 'error', 3200);
    alert('Файл больше 5MB и не был добавлен.');
    this.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = async function(e) {
    const imageData = String(e.target?.result || '');
    try {
      const meta = await getImageMeta(imageData);
      if (meta.ratio < BANNER_IMAGE_RATIO_MIN || meta.ratio > BANNER_IMAGE_RATIO_MAX) {
        showBannerFeedback('Неверная пропорция изображения для баннера.', 'error', 3800);
        alert(`Неверная пропорция изображения (${meta.width}x${meta.height}). Используйте горизонтальный баннер примерно 16:6.`);
        if (bannerImageMeta) bannerImageMeta.textContent = 'Изображение не выбрано';
        return;
      }
      bannerFormImage = imageData;
      if (bannerImageMeta) bannerImageMeta.textContent = `Загружено: ${file.name} (${meta.width}x${meta.height})`;
      renderBannerPreview(getBannerPreviewDataFromForm());
      showBannerFeedback(`Изображение загружено: ${file.name}.`, 'success');
    } catch (_) {
      showBannerFeedback('Не удалось обработать изображение.', 'error', 3200);
      alert('Не удалось обработать изображение.');
    }
  };
  reader.readAsDataURL(file);
  this.value = '';
});

document.getElementById('bannersBody')?.addEventListener('click', function(e) {
  const button = e.target.closest('button[data-action]');
  if (!button) return;
  const bannerId = button.getAttribute('data-banner-id');
  if (!bannerId) return;
  const action = button.getAttribute('data-action');

  if (action === 'edit-banner') {
    switchPage('banners');
    fillBannerForm(bannerId);
    return;
  }
  if (action === 'toggle-banner') {
    toggleBannerStatus(bannerId);
    return;
  }
  if (action === 'delete-banner') {
    deleteBanner(bannerId);
  }
});

// ===== PRODUCT EDITOR =====
let editingProductId = null;
const editorDescriptionPreview = document.getElementById('editorDescriptionPreview');
const editorSpecsPreview = document.getElementById('editorSpecsPreview');

function getEditorDescriptionText() {
  const ru = document.getElementById('pDescRu')?.value?.trim() || '';
  const uz = document.getElementById('pDescUz')?.value?.trim() || '';
  return ru || uz;
}

function renderEditorDescriptionPreview() {
  if (!editorDescriptionPreview) return;
  const descriptionText = getEditorDescriptionText();
  if (!descriptionText) {
    editorDescriptionPreview.innerHTML = '<p class="editor-live-empty">Введите описание, чтобы увидеть предпросмотр.</p>';
    return;
  }

  const paragraphs = descriptionText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');

  editorDescriptionPreview.innerHTML = paragraphs;
}

function renderEditorSpecsPreview() {
  if (!editorSpecsPreview) return;
  const specs = getSpecsFromEditor();
  if (!specs.length) {
    editorSpecsPreview.innerHTML = '<p class="editor-live-empty">Добавьте характеристики, чтобы увидеть предпросмотр.</p>';
    return;
  }

  editorSpecsPreview.innerHTML = specs
    .map((spec) => `
      <div class="editor-live-specs-row">
        <span class="editor-live-spec-label">${escapeHtml(spec.keyRu || spec.keyUz)}</span>
        <span class="editor-live-spec-value">${escapeHtml(spec.valueRu || spec.valueUz)}</span>
      </div>
    `)
    .join('');
}

function renderProductEditorPreviews() {
  renderEditorDescriptionPreview();
  renderEditorSpecsPreview();
}

const colorNameRuInput = document.getElementById('pColorNameRu');
const colorNameUzInput = document.getElementById('pColorNameUz');
const colorHexInput = document.getElementById('pColorHex');
const colorStatusInput = document.getElementById('pColorStatus');
const colorAttrNameRuInput = document.getElementById('pColorAttrNameRu');
const colorAttrNameUzInput = document.getElementById('pColorAttrNameUz');
const colorAttrStatusInput = document.getElementById('pColorAttrStatus');
const colorAttrTypeInput = document.getElementById('pColorAttrType');
const colorVariantPhotoInput = document.getElementById('colorVariantPhotoInput');
const colorVariantPhotoPreview = document.getElementById('colorVariantPhotoPreview');
const colorVariantsList = document.getElementById('colorVariantsList');
const colorVariantSaveBtn = document.getElementById('colorVariantSaveBtn');
const colorVariantResetBtn = document.getElementById('colorVariantResetBtn');

let productColorVariants = [];
let productColorMeta = {
  nameRu: 'Цвет',
  nameUz: 'rang',
  status: 'active',
  type: 'image'
};
let editingColorVariantId = null;
let uploadedColorVariantPhotos = [];

function normalizeColorHex(value) {
  const hex = String(value || '').trim().replace(/^#/, '');
  if (!hex) return '';
  return /^[0-9a-f]{3,8}$/i.test(hex) ? `#${hex}` : '';
}

function syncColorMetaFromForm() {
  productColorMeta = {
    nameRu: String(colorAttrNameRuInput?.value || 'Цвет').trim() || 'Цвет',
    nameUz: String(colorAttrNameUzInput?.value || 'rang').trim() || 'rang',
    status: colorAttrStatusInput?.value === 'inactive' ? 'inactive' : 'active',
    type: colorAttrTypeInput?.value === 'text' ? 'text' : 'image'
  };
}

function getColorVariantDisplayName(variant) {
  return variant.nameRu || variant.nameUz || 'Без названия';
}

function renderColorVariantPhotoPreview() {
  if (!colorVariantPhotoPreview) return;
  colorVariantPhotoPreview.innerHTML = uploadedColorVariantPhotos.map((src, idx) => `
    <div class="photo-preview-item">
      <img src="${src}" alt="Color photo">
      <button class="photo-remove" onclick="removeColorVariantPhoto(${idx})">×</button>
    </div>
  `).join('');
}

function resetColorVariantForm() {
  editingColorVariantId = null;
  uploadedColorVariantPhotos = [];
  if (colorNameRuInput) colorNameRuInput.value = '';
  if (colorNameUzInput) colorNameUzInput.value = '';
  if (colorHexInput) colorHexInput.value = '';
  if (colorStatusInput) colorStatusInput.value = 'active';
  if (colorVariantSaveBtn) colorVariantSaveBtn.textContent = '+ Добавить цвет';
  renderColorVariantPhotoPreview();
}

function renderColorVariantsList() {
  if (!colorVariantsList) return;
  syncColorMetaFromForm();
  const isInactive = productColorMeta.status === 'inactive';
  const isText = productColorMeta.type === 'text';
  if (!productColorVariants.length) {
    colorVariantsList.innerHTML = `<p class="color-variant-empty">Цвета еще не добавлены.${isInactive ? ' Атрибут отключен.' : ''}${isText ? ' Тип: текст.' : ''}</p>`;
    return;
  }

  colorVariantsList.innerHTML = productColorVariants.map((variant) => `
    <div class="color-variant-item">
      <div class="color-variant-item-main">
        <div class="color-variant-item-title">
          <span class="color-variant-dot" style="background:${escapeHtml(variant.swatch || '#cbd5e1')}"></span>
          ${escapeHtml(getColorVariantDisplayName(variant))}
        </div>
        <div class="color-variant-item-meta">Фото: ${variant.photos.length} · UZ: ${escapeHtml(variant.nameUz || '—')} · ${variant.status === 'inactive' ? 'Отключено' : 'Включено'} · ${isText ? 'Текст' : 'Изображение'}</div>
      </div>
      <div class="color-variant-item-actions">
        <button type="button" class="action-btn" data-action="edit-color-variant" data-color-id="${escapeHtml(variant.id)}" title="Редактировать"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button type="button" class="action-btn" data-action="toggle-color-variant" data-color-id="${escapeHtml(variant.id)}" title="Переключить статус">${variant.status === 'inactive' ? '↻' : '⏸'}</button>
        <button type="button" class="action-btn delete" data-action="delete-color-variant" data-color-id="${escapeHtml(variant.id)}" title="Удалить"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
      </div>
    </div>
  `).join('');
}

function fillColorVariantForm(id) {
  const variant = productColorVariants.find((item) => item.id === id);
  if (!variant) return;
  editingColorVariantId = variant.id;
  uploadedColorVariantPhotos = Array.isArray(variant.photos) ? [...variant.photos] : [];
  if (colorNameRuInput) colorNameRuInput.value = variant.nameRu || '';
  if (colorNameUzInput) colorNameUzInput.value = variant.nameUz || '';
  if (colorHexInput) colorHexInput.value = variant.swatch || '';
  if (colorStatusInput) colorStatusInput.value = variant.status === 'inactive' ? 'inactive' : 'active';
  if (colorVariantSaveBtn) colorVariantSaveBtn.textContent = 'Обновить цвет';
  renderColorVariantPhotoPreview();
}

function saveColorVariant() {
  const nameRu = colorNameRuInput?.value?.trim() || '';
  const nameUz = colorNameUzInput?.value?.trim() || '';
  const swatch = normalizeColorHex(colorHexInput?.value);
  const status = colorStatusInput?.value === 'inactive' ? 'inactive' : 'active';
  const photos = uploadedColorVariantPhotos.filter(Boolean);

  if (!nameRu && !nameUz) {
    alert('Введите название цвета хотя бы на одном языке.');
    return;
  }
  const nextVariant = {
    id: editingColorVariantId || `color_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    nameRu,
    nameUz,
    name: nameRu || nameUz,
    status,
    swatch,
    photos: [...photos]
  };

  if (editingColorVariantId) {
    productColorVariants = productColorVariants.map((item) => item.id === editingColorVariantId ? nextVariant : item);
  } else {
    productColorVariants.push(nextVariant);
  }

  renderColorVariantsList();
  resetColorVariantForm();
}

// Tab switching
const editorTabs = document.querySelectorAll('.editor-tab');
const editorTabContents = document.querySelectorAll('.editor-tab-content');

editorTabs.forEach(tab => {
  tab.addEventListener('click', function(e) {
    e.preventDefault();
    const tabName = this.dataset.tab;

    editorTabs.forEach(t => t.classList.remove('active'));
    editorTabContents.forEach(c => c.classList.remove('active'));

    this.classList.add('active');
    const target = document.querySelector(`.editor-tab-content[data-tab="${tabName}"]`);
    if (target) target.classList.add('active');
  });
});

// Open editor for new product
document.getElementById('addProductBtn').addEventListener('click', function() {
  editingProductId = null;
  clearEditorForm();
  document.getElementById('editorBreadcrumb').textContent = 'Добавить';
  pageTitle.textContent = 'Продукты › Добавить';
  switchPage('product-editor');
  // Reset to first tab
  editorTabs.forEach(t => t.classList.remove('active'));
  editorTabContents.forEach(c => c.classList.remove('active'));
  editorTabs[0].classList.add('active');
  editorTabContents[0].classList.add('active');
});

// Open editor for existing product
function openEditorForProduct(id) {
  const p = productsData.find(x => x.id === id);
  if (!p) return;

  editingProductId = id;
  clearEditorForm();

  // Fill form fields
  document.getElementById('pCategory').value = p.category || '';
  document.getElementById('pNameUz').value = p.nameUz || '';
  document.getElementById('pNameRu').value = p.nameRu || '';
  document.getElementById('pModel').value = p.model || '';
  document.getElementById('pBrand').value = p.brand || '';
  document.getElementById('pStatus').value = p.status || 'active';
  document.getElementById('pInstallment').value = p.installmentStatus || 'active';
  document.getElementById('pPromo').value = p.promo || 'no';
  document.getElementById('pExpress').value = p.express || 'no';
  document.getElementById('pCondition').value = p.condition || 'Есть в наличии';
  document.getElementById('pPriority').value = String(Number.isFinite(Number(p.priority)) ? Number(p.priority) : 300);
  document.getElementById('pDeliveryArea').value = p.deliveryArea || '';
  document.getElementById('pDescUz').value = p.descUz || '';
  document.getElementById('pDescRu').value = p.descRu || '';
  document.getElementById('pPrice').value = p.price || '';
  document.getElementById('pOldPrice').value = p.oldPrice || '';
  renderSpecsRows(Array.isArray(p.specs) ? p.specs : []);
  productColorVariants = Array.isArray(p.colors) ? p.colors.map((item) => ({
    id: String(item?.id || `color_${Date.now()}_${Math.floor(Math.random() * 1000)}`),
    nameRu: String(item?.nameRu || item?.name || '').trim(),
    nameUz: String(item?.nameUz || '').trim(),
    name: String(item?.nameRu || item?.nameUz || item?.name || '').trim(),
    status: item?.status === 'inactive' ? 'inactive' : 'active',
    swatch: normalizeColorHex(item?.swatch),
    photos: Array.isArray(item?.photos) ? item.photos.filter(Boolean) : []
  })).filter((item) => (item.nameRu || item.nameUz)) : [];
  productColorMeta = {
    nameRu: String(p.colorMeta?.nameRu || 'Цвет').trim() || 'Цвет',
    nameUz: String(p.colorMeta?.nameUz || 'rang').trim() || 'rang',
    status: p.colorMeta?.status === 'inactive' ? 'inactive' : 'active',
    type: p.colorMeta?.type === 'text' ? 'text' : 'image'
  };
  if (colorAttrNameRuInput) colorAttrNameRuInput.value = productColorMeta.nameRu;
  if (colorAttrNameUzInput) colorAttrNameUzInput.value = productColorMeta.nameUz;
  if (colorAttrStatusInput) colorAttrStatusInput.value = productColorMeta.status;
  if (colorAttrTypeInput) colorAttrTypeInput.value = productColorMeta.type;
  renderColorVariantsList();
  resetColorVariantForm();
  uploadedPhotos = Array.isArray(p.photos) ? [...p.photos] : [];
  renderPhotoPreviews();
  renderProductEditorPreviews();

  document.getElementById('editorBreadcrumb').textContent = 'Редактировать';
  pageTitle.textContent = 'Продукты › Редактировать';

  switchPage('product-editor');

  // Reset to first tab
  editorTabs.forEach(t => t.classList.remove('active'));
  editorTabContents.forEach(c => c.classList.remove('active'));
  editorTabs[0].classList.add('active');
  editorTabContents[0].classList.add('active');
}

// Clear all form fields
function clearEditorForm() {
  document.getElementById('pCategory').value = '';
  document.getElementById('pNameUz').value = '';
  document.getElementById('pNameRu').value = '';
  document.getElementById('pModel').value = '';
  document.getElementById('pBrand').value = '';
  document.getElementById('pBarcode').value = '';
  document.getElementById('pStatus').value = 'active';
  document.getElementById('pInstallment').value = 'active';
  document.getElementById('pPromo').value = 'no';
  document.getElementById('pExpress').value = 'no';
  document.getElementById('pPriority').value = '300';
  document.getElementById('pDeliveryArea').value = '';
  document.getElementById('pDescUz').value = '';
  document.getElementById('pDescRu').value = '';
  document.getElementById('pPrice').value = '';
  document.getElementById('pOldPrice').value = '';
  document.getElementById('pMarginPrice').value = '';
  document.getElementById('pCostPrice').value = '';
  document.getElementById('pInstallmentMonths').value = '';
  document.getElementById('pVideoUrl').value = '';
  document.getElementById('videoPreview').innerHTML = '';
  uploadedPhotos = [];
  renderPhotoPreviews();

  renderSpecsRows([]);
  productColorVariants = [];
  productColorMeta = { nameRu: 'Цвет', nameUz: 'rang', status: 'active', type: 'image' };
  if (colorAttrNameRuInput) colorAttrNameRuInput.value = productColorMeta.nameRu;
  if (colorAttrNameUzInput) colorAttrNameUzInput.value = productColorMeta.nameUz;
  if (colorAttrStatusInput) colorAttrStatusInput.value = productColorMeta.status;
  if (colorAttrTypeInput) colorAttrTypeInput.value = productColorMeta.type;
  renderColorVariantsList();
  resetColorVariantForm();
  renderProductEditorPreviews();

  // Clear validation errors
  document.querySelectorAll('.editor-section .form-group').forEach(g => g.classList.remove('error'));
}

function getSpecRowMarkup(spec = {}) {
  const keyRu = String(spec.keyRu || spec.key || '').trim();
  const keyUz = String(spec.keyUz || '').trim();
  const valueRu = String(spec.valueRu || spec.value || '').trim();
  const valueUz = String(spec.valueUz || '').trim();
  return `
    <div class="spec-row">
      <div class="spec-field">
        <label>Название Ru</label>
        <input type="text" placeholder="Напр. Память" class="spec-key-ru" value="${escapeHtml(keyRu)}">
      </div>
      <div class="spec-field">
        <label>Название Uz</label>
        <input type="text" placeholder="Masalan: Xotira" class="spec-key-uz" value="${escapeHtml(keyUz)}">
      </div>
      <div class="spec-field">
        <label>Значение Ru</label>
        <input type="text" placeholder="Напр. 256 GB" class="spec-value-ru" value="${escapeHtml(valueRu)}">
      </div>
      <div class="spec-field">
        <label>Значение Uz</label>
        <input type="text" placeholder="Masalan: 256 GB" class="spec-value-uz" value="${escapeHtml(valueUz)}">
      </div>
      <button class="action-btn delete spec-remove" title="Удалить"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
    </div>
  `;
}

function renderSpecsRows(specs = []) {
  const container = document.getElementById('specsContainer');
  if (!container) return;
  const rows = Array.isArray(specs)
    ? specs.filter((item) => item?.key || item?.value || item?.keyRu || item?.keyUz || item?.valueRu || item?.valueUz)
    : [];
  container.innerHTML = rows.length ? rows.map((item) => getSpecRowMarkup(item)).join('') : getSpecRowMarkup();
  renderEditorSpecsPreview();
}

function getSpecsFromEditor() {
  const rows = Array.from(document.querySelectorAll('#specsContainer .spec-row'));
  return rows
    .map((row) => ({
      keyRu: row.querySelector('.spec-key-ru')?.value?.trim() || '',
      keyUz: row.querySelector('.spec-key-uz')?.value?.trim() || '',
      valueRu: row.querySelector('.spec-value-ru')?.value?.trim() || '',
      valueUz: row.querySelector('.spec-value-uz')?.value?.trim() || ''
    }))
    .filter((item) => (item.keyRu || item.keyUz) && (item.valueRu || item.valueUz))
    .map((item) => ({
      ...item,
      key: item.keyRu || item.keyUz,
      value: item.valueRu || item.valueUz
    }));
}

// Cancel editor → go back to products
document.getElementById('editorCancelBtn').addEventListener('click', function() {
  switchPage('products');
});

// Save product
document.getElementById('productSaveBtn').addEventListener('click', async function() {
  if (activeAssetUploads > 0) {
    alert('Дождитесь завершения загрузки фото, затем сохраните товар.');
    return;
  }
  const nameRu = document.getElementById('pNameRu').value.trim();
  const nameUz = document.getElementById('pNameUz').value.trim();
  const category = document.getElementById('pCategory').value;
  const status = document.getElementById('pStatus').value;
  const installmentStatus = document.getElementById('pInstallment').value;
  const promo = document.getElementById('pPromo').value;
  const express = document.getElementById('pExpress').value;
  const condition = document.getElementById('pCondition').value.trim() || 'Есть в наличии';
  const deliveryArea = document.getElementById('pDeliveryArea').value.trim();
  const descUz = document.getElementById('pDescUz').value.trim();
  const descRu = document.getElementById('pDescRu').value.trim();
  const priority = Number(document.getElementById('pPriority').value);
  const price = document.getElementById('pPrice').value.trim();
  const oldPrice = document.getElementById('pOldPrice').value.trim();
  const brand = document.getElementById('pBrand').value;
  const model = document.getElementById('pModel').value.trim();
  const specs = getSpecsFromEditor();
  const colorMeta = {
    nameRu: String(colorAttrNameRuInput?.value || 'Цвет').trim() || 'Цвет',
    nameUz: String(colorAttrNameUzInput?.value || 'rang').trim() || 'rang',
    status: colorAttrStatusInput?.value === 'inactive' ? 'inactive' : 'active',
    type: colorAttrTypeInput?.value === 'text' ? 'text' : 'image'
  };
  const colors = productColorVariants.map((item) => ({
    id: String(item.id || `color_${Date.now()}_${Math.floor(Math.random() * 1000)}`),
    nameRu: String(item.nameRu || item.name || '').trim(),
    nameUz: String(item.nameUz || '').trim(),
    name: String(item.nameRu || item.nameUz || item.name || '').trim(),
    status: item.status === 'inactive' ? 'inactive' : 'active',
    swatch: normalizeColorHex(item.swatch),
    photos: Array.isArray(item.photos) ? item.photos.filter(Boolean) : []
  })).filter((item) => (item.nameRu || item.nameUz));

  // Validation
  let hasError = false;
  const nameRuGroup = document.getElementById('pNameRu').closest('.form-group');
  const nameUzGroup = document.getElementById('pNameUz').closest('.form-group');

  nameRuGroup.classList.remove('error');
  nameUzGroup.classList.remove('error');

  if (!nameRu) {
    nameRuGroup.classList.add('error');
    hasError = true;
  }
  if (!nameUz) {
    nameUzGroup.classList.add('error');
    hasError = true;
  }

  if (hasError) {
    // Switch to basic tab
    editorTabs.forEach(t => t.classList.remove('active'));
    editorTabContents.forEach(c => c.classList.remove('active'));
    editorTabs[0].classList.add('active');
    editorTabContents[0].classList.add('active');
    return;
  }

  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  const dateStr = `${dd}.${mm}.${yyyy}`;
  let focusPersistId = editingProductId;
  let removedMediaUrls = [];

  if (editingProductId) {
    const idx = productsData.findIndex(p => p.id === editingProductId);
    if (idx !== -1) {
      const previousProduct = productsData[idx];
      productsData[idx] = normalizeProductRecord({
        ...previousProduct,
        nameRu,
        nameUz,
        category,
        status,
        installmentStatus,
        promo,
        express,
        condition,
        deliveryArea,
        descUz,
        descRu,
        specs,
        colorMeta,
        colors,
        priority: Number.isFinite(priority) ? priority : 300,
        price,
        oldPrice,
        brand,
        model,
        date: dateStr,
        photos: [...uploadedPhotos]
      });
      const previousUrls = collectProductMediaUrls(previousProduct);
      const nextUrls = collectProductMediaUrls(productsData[idx]);
      removedMediaUrls = previousUrls.filter((url) => !nextUrls.includes(url));
    }
  } else {
    const newId = 'T' + (Math.floor(Math.random() * 90000) + 10000);
    focusPersistId = newId;
    productsData.unshift(normalizeProductRecord({
      id: newId,
      nameRu,
      nameUz,
      category,
      price,
      oldPrice,
      status,
      installmentStatus,
      promo,
      express,
      condition,
      deliveryArea,
      descUz,
      descRu,
      specs,
      colorMeta,
      colors,
      priority: Number.isFinite(priority) ? priority : 300,
      brand,
      model,
      date: dateStr,
      photos: [...uploadedPhotos]
    }));
  }

  if (!await persistProductsData(focusPersistId)) return;
  if (removedMediaUrls.length) {
    void window.emirateSupabaseApi?.removeAdminAssetsByUrls?.(removedMediaUrls);
  }
  renderProducts();
  switchPage('products');
});

// Delete product
async function deleteProduct(id) {
  if (!confirm('Удалить этот товар?')) return;
  productsData = productsData.filter(p => p.id !== id);
  if (!await persistProductsData()) return;
  renderProducts();
}

// ===== SPECS: Add / Remove =====
document.getElementById('addSpecBtn').addEventListener('click', function() {
  const container = document.getElementById('specsContainer');
  container.insertAdjacentHTML('beforeend', getSpecRowMarkup());
  renderEditorSpecsPreview();
});

document.getElementById('specsContainer').addEventListener('click', function(e) {
  const btn = e.target.closest('.spec-remove');
  if (btn) {
    btn.closest('.spec-row').remove();
    renderEditorSpecsPreview();
  }
});

document.getElementById('specsContainer').addEventListener('input', function(e) {
  if (
    e.target.classList.contains('spec-key-ru') ||
    e.target.classList.contains('spec-key-uz') ||
    e.target.classList.contains('spec-value-ru') ||
    e.target.classList.contains('spec-value-uz')
  ) {
    renderEditorSpecsPreview();
  }
});

document.getElementById('pDescRu')?.addEventListener('input', renderEditorDescriptionPreview);
document.getElementById('pDescUz')?.addEventListener('input', renderEditorDescriptionPreview);
renderProductEditorPreviews();
renderColorVariantsList();
resetColorVariantForm();

colorVariantSaveBtn?.addEventListener('click', saveColorVariant);
colorVariantResetBtn?.addEventListener('click', resetColorVariantForm);
colorAttrNameRuInput?.addEventListener('input', renderColorVariantsList);
colorAttrNameUzInput?.addEventListener('input', renderColorVariantsList);
colorAttrStatusInput?.addEventListener('change', renderColorVariantsList);
colorAttrTypeInput?.addEventListener('change', renderColorVariantsList);

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(String(event.target?.result || ''));
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image decode failed'));
    img.src = dataUrl;
  });
}

async function toOptimizedImageDataUrl(file) {
  const original = await readFileAsDataUrl(file);
  if (file.type === 'image/svg+xml') return original;
  const img = await loadImageFromDataUrl(original);
  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
  const height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return original;
  ctx.drawImage(img, 0, 0, width, height);
  const webp = canvas.toDataURL('image/webp', 0.78);
  if (webp && webp.startsWith('data:image/webp')) return webp;
  return canvas.toDataURL('image/jpeg', 0.8);
}

async function appendUploadedImages(files, target, render, options = {}) {
  for (const file of Array.from(files || [])) {
    if (!file.type.startsWith('image/')) continue;
    if (file.size > 12 * 1024 * 1024) {
      alert(`Файл "${file.name}" больше 12MB и не был добавлен.`);
      continue;
    }
    try {
      let finalSrc = '';
      if (window.emirateSupabaseApi?.isConfigured?.() && window.emirateSupabaseApi?.uploadAdminAsset) {
        setAssetUploadState(true);
        const uploadRes = await window.emirateSupabaseApi.uploadAdminAsset(file, options);
        setAssetUploadState(false);
        if (!uploadRes?.ok || !uploadRes.url) {
          throw new Error(uploadRes?.error || 'storage upload failed');
        }
        finalSrc = uploadRes.url;
      } else {
        const optimized = await toOptimizedImageDataUrl(file);
        finalSrc = optimized;
      }
      target.push(finalSrc);
      render();
    } catch (_) {
      alert(`Не удалось обработать файл "${file.name}".`);
    }
  }
}

colorVariantPhotoInput?.addEventListener('change', function() {
  appendUploadedImages(this.files, uploadedColorVariantPhotos, renderColorVariantPhotoPreview, { folder: 'product-colors' });
  this.value = '';
});

colorVariantsList?.addEventListener('click', function(e) {
  const button = e.target.closest('button[data-action]');
  if (!button) return;
  const colorId = button.getAttribute('data-color-id');
  if (!colorId) return;
  const action = button.getAttribute('data-action');
  if (action === 'edit-color-variant') {
    fillColorVariantForm(colorId);
    return;
  }
  if (action === 'toggle-color-variant') {
    productColorVariants = productColorVariants.map((item) => {
      if (item.id !== colorId) return item;
      return {
        ...item,
        status: item.status === 'inactive' ? 'active' : 'inactive'
      };
    });
    renderColorVariantsList();
    if (editingColorVariantId === colorId) {
      const edited = productColorVariants.find((item) => item.id === colorId);
      if (edited && colorStatusInput) {
        colorStatusInput.value = edited.status === 'inactive' ? 'inactive' : 'active';
      }
    }
    return;
  }
  if (action === 'delete-color-variant') {
    if (!confirm('Удалить этот цвет и связанные фото?')) return;
    productColorVariants = productColorVariants.filter((item) => item.id !== colorId);
    renderColorVariantsList();
    if (editingColorVariantId === colorId) {
      resetColorVariantForm();
    }
  }
});

document.getElementById('productsBody').addEventListener('click', function(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.getAttribute('data-product-id');
  if (!id) return;

  const action = btn.getAttribute('data-action');
  if (action === 'edit-product') {
    openEditorForProduct(id);
    return;
  }
  if (action === 'delete-product') {
    deleteProductAndSync(id);
  }
});

// ===== PHOTO UPLOAD =====
const photoInput = document.getElementById('photoInput');
const photoDropZone = document.getElementById('photoDropZone');
const photoPreviewGrid = document.getElementById('photoPreviewGrid');
let uploadedPhotos = [];

photoDropZone.addEventListener('click', function() {
  photoInput.click();
});

photoDropZone.addEventListener('dragover', function(e) {
  e.preventDefault();
  this.classList.add('dragover');
});

photoDropZone.addEventListener('dragleave', function() {
  this.classList.remove('dragover');
});

photoDropZone.addEventListener('drop', function(e) {
  e.preventDefault();
  this.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});

photoInput.addEventListener('change', function() {
  handleFiles(this.files);
  this.value = '';
});

function handleFiles(files) {
  appendUploadedImages(files, uploadedPhotos, renderPhotoPreviews, { folder: 'products' });
}

function renderPhotoPreviews() {
  photoPreviewGrid.innerHTML = uploadedPhotos.map((src, i) => `
    <div class="photo-preview-item">
      <img src="${src}" alt="Preview">
      <button class="photo-remove" onclick="removePhoto(${i})">×</button>
    </div>
  `).join('');
}

function removePhoto(index) {
  uploadedPhotos.splice(index, 1);
  renderPhotoPreviews();
}

function removeColorVariantPhoto(index) {
  uploadedColorVariantPhotos.splice(index, 1);
  renderColorVariantPhotoPreview();
}

// ===== VIDEO PREVIEW =====
const videoUrlInput = document.getElementById('pVideoUrl');
const videoPreview = document.getElementById('videoPreview');

videoUrlInput.addEventListener('input', function() {
  const url = this.value.trim();
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (ytMatch) {
    videoPreview.innerHTML = `<iframe src="https://www.youtube.com/embed/${ytMatch[1]}" allowfullscreen></iframe>`;
  } else {
    videoPreview.innerHTML = '';
  }
});

// ===== HEADER SEARCH =====
const headerSearch = document.querySelector('.admin-header-search input');
if (headerSearch) {
  headerSearch.addEventListener('input', function() {
    const query = this.value.toLowerCase();
    const activePage = document.querySelector('.admin-page.active')?.id || '';

    if (activePage === 'page-clients') {
      if (!query) return renderClients();
      return renderClients(clientsData.filter(c =>
        c.name.toLowerCase().includes(query)
        || c.phone.toLowerCase().includes(query)
        || c.email.toLowerCase().includes(query)
      ));
    }

    if (activePage === 'page-orders') {
      const statusFiltered = getFilteredOrdersByStatus();
      if (!query) return renderOrders(statusFiltered);
      return renderOrders(statusFiltered.filter(o =>
        o.id.toLowerCase().includes(query)
        || o.client.toLowerCase().includes(query)
        || o.phone.toLowerCase().includes(query)
        || o.items.toLowerCase().includes(query)
      ));
    }

    if (activePage === 'page-suppliers') {
      if (!query) return renderSuppliers();
      return renderSuppliers(suppliersData.filter(s =>
        s.name.toLowerCase().includes(query)
        || s.id.toLowerCase().includes(query)
        || s.phone.toLowerCase().includes(query)
        || s.status.toLowerCase().includes(query)
      ));
    }

    if (activePage === 'page-finance') {
      if (!query) return applyIntakeFilters();
      const searchInput = document.getElementById('intakeSearch');
      if (searchInput) {
        searchInput.value = query;
        applyIntakeFilters();
      }
      return;
    }

    if (!query) {
      renderProducts();
      return;
    }

    switchPage('products');
    const filtered = productsData.filter(p =>
      p.nameRu.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query) ||
      p.id.toLowerCase().includes(query) ||
      (p.brand && p.brand.toLowerCase().includes(query))
    );
    const tbody = document.getElementById('productsBody');
    tbody.innerHTML = filtered.map(renderProductRow).join('');
    document.getElementById('productsCount').textContent = `Найдено ${filtered.length} из ${productsData.length}`;
  });
}

window.switchPage = switchPage;
window.openEditorForProduct = openEditorForProduct;
window.deleteProduct = deleteProductAndSync;
window.removePhoto = removePhoto;
window.removeColorVariantPhoto = removeColorVariantPhoto;


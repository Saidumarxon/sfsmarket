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
  window.location.href = 'index.html';
}

const adminIdentity = String(adminSession?.role || adminSession?.user || '').toLowerCase();
const canManageBanners = /admin/.test(adminIdentity);
const ADMIN_SUPPLIERS_KEY = 'emirate_admin_suppliers_v2';

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
  categories: 'Категории',
  brands: 'Бренды',
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

  if (pageName === 'orders') {
    void loadOrdersFromSupabase();
  }

  if (pageName === 'clients') {
    void loadClientsFromSupabase();
  }

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
  window.location.href = 'index.html';
});

// ===== DEMO DATA =====

// --- Orders (Supabase) ---
let ordersData = [];

const ORDER_STATUS_VARIANTS = ['processing', 'ready_to_ship', 'out_of_stock', 'successful'];

const statusMap = {
  processing: 'В обработке',
  ready_to_ship: 'Готов к перевозке',
  out_of_stock: 'Нет товара',
  successful: 'Успешный',
};

const deliveryLabels = {
  door: 'Доставка до двери',
  pickup: 'Самовывоз',
};

const paymentLabels = {
  app: 'Через приложение или карту',
  cash: 'Наличными при получении',
  account: 'С лицевого счёта',
};

function normalizeOrderStatus(value) {
  const status = String(value || 'processing').trim().toLowerCase();
  return ORDER_STATUS_VARIANTS.includes(status) ? status : 'processing';
}

function formatOrderMoney(value) {
  const amount = Number(value) || 0;
  return amount.toLocaleString('ru-RU') + ' сум';
}

function formatOrderDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatOrderPublicId(uuid) {
  const raw = String(uuid || '').replace(/-/g, '');
  if (!raw) return '#—';
  return '#' + raw.slice(0, 8).toUpperCase();
}

function formatOrderItems(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return '—';
  return list
    .map((item) => {
      const title = String(item?.title || 'Товар').trim();
      const qty = Number(item?.qty) || 1;
      return qty > 1 ? `${title} ×${qty}` : title;
    })
    .join(', ');
}

function mapSupabaseOrderToAdminRow(row) {
  return {
    uuid: row.id,
    id: formatOrderPublicId(row.id),
    client: String(row.full_name || '—').trim() || '—',
    phone: String(row.phone || '—').trim() || '—',
    items: formatOrderItems(row.items),
    amount: formatOrderMoney(row.total_amount),
    status: normalizeOrderStatus(row.status),
    date: formatOrderDate(row.created_at),
    region: String(row.region || '').trim(),
    city: String(row.city || '').trim(),
    address: String(row.address || '').trim(),
    comment: String(row.comment_text || '').trim(),
    delivery: String(row.delivery_method || '').trim(),
    payment: String(row.payment_method || '').trim(),
    itemsList: Array.isArray(row.items) ? row.items : [],
    totalAmount: Number(row.total_amount) || 0,
    createdAt: row.created_at || null,
  };
}

function findOrderByKey(orderKey) {
  const key = String(orderKey || '');
  return ordersData.find((item) => item.uuid === key || item.id === key) || null;
}

const ORDER_STATUS_CHEVRON = '<svg class="order-status-picker__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

function renderOrderStatusPicker(order) {
  const status = normalizeOrderStatus(order.status);
  const options = ORDER_STATUS_VARIANTS.map((value) => `
    <button type="button" class="order-status-picker__option status-badge ${escapeHtml(value)}${value === status ? ' is-active' : ''}" data-value="${value}">
      <span class="status-dot"></span>${escapeHtml(statusMap[value])}
    </button>
  `).join('');
  return `
    <div class="order-status-picker" data-order-id="${escapeHtml(order.uuid)}">
      <button type="button" class="order-status-picker__trigger status-badge ${escapeHtml(status)}" aria-haspopup="listbox" aria-expanded="false" aria-label="Статус заказа ${escapeHtml(order.id)}">
        <span class="status-dot"></span>
        <span class="order-status-picker__label">${escapeHtml(statusMap[status])}</span>
        ${ORDER_STATUS_CHEVRON}
      </button>
      <div class="order-status-picker__menu" role="listbox" hidden>${options}</div>
    </div>
  `;
}

function closeAllOrderStatusPickers(exceptPicker) {
  document.querySelectorAll('.order-status-picker.is-open').forEach((picker) => {
    if (exceptPicker && picker === exceptPicker) return;
    picker.classList.remove('is-open');
    const menu = picker.querySelector('.order-status-picker__menu');
    const trigger = picker.querySelector('.order-status-picker__trigger');
    if (menu) menu.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  });
}

function toggleOrderStatusPicker(pickerEl) {
  if (!pickerEl) return;
  const willOpen = !pickerEl.classList.contains('is-open');
  closeAllOrderStatusPickers();
  if (!willOpen) return;
  pickerEl.classList.add('is-open');
  const menu = pickerEl.querySelector('.order-status-picker__menu');
  const trigger = pickerEl.querySelector('.order-status-picker__trigger');
  if (menu) menu.hidden = false;
  if (trigger) trigger.setAttribute('aria-expanded', 'true');
}

function setOrderStatusPickerLoading(pickerEl, loading) {
  if (!pickerEl) return;
  pickerEl.classList.toggle('is-loading', !!loading);
  const trigger = pickerEl.querySelector('.order-status-picker__trigger');
  if (trigger) trigger.disabled = !!loading;
}

function updateOrderStatusPickerUI(pickerEl, status) {
  if (!pickerEl) return;
  const normalized = normalizeOrderStatus(status);
  const trigger = pickerEl.querySelector('.order-status-picker__trigger');
  const label = pickerEl.querySelector('.order-status-picker__label');
  if (trigger) {
    ORDER_STATUS_VARIANTS.forEach((value) => trigger.classList.remove(value));
    trigger.classList.add(normalized);
  }
  if (label) label.textContent = statusMap[normalized] || normalized;
  pickerEl.querySelectorAll('.order-status-picker__option').forEach((btn) => {
    btn.classList.toggle('is-active', btn.getAttribute('data-value') === normalized);
  });
}

function renderOrderStats() {
  const processing = ordersData.filter((o) => o.status === 'processing').length;
  const ready = ordersData.filter((o) => o.status === 'ready_to_ship').length;
  const done = ordersData.filter((o) => o.status === 'successful').length;
  const elProcessing = document.getElementById('ordersStatProcessing');
  const elReady = document.getElementById('ordersStatReady');
  const elDone = document.getElementById('ordersStatDone');
  if (elProcessing) elProcessing.textContent = String(processing);
  if (elReady) elReady.textContent = String(ready);
  if (elDone) elDone.textContent = String(done);
}

function renderDashboardRecentOrders() {
  const tbody = document.getElementById('dashboardOrdersBody');
  if (!tbody) return;
  const recent = ordersData.slice(0, 5);
  if (!recent.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px;">Заказов пока нет</td></tr>';
    return;
  }
  tbody.innerHTML = recent.map((o) => `
    <tr>
      <td>${escapeHtml(o.id)}</td>
      <td>${escapeHtml(o.client)}</td>
      <td>${escapeHtml(o.amount)}</td>
      <td><span class="status-badge ${escapeHtml(o.status)}"><span class="status-dot"></span>${escapeHtml(statusMap[o.status] || o.status)}</span></td>
      <td>${escapeHtml(o.date)}</td>
    </tr>
  `).join('');
}

function renderOrders(data = ordersData) {
  const tbody = document.getElementById('ordersBody');
  const count = document.getElementById('ordersCount');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:24px;">Заказов пока нет. Они появятся после оформления на сайте.</td></tr>';
    if (count) count.textContent = 'Показано 0 из 0';
    return;
  }
  tbody.innerHTML = data.map((o) => `
    <tr>
      <td>${escapeHtml(o.id)}</td>
      <td>${escapeHtml(o.client)}</td>
      <td>${escapeHtml(o.phone)}</td>
      <td style="max-width:160px">${escapeHtml(o.items)}</td>
      <td>${escapeHtml(o.amount)}</td>
      <td>${renderOrderStatusPicker(o)}</td>
      <td>${escapeHtml(o.date)}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn" title="Подробнее" data-action="view-order" data-order-id="${escapeHtml(o.uuid)}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
        </div>
      </td>
    </tr>
  `).join('');
  if (count) count.textContent = `Показано ${data.length} из ${ordersData.length}`;
}

async function loadOrdersFromSupabase() {
  const tbody = document.getElementById('ordersBody');
  if (tbody && !ordersData.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:24px;">Загрузка заказов…</td></tr>';
  }
  if (!window.emirateSupabaseApi?.pullAdminOrdersRaw) {
    ordersData = [];
    renderOrderStats();
    renderDashboardRecentOrders();
    applyOrdersStatusFilter();
    return;
  }
  try {
    const raw = await window.emirateSupabaseApi.pullAdminOrdersRaw();
    if (raw === null) {
      ordersData = [];
    } else {
      ordersData = raw.map(mapSupabaseOrderToAdminRow);
    }
  } catch (err) {
    console.warn('[Supabase] admin orders pull', err);
    ordersData = [];
  }
  renderOrderStats();
  renderDashboardRecentOrders();
  applyOrdersStatusFilter();
}

function getFilteredOrdersByStatus() {
  const statusFilter = document.getElementById('ordersStatusFilter')?.value || 'all';
  if (statusFilter === 'all') return ordersData;
  return ordersData.filter((order) => order.status === statusFilter);
}

function applyOrdersStatusFilter() {
  renderOrders(getFilteredOrdersByStatus());
}

// --- Clients (Supabase customer_profiles) ---
let clientsData = [];
let clientsLoading = false;

function formatClientShortId(userId) {
  if (!userId) return '—';
  var n = 0;
  for (var i = 0; i < userId.length; i++) n = (n * 31 + userId.charCodeAt(i)) >>> 0;
  return 'E' + String(n % 1000000).padStart(6, '0');
}

function formatClientDate(value) {
  if (!value) return '—';
  var date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatClientProvider(value) {
  var key = String(value || '').toLowerCase();
  if (key === 'google') return 'Google';
  if (key === 'email') return 'Email';
  if (!key) return '—';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function mapCustomerProfileRow(row) {
  return {
    id: formatClientShortId(row.user_id),
    userId: row.user_id,
    name: String(row.full_name || row.email || '—').trim() || '—',
    phone: String(row.phone || '—').trim() || '—',
    email: String(row.email || '—').trim() || '—',
    provider: formatClientProvider(row.provider),
    orders: Number(row.orders_count) || 0,
    total: Number(row.orders_total) || 0,
    date: formatClientDate(row.registered_at),
    lastSeen: formatClientDate(row.last_seen_at),
    avatar: String(row.avatar_url || '').trim(),
    raw: row
  };
}

function setClientsLoadNote(message, isError) {
  const note = document.getElementById('clientsLoadNote');
  if (!note) return;
  note.textContent = message || '';
  note.hidden = !message;
  note.classList.toggle('is-error', !!isError);
}

async function loadClientsFromSupabase() {
  const sb = window.emirateSupabase;
  if (!sb || clientsLoading) return false;
  clientsLoading = true;
  setClientsLoadNote('Загрузка клиентов…', false);

  try {
    const res = await sb
      .from('customer_profiles')
      .select('*')
      .order('last_seen_at', { ascending: false });

    if (res.error) {
      setClientsLoadNote(
        'Не удалось загрузить клиентов. Выполните SQL: supabase/customer-profiles-migration.sql',
        true
      );
      clientsData = [];
      renderClients([]);
      return false;
    }

    clientsData = (res.data || []).map(mapCustomerProfileRow);
    setClientsLoadNote('');
    renderClients(clientsData);
    return true;
  } catch (_) {
    setClientsLoadNote('Ошибка загрузки клиентов', true);
    clientsData = [];
    renderClients([]);
    return false;
  } finally {
    clientsLoading = false;
  }
}

function renderClients(data = clientsData) {
  const tbody = document.getElementById('clientsBody');
  const count = document.getElementById('clientsCount');
  if (!tbody) return;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="table-empty">Клиенты не найдены</td></tr>';
    if (count) count.textContent = '0 клиентов';
    return;
  }

  tbody.innerHTML = data.map(c => `
    <tr>
      <td><code>${escapeHtml(c.id)}</code></td>
      <td>
        <div class="client-name-cell">
          ${c.avatar ? `<img class="client-avatar" src="${escapeHtml(c.avatar)}" alt="" width="32" height="32" referrerpolicy="no-referrer">` : ''}
          <strong>${escapeHtml(c.name)}</strong>
        </div>
      </td>
      <td>${escapeHtml(c.phone)}</td>
      <td>${escapeHtml(c.email)}</td>
      <td><span class="client-provider-badge">${escapeHtml(c.provider)}</span></td>
      <td>${c.orders}</td>
      <td>${escapeHtml(c.date)}</td>
      <td>${escapeHtml(c.lastSeen)}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn" title="Просмотр" data-action="view-client" data-client-id="${escapeHtml(c.userId || c.id)}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
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
  return [];
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
    if (!Array.isArray(parsed)) {
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

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px;">Нет поставщиков</td></tr>';
    count.textContent = 'Показано 0 из 0';
    return;
  }

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

const ADMIN_CATEGORIES_KEY = 'emirate_admin_categories_v1';

function defaultCategoriesData() {
  const seed = [
    { id: 'cat_smartphones', nameRu: 'Смартфоны', nameUz: 'Smartfonlar', sortOrder: 1 },
    { id: 'cat_laptops', nameRu: 'Ноутбуки', nameUz: 'Noutbuklar', sortOrder: 2 },
    { id: 'cat_tv', nameRu: 'ТВ и аудио', nameUz: 'TV va audio', sortOrder: 3 },
    { id: 'cat_appliances', nameRu: 'Бытовая техника', nameUz: 'Maishiy texnika', sortOrder: 4 },
    { id: 'cat_accessories', nameRu: 'Аксессуары', nameUz: 'Aksessuarlar', sortOrder: 5 },
    { id: 'cat_home', nameRu: 'Товары для дома', nameUz: 'Uy uchun tovarlar', sortOrder: 6 },
    { id: 'cat_beauty', nameRu: 'Красота и здоровье', nameUz: 'Go\'zallik va salomatlik', sortOrder: 7 }
  ];
  const smartphoneSpecs = [
    { keyRu: 'Память', keyUz: 'Xotira', valueRu: '', valueUz: '' },
    { keyRu: 'Экран', keyUz: 'Ekran', valueRu: '', valueUz: '' },
    { keyRu: 'Процессор', keyUz: 'Protsessor', valueRu: '', valueUz: '' },
    { keyRu: 'Камера', keyUz: 'Kamera', valueRu: '', valueUz: '' },
    { keyRu: 'Батарея', keyUz: 'Batareya', valueRu: '', valueUz: '' }
  ];
  const laptopSpecs = [
    { keyRu: 'Процессор', keyUz: 'Protsessor', valueRu: '', valueUz: '' },
    { keyRu: 'ОЗУ', keyUz: 'Operativ xotira', valueRu: '', valueUz: '' },
    { keyRu: 'Накопитель', keyUz: 'Xotira', valueRu: '', valueUz: '' },
    { keyRu: 'Экран', keyUz: 'Ekran', valueRu: '', valueUz: '' }
  ];
  const specMap = {
    'cat_smartphones': smartphoneSpecs,
    'cat_laptops': laptopSpecs
  };
  return seed.map((item) => ({
    ...item,
    isActive: true,
    defaultSpecs: specMap[item.id] || [],
    updatedAt: getDateTimeString()
  }));
}

function normalizeCategorySpec(spec) {
  const row = spec || {};
  return {
    keyRu: String(row.keyRu || row.key || '').trim(),
    keyUz: String(row.keyUz || '').trim(),
    valueRu: String(row.valueRu || row.value || '').trim(),
    valueUz: String(row.valueUz || '').trim()
  };
}

function normalizeCategoryRecord(record) {
  const category = record || {};
  const defaultSpecs = Array.isArray(category.defaultSpecs)
    ? category.defaultSpecs.map(normalizeCategorySpec).filter((item) => item.keyRu || item.keyUz)
    : [];
  return {
    id: category.id || `CAT-${Math.floor(Math.random() * 9000 + 1000)}`,
    nameRu: String(category.nameRu || '').trim(),
    nameUz: String(category.nameUz || '').trim(),
    sortOrder: Number.isFinite(Number(category.sortOrder)) ? Number(category.sortOrder) : 100,
    isActive: category.isActive !== false && category.status !== 'inactive',
    defaultSpecs,
    updatedAt: category.updatedAt || getDateTimeString()
  };
}

function loadCategoriesData() {
  try {
    const raw = localStorage.getItem(ADMIN_CATEGORIES_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed) || !parsed.length) {
      return defaultCategoriesData();
    }
    return parsed;
  } catch (_) {
    return defaultCategoriesData();
  }
}

let categoriesData = loadCategoriesData().map(normalizeCategoryRecord);
let categoryFeedbackTimer = null;

function persistCategoriesData() {
  localStorage.setItem(ADMIN_CATEGORIES_KEY, JSON.stringify(categoriesData));
}

function showCategoryFeedback(message, type = 'success', timeoutMs = 2800) {
  const node = document.getElementById('categoryFeedback');
  if (!node) return;
  node.textContent = message;
  node.classList.remove('success', 'error');
  node.classList.add(type === 'error' ? 'error' : 'success');
  node.removeAttribute('hidden');
  if (categoryFeedbackTimer) clearTimeout(categoryFeedbackTimer);
  categoryFeedbackTimer = setTimeout(() => {
    node.setAttribute('hidden', 'hidden');
    node.classList.remove('success', 'error');
  }, timeoutMs);
}

function renderCategorySpecsRows(specs = []) {
  const container = document.getElementById('categorySpecsContainer');
  if (!container) return;
  const rows = Array.isArray(specs)
    ? specs.filter((item) => item?.keyRu || item?.keyUz || item?.valueRu || item?.valueUz)
    : [];
  container.innerHTML = rows.length ? rows.map((item) => getSpecRowMarkup(item)).join('') : getSpecRowMarkup();
}

function getCategorySpecsFromEditor() {
  const rows = Array.from(document.querySelectorAll('#categorySpecsContainer .spec-row'));
  return rows
    .map((row) => ({
      keyRu: row.querySelector('.spec-key-ru')?.value.trim() || '',
      keyUz: row.querySelector('.spec-key-uz')?.value.trim() || '',
      valueRu: row.querySelector('.spec-value-ru')?.value.trim() || '',
      valueUz: row.querySelector('.spec-value-uz')?.value.trim() || ''
    }))
    .filter((item) => item.keyRu || item.keyUz || item.valueRu || item.valueUz)
    .map(normalizeCategorySpec)
    .filter((item) => item.keyRu || item.keyUz);
}

function renderCategories(data = categoriesData) {
  const tbody = document.getElementById('categoriesBody');
  const count = document.getElementById('categoriesCount');
  if (!tbody || !count) return;

  const sorted = [...data].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  if (!sorted.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px;">Нет категорий</td></tr>';
    count.textContent = 'Показано 0 из 0';
    return;
  }

  tbody.innerHTML = sorted.map((category) => `
    <tr>
      <td><strong>${escapeHtml(category.nameRu)}</strong><div class="product-sku">${escapeHtml(category.id)}</div></td>
      <td>${escapeHtml(category.nameUz || '—')}</td>
      <td>${category.defaultSpecs.length}</td>
      <td>${escapeHtml(String(category.sortOrder))}</td>
      <td><span class="status-badge ${category.isActive ? 'active' : 'inactive'}"><span class="status-dot"></span>${category.isActive ? 'Активна' : 'Неактивна'}</span></td>
      <td>${escapeHtml(category.updatedAt)}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn" title="Редактировать" data-action="edit-category" data-category-id="${escapeHtml(category.id)}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="action-btn" title="Вкл/выкл" data-action="toggle-category" data-category-id="${escapeHtml(category.id)}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/></svg></button>
          <button class="action-btn delete" title="Удалить" data-action="delete-category" data-category-id="${escapeHtml(category.id)}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
        </div>
      </td>
    </tr>
  `).join('');

  count.textContent = `Показано ${sorted.length} из ${categoriesData.length}`;
}

function resetCategoryForm() {
  const form = document.getElementById('categoryForm');
  const idInput = document.getElementById('categoryId');
  const statusInput = document.getElementById('categoryStatus');
  const sortInput = document.getElementById('categorySortOrder');
  const saveBtn = document.getElementById('categorySaveBtn');
  form?.reset();
  if (idInput) idInput.value = '';
  if (statusInput) statusInput.value = 'active';
  if (sortInput) sortInput.value = '100';
  if (saveBtn) {
    saveBtn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg> Создать категорию';
  }
  document.getElementById('categoryNameRu')?.closest('.form-group')?.classList.remove('error');
  renderCategorySpecsRows([]);
}

function fillCategoryForm(categoryId) {
  const category = categoriesData.find((item) => item.id === categoryId);
  if (!category) return;
  document.getElementById('categoryId').value = category.id;
  document.getElementById('categoryNameRu').value = category.nameRu;
  document.getElementById('categoryNameUz').value = category.nameUz;
  document.getElementById('categorySortOrder').value = String(category.sortOrder);
  document.getElementById('categoryStatus').value = category.isActive ? 'active' : 'inactive';
  renderCategorySpecsRows(category.defaultSpecs);
  const saveBtn = document.getElementById('categorySaveBtn');
  if (saveBtn) {
    saveBtn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg> Сохранить изменения';
  }
}

function saveCategory(event) {
  event.preventDefault();
  const id = document.getElementById('categoryId').value.trim();
  const nameRu = document.getElementById('categoryNameRu').value.trim();
  const nameUz = document.getElementById('categoryNameUz').value.trim();
  const sortOrder = Number(document.getElementById('categorySortOrder').value);
  const isActive = document.getElementById('categoryStatus').value !== 'inactive';
  const defaultSpecs = getCategorySpecsFromEditor();
  const nameGroup = document.getElementById('categoryNameRu').closest('.form-group');
  nameGroup?.classList.remove('error');

  if (nameRu.length < 2) {
    nameGroup?.classList.add('error');
    showCategoryFeedback('Введите корректное название категории (Ru).', 'error', 3200);
    return;
  }

  const duplicate = categoriesData.find((item) => item.nameRu.toLowerCase() === nameRu.toLowerCase() && item.id !== id);
  if (duplicate) {
    showCategoryFeedback('Категория с таким названием уже существует.', 'error', 3200);
    return;
  }

  const draft = normalizeCategoryRecord({
    id: id || undefined,
    nameRu,
    nameUz,
    sortOrder,
    isActive,
    defaultSpecs,
    updatedAt: getDateTimeString()
  });

  const existingIndex = categoriesData.findIndex((item) => item.id === draft.id);
  if (existingIndex === -1) {
    categoriesData.unshift(draft);
    showCategoryFeedback('Категория успешно создана.', 'success');
  } else {
    categoriesData[existingIndex] = draft;
    showCategoryFeedback('Категория обновлена.', 'success');
  }

  persistCategoriesData();
  renderCategories();
  syncProductCategorySelect();
  fillCategoryForm(draft.id);
}

function toggleCategoryStatus(categoryId) {
  const category = categoriesData.find((item) => item.id === categoryId);
  if (!category) return;
  category.isActive = !category.isActive;
  category.updatedAt = getDateTimeString();
  persistCategoriesData();
  renderCategories();
  syncProductCategorySelect();
  showCategoryFeedback(`Категория ${category.isActive ? 'активирована' : 'деактивирована'}.`, 'success');
}

function deleteCategory(categoryId) {
  const category = categoriesData.find((item) => item.id === categoryId);
  if (!category) return;
  if (!confirm(`Удалить категорию "${category.nameRu}"?`)) return;
  categoriesData = categoriesData.filter((item) => item.id !== categoryId);
  persistCategoriesData();
  renderCategories();
  syncProductCategorySelect();
  resetCategoryForm();
  showCategoryFeedback('Категория удалена.', 'success');
}

function getCategoryByProductName(name) {
  const key = String(name || '').trim();
  if (!key) return null;
  return categoriesData.find((item) => item.nameRu === key || item.nameUz === key) || null;
}

function syncProductCategorySelect(selectedValue = '') {
  const select = document.getElementById('pCategory');
  if (!select) return;
  const current = selectedValue || select.value;
  const sorted = [...categoriesData].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const active = sorted.filter((item) => item.isActive);
  const inactiveSelected = sorted.find((item) => item.nameRu === current && !item.isActive);

  let html = '<option value="">Выберите ...</option>';
  active.forEach((item) => {
    html += `<option value="${escapeHtml(item.nameRu)}">${escapeHtml(item.nameRu)}</option>`;
  });
  if (inactiveSelected) {
    html += `<option value="${escapeHtml(inactiveSelected.nameRu)}">${escapeHtml(inactiveSelected.nameRu)} (неактивна)</option>`;
  }
  const known = new Set([...active, ...(inactiveSelected ? [inactiveSelected] : [])].map((item) => item.nameRu));
  if (current && !known.has(current)) {
    html += `<option value="${escapeHtml(current)}">${escapeHtml(current)}</option>`;
  }
  select.innerHTML = html;
  if (current) select.value = current;
}

function applyCategoryDefaultSpecsToProduct(categoryName, { mode = 'replace' } = {}) {
  const category = getCategoryByProductName(categoryName);
  if (!category || !Array.isArray(category.defaultSpecs) || !category.defaultSpecs.length) return;

  const defaults = category.defaultSpecs
    .map(normalizeCategorySpec)
    .filter((item) => item.keyRu || item.keyUz);
  if (!defaults.length) return;

  if (mode === 'replace') {
    renderSpecsRows(defaults);
    return;
  }

  const current = getSpecsFromEditor();
  const normKey = (item) => String(item.keyRu || item.keyUz || '').trim().toLowerCase();
  const existingKeys = new Set(current.map(normKey).filter(Boolean));
  const merged = [...current];
  defaults.forEach((def) => {
    const key = normKey(def);
    if (key && !existingKeys.has(key)) {
      merged.push(def);
      existingKeys.add(key);
    }
  });
  renderSpecsRows(merged.length ? merged : defaults);
}

// ===== BRANDS =====
const ADMIN_BRANDS_KEY = window.emirateBrands?.ADMIN_BRANDS_KEY || 'emirate_admin_brands_v1';
let brandsData = (window.emirateBrands?.loadBrandsData?.() || []).map(function (item) {
  return window.emirateBrands?.normalizeBrandRecord?.(item) || item;
});
let brandFeedbackTimer = null;
let pendingBrandLogoData = null;

function persistBrandsData() {
  if (window.emirateBrands?.persistBrandsData) {
    window.emirateBrands.persistBrandsData(brandsData);
  } else {
    localStorage.setItem(ADMIN_BRANDS_KEY, JSON.stringify(brandsData));
  }
  void syncBrandsToSupabase();
}

async function syncBrandsToSupabase() {
  if (!window.emirateSupabaseApi?.pushAdminBrandsPayload) return;
  try {
    const res = await window.emirateSupabaseApi.pushAdminBrandsPayload(brandsData);
    if (!res?.ok && res?.error !== 'no_session') {
      console.warn('[Supabase] brands sync', res?.error);
    }
  } catch (err) {
    console.warn('[Supabase] brands sync', err);
  }
}

function showBrandFeedback(message, type = 'success', timeoutMs = 2800) {
  const node = document.getElementById('brandFeedback');
  if (!node) return;
  node.textContent = message;
  node.classList.remove('success', 'error');
  node.classList.add(type === 'error' ? 'error' : 'success');
  node.removeAttribute('hidden');
  if (brandFeedbackTimer) clearTimeout(brandFeedbackTimer);
  brandFeedbackTimer = setTimeout(() => {
    node.setAttribute('hidden', 'hidden');
    node.classList.remove('success', 'error');
  }, timeoutMs);
}

function setBrandLogoPreview(url) {
  const img = document.getElementById('brandLogoPreview');
  const placeholder = document.getElementById('brandLogoPlaceholder');
  if (!img || !placeholder) return;
  if (url) {
    img.src = url;
    img.hidden = false;
    placeholder.hidden = true;
  } else {
    img.hidden = true;
    img.removeAttribute('src');
    placeholder.hidden = false;
  }
}

function renderBrands(data = brandsData) {
  const tbody = document.getElementById('brandsBody');
  const count = document.getElementById('brandsCount');
  if (!tbody || !count) return;

  const sorted = [...data].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  if (!sorted.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:20px;">Нет брендов</td></tr>';
    count.textContent = 'Показано 0 из 0';
    return;
  }

  tbody.innerHTML = sorted.map((brand) => {
    const logo = brand.logoUrl
      ? `<img class="brand-table-logo" src="${escapeHtml(brand.logoUrl)}" alt="">`
      : '<span class="brand-table-logo brand-table-logo--empty">—</span>';
    return `
    <tr>
      <td>${logo}</td>
      <td><strong>${escapeHtml(brand.nameRu)}</strong><div class="product-sku">${escapeHtml(brand.id)}</div></td>
      <td>${escapeHtml(brand.nameUz || '—')}</td>
      <td>${escapeHtml(brand.slug || '—')}</td>
      <td>${escapeHtml(String(brand.sortOrder))}</td>
      <td><span class="status-badge ${brand.isActive ? 'active' : 'inactive'}"><span class="status-dot"></span>${brand.isActive ? 'Активен' : 'Неактивен'}</span></td>
      <td>${escapeHtml(formatBrandUpdatedAt(brand.updatedAt))}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn" title="Редактировать" data-action="edit-brand" data-brand-id="${escapeHtml(brand.id)}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="action-btn" title="Вкл/выкл" data-action="toggle-brand" data-brand-id="${escapeHtml(brand.id)}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></svg></button>
          <button class="action-btn delete" title="Удалить" data-action="delete-brand" data-brand-id="${escapeHtml(brand.id)}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
        </div>
      </td>
    </tr>`;
  }).join('');

  count.textContent = `Показано ${sorted.length} из ${brandsData.length}`;
}

function formatBrandUpdatedAt(value) {
  if (!value) return '—';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    return String(value);
  }
}

function resetBrandForm() {
  document.getElementById('brandForm')?.reset();
  document.getElementById('brandId').value = '';
  document.getElementById('brandStatus').value = 'active';
  document.getElementById('brandSortOrder').value = '100';
  pendingBrandLogoData = null;
  setBrandLogoPreview('');
  const saveBtn = document.getElementById('brandSaveBtn');
  if (saveBtn) {
    saveBtn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg> Создать бренд';
  }
  document.getElementById('brandNameRu')?.closest('.form-group')?.classList.remove('error');
}

function fillBrandForm(brandId) {
  const brand = brandsData.find((item) => item.id === brandId);
  if (!brand) return;
  document.getElementById('brandId').value = brand.id;
  document.getElementById('brandNameRu').value = brand.nameRu;
  document.getElementById('brandNameUz').value = brand.nameUz || '';
  document.getElementById('brandSlug').value = brand.slug || '';
  document.getElementById('brandSortOrder').value = String(brand.sortOrder || 100);
  document.getElementById('brandStatus').value = brand.isActive ? 'active' : 'inactive';
  pendingBrandLogoData = brand.logoUrl || null;
  setBrandLogoPreview(brand.logoUrl || '');
  const saveBtn = document.getElementById('brandSaveBtn');
  if (saveBtn) {
    saveBtn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg> Сохранить изменения';
  }
}

function saveBrand(event) {
  event.preventDefault();
  const id = document.getElementById('brandId').value.trim();
  const nameRu = document.getElementById('brandNameRu').value.trim();
  const nameUz = document.getElementById('brandNameUz').value.trim();
  const slugInput = document.getElementById('brandSlug').value.trim();
  const sortOrder = Number(document.getElementById('brandSortOrder').value);
  const isActive = document.getElementById('brandStatus').value !== 'inactive';
  const nameGroup = document.getElementById('brandNameRu').closest('.form-group');
  nameGroup?.classList.remove('error');

  if (nameRu.length < 2) {
    nameGroup?.classList.add('error');
    showBrandFeedback('Введите корректное название бренда (Ru).', 'error', 3200);
    return;
  }

  const slug = slugInput || (window.emirateBrands?.slugifyBrand?.(nameRu) || nameRu.toLowerCase());
  const duplicate = brandsData.find((item) => item.nameRu.toLowerCase() === nameRu.toLowerCase() && item.id !== id);
  if (duplicate) {
    showBrandFeedback('Бренд с таким названием уже существует.', 'error', 3200);
    return;
  }

  const draft = window.emirateBrands?.normalizeBrandRecord
    ? window.emirateBrands.normalizeBrandRecord({
        id: id || undefined,
        nameRu,
        nameUz: nameUz || nameRu,
        slug,
        logoUrl: pendingBrandLogoData || '',
        sortOrder,
        isActive,
        updatedAt: getDateTimeString(),
      })
    : { id: id || `brand_${Date.now()}`, nameRu, nameUz, slug, logoUrl: pendingBrandLogoData || '', sortOrder, isActive, updatedAt: getDateTimeString() };

  const existingIndex = brandsData.findIndex((item) => item.id === draft.id);
  if (existingIndex === -1) {
    brandsData.unshift(draft);
    showBrandFeedback('Бренд успешно создан.', 'success');
  } else {
    brandsData[existingIndex] = draft;
    showBrandFeedback('Бренд обновлён.', 'success');
  }

  persistBrandsData();
  renderBrands();
  syncProductBrandSelect();
  fillBrandForm(draft.id);
}

function toggleBrandStatus(brandId) {
  const brand = brandsData.find((item) => item.id === brandId);
  if (!brand) return;
  brand.isActive = !brand.isActive;
  brand.updatedAt = getDateTimeString();
  persistBrandsData();
  renderBrands();
  syncProductBrandSelect();
  showBrandFeedback(`Бренд ${brand.isActive ? 'активирован' : 'деактивирован'}.`, 'success');
}

function deleteBrand(brandId) {
  const brand = brandsData.find((item) => item.id === brandId);
  if (!brand) return;
  if (!confirm(`Удалить бренд "${brand.nameRu}"?`)) return;
  brandsData = brandsData.filter((item) => item.id !== brandId);
  persistBrandsData();
  void window.emirateSupabaseApi?.deleteAdminBrand?.(brandId);
  renderBrands();
  syncProductBrandSelect();
  resetBrandForm();
  showBrandFeedback('Бренд удалён.', 'success');
}

function syncProductBrandSelect(selectedValue = '') {
  const select = document.getElementById('pBrand');
  if (!select) return;
  const current = selectedValue || select.value;
  const sorted = [...brandsData].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const active = sorted.filter((item) => item.isActive);
  const inactiveSelected = sorted.find((item) => item.nameRu === current && !item.isActive);

  let html = '<option value="">Выберите ...</option>';
  active.forEach((item) => {
    html += `<option value="${escapeHtml(item.nameRu)}">${escapeHtml(item.nameRu)}</option>`;
  });
  if (inactiveSelected) {
    html += `<option value="${escapeHtml(inactiveSelected.nameRu)}">${escapeHtml(inactiveSelected.nameRu)} (неактивен)</option>`;
  }
  const known = new Set([...active, ...(inactiveSelected ? [inactiveSelected] : [])].map((item) => item.nameRu));
  if (current && !known.has(current)) {
    html += `<option value="${escapeHtml(current)}">${escapeHtml(current)}</option>`;
  }
  select.innerHTML = html;
  if (current) select.value = current;
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
const BANNER_MOBILE_RATIO_MIN = 1.7;
const BANNER_MOBILE_RATIO_MAX = 2.6;
const BANNER_BLOCKED_PHRASES = [
  'всем пока',
  'нету скидок',
  'пошел',
  'идиот',
  'дурак'
];

function loadProductsData() {
  return readLocalProductsCache();
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
  if (!confirm('Удалить этот товар?')) return;
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
  const payloadForSync = focusProductId
    ? optimizedData.filter((item) => item.id === focusProductId)
    : optimizedData;
  const syncRes = await verifyProductsSupabaseSync(payloadForSync);
  if (!syncRes?.ok) {
    console.warn('[Supabase] strict product sync failed', syncRes?.error);
    const reason = String(syncRes?.error || 'unknown_error');
    const hint = reason === 'no_client'
      ? 'На сервере не загружается supabase-config.js. Откройте /supabase-config.js в браузере — должен быть JS, не 404. Задеплойте проект с файлом supabase-config.prod.js.'
      : 'Проверьте вход через Supabase, таблицу products и RLS policies.';
    alert(`Товар не сохранён в Supabase.\n\nПричина: ${reason}\n\n${hint}`);
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
    },
    memoryVariants: Array.isArray(p.memoryVariants)
      ? p.memoryVariants
          .map((item, index) => ({
            id: String(item?.id || `memory_${Date.now()}_${index}`),
            nameRu: String(item?.nameRu || item?.name || '').trim(),
            nameUz: String(item?.nameUz || '').trim(),
            status: item?.status === 'inactive' ? 'inactive' : 'active',
            priceUsd: item?.priceUsd != null ? String(item.priceUsd) : '',
            oldPriceUsd: item?.oldPriceUsd != null ? String(item.oldPriceUsd) : '',
            price: String(item?.price || '').trim(),
            oldPrice: String(item?.oldPrice || '').trim()
          }))
          .filter((item) => item.nameRu || item.nameUz)
          .map((item) => ({ ...item, name: item.nameRu || item.nameUz }))
      : [],
    memoryMeta: {
      nameRu: String((p.memoryMeta && p.memoryMeta.nameRu) || 'Память').trim() || 'Память',
      nameUz: String((p.memoryMeta && p.memoryMeta.nameUz) || 'Xotira').trim() || 'Xotira',
      status: p.memoryMeta && p.memoryMeta.status === 'inactive' ? 'inactive' : 'active'
    },
    priceUsd: window.emirateExchange?.parseUsdInput
      ? window.emirateExchange.parseUsdInput(p.priceUsd)
      : Number(String(p.priceUsd || '').replace(/[^\d.]/g, '')) || 0,
    oldPriceUsd: window.emirateExchange?.parseUsdInput
      ? window.emirateExchange.parseUsdInput(p.oldPriceUsd)
      : Number(String(p.oldPriceUsd || '').replace(/[^\d.]/g, '')) || 0
  };
}

function updateNbuRateLine() {
  const el = document.getElementById('pNbuRateLine');
  if (!el || !window.emirateExchange) return;
  const meta = window.emirateExchange.getNbuRateMeta();
  const when = meta.fetchedAt
    ? new Date(meta.fetchedAt).toLocaleString('ru-RU')
    : 'кэш';
  el.textContent = `Курс NBU (продажа USD): ${meta.rate.toLocaleString('ru-RU')} сум · источник: ${meta.source} · ${when} · на витрине +20%`;
}

function updateStorefrontPricePreview() {
  const el = document.getElementById('pStorefrontPreview');
  if (!el || !window.emirateExchange?.previewStorefrontFromUsd) return;
  const usd = window.emirateExchange.parseUsdInput(document.getElementById('pPriceUsd')?.value);
  if (usd <= 0) {
    el.textContent = 'Укажите цену в USD — на витрине будет: курс NBU (продажа) × USD × 1.2. Или заполните цену в сумах.';
    return;
  }
  const preview = window.emirateExchange.previewStorefrontFromUsd(
    usd,
    document.getElementById('pOldPriceUsd')?.value
  );
  el.textContent = `На витрине: ${window.emirateExchange.formatUzs(preview.price)} (база ${window.emirateExchange.formatUzs(preview.base)} + 20%)` +
    (preview.oldPrice > preview.price ? ` · старая: ${window.emirateExchange.formatUzs(preview.oldPrice)}` : '');
}

let productsData = loadProductsData().map(normalizeProductRecord).filter((item) => item && item.id);
let productsLoading = !!window.emirateSupabaseApi?.isConfigured?.();

function renderProducts() {
  const tbody = document.getElementById('productsBody');
  const countEl = document.getElementById('productsCount');
  if (!tbody) return;
  if (productsLoading) {
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align:center;padding:28px;color:#64748b">Загрузка товаров…</td></tr>';
    if (countEl) countEl.textContent = 'Загрузка…';
    return;
  }
  if (!productsData.length) {
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align:center;padding:28px;color:#64748b">Нет товаров. Нажмите «+ Добавить», чтобы создать первый.</td></tr>';
    if (countEl) countEl.textContent = 'Показано 0 товаров';
    return;
  }
  tbody.innerHTML = productsData.map(renderProductRow).join('');
  if (countEl) countEl.textContent = `Показано ${productsData.length} товаров`;
}

function showAdminProductsBanner(message, tone) {
  const host = document.querySelector('#page-products .table-card-header') || document.querySelector('.admin-content');
  if (!host) return;
  let el = document.getElementById('adminProductsBanner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'adminProductsBanner';
    el.setAttribute('role', 'alert');
    host.insertAdjacentElement('afterend', el);
  }
  const bg = tone === 'error' ? '#fef2f2' : '#eff6ff';
  const border = tone === 'error' ? '#fecaca' : '#bfdbfe';
  const color = tone === 'error' ? '#991b1b' : '#1e40af';
  el.style.cssText =
    `margin:0 0 12px;padding:12px 14px;border-radius:10px;background:${bg};color:${color};border:1px solid ${border};font-size:14px;line-height:1.45;`;
  el.textContent = message;
}

async function loadAdminProductsFromSupabase() {
  const api = window.emirateSupabaseApi;
  if (!api?.isConfigured?.()) {
    productsLoading = false;
    productsData = loadProductsData().map(normalizeProductRecord).filter((item) => item && item.id);
    renderProducts();
    return;
  }

  productsLoading = true;
  renderProducts();
  document.getElementById('adminProductsBanner')?.remove();

  const sb = window.emirateSupabase;
  try {
    const sess = await sb.auth.getSession();
    if (!sess.data?.session) {
      localStorage.removeItem('emirate_admin');
      window.location.href = 'index.html';
      return;
    }

    const raw = await api.pullAdminProductsRaw();
    if (raw === null) {
      showAdminProductsBanner(
        'Не удалось загрузить товары из Supabase. Войдите с email из Authentication и добавьте его в таблицу admin_users (SQL в supabase/schema.sql).',
        'error'
      );
      const local = readLocalProductsCache();
      if (local.length) {
        productsData = local.map(normalizeProductRecord).filter((item) => item && item.id);
      }
      renderProducts();
      return;
    }

    productsData = (raw || []).map(normalizeProductRecord).filter((item) => item && item.id);
    try {
      localStorage.setItem(ADMIN_PRODUCTS_KEY, JSON.stringify(productsData));
    } catch (_) {
      // quota
    }
    renderProducts();

    if (!productsData.length) {
      const local = readLocalProductsCache();
      if (!local.length) return;
      productsData = local.map(normalizeProductRecord).filter((item) => item && item.id);
      renderProducts();
      const syncRes = await verifyProductsSupabaseSync(productsData);
      if (syncRes?.ok) {
        try {
          localStorage.setItem(ADMIN_PRODUCTS_KEY, JSON.stringify(productsData));
        } catch (_) {}
        await loadAdminProductsFromSupabase();
        alert('Локальные товары из этого браузера перенесены в Supabase. Теперь они видны на сайте и в админке.');
      }
    }
  } catch (err) {
    console.warn('[Supabase] admin products pull', err);
    showAdminProductsBanner('Ошибка загрузки товаров. Проверьте интернет и обновите страницу.', 'error');
    renderProducts();
  } finally {
    productsLoading = false;
    renderProducts();
  }
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
      tagUz: '🔥 Hafta aksiyasi',
      titleUz: 'Elektronikaga 30% gacha chegirma',
      descUz: '0-0-12 oy muddatli to\'lov, ortiqcha to\'lovsiz. Toshkent bo\'ylab bepul yetkazib berish.',
      primaryTextUz: 'Takliflarni ko\'rish',
      secondaryTextUz: 'Katalogga o\'tish',
      imageUz: '',
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
    imageMobile: typeof banner.imageMobile === 'string' ? banner.imageMobile : '',
    tagUz: String(banner.tagUz || '').trim() || '🔥 Aksiya',
    titleUz: String(banner.titleUz || '').trim() || 'Aksiya banneri',
    descUz: String(banner.descUz || '').trim() || '',
    primaryTextUz: String(banner.primaryTextUz || '').trim() || '',
    secondaryTextUz: String(banner.secondaryTextUz || '').trim() || '',
    imageUz: typeof banner.imageUz === 'string' ? banner.imageUz : '',
    imageMobileUz: typeof banner.imageMobileUz === 'string' ? banner.imageMobileUz : '',
    isActive: banner.isActive !== false,
    priority: Number.isFinite(priority) ? priority : 100
  };
}

function loadBannersData() {
  if (window.emirateSupabaseApi?.isConfigured?.()) {
    return [];
  }
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

async function verifyBannersSupabaseSync(data) {
  if (!window.emirateSupabaseApi?.isConfigured?.()) {
    return { ok: false, error: 'no_client' };
  }
  try {
    return await window.emirateSupabaseApi.pushAdminBannersPayload(data);
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

async function persistBannersData(focusBannerId = null) {
  const payloadForSync = focusBannerId
    ? bannersData.filter((item) => item.id === focusBannerId)
    : bannersData;
  const syncRes = await verifyBannersSupabaseSync(payloadForSync);
  if (!syncRes?.ok) {
    const reason = String(syncRes?.error || 'unknown_error');
    const hint = reason === 'no_client'
      ? 'На сервере не загружается supabase-config.js.'
      : 'Проверьте вход через Supabase и таблицу banners в SQL Editor.';
    alert(`Баннер не сохранён в Supabase.\n\nПричина: ${reason}\n\n${hint}`);
    return false;
  }
  try {
    localStorage.setItem(ADMIN_BANNERS_KEY, JSON.stringify(bannersData));
    return true;
  } catch (error) {
    console.error('Failed to update local banner cache', error);
    return true;
  }
}

function sortBanners() {
  bannersData.sort((a, b) => Number(a.priority) - Number(b.priority));
}

function getBannerPreviewDataFromForm() {
  const bannerIdInput = document.getElementById('bannerId');
  const bannerTagInput = document.getElementById('bannerTag');
  const bannerTitleInput = document.getElementById('bannerTitle');
  const bannerDescInput = document.getElementById('bannerDesc');
  const bannerTagUzInput = document.getElementById('bannerTagUz');
  const bannerTitleUzInput = document.getElementById('bannerTitleUz');
  const bannerDescUzInput = document.getElementById('bannerDescUz');
  const bannerPrimaryTextInput = document.getElementById('bannerPrimaryText');
  const bannerPrimaryUrlInput = document.getElementById('bannerPrimaryUrl');
  const bannerSecondaryTextInput = document.getElementById('bannerSecondaryText');
  const bannerSecondaryUrlInput = document.getElementById('bannerSecondaryUrl');
  const bannerPrimaryTextUzInput = document.getElementById('bannerPrimaryTextUz');
  const bannerSecondaryTextUzInput = document.getElementById('bannerSecondaryTextUz');
  const bannerPriorityInput = document.getElementById('bannerPriority');
  const bannerActiveSelect = document.getElementById('bannerActive');

  const existing = bannersData.find((item) => item.id === bannerIdInput?.value);
  const priority = Number(bannerPriorityInput?.value);

  return normalizeBannerRecord({
    id: bannerIdInput?.value || undefined,
    tag: bannerTagInput?.value || '',
    title: bannerTitleInput?.value || '',
    desc: bannerDescInput?.value || '',
    tagUz: bannerTagUzInput?.value || '',
    titleUz: bannerTitleUzInput?.value || '',
    descUz: bannerDescUzInput?.value || '',
    primaryText: bannerPrimaryTextInput?.value || '',
    primaryUrl: sanitizeBannerUrl(bannerPrimaryUrlInput?.value || '#'),
    secondaryText: bannerSecondaryTextInput?.value || '',
    secondaryUrl: sanitizeBannerUrl(bannerSecondaryUrlInput?.value || '#'),
    primaryTextUz: bannerPrimaryTextUzInput?.value || '',
    secondaryTextUz: bannerSecondaryTextUzInput?.value || '',
    image: bannerFormImage || existing?.image || '',
    imageMobile: bannerFormImageMobile || existing?.imageMobile || '',
    imageUz: bannerFormImageUz || existing?.imageUz || '',
    imageMobileUz: bannerFormImageMobileUz || existing?.imageMobileUz || '',
    isActive: bannerActiveSelect?.value !== 'false',
    priority: Number.isFinite(priority) ? priority : 100
  });
}

function validateBannerLangFields(draft, lang) {
  const isUz = lang === 'uz';
  const prefix = isUz ? ' (UZ)' : ' (RU)';
  const tag = String(isUz ? draft.tagUz : draft.tag || '').trim();
  const title = String(isUz ? draft.titleUz : draft.title || '').trim();
  const desc = String(isUz ? draft.descUz : draft.desc || '').trim();
  const image = String(isUz ? (draft.imageUz || draft.image) : draft.image || '').trim();
  const imageMobile = String(isUz ? (draft.imageMobileUz || draft.imageMobile) : draft.imageMobile || '').trim();

  if (!image && !imageMobile) {
    return `Загрузите изображение баннера${prefix} (компьютер или телефон).`;
  }
  if (title.length < BANNER_TITLE_MIN || title.length > BANNER_TITLE_MAX) {
    return `Название слайда${prefix} должно быть от ${BANNER_TITLE_MIN} до ${BANNER_TITLE_MAX} символов.`;
  }
  if (tag.length > BANNER_TAG_MAX) {
    return `Метка${prefix} слишком длинная. Максимум ${BANNER_TAG_MAX} символов.`;
  }
  if (desc && (desc.length < 2 || desc.length > BANNER_DESC_MAX)) {
    return `Описание${prefix} должно быть до ${BANNER_DESC_MAX} символов.`;
  }
  if (hasBlockedPhrases(tag, title, desc)) {
    return `Обнаружены запрещенные фразы в тексте баннера${prefix}.`;
  }
  return '';
}

function validateBannerDraft(draft) {
  const primaryUrl = sanitizeBannerUrl(draft.primaryUrl || '#');

  const ruError = validateBannerLangFields(draft, 'ru');
  if (ruError) return ruError;
  const uzError = validateBannerLangFields(draft, 'uz');
  if (uzError) return uzError;

  if (!isAllowedBannerUrl(primaryUrl)) {
    return 'Разрешены только внутренние ссылки: #, /path, catalog.html, product.html.';
  }
  if (!draft.isActive && countActiveBanners(draft.id) < 1) {
    return 'Должен остаться хотя бы один активный баннер.';
  }
  return '';
}

function renderBannerPreview(data, lang) {
  const preview = document.getElementById('bannerLivePreview');
  if (!preview) return;

  const banner = normalizeBannerRecord(data);
  const isUz = (lang || bannerFormLang) === 'uz';
  const desktopImage = isUz ? (banner.imageUz || banner.image) : banner.image;
  const mobileImage = isUz ? (banner.imageMobileUz || banner.imageMobile || banner.imageUz || banner.image) : (banner.imageMobile || banner.image);
  const image = bannerFormPreviewMode === 'mobile' ? (mobileImage || desktopImage) : (desktopImage || mobileImage);

  preview.classList.toggle('banner-preview--mobile', bannerFormPreviewMode === 'mobile');
  preview.classList.toggle('banner-preview--image', true);
  preview.removeAttribute('style');

  if (!image) {
    preview.innerHTML = '<div class="banner-preview-empty">Загрузите изображение баннера</div>';
    return;
  }

  preview.innerHTML = `<img class="banner-preview-img" src="${escapeHtml(image)}" alt="${escapeHtml(isUz ? banner.titleUz : banner.title)}">`;
}

function renderBanners() {
  const tbody = document.getElementById('bannersBody');
  const count = document.getElementById('bannersCount');
  if (!tbody || !count) return;

  sortBanners();

  tbody.innerHTML = bannersData.map((banner) => {
    const imageCount = [banner.image, banner.imageMobile, banner.imageUz, banner.imageMobileUz].filter(Boolean).length;
    return `
      <tr>
        <td>
          <strong>${escapeHtml(banner.title)}</strong>
          <p class="banner-list-uz">${escapeHtml(banner.titleUz)}</p>
        </td>
        <td>${imageCount ? `${imageCount} шт.` : '—'}</td>
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
let bannerFormImageMobile = '';
let bannerFormImageUz = '';
let bannerFormImageMobileUz = '';
let bannerFormLang = 'ru';
let bannerFormPreviewMode = 'desktop';
let bannerFeedbackTimer = null;

function setBannerPreviewMode(mode) {
  bannerFormPreviewMode = mode === 'mobile' ? 'mobile' : 'desktop';
  document.querySelectorAll('[data-banner-preview-mode]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.getAttribute('data-banner-preview-mode') === bannerFormPreviewMode);
  });
  renderBannerPreview(getBannerPreviewDataFromForm(), bannerFormLang);
}

function setBannerFormLang(lang) {
  const nextLang = lang === 'uz' ? 'uz' : 'ru';
  bannerFormLang = nextLang;
  document.querySelectorAll('.banner-lang-tab').forEach((tab) => {
    const isActive = tab.getAttribute('data-banner-lang') === nextLang;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  document.querySelectorAll('.banner-lang-panel').forEach((panel) => {
    const isActive = panel.getAttribute('data-banner-lang-panel') === nextLang;
    if (isActive) panel.removeAttribute('hidden');
    else panel.setAttribute('hidden', 'hidden');
  });
  renderBannerPreview(getBannerPreviewDataFromForm(), nextLang);
}

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

async function restoreDefaultBanners() {
  if (!canManageBanners) return;
  if (!confirm('Вернуть дефолтный баннер и удалить текущие слайды?')) return;
  const previous = (await window.emirateSupabaseApi?.pullAdminBannersRaw?.()) || bannersData.slice();
  bannersData = defaultBannersData().map(normalizeBannerRecord);
  if (!await persistBannersData()) return;
  const keepIds = new Set(bannersData.map((item) => item.id));
  for (const item of previous) {
    if (!item?.id || keepIds.has(item.id)) continue;
    await window.emirateSupabaseApi?.deleteAdminBanner?.(item.id);
    const urls = [item.image, item.imageMobile, item.imageUz, item.imageMobileUz].filter(Boolean);
    if (urls.length) void window.emirateSupabaseApi?.removeAdminAssetsByUrls?.(urls);
  }
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
  const bannerImageMetaUz = document.getElementById('bannerImageMetaUz');
  const bannerImageMobileMeta = document.getElementById('bannerImageMobileMeta');
  const bannerImageMobileMetaUz = document.getElementById('bannerImageMobileMetaUz');
  const bannerImageInput = document.getElementById('bannerImageInput');
  const bannerImageInputUz = document.getElementById('bannerImageInputUz');
  const bannerImageMobileInput = document.getElementById('bannerImageMobileInput');
  const bannerImageMobileInputUz = document.getElementById('bannerImageMobileInputUz');

  bannerForm?.reset();
  if (bannerIdInput) bannerIdInput.value = '';
  if (bannerPriorityInput) bannerPriorityInput.value = '100';
  if (bannerActiveSelect) bannerActiveSelect.value = 'true';
  if (bannerImageMeta) bannerImageMeta.textContent = 'Рекомендуется 1200×430 px (широкий баннер)';
  if (bannerImageMetaUz) bannerImageMetaUz.textContent = 'Tavsiya: 1200×430 px';
  if (bannerImageMobileMeta) bannerImageMobileMeta.textContent = 'Рекомендуется 750×360 px. Если пусто — на телефоне покажется компьютерная версия.';
  if (bannerImageMobileMetaUz) bannerImageMobileMetaUz.textContent = 'Tavsiya: 750×360 px';
  if (bannerImageInput) bannerImageInput.value = '';
  if (bannerImageInputUz) bannerImageInputUz.value = '';
  if (bannerImageMobileInput) bannerImageMobileInput.value = '';
  if (bannerImageMobileInputUz) bannerImageMobileInputUz.value = '';

  bannerFormImage = '';
  bannerFormImageMobile = '';
  bannerFormImageUz = '';
  bannerFormImageMobileUz = '';
  setBannerPreviewMode('desktop');
  setBannerFormLang('ru');
  renderBannerPreview(defaultBannersData()[0], 'ru');
}

function fillBannerForm(bannerId) {
  const banner = bannersData.find((item) => item.id === bannerId);
  if (!banner) return;

  const bannerIdInput = document.getElementById('bannerId');
  const bannerTagInput = document.getElementById('bannerTag');
  const bannerTitleInput = document.getElementById('bannerTitle');
  const bannerDescInput = document.getElementById('bannerDesc');
  const bannerTagUzInput = document.getElementById('bannerTagUz');
  const bannerTitleUzInput = document.getElementById('bannerTitleUz');
  const bannerDescUzInput = document.getElementById('bannerDescUz');
  const bannerPrimaryTextInput = document.getElementById('bannerPrimaryText');
  const bannerPrimaryUrlInput = document.getElementById('bannerPrimaryUrl');
  const bannerSecondaryTextInput = document.getElementById('bannerSecondaryText');
  const bannerSecondaryUrlInput = document.getElementById('bannerSecondaryUrl');
  const bannerPrimaryTextUzInput = document.getElementById('bannerPrimaryTextUz');
  const bannerSecondaryTextUzInput = document.getElementById('bannerSecondaryTextUz');
  const bannerPriorityInput = document.getElementById('bannerPriority');
  const bannerActiveSelect = document.getElementById('bannerActive');
  const bannerImageMeta = document.getElementById('bannerImageMeta');
  const bannerImageMetaUz = document.getElementById('bannerImageMetaUz');
  const bannerImageMobileMeta = document.getElementById('bannerImageMobileMeta');
  const bannerImageMobileMetaUz = document.getElementById('bannerImageMobileMetaUz');

  if (bannerIdInput) bannerIdInput.value = banner.id;
  if (bannerTagInput) bannerTagInput.value = banner.tag;
  if (bannerTitleInput) bannerTitleInput.value = banner.title;
  if (bannerDescInput) bannerDescInput.value = banner.desc;
  if (bannerTagUzInput) bannerTagUzInput.value = banner.tagUz;
  if (bannerTitleUzInput) bannerTitleUzInput.value = banner.titleUz;
  if (bannerDescUzInput) bannerDescUzInput.value = banner.descUz;
  if (bannerPrimaryTextInput) bannerPrimaryTextInput.value = banner.primaryText;
  if (bannerPrimaryUrlInput) bannerPrimaryUrlInput.value = banner.primaryUrl;
  if (bannerSecondaryTextInput) bannerSecondaryTextInput.value = banner.secondaryText;
  if (bannerSecondaryUrlInput) bannerSecondaryUrlInput.value = banner.secondaryUrl;
  if (bannerPrimaryTextUzInput) bannerPrimaryTextUzInput.value = banner.primaryTextUz;
  if (bannerSecondaryTextUzInput) bannerSecondaryTextUzInput.value = banner.secondaryTextUz;
  if (bannerPriorityInput) bannerPriorityInput.value = String(banner.priority);
  if (bannerActiveSelect) bannerActiveSelect.value = banner.isActive ? 'true' : 'false';
  if (bannerImageMeta) bannerImageMeta.textContent = banner.image ? 'Компьютерное изображение загружено' : 'Рекомендуется 1200×430 px (широкий баннер)';
  if (bannerImageMetaUz) bannerImageMetaUz.textContent = banner.imageUz ? 'Kompyuter rasmi yuklangan' : 'Tavsiya: 1200×430 px';
  if (bannerImageMobileMeta) bannerImageMobileMeta.textContent = banner.imageMobile ? 'Мобильное изображение загружено' : 'Рекомендуется 750×360 px. Если пусто — на телефоне покажется компьютерная версия.';
  if (bannerImageMobileMetaUz) bannerImageMobileMetaUz.textContent = banner.imageMobileUz ? 'Mobil rasm yuklangan' : 'Tavsiya: 750×360 px';

  bannerFormImage = banner.image || '';
  bannerFormImageMobile = banner.imageMobile || '';
  bannerFormImageUz = banner.imageUz || '';
  bannerFormImageMobileUz = banner.imageMobileUz || '';
  renderBannerPreview(banner, bannerFormLang);
}

async function saveBanner(event) {
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

  if (!await persistBannersData(draft.id)) return;
  renderBanners();
  fillBannerForm(draft.id);
  showBannerFeedback(isNew ? 'Новый слайд успешно добавлен.' : 'Слайд успешно сохранен.', 'success');
}

async function deleteBanner(bannerId) {
  if (!canManageBanners) return;
  const banner = bannersData.find((item) => item.id === bannerId);
  if (!banner) return;
  if (bannersData.length <= 1) {
    showBannerFeedback('Нельзя удалить единственный слайд.', 'error', 3200);
    alert('Нельзя удалить единственный слайд. Создайте новый или верните дефолт.');
    return;
  }
  if (!confirm(`Удалить слайд "${banner.title}"?`)) return;

  const urls = [banner.image, banner.imageMobile, banner.imageUz, banner.imageMobileUz].filter(Boolean);
  bannersData = bannersData.filter((item) => item.id !== bannerId);
  if (!await persistBannersData()) return;
  const deleteRes = await window.emirateSupabaseApi?.deleteAdminBanner?.(bannerId);
  if (deleteRes && !deleteRes.ok) {
    console.warn('[Supabase] delete banner', deleteRes.error);
  }
  if (urls.length) {
    void window.emirateSupabaseApi?.removeAdminAssetsByUrls?.(urls);
  }
  renderBanners();
  resetBannerForm();
  showBannerFeedback('Слайд удален.', 'success');
}

async function toggleBannerStatus(bannerId) {
  if (!canManageBanners) return;
  const banner = bannersData.find((item) => item.id === bannerId);
  if (!banner) return;
  if (banner.isActive && countActiveBanners(banner.id) < 1) {
    showBannerFeedback('Нельзя отключить последний активный баннер.', 'error', 3200);
    alert('Нельзя отключить последний активный баннер.');
    return;
  }
  banner.isActive = !banner.isActive;
  if (!await persistBannersData(banner.id)) return;
  renderBanners();
  showBannerFeedback(`Слайд ${banner.isActive ? 'включен' : 'отключен'}.`, 'success');
}

// --- Finance / Intake ---
const intakeData = [];

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
  if (!tbody) return;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:#94a3b8;padding:20px;">Нет записей</td></tr>';
    if (countLabel) countLabel.textContent = 'Показано 0 записей';
    syncIntakeCounterpartyFilterOptions();
    return;
  }

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

function viewClient(clientId) {
  const client = clientsData.find(item => String(item.userId || item.id) === String(clientId));
  if (!client) return;
  const raw = client.raw || {};
  alert(
    `Клиент: ${client.name}\n` +
    `ID: ${client.id}\n` +
    `Email: ${client.email}\n` +
    `Телефон: ${client.phone}\n` +
    `Вход: ${client.provider}\n` +
    `Паспорт: ${raw.passport || '—'}\n` +
    `Дата рождения: ${raw.birthday || '—'}\n` +
    `Пол: ${raw.gender || '—'}\n` +
    `Адрес: ${raw.address || '—'}\n` +
    `Рабочий адрес: ${raw.work_address || '—'}\n` +
    `Заказов: ${client.orders}\n` +
    `Регистрация: ${client.date}\n` +
    `Последний визит: ${client.lastSeen}`
  );
}

function orderDetailRow(label, value) {
  const text = String(value ?? '').trim() || '—';
  return `<div class="order-detail-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(text)}</dd></div>`;
}

function openOrderDetailModal(orderId) {
  const order = findOrderByKey(orderId);
  const modal = document.getElementById('orderDetailModal');
  const titleEl = document.getElementById('orderModalTitle');
  const bodyEl = document.getElementById('orderModalBody');
  if (!order || !modal || !titleEl || !bodyEl) return;

  const itemsHtml = (order.itemsList || []).length
    ? `<ul class="order-detail-items">${(order.itemsList || []).map((item) => {
        const itemTitle = String(item?.title || 'Товар').trim();
        const qty = Number(item?.qty) || 1;
        const price = formatOrderMoney((Number(item?.price) || 0) * qty);
        return `<li>${escapeHtml(itemTitle)} — ${qty} шт., ${escapeHtml(price)}</li>`;
      }).join('')}</ul>`
    : escapeHtml(order.items);

  titleEl.textContent = `Заказ ${order.id}`;
  bodyEl.innerHTML = `
    <div class="order-detail-grid">
      ${orderDetailRow('Клиент', order.client)}
      ${orderDetailRow('Телефон', order.phone)}
      ${orderDetailRow('Область', order.region)}
      ${orderDetailRow('Город', order.city)}
      ${orderDetailRow('Адрес', order.address)}
      ${orderDetailRow('Доставка', deliveryLabels[order.delivery] || order.delivery)}
      ${orderDetailRow('Оплата', paymentLabels[order.payment] || order.payment)}
      <div class="order-detail-row"><dt>Товары</dt><dd>${itemsHtml}</dd></div>
      ${orderDetailRow('Сумма', order.amount)}
      ${orderDetailRow('Статус', statusMap[order.status] || order.status)}
      ${orderDetailRow('Дата', order.date)}
      ${order.comment ? orderDetailRow('Комментарий', order.comment) : ''}
    </div>
  `;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeOrderDetailModal() {
  const modal = document.getElementById('orderDetailModal');
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';
}

async function applyOrderStatusChange(orderId, newStatus, pickerEl) {
  const order = findOrderByKey(orderId);
  if (!order) return;
  const previous = order.status;
  const normalized = normalizeOrderStatus(newStatus);
  if (normalized === previous) return;

  setOrderStatusPickerLoading(pickerEl, true);
  if (window.emirateSupabaseApi?.updateAdminOrderStatus && order.uuid) {
    const res = await window.emirateSupabaseApi.updateAdminOrderStatus(order.uuid, normalized);
    if (!res?.ok) {
      updateOrderStatusPickerUI(pickerEl, previous);
      setOrderStatusPickerLoading(pickerEl, false);
      alert('Не удалось сохранить статус.\n' + (res?.error || ''));
      return;
    }
  }
  order.status = normalized;
  updateOrderStatusPickerUI(pickerEl, normalized);
  setOrderStatusPickerLoading(pickerEl, false);
  renderOrderStats();
  renderDashboardRecentOrders();
}

// ===== RENDER ALL =====
void loadClientsFromSupabase();
renderSuppliers();
if (!localStorage.getItem(ADMIN_CATEGORIES_KEY)) {
  persistCategoriesData();
}
if (!localStorage.getItem(ADMIN_BRANDS_KEY)) {
  persistBrandsData();
}
renderCategories();
syncProductCategorySelect();
resetCategoryForm();
renderBrands();
syncProductBrandSelect();
resetBrandForm();
renderProducts();
renderBanners();
renderIntake();
setupIntakeFilters();
syncIntakeCounterpartyControls();
resetBannerForm();
setBannerReadonlyMode();
resetSupplierForm();

function readLocalProductsCache() {
  try {
    const raw = localStorage.getItem(ADMIN_PRODUCTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function showSupabaseStorageBanner() {
  if (window.emirateSupabaseApi?.isConfigured?.()) return;
  const host = document.querySelector('.admin-content') || document.querySelector('.admin-main');
  if (!host || document.getElementById('supabaseStorageBanner')) return;
  const el = document.createElement('div');
  el.id = 'supabaseStorageBanner';
  el.setAttribute('role', 'alert');
  el.style.cssText = 'margin:12px 16px;padding:12px 14px;border-radius:10px;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;font-size:14px;line-height:1.45;';
  el.textContent = 'Supabase не настроен на сервере: товары сохраняются только в этом браузере. Добавьте EMIRATE_SUPABASE_URL и EMIRATE_SUPABASE_ANON_KEY в настройках хостинга (Vercel → Environment Variables) и перезадеплойте сайт.';
  host.prepend(el);
}

showSupabaseStorageBanner();

void loadOrdersFromSupabase();

document.getElementById('refreshOrdersBtn')?.addEventListener('click', () => {
  void loadOrdersFromSupabase();
});

void loadAdminProductsFromSupabase();

document.getElementById('refreshProductsBtn')?.addEventListener('click', () => {
  void loadAdminProductsFromSupabase();
});

function readLocalBannersCache() {
  try {
    const raw = localStorage.getItem(ADMIN_BANNERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

void (async () => {
  try {
    const raw = await window.emirateSupabaseApi?.pullAdminBannersRaw?.();
    if (raw && raw.length) {
      bannersData = raw.map((item) => normalizeBannerRecord(item)).filter((item) => item && item.id);
      sortBanners();
      try {
        localStorage.setItem(ADMIN_BANNERS_KEY, JSON.stringify(bannersData));
      } catch (_) {}
      renderBanners();
      return;
    }
    if (!window.emirateSupabaseApi?.isConfigured?.()) return;
    const local = readLocalBannersCache();
    if (!local.length) return;
    bannersData = local.map((item) => normalizeBannerRecord(item)).filter((item) => item && item.id);
    sortBanners();
    renderBanners();
    const syncRes = await verifyBannersSupabaseSync(bannersData);
    if (syncRes?.ok) {
      try {
        localStorage.setItem(ADMIN_BANNERS_KEY, JSON.stringify(bannersData));
      } catch (_) {}
      alert('Локальные баннеры перенесены в Supabase. Теперь они видны всем на главной странице.');
    }
  } catch (err) {
    console.warn('[Supabase] admin banners pull', err);
  }
})();

void (async () => {
  try {
    const raw = await window.emirateSupabaseApi?.pullAdminBrandsRaw?.();
    if (raw && raw.length) {
      brandsData = raw.map((item) => window.emirateBrands?.normalizeBrandRecord?.(item) || item);
      persistBrandsData();
      renderBrands();
      syncProductBrandSelect();
    }
  } catch (err) {
    console.warn('[Supabase] admin brands pull', err);
  }
})();

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
});

document.getElementById('ordersBody')?.addEventListener('click', function(e) {
  const optionBtn = e.target.closest('.order-status-picker__option');
  if (optionBtn) {
    const picker = optionBtn.closest('.order-status-picker');
    const orderId = picker?.getAttribute('data-order-id');
    closeAllOrderStatusPickers();
    void applyOrderStatusChange(orderId, optionBtn.getAttribute('data-value'), picker);
    return;
  }

  const statusTrigger = e.target.closest('.order-status-picker__trigger');
  if (statusTrigger) {
    e.stopPropagation();
    toggleOrderStatusPicker(statusTrigger.closest('.order-status-picker'));
    return;
  }

  const button = e.target.closest('button[data-action]');
  if (!button) return;
  const action = button.getAttribute('data-action');
  const orderId = button.getAttribute('data-order-id');
  if (!orderId) return;
  if (action === 'view-order') openOrderDetailModal(orderId);
});

document.addEventListener('click', function(e) {
  if (!e.target.closest('.order-status-picker')) {
    closeAllOrderStatusPickers();
  }
});

document.querySelectorAll('[data-close-order-modal]').forEach((el) => {
  el.addEventListener('click', closeOrderDetailModal);
});

document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  closeOrderDetailModal();
  closeAllOrderStatusPickers();
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

document.getElementById('categoryForm')?.addEventListener('submit', saveCategory);

document.getElementById('addCategoryBtn')?.addEventListener('click', function() {
  switchPage('categories');
  resetCategoryForm();
  document.getElementById('categoryNameRu')?.focus();
  showCategoryFeedback('Режим создания категории включен.', 'success');
});

document.getElementById('categoryResetBtn')?.addEventListener('click', function() {
  resetCategoryForm();
  showCategoryFeedback('Форма очищена.', 'success');
});

document.getElementById('addCategorySpecBtn')?.addEventListener('click', function() {
  const container = document.getElementById('categorySpecsContainer');
  if (!container) return;
  container.insertAdjacentHTML('beforeend', getSpecRowMarkup());
});

document.getElementById('categorySpecsContainer')?.addEventListener('click', function(e) {
  const btn = e.target.closest('.spec-remove');
  if (!btn) return;
  const rows = this.querySelectorAll('.spec-row');
  if (rows.length <= 1) {
    renderCategorySpecsRows([]);
    return;
  }
  btn.closest('.spec-row')?.remove();
});

document.getElementById('categoriesBody')?.addEventListener('click', function(e) {
  const button = e.target.closest('button[data-action]');
  if (!button) return;
  const action = button.getAttribute('data-action');
  const categoryId = button.getAttribute('data-category-id');
  if (!categoryId) return;

  if (action === 'edit-category') {
    switchPage('categories');
    fillCategoryForm(categoryId);
    showCategoryFeedback('Категория загружена в форму для редактирования.', 'success');
    return;
  }
  if (action === 'toggle-category') {
    toggleCategoryStatus(categoryId);
    return;
  }
  if (action === 'delete-category') {
    deleteCategory(categoryId);
  }
});

document.getElementById('brandForm')?.addEventListener('submit', saveBrand);

document.getElementById('addBrandBtn')?.addEventListener('click', function() {
  switchPage('brands');
  resetBrandForm();
  document.getElementById('brandNameRu')?.focus();
  showBrandFeedback('Режим создания бренда включен.', 'success');
});

document.getElementById('brandResetBtn')?.addEventListener('click', function() {
  resetBrandForm();
  showBrandFeedback('Форма очищена.', 'success');
});

document.getElementById('brandLogoClearBtn')?.addEventListener('click', function() {
  pendingBrandLogoData = null;
  setBrandLogoPreview('');
});

document.getElementById('brandLogoInput')?.addEventListener('change', function() {
  const file = this.files && this.files[0];
  if (!file) return;
  if (file.size > 1024 * 1024 * 2) {
    showBrandFeedback('Логотип слишком большой. Максимум 2 МБ.', 'error', 3200);
    this.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = function () {
    pendingBrandLogoData = String(reader.result || '');
    setBrandLogoPreview(pendingBrandLogoData);
  };
  reader.readAsDataURL(file);
});

document.getElementById('brandNameRu')?.addEventListener('blur', function() {
  const slugInput = document.getElementById('brandSlug');
  if (!slugInput || slugInput.value.trim()) return;
  const name = this.value.trim();
  if (!name || !window.emirateBrands?.slugifyBrand) return;
  slugInput.value = window.emirateBrands.slugifyBrand(name);
});

document.getElementById('brandsBody')?.addEventListener('click', function(e) {
  const button = e.target.closest('button[data-action]');
  if (!button) return;
  const action = button.getAttribute('data-action');
  const brandId = button.getAttribute('data-brand-id');
  if (!brandId) return;

  if (action === 'edit-brand') {
    switchPage('brands');
    fillBrandForm(brandId);
    showBrandFeedback('Бренд загружен в форму для редактирования.', 'success');
    return;
  }
  if (action === 'toggle-brand') {
    toggleBrandStatus(brandId);
    return;
  }
  if (action === 'delete-brand') {
    deleteBrand(brandId);
  }
});

document.getElementById('clientsRefreshBtn')?.addEventListener('click', function() {
  void loadClientsFromSupabase();
});

document.getElementById('clientsSearch')?.addEventListener('input', function() {
  const query = String(this.value || '').trim().toLowerCase();
  if (!query) {
    renderClients(clientsData);
    return;
  }
  renderClients(clientsData.filter(item =>
    item.name.toLowerCase().includes(query)
    || item.phone.toLowerCase().includes(query)
    || item.email.toLowerCase().includes(query)
    || item.id.toLowerCase().includes(query)
    || item.provider.toLowerCase().includes(query)
  ));
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

document.querySelectorAll('.banner-lang-tab').forEach((tab) => {
  tab.addEventListener('click', function() {
    setBannerFormLang(this.getAttribute('data-banner-lang') || 'ru');
  });
});

['bannerTitle', 'bannerTitleUz', 'bannerPrimaryUrl', 'bannerActive'].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  const eventName = id === 'bannerActive' ? 'change' : 'input';
  el.addEventListener(eventName, function() {
    renderBannerPreview(getBannerPreviewDataFromForm(), bannerFormLang);
  });
});

async function handleBannerImageUpload(file, inputEl, options) {
  const { imageKey, metaEl, emptyMetaText, successPrefix, ratioMin, ratioMax, ratioHint } = options;
  if (!file) {
    if (!options.getImage() && metaEl) metaEl.textContent = emptyMetaText;
    showBannerFeedback('Изображение не выбрано.');
    return;
  }
  if (!file.type.startsWith('image/')) {
    showBannerFeedback('Можно загрузить только изображение.', 'error', 3200);
    alert('Можно загрузить только изображение.');
    inputEl.value = '';
    return;
  }
  if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
    showBannerFeedback('Файл больше 15MB и не был добавлен.', 'error', 3200);
    alert('Файл больше 15MB и не был добавлен.');
    inputEl.value = '';
    return;
  }
  try {
    const optimized = await prepareImageForUpload(file, { maxSide: 2400, skipIfUnderBytes: 600 * 1024 });
    let imageSrc = '';
    if (window.emirateSupabaseApi?.isConfigured?.() && window.emirateSupabaseApi?.uploadAdminAsset) {
      setAssetUploadState(true);
      const uploadRes = await window.emirateSupabaseApi.uploadAdminAsset(optimized, { folder: 'banners' });
      setAssetUploadState(false);
      if (!uploadRes?.ok || !uploadRes.url) {
        throw new Error(uploadRes?.error || 'storage upload failed');
      }
      imageSrc = uploadRes.url;
    } else {
      imageSrc = await readFileAsDataUrl(optimized);
    }
    const meta = await getImageMeta(imageSrc);
    const minRatio = ratioMin ?? BANNER_IMAGE_RATIO_MIN;
    const maxRatio = ratioMax ?? BANNER_IMAGE_RATIO_MAX;
    if (meta.ratio < minRatio || meta.ratio > maxRatio) {
      showBannerFeedback('Неверная пропорция изображения для баннера.', 'error', 3800);
      alert(`Неверная пропорция (${meta.width}×${meta.height}). ${ratioHint || 'Используйте горизонтальный баннер.'}`);
      if (metaEl) metaEl.textContent = emptyMetaText;
      return;
    }
    options.setImage(imageSrc);
    const sizeNote = optimized.size < file.size
      ? `, сжато ${Math.round(file.size / 1024)}→${Math.round(optimized.size / 1024)} КБ`
      : '';
    if (metaEl) metaEl.textContent = `${successPrefix}: ${file.name} (${meta.width}×${meta.height}${sizeNote})`;
    renderBannerPreview(getBannerPreviewDataFromForm(), bannerFormLang);
    showBannerFeedback(`Изображение загружено (${imageKey}): ${file.name}.`, 'success');
  } catch (_) {
    showBannerFeedback('Не удалось обработать изображение.', 'error', 3200);
    alert('Не удалось обработать изображение.');
  }
}

document.getElementById('bannerImageInput')?.addEventListener('change', function() {
  if (!canManageBanners) return;
  const file = this.files?.[0];
  void handleBannerImageUpload(file, this, {
    imageKey: 'RU desktop',
    metaEl: document.getElementById('bannerImageMeta'),
    emptyMetaText: 'Рекомендуется 1200×430 px (широкий баннер)',
    successPrefix: 'Загружено',
    ratioMin: BANNER_IMAGE_RATIO_MIN,
    ratioMax: BANNER_IMAGE_RATIO_MAX,
    ratioHint: 'Для компьютера используйте широкий баннер примерно 1200×430 px.',
    getImage: () => bannerFormImage,
    setImage: (url) => { bannerFormImage = url; }
  });
  this.value = '';
});

document.getElementById('bannerImageMobileInput')?.addEventListener('change', function() {
  if (!canManageBanners) return;
  const file = this.files?.[0];
  void handleBannerImageUpload(file, this, {
    imageKey: 'RU mobile',
    metaEl: document.getElementById('bannerImageMobileMeta'),
    emptyMetaText: 'Рекомендуется 750×360 px. Если пусто — на телефоне покажется компьютерная версия.',
    successPrefix: 'Мобильное загружено',
    ratioMin: BANNER_MOBILE_RATIO_MIN,
    ratioMax: BANNER_MOBILE_RATIO_MAX,
    ratioHint: 'Для телефона используйте баннер примерно 750×360 px.',
    getImage: () => bannerFormImageMobile,
    setImage: (url) => { bannerFormImageMobile = url; }
  });
  this.value = '';
});

document.getElementById('bannerImageInputUz')?.addEventListener('change', function() {
  if (!canManageBanners) return;
  const file = this.files?.[0];
  void handleBannerImageUpload(file, this, {
    imageKey: 'UZ desktop',
    metaEl: document.getElementById('bannerImageMetaUz'),
    emptyMetaText: 'Tavsiya: 1200×430 px',
    successPrefix: 'Yuklandi',
    ratioMin: BANNER_IMAGE_RATIO_MIN,
    ratioMax: BANNER_IMAGE_RATIO_MAX,
    ratioHint: 'Kompyuter uchun taxminan 1200×430 px.',
    getImage: () => bannerFormImageUz,
    setImage: (url) => { bannerFormImageUz = url; }
  });
  this.value = '';
});

document.getElementById('bannerImageMobileInputUz')?.addEventListener('change', function() {
  if (!canManageBanners) return;
  const file = this.files?.[0];
  void handleBannerImageUpload(file, this, {
    imageKey: 'UZ mobile',
    metaEl: document.getElementById('bannerImageMobileMetaUz'),
    emptyMetaText: 'Tavsiya: 750×360 px',
    successPrefix: 'Mobil yuklandi',
    ratioMin: BANNER_MOBILE_RATIO_MIN,
    ratioMax: BANNER_MOBILE_RATIO_MAX,
    ratioHint: 'Telefon uchun taxminan 750×360 px.',
    getImage: () => bannerFormImageMobileUz,
    setImage: (url) => { bannerFormImageMobileUz = url; }
  });
  this.value = '';
});

document.querySelectorAll('[data-banner-preview-mode]').forEach((btn) => {
  btn.addEventListener('click', function() {
    setBannerPreviewMode(this.getAttribute('data-banner-preview-mode'));
  });
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
let productMemoryVariants = [];
let productMemoryMeta = {
  nameRu: 'Память',
  nameUz: 'Xotira',
  status: 'active'
};
let editingMemoryVariantId = null;
const memoryVariantsList = document.getElementById('memoryVariantsList');
const memoryVariantSaveBtn = document.getElementById('memoryVariantSaveBtn');
const memoryVariantResetBtn = document.getElementById('memoryVariantResetBtn');
const memoryAttrNameRuInput = document.getElementById('pMemoryAttrNameRu');
const memoryAttrNameUzInput = document.getElementById('pMemoryAttrNameUz');
const memoryAttrStatusInput = document.getElementById('pMemoryAttrStatus');
const memoryNameRuInput = document.getElementById('pMemoryNameRu');
const memoryNameUzInput = document.getElementById('pMemoryNameUz');
const memoryPriceUsdInput = document.getElementById('pMemoryPriceUsd');
const memoryOldPriceUsdInput = document.getElementById('pMemoryOldPriceUsd');
const memoryPriceInput = document.getElementById('pMemoryPrice');
const memoryOldPriceInput = document.getElementById('pMemoryOldPrice');
const memoryStatusInput = document.getElementById('pMemoryStatus');
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

function syncMemoryMetaFromForm() {
  productMemoryMeta = {
    nameRu: String(memoryAttrNameRuInput?.value || 'Память').trim() || 'Память',
    nameUz: String(memoryAttrNameUzInput?.value || 'Xotira').trim() || 'Xotira',
    status: memoryAttrStatusInput?.value === 'inactive' ? 'inactive' : 'active'
  };
}

function getMemoryVariantDisplayName(variant) {
  return variant.nameRu || variant.nameUz || 'Без названия';
}

function resetMemoryVariantForm() {
  editingMemoryVariantId = null;
  if (memoryNameRuInput) memoryNameRuInput.value = '';
  if (memoryNameUzInput) memoryNameUzInput.value = '';
  if (memoryPriceUsdInput) memoryPriceUsdInput.value = '';
  if (memoryOldPriceUsdInput) memoryOldPriceUsdInput.value = '';
  if (memoryPriceInput) memoryPriceInput.value = '';
  if (memoryOldPriceInput) memoryOldPriceInput.value = '';
  if (memoryStatusInput) memoryStatusInput.value = 'active';
  if (memoryVariantSaveBtn) memoryVariantSaveBtn.textContent = '+ Добавить память';
}

function renderMemoryVariantsList() {
  if (!memoryVariantsList) return;
  syncMemoryMetaFromForm();
  const isInactive = productMemoryMeta.status === 'inactive';
  if (!productMemoryVariants.length) {
    memoryVariantsList.innerHTML = `<p class="color-variant-empty">Варианты памяти еще не добавлены.${isInactive ? ' Атрибут отключен.' : ''}</p>`;
    return;
  }

  memoryVariantsList.innerHTML = productMemoryVariants.map((variant) => {
    const preview = window.emirateExchange?.previewStorefrontFromUsd
      ? window.emirateExchange.previewStorefrontFromUsd(variant.priceUsd, variant.oldPriceUsd)
      : null;
    const priceHint = preview && window.emirateExchange?.parseUsdInput?.(variant.priceUsd) > 0
      ? ` · витрина: ${window.emirateExchange.formatUzs(preview.price)}`
      : (variant.price ? ` · ${variant.price} сум` : '');
    return `
    <div class="color-variant-item">
      <div class="color-variant-item-main">
        <div class="color-variant-item-title">${escapeHtml(getMemoryVariantDisplayName(variant))}</div>
        <div class="color-variant-item-meta">USD: ${escapeHtml(String(variant.priceUsd || '—'))}${priceHint} · UZ: ${escapeHtml(variant.nameUz || '—')} · ${variant.status === 'inactive' ? 'Отключено' : 'Включено'}</div>
      </div>
      <div class="color-variant-item-actions">
        <button type="button" class="action-btn" data-action="edit-memory-variant" data-memory-id="${escapeHtml(variant.id)}" title="Редактировать"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button type="button" class="action-btn" data-action="toggle-memory-variant" data-memory-id="${escapeHtml(variant.id)}" title="Переключить статус">${variant.status === 'inactive' ? '↻' : '⏸'}</button>
        <button type="button" class="action-btn delete" data-action="delete-memory-variant" data-memory-id="${escapeHtml(variant.id)}" title="Удалить"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
      </div>
    </div>
  `;
  }).join('');
}

function loadMemoryVariantToForm(id) {
  const variant = productMemoryVariants.find((item) => item.id === id);
  if (!variant) return;
  editingMemoryVariantId = variant.id;
  if (memoryNameRuInput) memoryNameRuInput.value = variant.nameRu || '';
  if (memoryNameUzInput) memoryNameUzInput.value = variant.nameUz || '';
  if (memoryPriceUsdInput) memoryPriceUsdInput.value = variant.priceUsd || '';
  if (memoryOldPriceUsdInput) memoryOldPriceUsdInput.value = variant.oldPriceUsd || '';
  if (memoryPriceInput) memoryPriceInput.value = variant.price || '';
  if (memoryOldPriceInput) memoryOldPriceInput.value = variant.oldPrice || '';
  if (memoryStatusInput) memoryStatusInput.value = variant.status === 'inactive' ? 'inactive' : 'active';
  if (memoryVariantSaveBtn) memoryVariantSaveBtn.textContent = 'Обновить память';
}

function saveMemoryVariant() {
  const nameRu = memoryNameRuInput?.value?.trim() || '';
  const nameUz = memoryNameUzInput?.value?.trim() || '';
  const priceUsd = memoryPriceUsdInput?.value?.trim() || '';
  const oldPriceUsd = memoryOldPriceUsdInput?.value?.trim() || '';
  const price = memoryPriceInput?.value?.trim() || '';
  const oldPrice = memoryOldPriceInput?.value?.trim() || '';
  const status = memoryStatusInput?.value === 'inactive' ? 'inactive' : 'active';
  const hasUsd = window.emirateExchange?.parseUsdInput?.(priceUsd) > 0;
  const hasSum = Number(String(price || '').replace(/\s+/g, '').replace(/[^\d]/g, '')) > 0;

  if (!nameRu && !nameUz) {
    alert('Введите объём памяти хотя бы на одном языке.');
    return;
  }
  if (!hasUsd && !hasSum) {
    alert('Укажите цену для этого объёма памяти (USD или сум).');
    return;
  }

  const nextVariant = {
    id: editingMemoryVariantId || `memory_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    nameRu,
    nameUz,
    name: nameRu || nameUz,
    status,
    priceUsd,
    oldPriceUsd,
    price,
    oldPrice
  };

  if (editingMemoryVariantId) {
    productMemoryVariants = productMemoryVariants.map((item) => item.id === editingMemoryVariantId ? nextVariant : item);
  } else {
    productMemoryVariants.push(nextVariant);
  }

  renderMemoryVariantsList();
  resetMemoryVariantForm();
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
  document.getElementById('pPriceUsd').value = p.priceUsd > 0 ? String(p.priceUsd) : '';
  document.getElementById('pOldPriceUsd').value = p.oldPriceUsd > 0 ? String(p.oldPriceUsd) : '';
  document.getElementById('pPrice').value = p.price || '';
  document.getElementById('pOldPrice').value = p.oldPrice || '';
  updateStorefrontPricePreview();
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
  productMemoryVariants = Array.isArray(p.memoryVariants) ? p.memoryVariants.map((item) => ({
    id: String(item?.id || `memory_${Date.now()}_${Math.floor(Math.random() * 1000)}`),
    nameRu: String(item?.nameRu || item?.name || '').trim(),
    nameUz: String(item?.nameUz || '').trim(),
    name: String(item?.nameRu || item?.nameUz || item?.name || '').trim(),
    status: item?.status === 'inactive' ? 'inactive' : 'active',
    priceUsd: item?.priceUsd != null ? String(item.priceUsd) : '',
    oldPriceUsd: item?.oldPriceUsd != null ? String(item.oldPriceUsd) : '',
    price: String(item?.price || '').trim(),
    oldPrice: String(item?.oldPrice || '').trim()
  })).filter((item) => (item.nameRu || item.nameUz)) : [];
  productMemoryMeta = {
    nameRu: String(p.memoryMeta?.nameRu || 'Память').trim() || 'Память',
    nameUz: String(p.memoryMeta?.nameUz || 'Xotira').trim() || 'Xotira',
    status: p.memoryMeta?.status === 'inactive' ? 'inactive' : 'active'
  };
  if (memoryAttrNameRuInput) memoryAttrNameRuInput.value = productMemoryMeta.nameRu;
  if (memoryAttrNameUzInput) memoryAttrNameUzInput.value = productMemoryMeta.nameUz;
  if (memoryAttrStatusInput) memoryAttrStatusInput.value = productMemoryMeta.status;
  renderMemoryVariantsList();
  resetMemoryVariantForm();
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

  setTimeout(function () {
    scheduleTitleSuggest('ru');
    scheduleTitleSuggest('uz');
  }, 150);
}

// ===== PRODUCT TITLE SUGGESTIONS =====
const titleSuggestTimers = { ru: null, uz: null };
const titleSuggestSeq = { ru: 0, uz: 0 };

const titleSuggestEls = {
  ru: {
    input: document.getElementById('pNameRu'),
    panel: document.getElementById('pNameRuSuggest'),
    score: document.getElementById('pNameRuScore'),
    chars: document.getElementById('pNameRuChars'),
    feedback: document.getElementById('pNameRuFeedback'),
    alt: document.getElementById('pNameRuAlt'),
    altText: document.getElementById('pNameRuAltText'),
    apply: document.getElementById('pNameRuApply'),
  },
  uz: {
    input: document.getElementById('pNameUz'),
    panel: document.getElementById('pNameUzSuggest'),
    score: document.getElementById('pNameUzScore'),
    chars: document.getElementById('pNameUzChars'),
    feedback: document.getElementById('pNameUzFeedback'),
    alt: document.getElementById('pNameUzAlt'),
    altText: document.getElementById('pNameUzAltText'),
    apply: document.getElementById('pNameUzApply'),
  },
};

function resetTitleSuggestPanels() {
  Object.keys(titleSuggestEls).forEach(function (lang) {
    const els = titleSuggestEls[lang];
    if (titleSuggestTimers[lang]) {
      clearTimeout(titleSuggestTimers[lang]);
      titleSuggestTimers[lang] = null;
    }
    titleSuggestSeq[lang] += 1;
    if (els.panel) els.panel.hidden = true;
    if (els.panel) els.panel.classList.remove('is-loading');
    if (els.alt) els.alt.hidden = true;
  });
}

function scoreClass(score) {
  if (score >= 8) return '';
  if (score >= 5) return 'is-mid';
  return 'is-low';
}

function renderTitleSuggest(lang, payload) {
  const els = titleSuggestEls[lang];
  if (!els.panel) return;

  const title = String(els.input?.value || '').trim();
  if (!title || title.length < 12) {
    els.panel.hidden = true;
    return;
  }

  els.panel.hidden = false;
  els.panel.classList.remove('is-loading');

  const score = Number(payload.score) || 0;
  const charCount = Number(payload.charCount) || title.length;
  const suggested = String(payload.suggested || '').trim();

  if (els.score) {
    els.score.textContent = score + ' ball';
    els.score.className = 'title-suggest-score ' + scoreClass(score);
  }
  if (els.chars) {
    const sourceLabel =
      payload.source === 'openai'
        ? ' · Emirate AI'
        : payload.source === 'rules'
          ? (lang === 'uz' ? ' · qoidalar' : ' · без ИИ')
          : '';
    els.chars.textContent =
      (lang === 'uz' ? 'Belgilar soni: ' : 'Символов: ') + charCount + sourceLabel;
    els.chars.className = 'title-suggest-chars' + (charCount > 90 ? ' is-warn' : '');
  }
  if (els.feedback) {
    els.feedback.textContent = String(payload.feedback || '').trim();
  }

  if (els.alt && els.altText && suggested && suggested.toLowerCase() !== title.toLowerCase()) {
    els.alt.hidden = false;
    els.altText.textContent = suggested;
  } else if (els.alt) {
    els.alt.hidden = true;
  }
}

async function requestTitleSuggest(lang) {
  const els = titleSuggestEls[lang];
  if (!els.input) return;

  const title = String(els.input.value || '').trim();
  if (title.length < 12) {
    if (els.panel) els.panel.hidden = true;
    return;
  }

  const seq = ++titleSuggestSeq[lang];
  if (els.panel) {
    els.panel.hidden = false;
    els.panel.classList.add('is-loading');
  }

  try {
    const res = await fetch('/api/suggest-product-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        lang: lang,
        brand: document.getElementById('pBrand')?.value || '',
        model: document.getElementById('pModel')?.value || '',
        category: document.getElementById('pCategory')?.value || '',
      }),
    });
    const data = await res.json().catch(function () {
      return {};
    });
    if (seq !== titleSuggestSeq[lang]) return;

    if (!res.ok || !data.ok) {
      if (els.panel) els.panel.hidden = true;
      return;
    }

    renderTitleSuggest(lang, Object.assign({ charCount: title.length }, data));

    if (lang === 'ru' && data.suggestedUz && titleSuggestEls.uz.altText) {
      const uzTitle = String(titleSuggestEls.uz.input?.value || '').trim();
      if (!uzTitle || uzTitle.length < 12) {
        titleSuggestEls.uz.alt.hidden = false;
        titleSuggestEls.uz.altText.textContent = String(data.suggestedUz).trim();
        titleSuggestEls.uz.panel.hidden = false;
        if (titleSuggestEls.uz.feedback) {
          titleSuggestEls.uz.feedback.textContent = "Rus nomidan o'zbekcha variant taklif qilindi.";
        }
      }
    }
  } catch (_) {
    if (seq === titleSuggestSeq[lang] && els.panel) els.panel.hidden = true;
  }
}

function scheduleTitleSuggest(lang) {
  if (titleSuggestTimers[lang]) clearTimeout(titleSuggestTimers[lang]);
  titleSuggestTimers[lang] = setTimeout(function () {
    void requestTitleSuggest(lang);
  }, 700);
}

Object.keys(titleSuggestEls).forEach(function (lang) {
  const els = titleSuggestEls[lang];
  if (!els.input) return;
  els.input.addEventListener('input', function () {
    scheduleTitleSuggest(lang);
  });
  els.input.addEventListener('blur', function () {
    scheduleTitleSuggest(lang);
  });
  if (els.apply) {
    els.apply.addEventListener('click', function () {
      const suggested = String(els.altText?.textContent || '').trim();
      if (!suggested) return;
      els.input.value = suggested;
      scheduleTitleSuggest(lang);
    });
  }
});

['pBrand', 'pModel', 'pCategory'].forEach(function (id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('change', function () {
    scheduleTitleSuggest('ru');
    scheduleTitleSuggest('uz');
  });
});

// Clear all form fields
function clearEditorForm() {
  resetTitleSuggestPanels();
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
  document.getElementById('pPriceUsd').value = '';
  document.getElementById('pOldPriceUsd').value = '';
  document.getElementById('pPrice').value = '';
  document.getElementById('pOldPrice').value = '';
  updateStorefrontPricePreview();
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
  productMemoryVariants = [];
  productMemoryMeta = { nameRu: 'Память', nameUz: 'Xotira', status: 'active' };
  if (memoryAttrNameRuInput) memoryAttrNameRuInput.value = productMemoryMeta.nameRu;
  if (memoryAttrNameUzInput) memoryAttrNameUzInput.value = productMemoryMeta.nameUz;
  if (memoryAttrStatusInput) memoryAttrStatusInput.value = productMemoryMeta.status;
  renderMemoryVariantsList();
  resetMemoryVariantForm();
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
document.getElementById('refreshNbuRateBtn')?.addEventListener('click', async function() {
  const btn = this;
  btn.disabled = true;
  try {
    const res = await window.emirateExchange?.refreshNbuUsdSellRate?.(true);
    if (!res?.ok) {
      alert('Не удалось обновить курс с nbu.uz. Используется последний сохранённый курс.');
    }
    updateNbuRateLine();
    updateStorefrontPricePreview();
  } finally {
    btn.disabled = false;
  }
});

['pPriceUsd', 'pOldPriceUsd'].forEach((id) => {
  document.getElementById(id)?.addEventListener('input', updateStorefrontPricePreview);
});

void (async () => {
  if (!window.emirateExchange?.refreshNbuUsdSellRate) return;
  await window.emirateExchange.refreshNbuUsdSellRate(false);
  updateNbuRateLine();
  updateStorefrontPricePreview();
})();

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
  const priceUsd = document.getElementById('pPriceUsd').value.trim();
  const oldPriceUsd = document.getElementById('pOldPriceUsd').value.trim();
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
  const memoryMeta = {
    nameRu: String(memoryAttrNameRuInput?.value || 'Память').trim() || 'Память',
    nameUz: String(memoryAttrNameUzInput?.value || 'Xotira').trim() || 'Xotira',
    status: memoryAttrStatusInput?.value === 'inactive' ? 'inactive' : 'active'
  };
  const memoryVariants = productMemoryVariants.map((item) => ({
    id: String(item.id || `memory_${Date.now()}_${Math.floor(Math.random() * 1000)}`),
    nameRu: String(item.nameRu || item.name || '').trim(),
    nameUz: String(item.nameUz || '').trim(),
    name: String(item.nameRu || item.nameUz || item.name || '').trim(),
    status: item.status === 'inactive' ? 'inactive' : 'active',
    priceUsd: String(item.priceUsd || '').trim(),
    oldPriceUsd: String(item.oldPriceUsd || '').trim(),
    price: String(item.price || '').trim(),
    oldPrice: String(item.oldPrice || '').trim()
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

  const hasUsd = window.emirateExchange?.parseUsdInput?.(priceUsd) > 0;
  if (!hasUsd && !price) {
    alert('Укажите цену в USD или цену в сумах.');
    editorTabs.forEach(t => t.classList.remove('active'));
    editorTabContents.forEach(c => c.classList.remove('active'));
    document.querySelector('.editor-tab[data-tab="price"]')?.classList.add('active');
    document.querySelector('.editor-tab-content[data-tab="price"]')?.classList.add('active');
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
        memoryMeta,
        memoryVariants,
        priority: Number.isFinite(priority) ? priority : 300,
        priceUsd,
        oldPriceUsd,
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
      priceUsd,
      oldPriceUsd,
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
      memoryMeta,
      memoryVariants,
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

document.getElementById('pCategory')?.addEventListener('change', function() {
  const mode = editingProductId ? 'merge' : 'replace';
  applyCategoryDefaultSpecsToProduct(this.value, { mode });
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

const IMAGE_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
const IMAGE_OPTIMIZE_DEFAULTS = {
  maxSide: 1920,
  webpQuality: 0.86,
  jpegQuality: 0.88,
  skipIfUnderBytes: 450 * 1024,
  skipIfMaxSide: 1920
};

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

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image decode failed'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function toOptimizedImageDataUrl(file, options = {}) {
  const maxSide = Number(options.maxSide) || IMAGE_OPTIMIZE_DEFAULTS.maxSide;
  const webpQuality = Number(options.webpQuality) || IMAGE_OPTIMIZE_DEFAULTS.webpQuality;
  const jpegQuality = Number(options.jpegQuality) || IMAGE_OPTIMIZE_DEFAULTS.jpegQuality;
  const original = await readFileAsDataUrl(file);
  if (file.type === 'image/svg+xml') return original;
  const img = await loadImageFromDataUrl(original);
  const longest = Math.max(img.naturalWidth || 1, img.naturalHeight || 1);
  const scale = Math.min(1, maxSide / longest);
  const width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
  const height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return original;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  const webpBlob = await canvasToBlob(canvas, 'image/webp', webpQuality);
  if (webpBlob) {
    return readFileAsDataUrl(new File([webpBlob], 'optimized.webp', { type: 'image/webp' }));
  }
  const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', jpegQuality);
  if (jpegBlob) {
    return readFileAsDataUrl(new File([jpegBlob], 'optimized.jpg', { type: 'image/jpeg' }));
  }
  return canvas.toDataURL('image/jpeg', jpegQuality);
}

async function shouldSkipImageOptimize(file, options = {}) {
  if (!file?.type?.startsWith('image/') || file.type === 'image/svg+xml') return true;
  const skipBytes = Number(options.skipIfUnderBytes) || IMAGE_OPTIMIZE_DEFAULTS.skipIfUnderBytes;
  const skipSide = Number(options.skipIfMaxSide) || IMAGE_OPTIMIZE_DEFAULTS.skipIfMaxSide;
  if (file.size > skipBytes) return false;
  try {
    const img = await loadImageFromFile(file);
    const longest = Math.max(img.naturalWidth || 1, img.naturalHeight || 1);
    return longest <= skipSide && (file.type === 'image/jpeg' || file.type === 'image/webp');
  } catch (_) {
    return false;
  }
}

async function toOptimizedImageFile(file, options = {}) {
  if (await shouldSkipImageOptimize(file, options)) return file;
  const dataUrl = await toOptimizedImageDataUrl(file, options);
  const blob = await fetch(dataUrl).then((r) => r.blob());
  const base = String(file.name || 'image').replace(/\.[^.]+$/, '') || 'image';
  const isWebp = blob.type === 'image/webp';
  const ext = isWebp ? 'webp' : 'jpg';
  const mime = isWebp ? 'image/webp' : 'image/jpeg';
  return new File([blob], `${base}.${ext}`, { type: mime, lastModified: Date.now() });
}

async function prepareImageForUpload(file, options = {}) {
  if (!file?.type?.startsWith('image/')) return file;
  return toOptimizedImageFile(file, options);
}

async function appendUploadedImages(files, target, render, options = {}) {
  for (const file of Array.from(files || [])) {
    if (!file.type.startsWith('image/')) continue;
    if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
      alert(`Файл "${file.name}" больше 15MB и не был добавлен.`);
      continue;
    }
    try {
      const uploadFile = await prepareImageForUpload(file, options);
      let finalSrc = '';
      if (window.emirateSupabaseApi?.isConfigured?.() && window.emirateSupabaseApi?.uploadAdminAsset) {
        setAssetUploadState(true);
        const uploadRes = await window.emirateSupabaseApi.uploadAdminAsset(uploadFile, options);
        setAssetUploadState(false);
        if (!uploadRes?.ok || !uploadRes.url) {
          throw new Error(uploadRes?.error || 'storage upload failed');
        }
        finalSrc = uploadRes.url;
      } else {
        finalSrc = uploadFile === file
          ? await toOptimizedImageDataUrl(file, options)
          : await readFileAsDataUrl(uploadFile);
      }
      target.push(finalSrc);
      render();
    } catch (_) {
      setAssetUploadState(false);
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

memoryVariantSaveBtn?.addEventListener('click', saveMemoryVariant);
memoryVariantResetBtn?.addEventListener('click', resetMemoryVariantForm);
memoryVariantsList?.addEventListener('click', function(e) {
  const button = e.target.closest('button[data-action]');
  if (!button) return;
  const memoryId = button.getAttribute('data-memory-id');
  if (!memoryId) return;
  const action = button.getAttribute('data-action');
  if (action === 'edit-memory-variant') {
    loadMemoryVariantToForm(memoryId);
    return;
  }
  if (action === 'toggle-memory-variant') {
    productMemoryVariants = productMemoryVariants.map((item) => {
      if (item.id !== memoryId) return item;
      return { ...item, status: item.status === 'inactive' ? 'active' : 'inactive' };
    });
    renderMemoryVariantsList();
    if (editingMemoryVariantId === memoryId) {
      const edited = productMemoryVariants.find((item) => item.id === memoryId);
      if (edited && memoryStatusInput) memoryStatusInput.value = edited.status;
    }
    return;
  }
  if (action === 'delete-memory-variant') {
    if (!confirm('Удалить этот вариант памяти?')) return;
    productMemoryVariants = productMemoryVariants.filter((item) => item.id !== memoryId);
    renderMemoryVariantsList();
    if (editingMemoryVariantId === memoryId) resetMemoryVariantForm();
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

    if (activePage === 'page-categories') {
      if (!query) return renderCategories();
      return renderCategories(categoriesData.filter(c =>
        c.nameRu.toLowerCase().includes(query)
        || c.nameUz.toLowerCase().includes(query)
        || c.id.toLowerCase().includes(query)
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


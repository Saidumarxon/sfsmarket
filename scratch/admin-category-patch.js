function normalizeCategorySpec(spec) {
  if (window.emirateCategories?.normalizeCategorySpec) {
    return window.emirateCategories.normalizeCategorySpec(spec);
  }
  const row = spec || {};
  return {
    keyRu: String(row.keyRu || row.key_ru || row.key || '').trim(),
    keyUz: String(row.keyUz || row.key_uz || '').trim(),
    valueRu: String(row.valueRu || row.value_ru || row.value || '').trim(),
    valueUz: String(row.valueUz || row.value_uz || '').trim()
  };
}

function normalizeCategoryRecord(record) {
  if (window.emirateCategories?.normalizeCategoryRecord) {
    return window.emirateCategories.normalizeCategoryRecord(record);
  }
  const c = record || {};
  const id = String(c.id || '').trim();
  const parentId = String(c.parentId !== undefined ? (c.parentId || '') : (c.parent_id || '')).trim();
  const nameRu = String(c.nameRu || c.name_ru || c.name || '').trim();
  const nameUz = String(c.nameUz || c.name_uz || '').trim();
  const slug = String(c.slug || '').trim();
  const sortOrder = Number.isFinite(Number(c.sortOrder)) ? Number(c.sortOrder) : (Number.isFinite(Number(c.sort_order)) ? Number(c.sort_order) : 100);
  const isActive = c.isActive !== undefined ? Boolean(c.isActive) : (c.is_active !== undefined ? Boolean(c.is_active) : (c.status !== 'inactive'));
  const showInNav = c.showInNav !== undefined ? Boolean(c.showInNav) : (c.show_in_nav !== undefined ? Boolean(c.show_in_nav) : !parentId);
  const icon = String(c.icon || '').trim();
  const rawSpecs = Array.isArray(c.defaultSpecs) ? c.defaultSpecs : (Array.isArray(c.default_specs) ? c.default_specs : []);
  const defaultSpecs = rawSpecs.map(normalizeCategorySpec).filter((item) => item.keyRu || item.keyUz);
  const updatedAt = c.updatedAt || c.updated_at || getDateTimeString();

  return {
    id: id || `cat_${Math.floor(Math.random() * 9000 + 1000)}`,
    nameRu,
    name_ru: nameRu,
    nameUz,
    name_uz: nameUz,
    slug,
    parentId,
    parent_id: parentId || null,
    sortOrder,
    sort_order: sortOrder,
    isActive,
    is_active: isActive,
    showInNav,
    show_in_nav: showInNav,
    icon,
    defaultSpecs,
    default_specs: defaultSpecs,
    updatedAt,
    updated_at: updatedAt
  };
}

function getCategoryById(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  return categoriesData.find((item) => item.id === key) || null;
}

function getCategoryChildren(parentId, { activeOnly = false } = {}) {
  const parent = String(parentId || '').trim();
  return categoriesData
    .filter((item) => {
      const pId = String(item.parentId || item.parent_id || '').trim();
      return pId === parent;
    })
    .filter((item) => !activeOnly || item.isActive)
    .sort((a, b) => (Number(a.sortOrder || a.sort_order || 0)) - (Number(b.sortOrder || b.sort_order || 0)) || String(a.nameRu || '').localeCompare(String(b.nameRu || ''), 'ru'));
}

function getCategoryPath(categoryOrId) {
  const start = typeof categoryOrId === 'string' ? getCategoryById(categoryOrId) : categoryOrId;
  if (!start) return [];
  const path = [];
  const seen = new Set();
  let current = start;
  while (current && !seen.has(current.id)) {
    path.unshift(current);
    seen.add(current.id);
    const pId = String(current.parentId || current.parent_id || '').trim();
    current = pId ? getCategoryById(pId) : null;
  }
  return path;
}

function getCategoryPathLabel(categoryOrId, separator = ' · ') {
  const path = getCategoryPath(categoryOrId);
  return path.map((item) => item.nameRu).join(separator);
}

function categoryHasChildren(categoryId) {
  const id = String(categoryId || '').trim();
  return categoriesData.some((item) => {
    const pId = String(item.parentId || item.parent_id || '').trim();
    return pId === id;
  });
}

function isLeafCategory(categoryId) {
  const cat = getCategoryById(categoryId);
  if (!cat) return false;
  const path = getCategoryPath(cat);
  return path.length === 3 && !categoryHasChildren(cat.id);
}

function flattenCategoryTree(parentId = '') {
  return getCategoryChildren(parentId).flatMap((item) => [item, ...flattenCategoryTree(item.id)]);
}

function collectDescendantCategoryIds(categoryId) {
  return getCategoryChildren(categoryId).flatMap((item) => [item.id, ...collectDescendantCategoryIds(item.id)]);
}

function wouldCreateCategoryCycle(categoryId, parentId) {
  const id = String(categoryId || '').trim();
  let current = String(parentId || '').trim();
  const seen = new Set();
  while (current) {
    if (id && current === id) return true;
    if (seen.has(current)) return true;
    seen.add(current);
    const parent = getCategoryById(current);
    current = parent ? String(parent.parentId || parent.parent_id || '').trim() : '';
  }
  return false;
}

function syncCategoryParentSelect(selectedValue = '', excludeId = '') {
  const select = document.getElementById('categoryParentId');
  if (!select) return;
  const current = selectedValue != null ? String(selectedValue) : select.value;
  const exclude = String(excludeId || '').trim();

  // In a strict 3-level tree: Root (depth 1) -> Group (depth 2) -> Leaf (depth 3).
  // Only Roots and Groups can be parents. A Leaf cannot have children.
  const options = categoriesData
    .filter((item) => item.id !== exclude)
    .filter((item) => !exclude || !wouldCreateCategoryCycle(exclude, item.id))
    .filter((item) => {
      const depth = getCategoryPath(item).length;
      return depth <= 2;
    })
    .sort((a, b) => getCategoryPathLabel(a).localeCompare(getCategoryPathLabel(b), 'ru'));

  let html = '<option value="">— Корень (верхний уровень: Root) —</option>';
  options.forEach((item) => {
    const depth = Math.max(0, getCategoryPath(item).length - 1);
    const pad = depth ? `${'—'.repeat(depth)} ` : '';
    const levelLabel = depth === 0 ? ' [Корень]' : ' [Группа]';
    const label = pad + item.nameRu + levelLabel + (item.isActive ? '' : ' (неактивна)');
    html += `<option value="${escapeHtml(item.id)}">${escapeHtml(label)}</option>`;
  });
  select.innerHTML = html;
  if (current && Array.from(select.options).some((opt) => opt.value === current)) {
    select.value = current;
  } else {
    select.value = '';
  }
}

// Memory state for categories loaded from Supabase
let categoriesData = [];
let categoriesLoading = false;
let categoryFeedbackTimer = null;

async function loadCategoriesFromSupabase() {
  if (!window.emirateSupabaseApi?.fetchAdminCategories) return;
  categoriesLoading = true;
  try {
    const list = await window.emirateSupabaseApi.fetchAdminCategories();
    if (Array.isArray(list) && list.length) {
      categoriesData = list.map(normalizeCategoryRecord);
      try {
        localStorage.setItem(ADMIN_CATEGORIES_KEY, JSON.stringify(categoriesData));
      } catch (_) {}
    }
  } catch (err) {
    console.warn('[Supabase] Failed to load categories', err);
  } finally {
    categoriesLoading = false;
  }
  renderCategories();
  syncCategoryParentSelect();
  renderCategoryStackLevels();
  syncCategoryAcceptButton();
}

function showCategoryFeedback(message, type = 'success', timeoutMs = 3200) {
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

  const idSet = new Set(data.map((item) => item.id));
  const sorted = flattenCategoryTree('').filter((item) => idSet.has(item.id));

  if (!sorted.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:20px;">Нет категорий</td></tr>';
    count.textContent = 'Показано 0 из 0';
    return;
  }

  tbody.innerHTML = sorted.map((category) => {
    const path = getCategoryPath(category);
    const depth = Math.max(0, path.length - 1);
    const pathLabel = getCategoryPathLabel(category, ' › ');
    const pId = String(category.parentId || category.parent_id || '').trim();
    const parentLabel = pId ? (getCategoryById(pId)?.nameRu || '—') : 'Корень';
    const levelName = depth === 0 ? 'Корень' : (depth === 1 ? 'Группа' : 'Категория');
    const levelBadgeClass = depth === 0 ? 'status-badge active' : (depth === 1 ? 'status-badge' : 'status-badge inactive');
    const canHaveChildren = depth < 2;

    const navBadge = category.showInNav
      ? `<button type="button" class="status-badge active" style="cursor:pointer;" title="Отображается в навигации. Нажмите, чтобы скрыть" data-action="toggle-category-nav" data-category-id="${escapeHtml(category.id)}"><span class="status-dot"></span>ON</button>`
      : `<button type="button" class="status-badge inactive" style="cursor:pointer;" title="Скрыто из навигации. Нажмите, чтобы показать" data-action="toggle-category-nav" data-category-id="${escapeHtml(category.id)}"><span class="status-dot"></span>OFF</button>`;

    const addChildBtn = canHaveChildren
      ? `<button class="action-btn" title="Добавить подкатегорию" data-action="add-child-category" data-category-id="${escapeHtml(category.id)}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>`
      : '';

    return `
    <tr>
      <td style="padding-left:${12 + depth * 18}px"><strong>${escapeHtml(category.nameRu)}</strong><div class="product-sku">${escapeHtml(category.id)}</div></td>
      <td><code>${escapeHtml(category.slug || '')}</code></td>
      <td><span class="category-path-cell" title="${escapeHtml(pathLabel)}">${escapeHtml(pathLabel || category.nameRu)}</span><div class="product-sku">${escapeHtml(parentLabel)}</div></td>
      <td>${escapeHtml(category.nameUz || '—')}</td>
      <td>${navBadge}</td>
      <td><span class="${levelBadgeClass}">${levelName}</span></td>
      <td>${escapeHtml(String(category.sortOrder || category.sort_order || 100))}</td>
      <td><span class="status-badge ${category.isActive ? 'active' : 'inactive'}"><span class="status-dot"></span>${category.isActive ? 'Активна' : 'Неактивна'}</span></td>
      <td>
        <div class="action-btns">
          ${addChildBtn}
          <button class="action-btn" title="Редактировать" data-action="edit-category" data-category-id="${escapeHtml(category.id)}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="action-btn" title="Вкл/выкл" data-action="toggle-category" data-category-id="${escapeHtml(category.id)}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/></svg></button>
          <button class="action-btn delete" title="Удалить" data-action="delete-category" data-category-id="${escapeHtml(category.id)}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
        </div>
      </td>
    </tr>
  `;
  }).join('');

  count.textContent = `Показано ${sorted.length} из ${categoriesData.length}`;
}

function resetCategoryForm() {
  const form = document.getElementById('categoryForm');
  const idInput = document.getElementById('categoryId');
  const statusInput = document.getElementById('categoryStatus');
  const sortInput = document.getElementById('categorySortOrder');
  const navInput = document.getElementById('categoryShowInNav');
  const saveBtn = document.getElementById('categorySaveBtn');
  form?.reset();
  if (idInput) idInput.value = '';
  const nameRu = document.getElementById('categoryNameRu');
  const nameUz = document.getElementById('categoryNameUz');
  const slugInput = document.getElementById('categorySlug');
  const iconInput = document.getElementById('categoryIcon');
  if (nameRu) nameRu.value = '';
  if (nameUz) nameUz.value = '';
  if (slugInput) slugInput.value = '';
  if (iconInput) iconInput.value = '';
  if (statusInput) statusInput.value = 'active';
  if (sortInput) sortInput.value = '100';
  if (navInput) navInput.value = 'false';
  if (saveBtn) {
    saveBtn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg> Создать категорию';
  }
  document.getElementById('categoryNameRu')?.closest('.form-group')?.classList.remove('error');
  renderCategorySpecsRows([]);
  syncCategoryParentSelect('');
}

function fillCategoryForm(categoryId) {
  const category = categoriesData.find((item) => item.id === categoryId);
  if (!category) return;
  document.getElementById('categoryId').value = category.id;
  document.getElementById('categoryNameRu').value = category.nameRu;
  document.getElementById('categoryNameUz').value = category.nameUz || '';
  if (document.getElementById('categorySlug')) {
    document.getElementById('categorySlug').value = category.slug || '';
  }
  if (document.getElementById('categoryIcon')) {
    document.getElementById('categoryIcon').value = category.icon || '';
  }
  document.getElementById('categorySortOrder').value = String(category.sortOrder || category.sort_order || 100);
  document.getElementById('categoryStatus').value = category.isActive ? 'active' : 'inactive';
  const navInput = document.getElementById('categoryShowInNav');
  if (navInput) navInput.value = category.showInNav !== false ? 'true' : 'false';
  syncCategoryParentSelect(category.parentId || category.parent_id || '', category.id);
  renderCategorySpecsRows(category.defaultSpecs || category.default_specs || []);
  const saveBtn = document.getElementById('categorySaveBtn');
  if (saveBtn) {
    saveBtn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg> Сохранить изменения';
  }
}

async function saveCategory(event) {
  event.preventDefault();
  const id = document.getElementById('categoryId').value.trim();
  const nameRu = document.getElementById('categoryNameRu').value.trim();
  const nameUz = document.getElementById('categoryNameUz').value.trim();
  const rawSlug = document.getElementById('categorySlug')?.value?.trim() || '';
  const icon = document.getElementById('categoryIcon')?.value?.trim() || '';
  const parentId = document.getElementById('categoryParentId')?.value?.trim() || null;
  const sortOrder = Number(document.getElementById('categorySortOrder').value) || 100;
  const isActive = document.getElementById('categoryStatus').value !== 'inactive';
  const showInNav = document.getElementById('categoryShowInNav')?.value !== 'false';
  const defaultSpecs = getCategorySpecsFromEditor();
  const nameGroup = document.getElementById('categoryNameRu').closest('.form-group');
  nameGroup?.classList.remove('error');

  if (nameRu.length < 2) {
    nameGroup?.classList.add('error');
    showCategoryFeedback('Введите корректное название категории (Ru).', 'error', 3200);
    return;
  }

  const slug = rawSlug
    ? (window.emirateCategories?.slugifyCategory(rawSlug) || rawSlug.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
    : (window.emirateCategories?.slugifyCategory(nameRu) || 'cat-' + Date.now());

  if (id && wouldCreateCategoryCycle(id, parentId)) {
    showCategoryFeedback('Нельзя выбрать эту родительскую категорию — получится цикл.', 'error', 3600);
    return;
  }

  // Strictly enforce 3-level tree limit: Root -> Group -> Leaf
  if (parentId) {
    const parentPath = getCategoryPath(parentId);
    if (parentPath.length >= 3) {
      showCategoryFeedback('Максимальная глубина дерева — 3 уровня. Нельзя создавать подкатегорию внутри конечной категории (Leaf).', 'error', 4500);
      return;
    }
  }

  const duplicate = categoriesData.find((item) => (
    item.nameRu.toLowerCase() === nameRu.toLowerCase() &&
    item.id !== id &&
    String(item.parentId || item.parent_id || '') === String(parentId || '')
  ));
  if (duplicate) {
    showCategoryFeedback('В этой категории уже есть подкатегория с таким названием.', 'error', 3200);
    return;
  }

  const duplicateSlug = categoriesData.find((item) => item.slug === slug && item.id !== id);
  if (duplicateSlug) {
    showCategoryFeedback(`Категория с slug "${slug}" уже существует. Укажите уникальный slug.`, 'error', 3600);
    return;
  }

  const saveBtn = document.getElementById('categorySaveBtn');
  if (saveBtn) saveBtn.disabled = true;

  try {
    if (id) {
      const res = await window.emirateSupabaseApi.updateAdminCategory(id, {
        name_ru: nameRu,
        name_uz: nameUz,
        parent_id: parentId,
        slug: slug,
        icon: icon,
        sort_order: sortOrder,
        is_active: isActive,
        show_in_nav: showInNav,
        default_specs: defaultSpecs
      });
      if (!res.ok) {
        showCategoryFeedback('Ошибка сохранения: ' + (res.error || 'неизвестно'), 'error', 4500);
        return;
      }
      showCategoryFeedback('Категория успешно сохранена в Supabase.', 'success');
    } else {
      let newIdPrefix = 'cat_';
      if (!parentId) {
        newIdPrefix = 'root_';
      } else {
        const pPath = getCategoryPath(parentId);
        if (pPath.length === 1) newIdPrefix = 'grp_';
        else newIdPrefix = 'cat_';
      }
      let candidateId = newIdPrefix + slug.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
      if (categoriesData.some(c => c.id === candidateId)) {
        candidateId += '_' + Math.floor(Math.random() * 900 + 100);
      }

      const res = await window.emirateSupabaseApi.createAdminCategory({
        id: candidateId,
        name_ru: nameRu,
        name_uz: nameUz,
        parent_id: parentId,
        slug: slug,
        icon: icon,
        sort_order: sortOrder,
        is_active: isActive,
        show_in_nav: showInNav,
        default_specs: defaultSpecs
      });
      if (!res.ok) {
        showCategoryFeedback('Ошибка создания: ' + (res.error || 'неизвестно'), 'error', 4500);
        return;
      }
      showCategoryFeedback('Категория успешно создана в Supabase.', 'success');
      resetCategoryForm();
    }

    await loadCategoriesFromSupabase();
  } catch (err) {
    showCategoryFeedback('Ошибка: ' + (err.message || String(err)), 'error', 4500);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function toggleCategoryStatus(categoryId) {
  const category = categoriesData.find((item) => item.id === categoryId);
  if (!category) return;
  const nextActive = !category.isActive;
  const res = await window.emirateSupabaseApi.updateAdminCategory(categoryId, { is_active: nextActive });
  if (!res.ok) {
    showCategoryFeedback('Ошибка обновления статуса: ' + (res.error || 'неизвестно'), 'error', 4000);
    return;
  }
  category.isActive = nextActive;
  category.is_active = nextActive;
  renderCategories();
  renderCategoryStackLevels();
  showCategoryFeedback(`Категория ${nextActive ? 'активирована' : 'деактивирована'}.`, 'success');
}

async function toggleCategoryNav(categoryId) {
  const category = categoriesData.find((item) => item.id === categoryId);
  if (!category) return;
  const nextNav = !category.showInNav;
  const res = await window.emirateSupabaseApi.updateAdminCategory(categoryId, { show_in_nav: nextNav });
  if (!res.ok) {
    showCategoryFeedback('Ошибка обновления навигации: ' + (res.error || 'неизвестно'), 'error', 4000);
    return;
  }
  category.showInNav = nextNav;
  category.show_in_nav = nextNav;
  renderCategories();
  showCategoryFeedback(`Отображение в навигации: ${nextNav ? 'ВКЛ (ON)' : 'ВЫКЛ (OFF)'}.`, 'success');
}

function startAddChildCategory(parentId) {
  const parent = getCategoryById(parentId);
  if (!parent) return;
  const depth = getCategoryPath(parent).length;
  if (depth >= 3) {
    showCategoryFeedback('Максимальная глубина дерева — 3 уровня. Нельзя добавить подкатегорию в Leaf категорию.', 'error', 4000);
    return;
  }
  resetCategoryForm();
  syncCategoryParentSelect(parent.id);
  document.getElementById('categoryNameRu')?.focus();
  showCategoryFeedback(`Подкатегория внутри «${parent.nameRu}». Укажите название.`, 'success');
}

async function deleteCategory(categoryId) {
  const category = categoriesData.find((item) => item.id === categoryId);
  if (!category) return;

  const childIds = collectDescendantCategoryIds(categoryId);
  if (childIds.length) {
    const proceed = confirm(`У категории "${category.nameRu}" есть ${childIds.length} подкатегорий. Вы уверены, что хотите удалить её?`);
    if (!proceed) return;
  } else {
    if (!confirm(`Удалить категорию "${category.nameRu}"?`)) return;
  }

  const res = await window.emirateSupabaseApi.deleteAdminCategory(categoryId);
  if (!res.ok) {
    const isFkConstraint = res.code === '23503' || String(res.error || '').includes('foreign key') || String(res.error || '').includes('products_category_id_fkey');
    if (isFkConstraint) {
      const msg = 'Невозможно удалить категорию: к ней привязаны товары в каталоге (действует ограничение целостности данных ON DELETE RESTRICT). Сначала отвяжите товары или деактивируйте категорию.';
      showCategoryFeedback(msg, 'error', 6000);
      alert(msg);
    } else {
      const msg = 'Ошибка удаления: ' + (res.error || 'неизвестно');
      showCategoryFeedback(msg, 'error', 4000);
      alert(msg);
    }
    return;
  }

  showCategoryFeedback('Категория удалена из Supabase.', 'success');
  resetCategoryForm();
  await loadCategoriesFromSupabase();
}

function getCategoryByProductName(name) {
  const key = String(name || '').trim();
  if (!key) return null;
  const matches = categoriesData.filter((item) => item.nameRu === key || item.nameUz === key);
  if (!matches.length) return null;
  return matches.sort((a, b) => getCategoryPath(b).length - getCategoryPath(a).length)[0];
}

function getCategoryDefaultSpecs(category) {
  let current = category || null;
  while (current) {
    const specs = Array.isArray(current.defaultSpecs) ? current.defaultSpecs : (Array.isArray(current.default_specs) ? current.default_specs : []);
    const normalized = specs.map(normalizeCategorySpec).filter((item) => item.keyRu || item.keyUz);
    if (normalized.length) return normalized;
    const pId = String(current.parentId || current.parent_id || '').trim();
    current = pId ? getCategoryById(pId) : null;
  }
  return [];
}

function activateEditorTab(tabName) {
  const tab = document.querySelector(`.editor-tab[data-tab="${tabName}"]`);
  if (tab) tab.click();
}

// ==============================================================================
// PRODUCT CATEGORY PICKER (3-LEVEL CASCADING: Root -> Group -> Leaf)
// ==============================================================================
const categoryPickerState = {
  selectedRootId: '',
  selectedGroupId: '',
  selectedLeafId: '',
  initialized: false
};

function syncCategoryAcceptButton() {
  const btn = document.getElementById('pCategoryAccept');
  if (!btn) return;
  // Product assignment is allowed ONLY to Leaf categories (depth 3, no children)
  const leaf = categoryPickerState.selectedLeafId ? getCategoryById(categoryPickerState.selectedLeafId) : null;
  btn.disabled = !(leaf && isLeafCategory(leaf.id));
}

function renderCategoryStackLevels() {
  const box = document.getElementById('pCategoryLevels');
  if (!box) return;

  // Level 1: Roots
  const roots = categoriesData
    .filter((c) => !c.parentId && !c.parent_id && c.isActive)
    .sort((a, b) => (Number(a.sortOrder || a.sort_order || 0)) - (Number(b.sortOrder || b.sort_order || 0)) || String(a.nameRu || '').localeCompare(String(b.nameRu || ''), 'ru'));

  // Level 2: Groups for selectedRootId
  const groups = categoryPickerState.selectedRootId
    ? getCategoryChildren(categoryPickerState.selectedRootId, { activeOnly: true })
    : [];

  // Level 3: Leafs for selectedGroupId
  const leafs = categoryPickerState.selectedGroupId
    ? getCategoryChildren(categoryPickerState.selectedGroupId, { activeOnly: true })
    : [];

  let html = `
    <select class="category-stack-select" data-stack-level="0">
      <option value="">1. Выберите раздел (Корень)…</option>
      ${roots.map((item) => `
        <option value="${escapeHtml(item.id)}"${item.id === categoryPickerState.selectedRootId ? ' selected' : ''}>${escapeHtml(item.nameRu)}</option>
      `).join('')}
    </select>
  `;

  if (categoryPickerState.selectedRootId && groups.length) {
    html += `
      <select class="category-stack-select" data-stack-level="1">
        <option value="">2. Выберите группу…</option>
        ${groups.map((item) => `
          <option value="${escapeHtml(item.id)}"${item.id === categoryPickerState.selectedGroupId ? ' selected' : ''}>${escapeHtml(item.nameRu)}</option>
        `).join('')}
      </select>
    `;
  }

  if (categoryPickerState.selectedGroupId && leafs.length) {
    html += `
      <select class="category-stack-select" data-stack-level="2">
        <option value="">3. Выберите категорию (Leaf)…</option>
        ${leafs.map((item) => `
          <option value="${escapeHtml(item.id)}"${item.id === categoryPickerState.selectedLeafId ? ' selected' : ''}>${escapeHtml(item.nameRu)}</option>
        `).join('')}
      </select>
    `;
  }

  box.innerHTML = html;
}

function onCategoryStackLevelChange(levelIndex, categoryId) {
  const nextId = String(categoryId || '').trim();
  if (levelIndex === 0) {
    categoryPickerState.selectedRootId = nextId;
    categoryPickerState.selectedGroupId = '';
    categoryPickerState.selectedLeafId = '';
  } else if (levelIndex === 1) {
    categoryPickerState.selectedGroupId = nextId;
    categoryPickerState.selectedLeafId = '';
  } else if (levelIndex === 2) {
    categoryPickerState.selectedLeafId = nextId;
  }
  renderCategoryStackLevels();
  syncCategoryAcceptButton();
}

function setCategoryPickerOpen(open) {
  const picker = document.getElementById('pCategoryPicker');
  if (!picker) return;
  picker.classList.toggle('is-collapsed', !open);
}

function acceptProductCategoryStack() {
  const leafId = categoryPickerState.selectedLeafId;
  const leaf = leafId ? getCategoryById(leafId) : null;
  if (!leaf || !isLeafCategory(leaf.id)) return;

  const catIdInput = document.getElementById('pCategoryId');
  const catInput = document.getElementById('pCategory');
  const pathEl = document.getElementById('pCategoryPath');

  if (catIdInput) catIdInput.value = leaf.id;
  if (catInput && !editingProductId) catInput.value = leaf.nameRu;

  if (pathEl) {
    pathEl.textContent = getCategoryPathLabel(leaf, ' › ');
    pathEl.classList.remove('is-placeholder');
  }

  applyCategoryDefaultSpecsToProduct(leaf.nameRu, {
    mode: editingProductId ? 'merge' : 'replace',
    categoryId: leaf.id
  });

  setCategoryPickerOpen(false);
}

function setProductCategoryFromId(categoryId) {
  const catIdInput = document.getElementById('pCategoryId');
  const pathEl = document.getElementById('pCategoryPath');
  const leaf = categoryId ? getCategoryById(categoryId) : null;

  if (leaf) {
    const path = getCategoryPath(leaf);
    categoryPickerState.selectedRootId = path[0]?.id || '';
    categoryPickerState.selectedGroupId = path[1]?.id || '';
    categoryPickerState.selectedLeafId = path[2]?.id || leaf.id;

    if (catIdInput) catIdInput.value = leaf.id;
    if (pathEl) {
      pathEl.textContent = getCategoryPathLabel(leaf, ' › ');
      pathEl.classList.remove('is-placeholder');
    }
    renderCategoryStackLevels();
    syncCategoryAcceptButton();
    setCategoryPickerOpen(false);
  } else {
    // category_id is NULL (e.g. NEEDS_REVIEW products or new product)
    // CRITICAL: Do NOT infer or auto-select from payload.category!
    categoryPickerState.selectedRootId = '';
    categoryPickerState.selectedGroupId = '';
    categoryPickerState.selectedLeafId = '';

    if (catIdInput) catIdInput.value = '';
    if (pathEl) {
      pathEl.textContent = 'Выберите категорию…';
      pathEl.classList.add('is-placeholder');
    }
    renderCategoryStackLevels();
    syncCategoryAcceptButton();
    setCategoryPickerOpen(true);
  }
}

function initCategoryTreePicker() {
  if (categoryPickerState.initialized) return;
  const picker = document.getElementById('pCategoryPicker');
  const levels = document.getElementById('pCategoryLevels');
  const accept = document.getElementById('pCategoryAccept');
  const changeBtn = document.getElementById('pCategoryChange');
  if (!picker || !levels) return;
  categoryPickerState.initialized = true;

  levels.addEventListener('change', function (e) {
    const select = e.target.closest('[data-stack-level]');
    if (!select) return;
    onCategoryStackLevelChange(Number(select.getAttribute('data-stack-level')) || 0, select.value);
  });

  accept?.addEventListener('click', acceptProductCategoryStack);
  changeBtn?.addEventListener('click', function () {
    setCategoryPickerOpen(true);
  });
  renderCategoryStackLevels();
  syncCategoryAcceptButton();
}

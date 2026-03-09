// Dashboard JavaScript
let currentPage = 1;
const itemsPerPage = 1000;
let allSubscribers = [];
let searchTimeout = null;
let selectedIds = new Set();
let currentProfileSubscriberId = null;
let originalProfileUsername = null;
let originalProfileSpeed = null;

// =============================================
// TOAST NOTIFICATION SYSTEM
// =============================================
function showToast(message, type = "success") {
  const existingToast = document.querySelector(".toast-notification");
  if (existingToast) existingToast.remove();

  const toast = document.createElement("div");
  toast.className = `toast-notification toast-${type}`;

  const icons = {
    success: "fa-check-circle",
    error: "fa-exclamation-circle",
    warning: "fa-exclamation-triangle",
    info: "fa-info-circle",
  };

  toast.innerHTML = `
    <i class="fas ${icons[type] || icons.info}"></i>
    <span>${message}</span>
  `;

  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// =============================================
// CUSTOM CONFIRM DIALOG
// =============================================
function showConfirm(message, onConfirm, onCancel = null) {
  const existing = document.querySelector(".confirm-dialog-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "confirm-dialog-overlay";
  overlay.innerHTML = `
    <div class="confirm-dialog">
      <div class="confirm-dialog-icon">
        <i class="fas fa-question-circle"></i>
      </div>
      <p class="confirm-dialog-message">${message}</p>
      <div class="confirm-dialog-buttons">
        <button type="button" class="confirm-btn confirm-btn-danger" id="confirmYesBtn">
          <i class="fas fa-check"></i> نعم، تأكيد
        </button>
        <button type="button" class="confirm-btn confirm-btn-cancel" id="confirmNoBtn">
          <i class="fas fa-times"></i> إلغاء
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add("show"), 10);

  const closeDialog = () => {
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 200);
  };

  overlay.querySelector("#confirmYesBtn").onclick = () => {
    closeDialog();
    if (onConfirm) onConfirm();
  };
  overlay.querySelector("#confirmNoBtn").onclick = () => {
    closeDialog();
    if (onCancel) onCancel();
  };
  overlay.onclick = (e) => {
    if (e.target === overlay) { closeDialog(); if (onCancel) onCancel(); }
  };
  const handleEscape = (e) => {
    if (e.key === "Escape") {
      closeDialog();
      if (onCancel) onCancel();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);
}

// =============================================
// AUTHENTICATED FETCH
// =============================================
async function authenticatedFetch(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    if (response.ok) return response;
    window.location.href = "/login";
    throw new Error("Not authenticated");
  }
  return response;
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// =============================================
// INIT
// =============================================
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  setupNewFeatureListeners();
  setupExpiringUsernamesListeners();
  initSmsSection();
  loadStats();
  addQuickFilters();
});

window.addEventListener("hashchange", handleHashChange);
window.addEventListener("load", () => { handleHashChange(); });

function handleHashChange() {
  let hash = window.location.hash.slice(1);

  if (!hash) {
    hash = sessionStorage.getItem("currentDashboardSection") || "dashboard";
    history.replaceState(null, null, "#" + hash);
  }

  if (hash === "subscriber-profile") {
    if (!currentProfileSubscriberId) {
      hash = "subscribers";
      history.replaceState(null, null, "#" + hash);
    } else {
      openSubscriberProfile(currentProfileSubscriberId, true);
      return;
    }
  }

  switchSection(hash);

  if (hash !== "subscriber-profile") {
    sessionStorage.setItem("currentDashboardSection", hash);
  }

  document.querySelectorAll(".menu-item").forEach((item) => {
    item.classList.remove("active");
    if (item.dataset.section === hash) item.classList.add("active");
  });
}

// =============================================
// EVENT LISTENERS
// =============================================
function setupEventListeners() {
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.querySelector(".sidebar");

  if (menuToggle) {
    menuToggle.addEventListener("click", () => sidebar.classList.toggle("active"));
  }

  document.addEventListener("click", (e) => {
    if (sidebar && menuToggle && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
      sidebar.classList.remove("active");
    }
  });

  document.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      if (item.classList.contains("logout")) return;
      e.preventDefault();
      const section = item.dataset.section;
      window.location.hash = section;
      handleHashChange();
      if (window.innerWidth <= 768) sidebar.classList.remove("active");
    });
  });

  document.getElementById("addSubscriberBtn")?.addEventListener("click", showAddForm);
  document.getElementById("cancelFormBtn")?.addEventListener("click", hideForm);
  document.getElementById("subscriberFormElement")?.addEventListener("submit", handleFormSubmit);
  document.getElementById("deleteAllBtn")?.addEventListener("click", deleteAllSubscribers);
  document.getElementById("importExcelBtn")?.addEventListener("click", openImportModal);

  const uploadArea = document.getElementById("uploadArea");
  const excelFileInput = document.getElementById("excelFile");

  if (uploadArea && excelFileInput) {
    uploadArea.addEventListener("click", (e) => {
      if (e.target.id !== "chooseFileBtn") {
        excelFileInput.value = "";
        excelFileInput.click();
      }
    });
    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = "var(--primary-color)";
    });
    uploadArea.addEventListener("dragleave", () => {
      uploadArea.style.borderColor = "var(--border-color)";
    });
    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = "var(--border-color)";
      handleFileUpload(e.dataTransfer.files);
    });
  }

  document.getElementById("chooseFileBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const fi = document.getElementById("excelFile");
    if (fi) { fi.value = ""; fi.click(); }
  });

  document.getElementById("excelFile")?.addEventListener("change", (e) => {
    if (e.target.files?.length > 0) handleFileUpload(e.target.files);
  });

  const mainSearchInput = document.getElementById("mainSearchInput");
  if (mainSearchInput) {
    mainSearchInput.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const term = mainSearchInput.value.trim();
        if (term) handleSmartSearch(term);
        else loadSubscribers(currentPage);
      }, 300);
    });
  }

  document.querySelectorAll(".column-filter").forEach((filter) => {
    filter.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => applyColumnFilters(), 200);
    });
    filter.addEventListener("change", () => applyColumnFilters());
  });

  document.getElementById("clearFiltersBtn")?.addEventListener("click", clearColumnFilters);
  document.getElementById("selectAllCheckbox")?.addEventListener("change", handleSelectAll);
  document.getElementById("deleteSelectedBtn")?.addEventListener("click", deleteSelectedSubscribers);
  document.getElementById("bulkEditBtn")?.addEventListener("click", showBulkEditModal);
  document.getElementById("cancelBulkEdit")?.addEventListener("click", hideBulkEditModal);
  document.getElementById("bulkEditForm")?.addEventListener("submit", handleBulkEdit);

  document.getElementById("bulkField")?.addEventListener("change", (e) => {
    const valueGroup = document.getElementById("bulkValueGroup");
    const valueInput = document.getElementById("bulkValue");
    const valueDateInput = document.getElementById("bulkValueDate");
    if (e.target.value) {
      valueGroup.style.display = "block";
      const isDate = e.target.value === "startDate" || e.target.value === "firstContactDate";
      valueInput.style.display = isDate ? "none" : "block";
      valueDateInput.style.display = isDate ? "block" : "none";
    } else {
      valueGroup.style.display = "none";
    }
  });

  document.getElementById("exportExcelBtn")?.addEventListener("click", exportToExcel);

  document.querySelectorAll('input[name="uploadType"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const updateInfo = document.getElementById("updateInfo");
      if (updateInfo) updateInfo.style.display = e.target.value === "update" ? "block" : "none";
    });
  });
}

// =============================================
// SECTION SWITCHING
// =============================================
function switchSection(sectionId) {
  document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));
  const target = document.getElementById(sectionId);

  if (target) {
    target.classList.add("active");
    if (sectionId === "subscribers") loadSubscribers();
    else if (sectionId === "available-usernames") loadAvailableUsernames();
    else if (sectionId === "stopped-subscribers") loadStoppedSubscribers();
    else if (sectionId === "expiring-usernames") loadExpiringUsernames();
    else if (sectionId === "sms") {
      // Ensure allSubscribers is populated for SMS search suggestions
      if (allSubscribers.length === 0) loadSubscribers(1, "");
      // Reset bulk cache so list is fresh
      smsAllSubscribers = [];
      if (smsCurrentMode === "bulk") populateSmsRecipientsList();
    }
  } else {
    document.getElementById("dashboard")?.classList.add("active");
  }
}

// =============================================
// LOAD SUBSCRIBERS
// =============================================
async function loadSubscribers(page = 1, search = "") {
  try {
    let url = `/api/subscribers?page=${page}&limit=${itemsPerPage}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const response = await authenticatedFetch(url);
    const result = await response.json();
    if (result.success) {
      allSubscribers = result.data;
      displaySubscribers(result.data);
      displayPagination(result.pagination);
      currentPage = page;
    }
  } catch (error) {
    if (error.message === "Not authenticated") return;
    console.error("Error loading subscribers:", error);
    showToast("خطأ في تحميل قائمة المشتركين", "error");
  }
}

// =============================================
// SMART SEARCH
// =============================================
async function handleSmartSearch(searchTerm) {
  const term = searchTerm.toLowerCase().trim();
  if (allSubscribers.length === 0) await loadSubscribers(1);

  const emptyFieldSearches = {
    "بدون هاتف": (sub) => !sub.phone || sub.phone.trim() === "",
    "لا هاتف": (sub) => !sub.phone || sub.phone.trim() === "",
    "no phone": (sub) => !sub.phone || sub.phone.trim() === "",
    "بدون تاريخ": (sub) => !sub.startDate || sub.startDate.trim() === "",
    "لا تاريخ": (sub) => !sub.startDate || sub.startDate.trim() === "",
    "بدون تاريخ اتصال": (sub) => !sub.firstContactDate || sub.firstContactDate === "-",
    "لا تاريخ اتصال": (sub) => !sub.firstContactDate || sub.firstContactDate === "-",
    "بدون تاريخ اول اتصال": (sub) => !sub.firstContactDate || sub.firstContactDate === "-",
    "بدون كلمة مرور": (sub) => !sub.password || sub.password.trim() === "",
    "لا كلمة مرور": (sub) => !sub.password || sub.password.trim() === "",
    "بدون ملاحظات": (sub) => !sub.notes || sub.notes.trim() === "",
    "لا ملاحظات": (sub) => !sub.notes || sub.notes.trim() === "",
    "بدون باقة": (sub) => !sub.package || sub.package.trim() === "",
    "لا باقة": (sub) => !sub.package || sub.package.trim() === "",
    "بيانات ناقصة": (sub) =>
      !sub.phone || !sub.startDate || !sub.firstContactDate || !sub.password || !sub.notes,
    "معلومات ناقصة": (sub) =>
      !sub.phone || !sub.startDate || !sub.firstContactDate || !sub.password || !sub.notes,
    "missing data": (sub) =>
      !sub.phone || !sub.startDate || !sub.firstContactDate || !sub.password || !sub.notes,
    incomplete: (sub) =>
      !sub.phone || !sub.startDate || !sub.firstContactDate || !sub.password || !sub.notes,
  };

  if (emptyFieldSearches[term]) {
    const filtered = allSubscribers.filter(emptyFieldSearches[term]);
    displaySubscribers(filtered);
    showSearchFeedback(`تم العثور على ${filtered.length} مشترك`);
    return;
  }

  const filtered = allSubscribers.filter((sub) =>
    (sub.username && sub.username.toLowerCase().includes(term)) ||
    (sub.fullName && sub.fullName.toLowerCase().includes(term)) ||
    (sub.phone && sub.phone.toLowerCase().includes(term)) ||
    (sub.package && sub.package.toLowerCase().includes(term)) ||
    (sub.notes && sub.notes.toLowerCase().includes(term)) ||
    (sub.monthlyPrice && sub.monthlyPrice.toString().includes(term)) ||
    (sub.startDate && sub.startDate.toLowerCase().includes(term)) ||
    (sub.firstContactDate && sub.firstContactDate.toLowerCase().includes(term))
  );

  displaySubscribers(filtered);
  showSearchFeedback(`تم العثور على ${filtered.length} مشترك`);
}

function showSearchFeedback(message) {
  const existing = document.querySelector(".search-feedback");
  if (existing) existing.remove();
  const feedback = document.createElement("div");
  feedback.className = "search-feedback";
  feedback.textContent = message;
  document.body.appendChild(feedback);
  setTimeout(() => feedback.remove(), 3000);
}

function addQuickFilters() {
  const filtersSection = document.querySelector("#subscribers .filters-section");
  if (!filtersSection) return;

  const quickFiltersDiv = document.createElement("div");
  quickFiltersDiv.className = "quick-filters";
  quickFiltersDiv.innerHTML = `
    <div class="quick-filters-header">فلترة سريعة:</div>
    <button class="quick-filter-btn" data-search="بدون هاتف">بدون هاتف</button>
    <button class="quick-filter-btn" data-search="بدون تاريخ">بدون تاريخ</button>
    <button class="quick-filter-btn" data-search="بدون كلمة مرور">بدون كلمة مرور</button>
    <button class="quick-filter-btn" data-search="بدون تاريخ اول اتصال">بدون تاريخ اول اتصال</button>
    <button class="quick-filter-btn" data-search="بيانات ناقصة">بيانات ناقصة</button>
    <button class="quick-filter-btn" data-search="">عرض الكل</button>
  `;

  const filtersHeader = filtersSection.querySelector(".filters-header");
  filtersHeader.after(quickFiltersDiv);

  quickFiltersDiv.querySelectorAll(".quick-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const searchTerm = btn.dataset.search;
      const mainSearchInput = document.getElementById("mainSearchInput");
      if (mainSearchInput) mainSearchInput.value = searchTerm;
      if (searchTerm) handleSmartSearch(searchTerm);
      else loadSubscribers(currentPage);
      quickFiltersDiv.querySelectorAll(".quick-filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
}

function applyColumnFilters() {
  const filters = {};
  document.querySelectorAll(".column-filter").forEach((filter) => {
    const column = filter.dataset.column;
    const value = filter.value.trim().toLowerCase();
    if (value) filters[column] = value;
  });

  if (Object.keys(filters).length === 0) {
    displaySubscribers(allSubscribers);
    return;
  }

  const filtered = allSubscribers.filter((sub) => {
    for (const [column, filterValue] of Object.entries(filters)) {
      let cellValue = "";
      if (column === "startDate" || column === "firstContactDate") {
        cellValue = formatDate(sub[column]).toLowerCase();
      } else if (column === "isActive") {
        if (String(sub.isActive) !== filterValue) return false;
        continue;
      } else {
        cellValue = String(sub[column] || "").toLowerCase();
      }
      if (!cellValue.includes(filterValue)) return false;
    }
    return true;
  });

  displaySubscribers(filtered);
}

function clearColumnFilters() {
  document.querySelectorAll(".column-filter").forEach((f) => (f.value = ""));
  const mainSearchInput = document.getElementById("mainSearchInput");
  if (mainSearchInput) mainSearchInput.value = "";
  document.querySelectorAll(".quick-filter-btn").forEach((b) => b.classList.remove("active"));
  loadSubscribers(1);
}

// =============================================
// DISPLAY SUBSCRIBERS
// =============================================
function displaySubscribers(subscribers) {
  const tbody = document.getElementById("subscribersTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";
  subscribers.forEach((sub) => {
    const id = sub._id || sub.id;
    const isChecked = selectedIds.has(String(id));
    const speed = sub.speed || 4;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="checkbox-col">
        <input type="checkbox" class="row-checkbox" data-id="${id}" ${isChecked ? "checked" : ""} onchange="handleRowSelect(this)">
      </td>
      <td class="id-col">${id}</td>
      <td>${escapeHtml(sub.username)}</td>
      <td>${escapeHtml(sub.password || "")}</td>
      <td>${escapeHtml(sub.fullName || "")}</td>
      <td>${escapeHtml(sub.facilityType || "")}</td>
      <td>${escapeHtml(sub.phone || "")}</td>
      <td>${escapeHtml(sub.package || "")}</td>
      <td>${formatDate(sub.startDate)}</td>
      <td>${sub.firstContactDate ? formatDate(sub.firstContactDate) : "-"}</td>
      <td>${sub.disconnectionDate ? formatDate(sub.disconnectionDate) : "-"}</td>
      <td><span class="speed-badge speed-${speed}">${speed} ميجا</span></td>
      <td>
        <div class="action-buttons">
          <button class="btn-profile modern-action-btn" onclick="openSubscriberProfile('${id}')" title="عرض الملف الشخصي">ملف</button>
          <button class="btn-delete modern-action-btn" onclick="deleteSubscriber('${id}')" title="حذف المشترك">حذف</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
  updateSelectAllCheckbox();
}

function handleRowSelect(checkbox) {
  const id = checkbox.dataset.id;
  if (checkbox.checked) selectedIds.add(id);
  else selectedIds.delete(id);
  updateSelectionUI();
}

function handleSelectAll(e) {
  document.querySelectorAll(".row-checkbox").forEach((cb) => {
    cb.checked = e.target.checked;
    const id = cb.dataset.id;
    if (e.target.checked) selectedIds.add(id);
    else selectedIds.delete(id);
  });
  updateSelectionUI();
}

function updateSelectAllCheckbox() {
  const selectAll = document.getElementById("selectAllCheckbox");
  const checkboxes = document.querySelectorAll(".row-checkbox");
  if (!selectAll || checkboxes.length === 0) return;
  const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
  const someChecked = Array.from(checkboxes).some((cb) => cb.checked);
  selectAll.checked = allChecked;
  selectAll.indeterminate = someChecked && !allChecked;
}

function updateSelectionUI() {
  const count = selectedIds.size;
  const deleteBtn = document.getElementById("deleteSelectedBtn");
  const bulkEditBtn = document.getElementById("bulkEditBtn");
  const countSpan = document.getElementById("selectedCount");
  if (count > 0) {
    if (deleteBtn) deleteBtn.style.display = "inline-block";
    if (bulkEditBtn) bulkEditBtn.style.display = "inline-block";
    if (countSpan) countSpan.textContent = count;
  } else {
    if (deleteBtn) deleteBtn.style.display = "none";
    if (bulkEditBtn) bulkEditBtn.style.display = "none";
  }
}

async function deleteSelectedSubscribers() {
  if (selectedIds.size === 0) return;
  showConfirm(`هل أنت متأكد من حذف ${selectedIds.size} مشترك؟`, async () => {
    try {
      const response = await authenticatedFetch("/api/subscribers/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const result = await response.json();
      if (result.success) {
        showToast("تم حذف المشتركين المحددين بنجاح", "success");
        selectedIds.clear();
        updateSelectionUI();
        loadSubscribers(currentPage);
        loadStats();
      } else {
        showToast("فشل في حذف المشتركين: " + result.message, "error");
      }
    } catch (error) {
      showToast("خطأ في حذف المشتركين المحددين", "error");
    }
  });
}

function showBulkEditModal() {
  if (selectedIds.size === 0) return;
  document.getElementById("bulkEditCount").textContent = selectedIds.size;
  document.getElementById("bulkEditModal").style.display = "flex";
  document.getElementById("bulkEditForm").reset();
  document.getElementById("bulkValueGroup").style.display = "none";
}

function hideBulkEditModal() {
  document.getElementById("bulkEditModal").style.display = "none";
}

async function handleBulkEdit(e) {
  e.preventDefault();
  const field = document.getElementById("bulkField").value;
  let value = (field === "startDate" || field === "firstContactDate")
    ? document.getElementById("bulkValueDate").value
    : document.getElementById("bulkValue").value;

  if (!field) { showToast("يرجى اختيار الحقل", "error"); return; }

  try {
    const response = await authenticatedFetch("/api/subscribers/bulk-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds), field, value }),
    });
    const result = await response.json();
    if (result.success) {
      showToast(`تم تحديث ${result.updated} مشترك بنجاح`, "success");
      hideBulkEditModal();
      selectedIds.clear();
      updateSelectionUI();
      loadSubscribers();
      loadStats();
    } else {
      showToast("خطأ في تحديث المشتركين: " + result.message, "error");
    }
  } catch (error) {
    if (error.message === "Not authenticated") return;
    showToast("خطأ في تحديث المشتركين", "error");
  }
}

function displayPagination(pagination) {
  const container = document.getElementById("pagination");
  if (!container || !pagination) return;
  container.innerHTML = "";

  if (pagination.page > 1) {
    const btn = document.createElement("button");
    btn.textContent = "السابق";
    btn.onclick = () => loadSubscribers(pagination.page - 1);
    container.appendChild(btn);
  }
  for (let i = 1; i <= pagination.pages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.classList.toggle("active", i === pagination.page);
    btn.onclick = () => loadSubscribers(i);
    container.appendChild(btn);
  }
  if (pagination.page < pagination.pages) {
    const btn = document.createElement("button");
    btn.textContent = "التالي";
    btn.onclick = () => loadSubscribers(pagination.page + 1);
    container.appendChild(btn);
  }
}

function showAddForm() {
  document.getElementById("formTitle").textContent = "إضافة مشترك جديد";
  document.getElementById("subscriberFormElement").reset();
  document.getElementById("subscriberForm").style.display = "block";
}

function hideForm() {
  document.getElementById("subscriberForm").style.display = "none";
  document.getElementById("subscriberFormElement").reset();
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const formData = {
    username: document.getElementById("username").value,
    password: document.getElementById("password").value,
    fullName: document.getElementById("fullName").value,
    facilityType: document.getElementById("facilityType").value,
    phone: document.getElementById("phone").value,
    package: document.getElementById("package").value,
    startDate: document.getElementById("startDate").value,
    firstContactDate: document.getElementById("firstContactDate").value || null,
    speed: Number(document.getElementById("speed")?.value || 4),
    notes: document.getElementById("notes").value,
  };

  if (!formData.package) {
    showToast("يرجى إدخال رقم الخط لتوليد ID تلقائياً", "error");
    return;
  }

  try {
    const response = await authenticatedFetch("/api/subscribers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    const result = await response.json();
    if (result.success) {
      hideForm();
      loadSubscribers(currentPage);
      loadStats();
      showToast(`تم إضافة المشترك بنجاح (ID: ${result.id || "تم التوليد"})`, "success");
    } else {
      showToast("خطأ: " + result.message, "error");
    }
  } catch (error) {
    showToast("خطأ في معالجة الطلب", "error");
  }
}

async function exportToExcel() {
  try {
    const btn = document.getElementById("exportExcelBtn");
    const originalText = btn.textContent;
    btn.textContent = "جاري التصدير...";
    btn.disabled = true;
    const response = await fetch("/api/subscribers/export");
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `subscribers_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } else {
      const result = await response.json();
      showToast("خطأ في تصدير الملف: " + (result.message || "خطأ غير معروف"), "error");
    }
    btn.textContent = originalText;
    btn.disabled = false;
  } catch (error) {
    showToast("خطأ في تصدير الملف", "error");
    const btn = document.getElementById("exportExcelBtn");
    if (btn) { btn.textContent = "تصدير Excel"; btn.disabled = false; }
  }
}

async function deleteAllSubscribers() {
  showConfirm("⚠️ هل تريد فعلاً حذف جميع المشتركين؟ هذا الإجراء لا يمكن التراجع عنه!", () => {
    showConfirm("تأكيد نهائي: سيتم حذف جميع المشتركين. هل أنت متأكد؟", async () => {
      try {
        const response = await authenticatedFetch("/api/subscribers/all", { method: "DELETE" });
        const result = await response.json();
        if (result.success) {
          loadSubscribers(currentPage);
          loadStats();
          showToast(result.message, "success");
        } else {
          showToast("خطأ في حذف المشتركين: " + result.message, "error");
        }
      } catch (error) {
        showToast("خطأ في حذف المشتركين", "error");
      }
    });
  });
}

async function deleteSubscriber(id) {
  showConfirm("هل تريد فعلاً حذف هذا المشترك؟ لا يمكن التراجع عن هذا الإجراء.", async () => {
    try {
      const response = await authenticatedFetch(`/api/subscribers/${id}`, { method: "DELETE" });
      const result = await response.json();
      if (result.success) {
        loadSubscribers(currentPage);
        loadStats();
        showToast("تم حذف المشترك بنجاح", "success");
      } else {
        showToast("فشل حذف المشترك: " + result.message, "error");
      }
    } catch (error) {
      if (error.message === "Not authenticated") return;
      showToast("خطأ في حذف المشترك", "error");
    }
  });
}

async function handleFileUpload(files) {
  if (!files || files.length === 0) return;
  const file = files[0];
  const formData = new FormData();
  formData.append("file", file);

  const uploadType = document.querySelector('input[name="uploadType"]:checked')?.value || "new";
  const endpoint = uploadType === "update" ? "/api/subscribers/upload-credentials" : "/api/subscribers/upload";

  try {
    const response = await authenticatedFetch(endpoint, { method: "POST", body: formData });
    const result = await response.json();
    const uploadResult = document.getElementById("uploadResult");
    const uploadMessage = document.getElementById("uploadMessage");
    const uploadStats = document.getElementById("uploadStats");

    if (result.success) {
      uploadMessage.className = "message success";
      uploadMessage.textContent = result.message;

      let statsHTML = `<div class="stats-grid">
        <div class="stat-card"><h3>تم الاستيراد</h3><p class="stat-number" style="color:var(--success-color);">${result.uploaded}</p><p>مشترك جديد</p></div>`;
      if (result.skipped?.length > 0) statsHTML += `<div class="stat-card"><h3>تم التخطي</h3><p class="stat-number" style="color:var(--warning-color);">${result.skipped.length}</p><p>مشترك موجود</p></div>`;
      if (result.errors?.length > 0) statsHTML += `<div class="stat-card"><h3>أخطاء</h3><p class="stat-number" style="color:var(--danger-color);">${result.errors.length}</p><p>صف به خطأ</p></div>`;
      statsHTML += `</div>`;
      uploadStats.innerHTML = statsHTML;
    } else {
      uploadMessage.className = "message error";
      uploadMessage.textContent = result.message;
    }
    uploadResult.style.display = "block";
    if (result.success && result.uploaded > 0) setTimeout(() => loadSubscribers(), 500);
  } catch (error) {
    const uploadResult = document.getElementById("uploadResult");
    const uploadMessage = document.getElementById("uploadMessage");
    if (uploadMessage) uploadMessage.className = "message error";
    if (uploadMessage) uploadMessage.textContent = "خطأ في استيراد الملف.";
    if (uploadResult) uploadResult.style.display = "block";
  }
}

// =============================================
// STATS & DASHBOARD
// =============================================
async function loadStats() {
  try {
    const response = await authenticatedFetch("/api/subscribers/dashboard-stats");
    const result = await response.json();
    if (result.success) {
      const data = result.data;
      document.getElementById("totalSubscribers").textContent = data.overview.totalSubscribers;
      document.getElementById("availableUsernamesCount").textContent = data.overview.totalAvailableUsernames;
      document.getElementById("aboutToDisconnectCount").textContent = data.overview.expiringSubscribers;
      const expiredEl = document.getElementById("expiredCount");
      if (expiredEl) expiredEl.textContent = data.overview.expiredSubscribers;

      const newSubsWeekEl = document.getElementById("newSubscribersWeek");
      if (newSubsWeekEl) newSubsWeekEl.textContent = `+${data.thisWeek.newSubscribers} هذا الأسبوع`;
      const availableWeekEl = document.getElementById("availableAddedWeek");
      if (availableWeekEl) availableWeekEl.textContent = `+${data.thisWeek.availableUsernamesAdded} هذا الأسبوع`;

      const weekNewSubsEl = document.getElementById("weekNewSubscribers");
      if (weekNewSubsEl) weekNewSubsEl.textContent = data.thisWeek.newSubscribers;
      const weekAvailableEl = document.getElementById("weekAvailableAdded");
      if (weekAvailableEl) weekAvailableEl.textContent = data.thisWeek.availableUsernamesAdded;
      const weekSpeedEl = document.getElementById("weekSpeedChanges");
      if (weekSpeedEl) weekSpeedEl.textContent = data.thisWeek.speedChanges;
      const weekUsernameEl = document.getElementById("weekUsernameChanges");
      if (weekUsernameEl) weekUsernameEl.textContent = data.thisWeek.usernameChanges;

      updateSpeedChart(data.subscribersBySpeed, data.overview.totalSubscribers);
      updateAvailableBySpeed(data.availableBySpeed);
      updateDaysBreakdown(data.availableDaysBreakdown, data.overview.totalAvailableUsernames);
      updateRecentSpeedChanges(data.recentSpeedChanges);
      updateCurrentDate();
    }
    await loadSubscribersAboutToDisconnect();
  } catch (error) {
    if (error.message === "Not authenticated") return;
    console.error("Error loading stats:", error);
  }
}

function updateSpeedChart(speedData, total) {
  let count4m = 0, count8m = 0;
  if (speedData) speedData.forEach((item) => {
    if (item.speed === 4) count4m = item.count;
    else if (item.speed === 8) count8m = item.count;
  });
  const s4 = document.getElementById("speed4mCount");
  const s8 = document.getElementById("speed8mCount");
  const dt = document.getElementById("speedDonutTotal");
  if (s4) s4.textContent = count4m;
  if (s8) s8.textContent = count8m;
  if (dt) dt.textContent = count4m + count8m;
  drawDonutChart(count4m, count8m);
}

function drawDonutChart(count4m, count8m) {
  const canvas = document.getElementById("speedDonutChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const size = 160;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + "px";
  canvas.style.height = size + "px";
  ctx.scale(dpr, dpr);
  const cx = size / 2, cy = size / 2, outerR = 72, innerR = 48;
  const total = count4m + count8m;
  ctx.clearRect(0, 0, size, size);
  if (total === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
    ctx.fillStyle = "#f1f5f9";
    ctx.fill();
    return;
  }
  const slices = [{ value: count4m, color: "#f5a623" }, { value: count8m, color: "#0891b2" }];
  let startAngle = -Math.PI / 2;
  slices.forEach((slice) => {
    if (slice.value === 0) return;
    const sliceAngle = (slice.value / total) * Math.PI * 2;
    const endAngle = startAngle + sliceAngle;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, startAngle, endAngle);
    ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();
    startAngle = endAngle;
  });
  if (count4m > 0 && count8m > 0) {
    const gapWidth = 0.03;
    const angles = [-Math.PI / 2, -Math.PI / 2 + (count4m / total) * Math.PI * 2];
    angles.forEach((angle) => {
      ctx.beginPath();
      ctx.arc(cx, cy, outerR + 1, angle - gapWidth, angle + gapWidth);
      ctx.arc(cx, cy, innerR - 1, angle + gapWidth, angle - gapWidth, true);
      ctx.closePath();
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    });
  }
}

function updateAvailableBySpeed(availableData) {
  let count4m = 0, count8m = 0;
  if (availableData) availableData.forEach((item) => {
    if (item.speed === 4) count4m = item.count;
    else if (item.speed === 8) count8m = item.count;
  });
  const a4 = document.getElementById("available4mCount");
  const a8 = document.getElementById("available8mCount");
  if (a4) a4.textContent = count4m;
  if (a8) a8.textContent = count8m;
}

function updateDaysBreakdown(breakdownData, total) {
  const categories = {
    full: { progress: "fullDaysProgress", count: "fullDaysCount", value: 0 },
    half: { progress: "halfDaysProgress", count: "halfDaysCount", value: 0 },
    quarter: { progress: "quarterDaysProgress", count: "quarterDaysCount", value: 0 },
    low: { progress: "lowDaysProgress", count: "lowDaysCount", value: 0 },
  };
  if (breakdownData) breakdownData.forEach((item) => {
    if (categories[item.category]) categories[item.category].value = item.count;
  });
  Object.keys(categories).forEach((key) => {
    const cat = categories[key];
    const progressEl = document.getElementById(cat.progress);
    const countEl = document.getElementById(cat.count);
    if (progressEl) progressEl.style.width = (total > 0 ? (cat.value / total) * 100 : 0) + "%";
    if (countEl) countEl.textContent = cat.value;
  });
}

function updateRecentSpeedChanges(changes) {
  const listEl = document.getElementById("recentSpeedChangesList");
  if (!listEl) return;
  if (!changes || changes.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>لا توجد تغييرات حديثة</p></div>`;
    return;
  }
  listEl.innerHTML = changes.map((change) => `
    <div class="recent-item">
      <div class="recent-item-title"><i class="fas fa-bolt"></i>${escapeHtml(change.fullName || change.username || "غير معروف")}</div>
      <div class="recent-item-detail">من ${change.old_speed}M إلى ${change.new_speed}M</div>
      <div class="recent-item-time">${formatDate(change.changed_at)}</div>
    </div>
  `).join("");
}

function updateCurrentDate() {
  const dateEl = document.getElementById("currentDate");
  if (!dateEl) return;
  dateEl.textContent = new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

async function loadSubscribersAboutToDisconnect() {
  try {
    const response = await authenticatedFetch("/api/subscribers/about-to-disconnect");
    const result = await response.json();
    const countEl = document.getElementById("aboutToDisconnectCount");
    const listEl = document.getElementById("aboutToDisconnectList");

    if (result.success && result.data.length > 0) {
      if (countEl) countEl.textContent = result.data.length;
      if (listEl) {
        listEl.innerHTML = result.data.slice(0, 5).map((subscriber) => {
          const disconnectionDate = new Date(subscriber.disconnectionDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          disconnectionDate.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((disconnectionDate - today) / (1000 * 60 * 60 * 24));
          return `
            <div class="expiring-item" onclick="openSubscriberProfile('${subscriber._id || subscriber.id}')">
              <div class="expiring-item-name">${escapeHtml(subscriber.fullName || subscriber.username || "-")}</div>
              <div class="expiring-item-info">${escapeHtml(subscriber.phone || "-")}</div>
            </div>`;
        }).join("");
      }
    } else {
      if (countEl) countEl.textContent = "0";
      if (listEl) listEl.innerHTML = `<div class="empty-state"><i class="fas fa-check-circle"></i><p>لا توجد اشتراكات تنتهي قريباً 🎉</p></div>`;
    }
  } catch (error) {
    console.error("Error loading subscribers about to disconnect:", error);
  }
}

// =============================================
// SUBSCRIBER PROFILE
// =============================================
function addToUsernameHistoryTable(oldUsername, oldPassword, usageStartDate) {
  const historyList = document.getElementById("usernameHistoryList");
  const today = formatDate(new Date());
  if (historyList) {
    const emptyMsg = historyList.querySelector(".profile-history-empty");
    if (emptyMsg) historyList.innerHTML = "";
    const newItem = document.createElement("div");
    newItem.className = "profile-history-item";
    newItem.innerHTML = `
      <div class="profile-history-main">
        <span class="profile-history-username">${escapeHtml(oldUsername)}</span>
        <span class="profile-history-password">${escapeHtml(oldPassword || "-")}</span>
      </div>
      <div class="profile-history-dates">
        <span>من: ${usageStartDate || "-"}</span>
        <span>إلى: ${today}</span>
      </div>`;
    historyList.insertBefore(newItem, historyList.firstChild);
  }
  const historyBody = document.getElementById("usernameHistoryTableBody");
  if (historyBody) {
    const noDataRow = historyBody.querySelector('td[colspan="4"]');
    if (noDataRow) historyBody.innerHTML = "";
    const newRow = document.createElement("tr");
    newRow.innerHTML = `<td>${escapeHtml(oldUsername)}</td><td>${escapeHtml(oldPassword || "-")}</td><td>${usageStartDate || "-"}</td><td>${today}</td>`;
    historyBody.insertBefore(newRow, historyBody.firstChild);
  }
}

function addToSpeedHistoryList(entry) {
  const speedHistoryList = document.getElementById("speedHistoryList");
  if (!speedHistoryList) return;
  const emptyMsg = speedHistoryList.querySelector(".profile-history-empty");
  if (emptyMsg) speedHistoryList.innerHTML = "";
  const newItem = document.createElement("div");
  newItem.className = "profile-history-item speed-history-item";
  newItem.innerHTML = `
    <div class="profile-history-main">
      <span class="speed-change-badge">${entry.old_speed}M → ${entry.new_speed}M</span>
      <span class="speed-days-badge">${entry.days_used} يوم</span>
    </div>
    <div class="profile-history-dates">
      <span>من: ${formatDate(entry.usage_start_date) || "-"}</span>
      <span>إلى: ${formatDate(entry.usage_end_date) || formatDate(new Date())}</span>
    </div>`;
  speedHistoryList.insertBefore(newItem, speedHistoryList.firstChild);
}

async function openSpeedChangeUsernameModal(newSpeed) {
  try {
    const response = await authenticatedFetch(`/api/subscribers/available-usernames?speed=${newSpeed}`);
    const result = await response.json();
    if (!result.success || !result.data || result.data.length === 0) {
      showToast(`لا توجد أسماء مستخدمين متاحة للسرعة ${newSpeed} ميجا`, "error");
      document.getElementById("profileSpeed").value = originalProfileSpeed;
      return;
    }
    const modal = document.getElementById("speedChangeUsernameModal");
    const select = document.getElementById("speedChangeUsernameSelect");
    const speedLabel = document.getElementById("speedChangeSpeedLabel");
    if (modal && select && speedLabel) {
      speedLabel.textContent = `${newSpeed} ميجا`;
      select.innerHTML = `<option value="">-- اختر اسم مستخدم --</option>` +
        result.data.map((u) => `<option value="${escapeHtml(u.username)}" data-password="${escapeHtml(u.password || "")}" data-remaining="${u.remainingDays || 30}">${escapeHtml(u.username)} (${u.remainingDays || 30} يوم متبقي)</option>`).join("");
      modal.style.display = "flex";
    }
  } catch (error) {
    showToast("خطأ في تحميل أسماء المستخدمين المتاحة", "error");
    document.getElementById("profileSpeed").value = originalProfileSpeed;
  }
}

function confirmSpeedChangeUsername() {
  const select = document.getElementById("speedChangeUsernameSelect");
  if (!select || !select.value) { showToast("يرجى اختيار اسم مستخدم", "error"); return; }
  const selectedOption = select.options[select.selectedIndex];
  document.getElementById("profileUsername").value = select.value;
  document.getElementById("profilePassword").value = selectedOption.dataset.password || "";
  closeSpeedChangeUsernameModal();
  document.getElementById("profileEditForm").dispatchEvent(new Event("submit"));
}

function closeSpeedChangeUsernameModal() {
  const modal = document.getElementById("speedChangeUsernameModal");
  if (modal) modal.style.display = "none";
  if (document.getElementById("profileUsername").value === originalProfileUsername) {
    document.getElementById("profileSpeed").value = originalProfileSpeed;
  }
}

function formatDateForInput(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function openSubscriberProfile(subscriberId, skipHashChange = false) {
  currentProfileSubscriberId = subscriberId;
  sessionStorage.setItem("currentProfileSubscriberId", subscriberId);

  if (!skipHashChange && window.location.hash !== "#subscriber-profile") {
    window.location.hash = "subscriber-profile";
  }
  switchSection("subscriber-profile");

  const profileMenuItem = document.querySelector(".profile-menu-item");
  if (profileMenuItem) profileMenuItem.style.display = "block";

  try {
    const response = await authenticatedFetch(`/api/subscribers/profile/${subscriberId}`);
    const result = await response.json();
    if (result.success) {
      const subscriber = result.data.subscriber;
      const history = result.data.usernameHistory || [];
      const speedHistory = result.data.speedHistory || [];

      originalProfileUsername = subscriber.username || "";
      originalProfileSpeed = subscriber.speed || 4;

      const idBadge = document.getElementById("profileIdBadge");
      if (idBadge) idBadge.textContent = subscriber._id || subscriber.id || "-";

      document.getElementById("profileEditId").value = subscriber._id || subscriber.id || "";
      document.getElementById("profileId").value = subscriber._id || subscriber.id || "";
      document.getElementById("profileUsername").value = subscriber.username || "";
      document.getElementById("profilePassword").value = subscriber.password || "";
      document.getElementById("profileFullName").value = subscriber.fullName || "";
      document.getElementById("profileFacilityType").value = subscriber.facilityType || "";
      document.getElementById("profilePhone").value = subscriber.phone || "";
      document.getElementById("profilePackage").value = subscriber.package || "";
      document.getElementById("profileStartDate").value = formatDateForInput(subscriber.startDate);
      document.getElementById("profileFirstContactDate").value = formatDateForInput(subscriber.firstContactDate);
      document.getElementById("profileDisconnectionDate").value = formatDateForInput(subscriber.disconnectionDate);
      document.getElementById("profileSpeed").value = subscriber.speed || 4;
      document.getElementById("profileNotes").value = subscriber.notes || "";

      updateProfileTimer(subscriber.firstContactDate, subscriber.disconnectionDate, subscriber.speed);

      const historyList = document.getElementById("usernameHistoryList");
      if (historyList) {
        historyList.innerHTML = history.length > 0
          ? history.map((h) => `
            <div class="profile-history-item" data-history-id="${h.id}">
              <div class="profile-history-main">
                <span class="profile-history-username">${escapeHtml(h.old_username)}</span>
                <div class="profile-history-actions-inline">
                  <span class="profile-history-password">${escapeHtml(h.old_password || "-")}</span>
                  <button type="button" class="history-action-btn history-edit-btn" onclick="editHistoryEntry(${h.id}, '${(h.old_username||'').replace(/'/g,"\\'")}', '${(h.old_password||'').replace(/'/g,"\\'")}', '${h.usage_start_date ? h.usage_start_date.split('T')[0] : ''}', '${h.usage_end_date ? h.usage_end_date.split('T')[0] : ''}')" title="تعديل"><i class="fas fa-pen"></i></button>
                  <button type="button" class="history-action-btn history-delete-btn" onclick="deleteHistoryEntry(${h.id})" title="حذف"><i class="fas fa-trash"></i></button>
                </div>
              </div>
              <div class="profile-history-dates">
                <span>من: ${formatDate(h.usage_start_date) || "-"}</span>
                <span>إلى: ${formatDate(h.usage_end_date) || formatDate(h.changed_at)}</span>
              </div>
            </div>`).join("")
          : '<div class="profile-history-empty">لا توجد بيانات سابقة</div>';
      }

      const historyBody = document.getElementById("usernameHistoryTableBody");
      if (historyBody) {
        historyBody.innerHTML = history.length > 0
          ? history.map((h) => `<tr><td>${escapeHtml(h.old_username)}</td><td>${escapeHtml(h.old_password || "-")}</td><td>${formatDate(h.usage_start_date) || "-"}</td><td>${formatDate(h.usage_end_date) || formatDate(h.changed_at)}</td></tr>`).join("")
          : '<tr><td colspan="4" class="text-center">لا توجد بيانات سابقة</td></tr>';
      }

      const speedHistoryList = document.getElementById("speedHistoryList");
      if (speedHistoryList) {
        speedHistoryList.innerHTML = speedHistory.length > 0
          ? speedHistory.map((h) => `
            <div class="profile-history-item speed-history-item">
              <div class="profile-history-main">
                <span class="speed-change-badge">${h.old_speed}M → ${h.new_speed}M</span>
                <span class="speed-days-badge">${h.days_used} يوم</span>
              </div>
              <div class="profile-history-dates">
                <span>من: ${formatDate(h.usage_start_date) || "-"}</span>
                <span>إلى: ${formatDate(h.usage_end_date) || formatDate(h.changed_at)}</span>
              </div>
            </div>`).join("")
          : '<div class="profile-history-empty">لا توجد بيانات سابقة</div>';
      }

      loadAvailableUsernamesDropdown();
    } else {
      showToast("خطأ في تحميل بيانات المشترك: " + result.message, "error");
      goBackToSubscribers();
    }
  } catch (error) {
    console.error("Error loading profile:", error);
    showToast("خطأ في تحميل الملف الشخصي", "error");
    goBackToSubscribers();
  }
}

function updateProfileTimer(firstContactDate, disconnectionDate, speed) {
  const usageTimerEl = document.getElementById("usageTimerValue");
  const remainingDaysEl = document.getElementById("remainingDaysValue");
  const speedDisplayEl = document.getElementById("profileSpeedDisplay");
  const remainingCard = document.getElementById("remainingDaysCard");

  let usageDays = 0;
  if (firstContactDate) {
    const startDate = new Date(firstContactDate);
    const today = new Date();
    startDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    usageDays = Math.max(0, Math.floor((today - startDate) / (1000 * 60 * 60 * 24)));
  }

  let remainingDays = 0;
  if (disconnectionDate) {
    const endDate = new Date(disconnectionDate);
    const today = new Date();
    endDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    remainingDays = Math.floor((endDate - today) / (1000 * 60 * 60 * 24));
  }

  if (usageTimerEl) usageTimerEl.textContent = usageDays;

  if (remainingDaysEl) {
    if (remainingDays < 0) {
      remainingDaysEl.textContent = "منتهي";
      const unitEl = remainingDaysEl.nextElementSibling;
      if (unitEl?.classList.contains("profile-stat-unit")) unitEl.style.visibility = "hidden";
    } else {
      remainingDaysEl.textContent = remainingDays;
      const unitEl = remainingDaysEl.nextElementSibling;
      if (unitEl?.classList.contains("profile-stat-unit")) unitEl.style.visibility = "visible";
    }
  }

  if (remainingCard) {
    remainingCard.classList.remove("warning", "danger");
    if (remainingDays < 0 || remainingDays <= 3) remainingCard.classList.add("danger");
    else if (remainingDays <= 7) remainingCard.classList.add("warning");
  }

  if (speedDisplayEl) speedDisplayEl.textContent = speed || 4;
}

function goBackToSubscribers() {
  currentProfileSubscriberId = null;
  originalProfileUsername = null;
  originalProfileSpeed = null;
  sessionStorage.removeItem("currentProfileSubscriberId");
  const profileMenuItem = document.querySelector(".profile-menu-item");
  if (profileMenuItem) profileMenuItem.style.display = "none";
  window.location.hash = "subscribers";
}

function openImportModal() {
  document.getElementById("importExcelModal").style.display = "flex";
}

function closeImportModal() {
  document.getElementById("importExcelModal").style.display = "none";
  document.getElementById("uploadResult").style.display = "none";
}

// =============================================
// AVAILABLE USERNAMES DROPDOWN (for profile)
// =============================================
async function loadAvailableUsernamesDropdown() {
  try {
    const [r4, r8] = await Promise.all([
      authenticatedFetch("/api/subscribers/available-usernames?speed=4").then(r => r.json()),
      authenticatedFetch("/api/subscribers/available-usernames?speed=8").then(r => r.json()),
    ]);
    const select = document.getElementById("availableUsernameSelect");
    if (!select) return;
    select.innerHTML = '<option value="">اختر اسم مستخدم متاح...</option>';
    if (r4.success && r4.data.length > 0) {
      const g = document.createElement("optgroup");
      g.label = "🔵 4 ميجا";
      r4.data.forEach((u) => {
        const o = document.createElement("option");
        o.value = u.id; o.dataset.speed = "4"; o.textContent = u.username;
        g.appendChild(o);
      });
      select.appendChild(g);
    }
    if (r8.success && r8.data.length > 0) {
      const g = document.createElement("optgroup");
      g.label = "🟢 8 ميجا";
      r8.data.forEach((u) => {
        const o = document.createElement("option");
        o.value = u.id; o.dataset.speed = "8"; o.textContent = u.username;
        g.appendChild(o);
      });
      select.appendChild(g);
    }
  } catch (error) {
    console.error("Error loading available usernames dropdown:", error);
  }
}

async function changeSubscriberUsername() {
  if (!currentProfileSubscriberId) return;
  const newUsername = document.getElementById("newUsernameInput").value.trim();
  const newPassword = document.getElementById("newPasswordInput").value.trim();
  if (!newUsername) { showToast("يرجى إدخال اسم المستخدم الجديد", "error"); return; }

  showConfirm("هل أنت متأكد من تغيير اسم المستخدم وكلمة المرور؟", async () => {
    try {
      const response = await authenticatedFetch(`/api/subscribers/change-username/${currentProfileSubscriberId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newUsername, newPassword }),
      });
      const result = await response.json();
      if (result.success) {
        const oldUsername = document.getElementById("profileUsername").value;
        const oldPassword = document.getElementById("profilePassword").value;
        const usageStartDate = document.getElementById("profileFirstContactDate").value;
        addToUsernameHistoryTable(oldUsername, oldPassword, usageStartDate);
        document.getElementById("profileUsername").value = newUsername;
        if (newPassword) document.getElementById("profilePassword").value = newPassword;
        originalProfileUsername = newUsername;
        showToast("تم تغيير اسم المستخدم بنجاح", "success");
        document.getElementById("newUsernameInput").value = "";
        document.getElementById("newPasswordInput").value = "";
        loadSubscribers();
        loadAvailableUsernames();
      } else {
        showToast("خطأ في تغيير اسم المستخدم: " + result.message, "error");
      }
    } catch (error) {
      showToast("خطأ في تغيير اسم المستخدم", "error");
    }
  });
}

async function assignAvailableUsername() {
  if (!currentProfileSubscriberId) { showToast("لم يتم تحديد المشترك", "error"); return; }
  const availableUsernameId = document.getElementById("availableUsernameSelect").value;
  if (!availableUsernameId) { showToast("يرجى اختيار اسم مستخدم متاح", "error"); return; }

  showConfirm("هل أنت متأكد من تعيين هذا اسم المستخدم للمشترك؟", async () => {
    try {
      const response = await authenticatedFetch("/api/subscribers/assign-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriberId: currentProfileSubscriberId, availableUsernameId }),
      });
      const result = await response.json();
      if (result.success) {
        const oldUsername = document.getElementById("profileUsername").value;
        const oldPassword = document.getElementById("profilePassword").value;
        const usageStartDate = document.getElementById("profileFirstContactDate").value;
        addToUsernameHistoryTable(oldUsername, oldPassword, usageStartDate);
        if (result.data) {
          document.getElementById("profileUsername").value = result.data.newUsername || "";
          originalProfileUsername = result.data.newUsername;
        }
        showToast("تم تعيين اسم المستخدم بنجاح", "success");
        document.getElementById("availableUsernameSelect").value = "";
        loadSubscribers();
        loadAvailableUsernames();
        loadAvailableUsernamesDropdown();
        loadStats();
      } else {
        showToast("خطأ في تعيين اسم المستخدم: " + result.message, "error");
      }
    } catch (error) {
      showToast("خطأ في تعيين اسم المستخدم", "error");
    }
  });
}

// =============================================
// AVAILABLE USERNAMES SECTION
// =============================================
let allAvailableUsernames = [];
let currentSpeedTab = 4;

async function loadAvailableUsernames() {
  try {
    const [r4, r8] = await Promise.all([
      authenticatedFetch("/api/subscribers/available-usernames?speed=4").then(r => r.json()),
      authenticatedFetch("/api/subscribers/available-usernames?speed=8").then(r => r.json()),
    ]);
    if (r4.success) displayAvailableUsernamesBySpeed(r4.data, 4);
    if (r8.success) displayAvailableUsernamesBySpeed(r8.data, 8);
    allAvailableUsernames = [...(r4.data || []), ...(r8.data || [])];
    await cleanupInvalidUsernames();
  } catch (error) {
    console.error("Error loading available usernames:", error);
    showToast("خطأ في تحميل أسماء المستخدمين المتاحة", "error");
  }
}

async function cleanupInvalidUsernames() {
  try {
    await authenticatedFetch("/api/subscribers/available-usernames/cleanup", { method: "POST" });
  } catch (error) { /* silent */ }
}

function switchSpeedTab(speed) {
  currentSpeedTab = speed;
  document.querySelectorAll(".speed-tab").forEach((tab) => tab.classList.remove("active"));
  document.querySelector(`.speed-tab[data-speed="${speed}"]`)?.classList.add("active");
  document.querySelectorAll(".speed-panel").forEach((panel) => panel.classList.remove("active"));
  document.getElementById(`panel-${speed}m`)?.classList.add("active");
}

function displayAvailableUsernamesBySpeed(usernames, speed) {
  const tbody = document.getElementById(`availableUsernames${speed}MTableBody`);
  const countBadge = document.getElementById(`count${speed}M`);
  if (!tbody) return;
  tbody.innerHTML = "";
  if (countBadge) countBadge.textContent = usernames ? usernames.length : 0;
  if (!usernames || usernames.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">لا توجد أسماء مستخدمين متاحة</td></tr>';
    return;
  }
  usernames.forEach((u) => {
    const remainingDays = u.remainingDays !== undefined ? u.remainingDays : 30;
    const daysClass = remainingDays <= 7 ? "days-warning" : remainingDays < 30 ? "days-partial" : "days-full";
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(u.username)}</strong></td>
      <td><code>${escapeHtml(u.password || "-")}</code></td>
      <td><span class="remaining-days-badge ${daysClass}">${remainingDays} يوم</span></td>
      <td>
        <div class="row-actions">
          <button class="row-btn edit" onclick="openEditAvailableUsername(${u.id}, '${escapeHtml(u.username)}', '${escapeHtml(u.password || "")}')">تعديل</button>
          <button class="row-btn delete" onclick="deleteAvailableUsername(${u.id})">حذف</button>
        </div>
      </td>`;
    tbody.appendChild(row);
  });
}

function openEditAvailableUsername(id, username, password) {
  document.getElementById("editAvailableUsernameId").value = id;
  document.getElementById("editAvailableUsernameInput").value = username;
  document.getElementById("editAvailablePasswordInput").value = password;
  document.getElementById("editAvailableUsernameModal").style.display = "flex";
}

function closeEditAvailableUsernameModal() {
  document.getElementById("editAvailableUsernameModal").style.display = "none";
}

async function handleEditAvailableUsernameSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("editAvailableUsernameId").value;
  const data = {
    username: document.getElementById("editAvailableUsernameInput").value,
    password: document.getElementById("editAvailablePasswordInput").value,
  };
  try {
    const response = await authenticatedFetch(`/api/subscribers/available-usernames/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (result.success) {
      closeEditAvailableUsernameModal();
      loadAvailableUsernames();
      showToast("تم تحديث اسم المستخدم بنجاح", "success");
    } else {
      showToast("خطأ: " + result.message, "error");
    }
  } catch (error) {
    showToast("خطأ في تحديث اسم المستخدم", "error");
  }
}

async function deleteAllAvailableUsernamesBySpeed(speed) {
  showConfirm(`هل أنت متأكد من حذف جميع أسماء المستخدمين المتاحة (${speed} ميجا)؟`, async () => {
    try {
      const response = await authenticatedFetch(`/api/subscribers/available-usernames/all?speed=${speed}`, { method: "DELETE" });
      const result = await response.json();
      if (result.success) {
        loadAvailableUsernames();
        showToast(`تم حذف ${result.deleted} اسم مستخدم`, "success");
      } else {
        showToast("خطأ: " + result.message, "error");
      }
    } catch (error) {
      showToast("خطأ في حذف أسماء المستخدمين", "error");
    }
  });
}

function showAddAvailableUsernameForm(speed) {
  document.getElementById("addUsernameModal").style.display = "flex";
  document.getElementById("availableUsernameSpeed").value = speed || currentSpeedTab;
  document.getElementById("modalSpeedLabel").textContent = `(${speed || currentSpeedTab} ميجا)`;
}

function hideAvailableUsernameForm() {
  document.getElementById("addUsernameModal").style.display = "none";
  document.getElementById("availableUsernameFormElement").reset();
}

function showUploadAvailableUsernamesArea(speed) {
  document.getElementById("uploadModal").style.display = "flex";
  document.getElementById("uploadAvailableUsernamesSpeed").value = speed || currentSpeedTab;
  document.getElementById("uploadSpeedLabel").textContent = `(${speed || currentSpeedTab} ميجا)`;
}

function hideUploadAvailableUsernamesArea() {
  document.getElementById("uploadModal").style.display = "none";
}

async function addAvailableUsername(e) {
  e.preventDefault();
  const username = document.getElementById("availableUsername").value.trim();
  const password = document.getElementById("availablePassword").value.trim();
  const speed = document.getElementById("availableUsernameSpeed").value;
  if (!username) { showToast("يرجى إدخال اسم المستخدم", "error"); return; }
  try {
    const response = await authenticatedFetch("/api/subscribers/available-usernames", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, speed }),
    });
    const result = await response.json();
    if (result.success) {
      showToast("تمت إضافة اسم المستخدم بنجاح", "success");
      hideAvailableUsernameForm();
      loadAvailableUsernames();
    } else {
      showToast("خطأ في إضافة اسم المستخدم: " + result.message, "error");
    }
  } catch (error) {
    showToast("خطأ في إضافة اسم المستخدم", "error");
  }
}

async function deleteAvailableUsername(id) {
  showConfirm("هل أنت متأكد من حذف اسم المستخدم هذا؟", async () => {
    try {
      const response = await authenticatedFetch(`/api/subscribers/available-usernames/${id}`, { method: "DELETE" });
      const result = await response.json();
      if (result.success) {
        showToast("تم حذف اسم المستخدم بنجاح", "success");
        loadAvailableUsernames();
      } else {
        showToast("خطأ: " + result.message, "error");
      }
    } catch (error) {
      showToast("خطأ في حذف اسم المستخدم", "error");
    }
  });
}

async function uploadAvailableUsernamesExcel(files) {
  if (!files || files.length === 0) return;
  const file = files[0];
  const speed = document.getElementById("uploadAvailableUsernamesSpeed").value;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("speed", speed);
  try {
    const response = await authenticatedFetch("/api/subscribers/available-usernames/upload", { method: "POST", body: formData });
    const result = await response.json();
    if (result.success) {
      hideUploadAvailableUsernamesArea();
      await loadAvailableUsernames();
      showToast(`تم استيراد ${result.added} اسم مستخدم بنجاح${result.skipped > 0 ? ` (تم تخطي ${result.skipped})` : ""}`, "success");
    } else {
      showToast("خطأ في استيراد الملف: " + result.message, "error");
    }
  } catch (error) {
    showToast("خطأ في استيراد الملف", "error");
  }
}

// =============================================
// NEW FEATURE LISTENERS
// =============================================
function setupNewFeatureListeners() {
  document.getElementById("profileEditForm")?.addEventListener("submit", handleProfileEditSubmit);
  document.getElementById("changeUsernameBtn")?.addEventListener("click", changeSubscriberUsername);
  document.getElementById("assignAvailableUsernameBtn")?.addEventListener("click", assignAvailableUsername);
  document.getElementById("toggleAddHistoryBtn")?.addEventListener("click", toggleAddHistoryForm);
  document.getElementById("saveHistoryEntryBtn")?.addEventListener("click", saveNewHistoryEntry);
  document.getElementById("cancelAddHistoryBtn")?.addEventListener("click", closeAddHistoryForm);
  document.getElementById("availableUsernameFormElement")?.addEventListener("submit", addAvailableUsername);
  document.getElementById("editAvailableUsernameForm")?.addEventListener("submit", handleEditAvailableUsernameSubmit);

  // Close modals when clicking outside
  document.querySelectorAll(".modal-overlay").forEach((modal) => {
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });
  });
}

// =============================================
// PROFILE EDIT SUBMIT
// =============================================
async function handleProfileEditSubmit(e) {
  e.preventDefault();
  if (!currentProfileSubscriberId) return;

  const newSpeed = Number(document.getElementById("profileSpeed").value) || 4;
  const currentUsername = document.getElementById("profileUsername").value;

  if (originalProfileSpeed && newSpeed !== originalProfileSpeed && currentUsername === originalProfileUsername) {
    showToast("عند تغيير السرعة، يجب اختيار اسم مستخدم جديد من الأسماء المتاحة", "warning");
    openSpeedChangeUsernameModal(newSpeed);
    return;
  }

  const formData = {
    username: document.getElementById("profileUsername").value,
    password: document.getElementById("profilePassword").value,
    fullName: document.getElementById("profileFullName").value,
    facilityType: document.getElementById("profileFacilityType").value,
    phone: document.getElementById("profilePhone").value,
    package: document.getElementById("profilePackage").value,
    startDate: document.getElementById("profileStartDate").value,
    firstContactDate: document.getElementById("profileFirstContactDate").value || null,
    speed: newSpeed,
    notes: document.getElementById("profileNotes").value,
  };

  try {
    const response = await authenticatedFetch(`/api/subscribers/${currentProfileSubscriberId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    const result = await response.json();
    if (result.success) {
      if (originalProfileUsername && formData.username !== originalProfileUsername) {
        addToUsernameHistoryTable(originalProfileUsername, formData.password, formData.firstContactDate);
        originalProfileUsername = formData.username;
      }
      if (result.speedHistoryEntry) {
        addToSpeedHistoryList(result.speedHistoryEntry);
        originalProfileSpeed = newSpeed;
        loadAvailableUsernames();
      }
      showToast("تم حفظ التعديلات بنجاح", "success");
      if (result.data) {
        if (result.data.username) { document.getElementById("profileUsername").value = result.data.username; originalProfileUsername = result.data.username; }
        if (result.data.password) document.getElementById("profilePassword").value = result.data.password;
        if (result.data.disconnectionDate) document.getElementById("profileDisconnectionDate").value = formatDateForInput(result.data.disconnectionDate);
        if (result.data.firstContactDate) {
          document.getElementById("profileFirstContactDate").value = formatDateForInput(result.data.firstContactDate);
          updateProfileTimer(result.data.firstContactDate, result.data.disconnectionDate, result.data.speed);
        }
      }
      loadSubscribers();
      loadStats();
    } else {
      showToast("خطأ في حفظ التعديلات: " + result.message, "error");
    }
  } catch (error) {
    showToast("خطأ في حفظ التعديلات", "error");
  }
}

// =============================================
// USERNAME HISTORY CRUD
// =============================================
function toggleAddHistoryForm() {
  const form = document.getElementById("addHistoryForm");
  const btn = document.getElementById("toggleAddHistoryBtn");
  if (form.style.display === "none") {
    form.style.display = "block";
    btn.innerHTML = '<i class="fas fa-times"></i>';
    btn.classList.add("active");
    document.getElementById("historyOldUsername").focus();
  } else {
    closeAddHistoryForm();
  }
}

function closeAddHistoryForm() {
  const form = document.getElementById("addHistoryForm");
  const btn = document.getElementById("toggleAddHistoryBtn");
  form.style.display = "none";
  btn.innerHTML = '<i class="fas fa-plus"></i>';
  btn.classList.remove("active");
  document.getElementById("historyOldUsername").value = "";
  document.getElementById("historyOldPassword").value = "";
  document.getElementById("historyStartDate").value = "";
  document.getElementById("historyEndDate").value = "";
  const saveBtn = document.getElementById("saveHistoryEntryBtn");
  saveBtn.onclick = saveNewHistoryEntry;
  saveBtn.innerHTML = '<i class="fas fa-check"></i> حفظ';
}

async function saveNewHistoryEntry() {
  const subscriberId = document.getElementById("profileEditId").value;
  const oldUsername = document.getElementById("historyOldUsername").value.trim();
  const oldPassword = document.getElementById("historyOldPassword").value.trim();
  const startDate = document.getElementById("historyStartDate").value;
  const endDate = document.getElementById("historyEndDate").value;
  if (!oldUsername) { showToast("اسم المستخدم القديم مطلوب", "error"); return; }
  try {
    const response = await fetch(`/api/subscribers/username-history/${subscriberId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_username: oldUsername, old_password: oldPassword || null, usage_start_date: startDate || null, usage_end_date: endDate || null }),
    });
    const result = await response.json();
    if (result.success) {
      closeAddHistoryForm();
      addHistoryEntryToDOM(result.data);
      showToast("تم إضافة السجل بنجاح", "success");
    } else {
      showToast(result.message || "خطأ في إضافة السجل", "error");
    }
  } catch (error) {
    showToast("خطأ في إضافة السجل", "error");
  }
}

function addHistoryEntryToDOM(entry) {
  const historyList = document.getElementById("usernameHistoryList");
  if (!historyList) return;
  const emptyMsg = historyList.querySelector(".profile-history-empty");
  if (emptyMsg) historyList.innerHTML = "";
  const startDateStr = entry.usage_start_date ? entry.usage_start_date.split("T")[0] : "";
  const endDateStr = entry.usage_end_date ? entry.usage_end_date.split("T")[0] : "";
  const newItem = document.createElement("div");
  newItem.className = "profile-history-item";
  newItem.setAttribute("data-history-id", entry.id);
  newItem.innerHTML = `
    <div class="profile-history-main">
      <span class="profile-history-username">${escapeHtml(entry.old_username)}</span>
      <div class="profile-history-actions-inline">
        <span class="profile-history-password">${escapeHtml(entry.old_password || "-")}</span>
        <button type="button" class="history-action-btn history-edit-btn" onclick="editHistoryEntry(${entry.id}, '${(entry.old_username||'').replace(/'/g,"\\'")}', '${(entry.old_password||'').replace(/'/g,"\\'")}', '${startDateStr}', '${endDateStr}')" title="تعديل"><i class="fas fa-pen"></i></button>
        <button type="button" class="history-action-btn history-delete-btn" onclick="deleteHistoryEntry(${entry.id})" title="حذف"><i class="fas fa-trash"></i></button>
      </div>
    </div>
    <div class="profile-history-dates">
      <span>من: ${formatDate(entry.usage_start_date) || "-"}</span>
      <span>إلى: ${formatDate(entry.usage_end_date) || "-"}</span>
    </div>`;
  newItem.style.opacity = "0";
  newItem.style.transform = "translateY(-10px)";
  historyList.insertBefore(newItem, historyList.firstChild);
  setTimeout(() => { newItem.style.transition = "all 0.3s ease"; newItem.style.opacity = "1"; newItem.style.transform = "translateY(0)"; }, 10);
}

function editHistoryEntry(historyId, oldUsername, oldPassword, startDate, endDate) {
  const form = document.getElementById("addHistoryForm");
  const btn = document.getElementById("toggleAddHistoryBtn");
  form.style.display = "block";
  btn.innerHTML = '<i class="fas fa-times"></i>';
  btn.classList.add("active");
  document.getElementById("historyOldUsername").value = oldUsername || "";
  document.getElementById("historyOldPassword").value = oldPassword || "";
  document.getElementById("historyStartDate").value = startDate || "";
  document.getElementById("historyEndDate").value = endDate || "";
  const saveBtn = document.getElementById("saveHistoryEntryBtn");
  saveBtn.innerHTML = '<i class="fas fa-save"></i> تحديث';
  saveBtn.onclick = () => updateHistoryEntry(historyId);
  form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  document.getElementById("historyOldUsername").focus();
}

async function updateHistoryEntry(historyId) {
  const oldUsername = document.getElementById("historyOldUsername").value.trim();
  const oldPassword = document.getElementById("historyOldPassword").value.trim();
  const startDate = document.getElementById("historyStartDate").value;
  const endDate = document.getElementById("historyEndDate").value;
  if (!oldUsername) { showToast("اسم المستخدم القديم مطلوب", "error"); return; }
  try {
    const response = await fetch(`/api/subscribers/username-history/${historyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_username: oldUsername, old_password: oldPassword || null, usage_start_date: startDate || null, usage_end_date: endDate || null }),
    });
    const result = await response.json();
    if (result.success) {
      closeAddHistoryForm();
      updateHistoryEntryInDOM(historyId, { old_username: oldUsername, old_password: oldPassword, usage_start_date: startDate, usage_end_date: endDate });
      showToast("تم تحديث السجل بنجاح", "success");
    } else {
      showToast(result.message || "خطأ في تحديث السجل", "error");
    }
  } catch (error) {
    showToast("خطأ في تحديث السجل", "error");
  }
}

function updateHistoryEntryInDOM(historyId, data) {
  const item = document.querySelector(`.profile-history-item[data-history-id="${historyId}"]`);
  if (!item) return;
  const startDateStr = data.usage_start_date || "";
  const endDateStr = data.usage_end_date || "";
  item.innerHTML = `
    <div class="profile-history-main">
      <span class="profile-history-username">${escapeHtml(data.old_username)}</span>
      <div class="profile-history-actions-inline">
        <span class="profile-history-password">${escapeHtml(data.old_password || "-")}</span>
        <button type="button" class="history-action-btn history-edit-btn" onclick="editHistoryEntry(${historyId}, '${(data.old_username||'').replace(/'/g,"\\'")}', '${(data.old_password||'').replace(/'/g,"\\'")}', '${startDateStr}', '${endDateStr}')" title="تعديل"><i class="fas fa-pen"></i></button>
        <button type="button" class="history-action-btn history-delete-btn" onclick="deleteHistoryEntry(${historyId})" title="حذف"><i class="fas fa-trash"></i></button>
      </div>
    </div>
    <div class="profile-history-dates">
      <span>من: ${formatDate(data.usage_start_date) || "-"}</span>
      <span>إلى: ${formatDate(data.usage_end_date) || "-"}</span>
    </div>`;
  item.style.background = "rgba(245,166,35,0.15)";
  setTimeout(() => { item.style.transition = "background 0.5s ease"; item.style.background = ""; }, 100);
}

function deleteHistoryEntry(historyId) {
  showConfirm("هل تريد حذف هذا السجل؟", async () => {
    try {
      const response = await fetch(`/api/subscribers/username-history/${historyId}`, { method: "DELETE" });
      const result = await response.json();
      if (result.success) {
        removeHistoryEntryFromDOM(historyId);
        showToast("تم حذف السجل بنجاح", "success");
      } else {
        showToast(result.message || "خطأ في حذف السجل", "error");
      }
    } catch (error) {
      showToast("خطأ في حذف السجل", "error");
    }
  });
}

function removeHistoryEntryFromDOM(historyId) {
  const item = document.querySelector(`.profile-history-item[data-history-id="${historyId}"]`);
  if (!item) return;
  item.style.transition = "all 0.3s ease";
  item.style.opacity = "0";
  item.style.transform = "translateX(20px)";
  setTimeout(() => {
    item.remove();
    const historyList = document.getElementById("usernameHistoryList");
    if (historyList && historyList.children.length === 0) {
      historyList.innerHTML = '<div class="profile-history-empty">لا توجد بيانات سابقة</div>';
    }
  }, 300);
}

// =============================================
// STOPPED SUBSCRIBERS
// =============================================
async function loadStoppedSubscribers() {
  try {
    const response = await authenticatedFetch("/api/subscribers/stopped");
    const result = await response.json();
    if (result.success) displayStoppedSubscribers(result.data);
  } catch (error) {
    console.error("Error loading stopped subscribers:", error);
  }
}

function displayStoppedSubscribers(subscribers) {
  const tbody = document.getElementById("stoppedSubscribersTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!subscribers || subscribers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">لا يوجد مشتركين متوقفين</td></tr>';
    return;
  }
  subscribers.forEach((s) => {
    const row = document.createElement("tr");
    const stoppedDate = s.stoppedAt ? new Date(s.stoppedAt).toLocaleDateString("ar-EG") : "-";
    row.innerHTML = `
      <td><strong>${escapeHtml(s.fullName || "-")}</strong></td>
      <td>${escapeHtml(s.username || "-")}</td>
      <td>${escapeHtml(s.phone || "-")}</td>
      <td>${s.speed || 4} ميجا</td>
      <td>${stoppedDate}</td>
      <td>${escapeHtml(s.stoppedReason || "-")}</td>
      <td>
        <div class="row-actions">
          <button class="row-btn edit" onclick="reactivateSubscriber('${s.id}')">إعادة تفعيل</button>
          <button class="row-btn delete" onclick="deleteStoppedSubscriber('${s.id}')">حذف</button>
        </div>
      </td>`;
    tbody.appendChild(row);
  });
}

function openStopSubscriberModal() {
  document.getElementById("stopReasonInput").value = "";
  document.getElementById("stopSubscriberModal").style.display = "flex";
}

function closeStopSubscriberModal() {
  document.getElementById("stopSubscriberModal").style.display = "none";
}

async function confirmStopSubscriber() {
  if (!currentProfileSubscriberId) { showToast("خطأ: لم يتم تحديد المشترك", "error"); return; }
  const reason = document.getElementById("stopReasonInput").value.trim();
  try {
    const response = await authenticatedFetch(`/api/subscribers/stop/${currentProfileSubscriberId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const result = await response.json();
    if (result.success) {
      closeStopSubscriberModal();
      showToast("تم إيقاف المشترك بنجاح", "success");
      goBackToSubscribers();
      loadSubscribers();
      loadStats();
    } else {
      showToast("خطأ: " + result.message, "error");
    }
  } catch (error) {
    showToast("خطأ في إيقاف المشترك", "error");
  }
}

async function reactivateSubscriber(id) {
  showConfirm("هل أنت متأكد من إعادة تفعيل هذا المشترك؟", async () => {
    try {
      const response = await authenticatedFetch(`/api/subscribers/reactivate/${id}`, { method: "POST" });
      const result = await response.json();
      if (result.success) {
        showToast("تم إعادة تفعيل المشترك بنجاح", "success");
        loadStoppedSubscribers();
        loadSubscribers();
        loadStats();
      } else {
        showToast("خطأ: " + result.message, "error");
      }
    } catch (error) {
      showToast("خطأ في إعادة تفعيل المشترك", "error");
    }
  });
}

async function deleteStoppedSubscriber(id) {
  showConfirm("هل أنت متأكد من حذف هذا المشترك نهائياً؟ لا يمكن التراجع.", async () => {
    try {
      const response = await authenticatedFetch(`/api/subscribers/stopped/${id}`, { method: "DELETE" });
      const result = await response.json();
      if (result.success) {
        showToast("تم حذف المشترك نهائياً", "success");
        loadStoppedSubscribers();
      } else {
        showToast("خطأ: " + result.message, "error");
      }
    } catch (error) {
      showToast("خطأ في حذف المشترك", "error");
    }
  });
}

// =============================================
// SMS SECTION V2
// =============================================
let smsCurrentMode = "single";
let smsAllSubscribers = [];
let smsFilteredSubscribers = [];
let smsSelectedIds = new Set();

// FIXED: Init SMS — called once from DOMContentLoaded
function initSmsSection() {
  // Char counter
  const ta = document.getElementById("smsMessage");
  const pill = document.getElementById("smsCharCount");
  if (ta && pill) {
    ta.addEventListener("input", () => {
      const len = ta.value.length;
      pill.textContent = `${len} / 320`;
      pill.classList.toggle("warn", len > 200 && len <= 280);
      pill.classList.toggle("danger", len > 280);
    });
  }

  // Subscriber search autocomplete
  const searchInput = document.getElementById("smsSubscriberSearch");
  if (searchInput) {
    searchInput.addEventListener("input", () => showSmsSuggestions(searchInput.value));
    searchInput.addEventListener("keydown", (e) => {
      const suggestions = document.getElementById("smsSuggestions");
      if (!suggestions) return;
      const items = Array.from(suggestions.querySelectorAll("li"));
      const activeIdx = items.findIndex((it) => it.classList.contains("highlighted"));
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = items[Math.min(items.length - 1, activeIdx + 1)];
        items.forEach((it) => it.classList.remove("highlighted"));
        if (next) next.classList.add("highlighted");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = items[Math.max(0, activeIdx - 1)];
        items.forEach((it) => it.classList.remove("highlighted"));
        if (prev) prev.classList.add("highlighted");
      } else if (e.key === "Enter") {
        const active = items[activeIdx];
        if (active) { e.preventDefault(); active.click(); }
      } else if (e.key === "Escape") {
        suggestions.classList.remove("open");
        suggestions.innerHTML = "";
      }
    });
  }

  // Close suggestions on outside click
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".sms-search-wrapper")) {
      const suggestions = document.getElementById("smsSuggestions");
      if (suggestions) { suggestions.classList.remove("open"); suggestions.innerHTML = ""; }
    }
  });
}

function switchSmsMode(mode) {
  smsCurrentMode = mode;
  document.getElementById("smsSingleMode").style.display = mode === "single" ? "" : "none";
  document.getElementById("smsBulkMode").style.display = mode === "bulk" ? "" : "none";
  document.getElementById("singleModeTab").classList.toggle("active", mode === "single");
  document.getElementById("bulkModeTab").classList.toggle("active", mode === "bulk");
  if (mode === "bulk") {
    populateSmsRecipientsList();
    updateSmsSendBtn();
  } else {
    const sendText = document.getElementById("smsSendBtnText");
    if (sendText) sendText.textContent = "إرسال الرسالة";
  }
}

// FIXED: toggleSmsRecipientType — clean chip toggle
function toggleSmsRecipientType() {
  const type = document.querySelector('input[name="smsRecipientType"]:checked')?.value;
  document.getElementById("smsSubscriberGroup").style.display = type === "subscriber" ? "" : "none";
  document.getElementById("smsCustomPhoneGroup").style.display = type === "custom" ? "" : "none";
  document.querySelectorAll(".sms-toggle-label").forEach((label) => {
    const radio = label.querySelector("input");
    const chip = label.querySelector(".sms-toggle-chip");
    if (!chip) return;
    if (radio && radio.checked) {
      chip.style.borderColor = "#f5a623";
      chip.style.color = "#f5a623";
      chip.style.background = "rgba(245,166,35,0.08)";
    } else {
      chip.style.borderColor = "";
      chip.style.color = "";
      chip.style.background = "";
    }
  });
}

// FIXED: uses allSubscribers (main list) with fallback load — for single mode suggestions
function showSmsSuggestions(query) {
  const suggestions = document.getElementById("smsSuggestions");
  if (!suggestions) return;
  if (!query || query.length < 1) {
    suggestions.classList.remove("open");
    suggestions.innerHTML = "";
    return;
  }

  // FIXED: use allSubscribers (populated by loadSubscribers) — works because
  // switchSection("sms") now ensures allSubscribers is loaded first
  const sourceList = allSubscribers.length > 0 ? allSubscribers : smsAllSubscribers;
  const lower = query.toLowerCase();
  const matches = sourceList.filter((s) =>
    s.phone && (
      (s.fullName || "").toLowerCase().includes(lower) ||
      (s.phone || "").toLowerCase().includes(lower) ||
      (s.username || "").toLowerCase().includes(lower)
    )
  ).slice(0, 25);

  if (!matches.length) {
    suggestions.classList.remove("open");
    suggestions.innerHTML = "";
    return;
  }

  suggestions.innerHTML = matches.map((s) => `
    <li onclick='selectSmsRecipient(${JSON.stringify({ fullName: s.fullName || s.username, phone: s.phone })})'>
      <span class="suggestion-name">${escapeHtml(s.fullName || s.username || "-")}</span>
      <span class="suggestion-phone">${escapeHtml(s.phone)}</span>
    </li>`).join("");

  suggestions.classList.add("open");
  suggestions.style.display = "";
}

function selectSmsRecipient(item) {
  if (typeof item === "string") { try { item = JSON.parse(item); } catch(e) { return; } }
  document.getElementById("smsSubscriberSearch").value = item.fullName || item.phone;
  document.getElementById("smsSelectedPhone").value = item.phone;
  const suggestions = document.getElementById("smsSuggestions");
  if (suggestions) { suggestions.classList.remove("open"); suggestions.innerHTML = ""; }
}

// FIXED: uses s._id (MongoDB _id) not s.id
async function populateSmsRecipientsList() {
  const list = document.getElementById("smsRecipientsList");
  if (!list) return;
  list.innerHTML = '<div class="sms-list-loading"><i class="fas fa-circle-notch fa-spin"></i> جاري التحميل...</div>';
  try {
    // Always reload fresh data
    const res = await authenticatedFetch("/api/subscribers?limit=9999");
    const data = await res.json();
    // Support both {success, data:[]} and direct array
    const rawList = data.success ? data.data : (Array.isArray(data) ? data : []);
    smsAllSubscribers = rawList.filter((s) => s.phone);
    smsFilteredSubscribers = [...smsAllSubscribers];
    renderSmsRecipientsList();
  } catch (err) {
    list.innerHTML = '<div class="sms-list-empty">تعذر تحميل المشتركين</div>';
  }
}

function filterSmsRecipients() {
  const speedVal = document.getElementById("smsBulkSpeedFilter")?.value || "";
  const searchVal = (document.getElementById("smsBulkSearch")?.value || "").toLowerCase().trim();
  smsFilteredSubscribers = smsAllSubscribers.filter((s) => {
    if (!s.phone) return false;
    if (speedVal && String(s.speed) !== speedVal) return false;
    if (searchVal) {
      const name = (s.fullName || "").toLowerCase();
      const phone = (s.phone || "").toLowerCase();
      const username = (s.username || "").toLowerCase();
      if (!name.includes(searchVal) && !phone.includes(searchVal) && !username.includes(searchVal)) return false;
    }
    return true;
  });
  renderSmsRecipientsList();
}

// FIXED: uses s._id consistently
function renderSmsRecipientsList() {
  const list = document.getElementById("smsRecipientsList");
  if (!list) return;
  if (!smsFilteredSubscribers.length) {
    list.innerHTML = '<div class="sms-list-empty">لا يوجد مشتركون مطابقون للبحث</div>';
    return;
  }
  list.innerHTML = smsFilteredSubscribers.map((s) => {
    const id = s._id || s.id;
    const checked = smsSelectedIds.has(String(id)) ? "checked" : "";
    const selClass = smsSelectedIds.has(String(id)) ? "selected" : "";
    return `
      <div class="sms-recipient-item ${selClass}" onclick="toggleSmsRecipient('${id}', this)">
        <input type="checkbox" ${checked} onclick="event.stopPropagation(); toggleSmsRecipient('${id}', this.closest('.sms-recipient-item'))">
        <span class="sms-recipient-name">${escapeHtml(s.fullName || s.username || "-")}</span>
        <span class="sms-recipient-phone">${escapeHtml(s.phone)}</span>
        <span class="sms-recipient-speed">${s.speed || 4}M</span>
      </div>`;
  }).join("");
  updateSmsSendBtn();
}

// FIXED: id is now String for consistent Set lookup
function toggleSmsRecipient(id, rowEl) {
  const sid = String(id);
  if (smsSelectedIds.has(sid)) {
    smsSelectedIds.delete(sid);
    rowEl.classList.remove("selected");
    rowEl.querySelector('input[type="checkbox"]').checked = false;
  } else {
    smsSelectedIds.add(sid);
    rowEl.classList.add("selected");
    rowEl.querySelector('input[type="checkbox"]').checked = true;
  }
  updateSmsSendBtn();
}

function toggleAllSmsRecipients(masterCb) {
  smsFilteredSubscribers.forEach((s) => {
    const id = String(s._id || s.id);
    if (masterCb.checked) smsSelectedIds.add(id);
    else smsSelectedIds.delete(id);
  });
  renderSmsRecipientsList();
  updateSmsSendBtn();
}

function updateSmsSendBtn() {
  const count = smsSelectedIds.size;
  const badge = document.getElementById("smsBulkBadge");
  const sendText = document.getElementById("smsSendBtnText");
  const countEl = document.getElementById("smsSelectedCount");
  if (badge) { badge.textContent = count; badge.style.display = count > 0 ? "" : "none"; }
  if (countEl) countEl.textContent = `${count} محدد`;
  if (sendText) sendText.textContent = (smsCurrentMode === "bulk" && count > 0) ? `إرسال لـ ${count} مشترك` : "إرسال الرسالة";
}

function insertSmsTemplate(type) {
  const ta = document.getElementById("smsMessage");
  if (!ta) return;
  const templates = {
    renewal: "عزيزي المشترك، نذكّركم بأن اشتراككم في شبكة WeWifi على وشك الانتهاء. يُرجى التجديد للاستمرار في الخدمة. للتواصل: 05XXXXXXXX",
    welcome: "أهلاً بك في شبكة WeWifi! يسعدنا انضمامك إلينا. لأي استفسار لا تتردد بالتواصل معنا. شكراً لثقتك.",
    promo: "عرض خاص من WeWifi 🎉 اشترك الآن بسعر مميز وسرعة فائقة. العرض محدود، تواصل معنا اليوم: 05XXXXXXXX",
  };
  if (templates[type]) { ta.value = templates[type]; ta.dispatchEvent(new Event("input")); ta.focus(); }
}

function addSmsLogEntry({ name, message, success, bulk, count }) {
  const logList = document.getElementById("smsLogList");
  if (!logList) return;
  const emptyEl = logList.querySelector(".sms-log-empty");
  if (emptyEl) emptyEl.remove();
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;
  const item = document.createElement("div");
  item.className = `sms-log-item ${success ? "success" : "error"}`;
  item.innerHTML = `
    <div class="sms-log-item-header">
      <span class="sms-log-name">${escapeHtml(name)}</span>
      <span class="sms-log-time">${time}</span>
    </div>
    <div class="sms-log-msg">${escapeHtml(message.substring(0, 60))}${message.length > 60 ? "..." : ""}</div>
    ${bulk ? `<span class="sms-log-bulk-label"><i class="fas fa-users"></i> جماعي · ${count} مشترك</span>` : ""}`;
  logList.insertBefore(item, logList.firstChild);
  const items = logList.querySelectorAll(".sms-log-item");
  if (items.length > 10) items[items.length - 1].remove();
}

async function handleSmsSubmit(e) {
  e.preventDefault();
  const message = document.getElementById("smsMessage").value.trim();
  if (!message) return showToast("يرجى كتابة نص الرسالة", "error");
  if (smsCurrentMode === "bulk") await sendSmsBulk(message);
  else await sendSmsSingle(message);
}

async function sendSmsSingle(message) {
  const recipientType = document.querySelector('input[name="smsRecipientType"]:checked')?.value;
  let phone;
  if (recipientType === "subscriber") {
    phone = document.getElementById("smsSelectedPhone")?.value;
    if (!phone) return showToast("يرجى اختيار مشترك من القائمة", "error");
  } else {
    phone = document.getElementById("smsCustomPhone")?.value?.trim();
    if (!phone) return showToast("يرجى إدخال رقم الجوال", "error");
  }
  const btn = document.getElementById("smsSendBtn");
  if (btn) btn.disabled = true;
  try {
    const res = await authenticatedFetch("/api/subscribers/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast("تم إرسال الرسالة بنجاح ✓", "success");
      addSmsLogEntry({ name: phone, message, success: true });
      document.getElementById("smsMessage").value = "";
      document.getElementById("smsCharCount").textContent = "0 / 320";
    } else {
      showToast(data.error || "فشل إرسال الرسالة", "error");
      addSmsLogEntry({ name: phone, message, success: false });
    }
  } catch (err) {
    showToast("حدث خطأ أثناء الإرسال", "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

// FIXED: uses s._id for filtering
async function sendSmsBulk(message) {
  if (smsSelectedIds.size === 0) return showToast("يرجى اختيار مشترك واحد على الأقل", "error");
  const selected = smsAllSubscribers.filter((s) => smsSelectedIds.has(String(s._id || s.id)));
  const total = selected.length;
  if (total === 0) return showToast("لم يتم العثور على المشتركين المحددين", "error");

  const overlay = document.getElementById("smsBulkProgress");
  const fill = document.getElementById("smsBulkProgressFill");
  const text = document.getElementById("smsBulkProgressText");
  if (overlay) overlay.style.display = "flex";
  if (fill) fill.style.width = "0%";
  if (text) text.textContent = `0 / ${total}`;

  let successCount = 0, failCount = 0;

  for (let i = 0; i < total; i++) {
    const sub = selected[i];
    try {
      const res = await authenticatedFetch("/api/subscribers/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: sub.phone, message }),
      });
      if (res.ok) successCount++;
      else failCount++;
    } catch { failCount++; }

    const pct = Math.round(((i + 1) / total) * 100);
    if (fill) fill.style.width = `${pct}%`;
    if (text) text.textContent = `${i + 1} / ${total}`;
    if (i < total - 1) await new Promise((r) => setTimeout(r, 300));
  }

  if (overlay) overlay.style.display = "none";
  showToast(`تم إرسال ${successCount} رسالة بنجاح${failCount > 0 ? ` وفشل ${failCount}` : ""}`, successCount > 0 ? "success" : "error");
  addSmsLogEntry({ name: "إرسال جماعي", message, success: successCount > 0, bulk: true, count: successCount });

  document.getElementById("smsMessage").value = "";
  document.getElementById("smsCharCount").textContent = "0 / 320";
  smsSelectedIds.clear();
  renderSmsRecipientsList();
  updateSmsSendBtn();
}

// =============================================
// EXPIRING USERNAMES
// =============================================
let expiringUsernamesData = [];
let selectedExpiringIds = new Set();

function setupExpiringUsernamesListeners() {
  document.getElementById("selectAllExpiringCheckbox")?.addEventListener("change", handleSelectAllExpiring);
  document.getElementById("bulkChangeUsernamesBtn")?.addEventListener("click", openBulkChangeUsernamesModal);
  document.getElementById("expiring4MFilter")?.addEventListener("change", filterExpiringUsernames);
  document.getElementById("expiring8MFilter")?.addEventListener("change", filterExpiringUsernames);
  document.getElementById("searchOldUsernameBtn")?.addEventListener("click", searchByOldUsername);
  document.getElementById("oldUsernameSearchInput")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") searchByOldUsername();
  });
}

async function loadExpiringUsernames() {
  try {
    const response = await authenticatedFetch("/api/subscribers/expiring-usernames");
    const result = await response.json();
    if (result.success) {
      expiringUsernamesData = result.data;
      filterExpiringUsernames();
    }
  } catch (error) {
    console.error("Error loading expiring usernames:", error);
    showToast("خطأ في تحميل البيانات", "error");
  }
}

function filterExpiringUsernames() {
  const show4M = document.getElementById("expiring4MFilter")?.checked ?? true;
  const show8M = document.getElementById("expiring8MFilter")?.checked ?? true;
  const filtered = expiringUsernamesData.filter((sub) => {
    if (sub.speed == 4 && !show4M) return false;
    if (sub.speed == 8 && !show8M) return false;
    return true;
  });
  displayExpiringUsernames(filtered);
}

function displayExpiringUsernames(subscribers) {
  const tableBody = document.getElementById("expiringUsernamesTableBody");
  if (!tableBody) return;
  if (!subscribers || subscribers.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="9" class="text-center">لا يوجد مشتركين تنتهي صلاحية اسمهم قريباً</td></tr>';
    return;
  }
  tableBody.innerHTML = subscribers.map((sub) => {
    const id = sub._id || sub.id;
    const disconnectionDate = new Date(sub.disconnectionDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    disconnectionDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((disconnectionDate - today) / (1000 * 60 * 60 * 24));
    let daysText = "", daysClass = "";
    if (diffDays < 0) { daysText = `منتهي منذ ${Math.abs(diffDays)} يوم`; daysClass = "days-expired"; }
    else if (diffDays === 0) { daysText = "اليوم!"; daysClass = "days-today"; }
    else if (diffDays === 1) { daysText = "غداً"; daysClass = "days-urgent"; }
    else { daysText = `${diffDays} أيام`; daysClass = "days-warning"; }
    const isChecked = selectedExpiringIds.has(String(id)) ? "checked" : "";
    return `
      <tr data-id="${id}">
        <td class="checkbox-col"><input type="checkbox" class="expiring-checkbox" data-id="${id}" ${isChecked} onchange="handleExpiringCheckboxChange(this)"></td>
        <td>${escapeHtml(String(id))}</td>
        <td>${escapeHtml(sub.username || "-")}</td>
        <td>${escapeHtml(sub.fullName || "-")}</td>
        <td>${escapeHtml(sub.phone || "-")}</td>
        <td>${sub.speed || 4} ميجا</td>
        <td>${formatDate(sub.disconnectionDate)}</td>
        <td><span class="days-badge ${daysClass}">${daysText}</span></td>
        <td><button class="btn btn-info btn-sm modern-btn" onclick="openSubscriberProfile('${id}')">ملف</button></td>
      </tr>`;
  }).join("");
  updateExpiringSelectedCount();
}

function handleExpiringCheckboxChange(checkbox) {
  const id = String(checkbox.dataset.id);
  if (checkbox.checked) selectedExpiringIds.add(id);
  else selectedExpiringIds.delete(id);
  updateExpiringSelectedCount();
}

function handleSelectAllExpiring(e) {
  document.querySelectorAll(".expiring-checkbox").forEach((cb) => {
    cb.checked = e.target.checked;
    const id = String(cb.dataset.id);
    if (e.target.checked) selectedExpiringIds.add(id);
    else selectedExpiringIds.delete(id);
  });
  updateExpiringSelectedCount();
}

function updateExpiringSelectedCount() {
  const countSpan = document.getElementById("expiringSelectedCount");
  const bulkBtn = document.getElementById("bulkChangeUsernamesBtn");
  if (countSpan) countSpan.textContent = selectedExpiringIds.size;
  if (bulkBtn) bulkBtn.style.display = selectedExpiringIds.size > 0 ? "inline-block" : "none";
}

async function openBulkChangeUsernamesModal() {
  if (selectedExpiringIds.size === 0) { showToast("يرجى تحديد مشترك واحد على الأقل", "error"); return; }
  document.getElementById("bulkChangeCount").textContent = selectedExpiringIds.size;
  await updateAvailableCountForBulk();
  document.getElementById("bulkChangeUsernamesModal").style.display = "flex";
}

function closeBulkChangeUsernamesModal() {
  document.getElementById("bulkChangeUsernamesModal").style.display = "none";
}

async function updateAvailableCountForBulk() {
  try {
    let count4M = 0, count8M = 0;
    document.querySelectorAll("#expiringUsernamesTableBody tr").forEach((row) => {
      const checkbox = row.querySelector('input[type="checkbox"]');
      if (checkbox && checkbox.checked) {
        const speedCell = row.cells[5];
        if (speedCell) {
          if (speedCell.textContent.trim().includes("8")) count8M++;
          else count4M++;
        }
      }
    });
    const [r4, r8] = await Promise.all([
      authenticatedFetch("/api/subscribers/available-usernames?speed=4").then(r => r.json()),
      authenticatedFetch("/api/subscribers/available-usernames?speed=8").then(r => r.json()),
    ]);
    const available4M = r4.success ? r4.data.length : 0;
    const available8M = r8.success ? r8.data.length : 0;
    document.getElementById("selected4MCount").textContent = count4M;
    document.getElementById("available4MCount").textContent = available4M;
    document.getElementById("selected8MCount").textContent = count8M;
    document.getElementById("available8MCount").textContent = available8M;
    window.bulkChangeData = { count4M, count8M, available4M, available8M };
  } catch (error) {
    console.error("Error fetching available count:", error);
  }
}

async function confirmBulkChangeUsernames() {
  const subscriberIds = Array.from(selectedExpiringIds);
  const data = window.bulkChangeData || {};
  if (data.count4M > data.available4M) {
    showToast(`لا توجد أسماء كافية لـ 4 ميجا! المتاح: ${data.available4M}، المطلوب: ${data.count4M}`, "error");
    return;
  }
  if (data.count8M > data.available8M) {
    showToast(`لا توجد أسماء كافية لـ 8 ميجا! المتاح: ${data.available8M}، المطلوب: ${data.count8M}`, "error");
    return;
  }
  showConfirm(`هل أنت متأكد من تغيير أسماء المستخدمين لـ ${subscriberIds.length} مشترك؟`, async () => {
    try {
      const response = await authenticatedFetch("/api/subscribers/bulk-change-usernames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriberIds }),
      });
      const result = await response.json();
      if (result.success) {
        closeBulkChangeUsernamesModal();
        showToast(result.message, "success");
        selectedExpiringIds.clear();
        document.getElementById("selectAllExpiringCheckbox").checked = false;
        loadExpiringUsernames();
        loadAvailableUsernames();
        loadSubscribers();
      } else {
        showToast("خطأ: " + result.message, "error");
      }
    } catch (error) {
      showToast("خطأ في تغيير أسماء المستخدمين", "error");
    }
  });
}

async function searchByOldUsername() {
  const searchInput = document.getElementById("oldUsernameSearchInput");
  const resultDiv = document.getElementById("oldUsernameSearchResult");
  const username = searchInput.value.trim();
  if (!username) { showToast("يرجى إدخال اسم المستخدم للبحث", "error"); return; }
  try {
    const response = await authenticatedFetch(`/api/subscribers/search-old-username?username=${encodeURIComponent(username)}`);
    const result = await response.json();
    resultDiv.style.display = "block";
    if (result.success && result.found) {
      resultDiv.innerHTML = `
        <div class="search-results-container">
          <h4>نتائج البحث عن "${escapeHtml(username)}"</h4>
          <table class="data-table modern-table">
            <thead><tr>
              <th>الاسم المستخدم القديم</th><th>كلمة المرور القديمة</th>
              <th>تاريخ التغيير</th><th>المشترك الحالي</th>
              <th>اسم المستخدم الحالي</th><th>الإجراءات</th>
            </tr></thead>
            <tbody>
              ${result.data.map((h) => `
                <tr>
                  <td>${escapeHtml(h.old_username)}</td>
                  <td>${escapeHtml(h.old_password || "-")}</td>
                  <td>${formatDate(h.changed_at)}</td>
                  <td>${escapeHtml(h.fullName || "-")}</td>
                  <td>${escapeHtml(h.currentUsername || "-")}</td>
                  <td><button class="btn btn-info btn-sm modern-btn" onclick="openSubscriberProfile('${h.subscriberId}')">فتح الملف</button></td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>`;
    } else {
      resultDiv.innerHTML = `<div class="no-results" style="padding:15px;background:var(--bg-color);border-radius:8px;text-align:center;"><p>لم يتم العثور على مشترك بهذا الاسم القديم "${escapeHtml(username)}"</p></div>`;
    }
  } catch (error) {
    resultDiv.innerHTML = `<div class="error-result" style="padding:15px;background:#fee;border-radius:8px;text-align:center;color:#c00;"><p>خطأ في البحث</p></div>`;
    resultDiv.style.display = "block";
  }
}
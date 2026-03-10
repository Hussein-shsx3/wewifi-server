// Dashboard JavaScript
let currentPage = 1;
const itemsPerPage = 1000; // Show all subscribers in one page
let allSubscribers = []; // Store all subscribers for client-side filtering
let searchTimeout = null; // For debouncing search
let selectedIds = new Set(); // Track selected subscriber IDs
let currentProfileSubscriberId =
  localStorage.getItem("currentProfileSubscriberId") || null;
let originalProfileUsername = null; // To track if username changed
let originalProfileSpeed = null; // To track if speed changed
let availableUsernameSpeedMap = new Map(); // username -> speed

// =============================================
// TOAST NOTIFICATION SYSTEM
// =============================================
function showToast(message, type = "success") {
  // Remove any existing toast
  const existingToast = document.querySelector(".toast-notification");
  if (existingToast) {
    existingToast.remove();
  }

  // Create toast element
  const toast = document.createElement("div");
  toast.className = `toast-notification toast-${type}`;

  // Icon based on type
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

  // Trigger animation
  setTimeout(() => toast.classList.add("show"), 10);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// =============================================
// CUSTOM CONFIRM DIALOG
// =============================================
function showConfirm(message, onConfirm, onCancel = null) {
  // Remove any existing confirm dialog
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
          <i class="fas fa-check"></i> نعم، احذف
        </button>
        <button type="button" class="confirm-btn confirm-btn-cancel" id="confirmNoBtn">
          <i class="fas fa-times"></i> إلغاء
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Show with animation
  setTimeout(() => overlay.classList.add("show"), 10);

  // Handle buttons
  const yesBtn = overlay.querySelector("#confirmYesBtn");
  const noBtn = overlay.querySelector("#confirmNoBtn");

  const closeDialog = () => {
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 200);
  };

  yesBtn.onclick = () => {
    closeDialog();
    if (onConfirm) onConfirm();
  };

  noBtn.onclick = () => {
    closeDialog();
    if (onCancel) onCancel();
  };

  // Close on overlay click
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      closeDialog();
      if (onCancel) onCancel();
    }
  };

  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === "Escape") {
      closeDialog();
      if (onCancel) onCancel();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);
}

// Helper function for authenticated API calls
async function authenticatedFetch(url, options = {}) {
  const response = await fetch(url, options);

  // Check if response is JSON (authenticated) or HTML (redirect to login)
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    // If it's a successful response but not JSON (e.g., file download), allow it
    if (response.ok) {
      return response;
    }
    // Otherwise, assume it's a redirect to login
    window.location.href = "/login";
    throw new Error("Not authenticated");
  }

  return response;
}

// Format date to Arabic format (DD/MM/YYYY)
function formatDate(dateString) {
  if (!dateString) return "-";
  const normalized = formatDateForInput(dateString);
  if (!normalized) return "-";
  const [year, month, day] = normalized.split("-");
  return `${day}/${month}/${year}`;
}

function setSelectValueWithFallback(selectId, value) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const safeValue = String(value || "").trim();

  if (!safeValue) {
    select.value = "";
    return;
  }

  const exists = Array.from(select.options).some(
    (option) => option.value === safeValue,
  );
  if (!exists) {
    const customOption = document.createElement("option");
    customOption.value = safeValue;
    customOption.textContent = `${safeValue} (موجود مسبقاً)`;
    select.appendChild(customOption);
  }

  select.value = safeValue;
}

function toggleFacilityTypeOther(selectId, otherInputId) {
  const select = document.getElementById(selectId);
  const otherInput = document.getElementById(otherInputId);
  if (!select || !otherInput) return;

  const isOther = select.value === "أخرى";
  otherInput.style.display = isOther ? "block" : "none";
  otherInput.required = isOther;

  if (!isOther) {
    otherInput.value = "";
  }
}

function getFacilityTypeValue(selectId, otherInputId) {
  const select = document.getElementById(selectId);
  const otherInput = document.getElementById(otherInputId);
  if (!select) return "";
  if (select.value !== "أخرى") return select.value;
  return String(otherInput?.value || "").trim();
}

function setFacilityTypeWithCustomSupport(selectId, otherInputId, value) {
  const select = document.getElementById(selectId);
  const otherInput = document.getElementById(otherInputId);
  if (!select || !otherInput) return;

  const safeValue = String(value || "").trim();
  if (!safeValue) {
    select.value = "";
    toggleFacilityTypeOther(selectId, otherInputId);
    return;
  }

  const exists = Array.from(select.options).some(
    (option) => option.value === safeValue,
  );

  if (exists && safeValue !== "أخرى") {
    select.value = safeValue;
    otherInput.value = "";
  } else {
    select.value = "أخرى";
    otherInput.value = safeValue === "أخرى" ? "" : safeValue;
  }

  toggleFacilityTypeOther(selectId, otherInputId);
}

async function loadAvailableUsernamesForAddForm() {
  const select = document.getElementById("availableUsernameForNewSubscriber");
  if (!select) return;

  try {
    const response = await authenticatedFetch("/api/subscribers/available-usernames");
    const result = await response.json();

    select.innerHTML = '<option value="">اختر اسم مستخدم متاح...</option>';

    if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
      return;
    }

    const bySpeed = { 4: [], 8: [] };
    result.data.forEach((u) => {
      const speed = Number(u.speed || 4);
      if (speed === 8) {
        bySpeed[8].push(u);
      } else {
        bySpeed[4].push(u);
      }
    });

    [4, 8].forEach((speed) => {
      if (!bySpeed[speed].length) return;
      const group = document.createElement("optgroup");
      group.label = speed === 4 ? "🔵 4 ميجا" : "🟢 8 ميجا";

      bySpeed[speed].forEach((u) => {
        const option = document.createElement("option");
        option.value = String(u.id);
        option.dataset.password = String(u.password || "");
        option.dataset.speed = String(u.speed || speed);
        option.textContent = `${u.username} (${u.remainingDays ?? 31} يوم متبقي)`;
        group.appendChild(option);
      });

      select.appendChild(group);
    });
  } catch (error) {
    console.error("Error loading usernames for add form:", error);
  }
}

function handleAddSubscriberAvailableUsernameChange() {
  const select = document.getElementById("availableUsernameForNewSubscriber");
  const passwordPreview = document.getElementById("newSubscriberPasswordPreview");
  const speedPreview = document.getElementById("newSubscriberSpeedPreview");
  if (!select || !passwordPreview || !speedPreview) return;

  const selectedOption = select.options[select.selectedIndex];
  if (!selectedOption || !select.value) {
    passwordPreview.value = "";
    speedPreview.value = "";
    return;
  }

  passwordPreview.value = selectedOption.dataset.password || "-";
  speedPreview.value = `${selectedOption.dataset.speed || 4} ميجا`;
}

function normalizeSearchValue(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Initialize dashboard
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  loadStats();
  addQuickFilters(); // Add quick filter buttons
});

// Handle hash change
window.addEventListener("hashchange", handleHashChange);

// Initialize navigation after everything is loaded
window.addEventListener("load", () => {
  handleHashChange();
});

function handleHashChange() {
  let hash = window.location.hash.slice(1);
  console.log("handleHashChange called, current hash:", hash);

  // If no hash, try to restore from localStorage
  if (!hash) {
    hash = localStorage.getItem("currentDashboardSection") || "dashboard";
    console.log("No hash found, restoring from localStorage:", hash);
    // Set the hash without triggering hashchange event
    history.replaceState(null, null, "#" + hash);
  }

  // If trying to access profile page directly without a subscriber loaded, try to restore from localStorage
  if (hash === "subscriber-profile") {
    if (!currentProfileSubscriberId) {
      const savedId = localStorage.getItem("currentProfileSubscriberId");
      if (savedId) {
        currentProfileSubscriberId = savedId;
        // Load the profile data (skip hash change since we're already on profile page)
        openSubscriberProfile(savedId, true);
        return;
      } else {
        hash = "subscribers";
        history.replaceState(null, null, "#" + hash);
      }
    } else {
      // We have an ID, just load the profile
      openSubscriberProfile(currentProfileSubscriberId, true);
      return;
    }
  }

  console.log("Switching to section:", hash);
  switchSection(hash);

  // Store current section in localStorage (except profile page)
  if (hash !== "subscriber-profile") {
    localStorage.setItem("currentDashboardSection", hash);
  }

  // Update active menu item
  document.querySelectorAll(".menu-item").forEach((item) => {
    item.classList.remove("active");
    if (item.dataset.section === hash) {
      item.classList.add("active");
    }
  });
}

// Setup event listeners
function setupEventListeners() {
  // Menu toggle for mobile
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.querySelector(".sidebar");

  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      sidebar.classList.toggle("active");
    });
  }

  // Close sidebar when clicking outside
  document.addEventListener("click", (e) => {
    if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
      sidebar.classList.remove("active");
    }
  });

  // Menu item click handler
  document.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      // Skip logout link - let it navigate normally
      if (item.classList.contains("logout")) {
        return; // Don't prevent default, let it navigate to /logout
      }

      e.preventDefault();
      const section = item.dataset.section;
      window.location.hash = section;
      handleHashChange();

      // Close mobile sidebar after clicking menu item
      if (window.innerWidth <= 768) {
        sidebar.classList.remove("active");
      }
    });
  });

  // Subscriber form
  document
    .getElementById("addSubscriberBtn")
    ?.addEventListener("click", showAddForm);
  document.getElementById("cancelFormBtn")?.addEventListener("click", hideForm);
  document
    .getElementById("subscriberFormElement")
    ?.addEventListener("submit", handleFormSubmit);
  document.getElementById("facilityType")?.addEventListener("change", () => {
    toggleFacilityTypeOther("facilityType", "facilityTypeOther");
  });
  document
    .getElementById("availableUsernameForNewSubscriber")
    ?.addEventListener("change", handleAddSubscriberAvailableUsernameChange);
  toggleFacilityTypeOther("facilityType", "facilityTypeOther");

  // Delete all button
  document
    .getElementById("deleteAllBtn")
    ?.addEventListener("click", deleteAllSubscribers);

  // Import Excel button
  document
    .getElementById("importExcelBtn")
    ?.addEventListener("click", openImportModal);

  // Upload area
  const uploadArea = document.getElementById("uploadArea");
  const excelFileInput = document.getElementById("excelFile");

  if (uploadArea && excelFileInput) {
    uploadArea.addEventListener("click", (e) => {
      // Prevent triggering if clicking on the button inside
      if (e.target.id !== "chooseFileBtn") {
        excelFileInput.value = ""; // Reset input to allow same file selection
        excelFileInput.click();
      }
    });
    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = "var(--primary-color)";
      uploadArea.style.backgroundColor = "var(--bg-color)";
    });
    uploadArea.addEventListener("dragleave", () => {
      uploadArea.style.borderColor = "var(--border-color)";
      uploadArea.style.backgroundColor = "transparent";
    });
    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = "var(--border-color)";
      const files = e.dataTransfer.files;
      handleFileUpload(files);
    });
  }

  document.getElementById("chooseFileBtn")?.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent uploadArea click from also firing
    const fileInput = document.getElementById("excelFile");
    if (fileInput) {
      fileInput.value = ""; // Reset to allow same file selection
      fileInput.click();
    }
  });

  document.getElementById("excelFile")?.addEventListener("change", (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
  });

  // Main search inputs - Live filtering on input
  const mainSearchInput = document.getElementById("mainSearchInput");
  const mainSearchClearBtn = document.getElementById("mainSearchClearBtn");

  if (mainSearchInput) {
    mainSearchInput.addEventListener("input", () => {
      if (mainSearchClearBtn) {
        mainSearchClearBtn.style.display = mainSearchInput.value.trim()
          ? "inline-flex"
          : "none";
      }
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const searchTerm = mainSearchInput.value.trim();
        if (searchTerm) {
          handleSmartSearch(searchTerm);
        } else {
          loadSubscribers(1);
        }
      }, 300);
    });

    mainSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        clearTimeout(searchTimeout);
        const searchTerm = mainSearchInput.value.trim();
        if (searchTerm) handleSmartSearch(searchTerm);
      }
    });
  }

  if (mainSearchClearBtn) {
    mainSearchClearBtn.addEventListener("click", () => {
      if (!mainSearchInput) return;
      mainSearchInput.value = "";
      mainSearchClearBtn.style.display = "none";
      loadSubscribers(1);
      mainSearchInput.focus();
    });
  }

  // Column filters - Live filtering on input
  document.querySelectorAll(".column-filter").forEach((filter) => {
    filter.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        applyColumnFilters();
      }, 200);
    });
    filter.addEventListener("change", () => {
      applyColumnFilters();
    });
  });

  // Clear filters button
  document
    .getElementById("clearFiltersBtn")
    ?.addEventListener("click", clearColumnFilters);

  // Select all checkbox
  document
    .getElementById("selectAllCheckbox")
    ?.addEventListener("change", handleSelectAll);

  // Delete selected button
  document
    .getElementById("deleteSelectedBtn")
    ?.addEventListener("click", deleteSelectedSubscribers);

  // Bulk edit button
  document
    .getElementById("bulkEditBtn")
    ?.addEventListener("click", showBulkEditModal);

  // Cancel bulk edit
  document
    .getElementById("cancelBulkEdit")
    ?.addEventListener("click", hideBulkEditModal);

  // Bulk edit form submit
  document
    .getElementById("bulkEditForm")
    ?.addEventListener("submit", handleBulkEdit);

  // Bulk field selection change
  document.getElementById("bulkField")?.addEventListener("change", (e) => {
    const valueGroup = document.getElementById("bulkValueGroup");
    const valueInput = document.getElementById("bulkValue");
    const valueSelect = document.getElementById("bulkValueSelect");
    const valueDateInput = document.getElementById("bulkValueDate");

    if (e.target.value) {
      valueGroup.style.display = "block";
      if (
        e.target.value === "startDate" ||
        e.target.value === "firstContactDate"
      ) {
        valueInput.style.display = "none";
        valueSelect.style.display = "none";
        valueDateInput.style.display = "block";
      } else {
        valueInput.style.display = "block";
        valueSelect.style.display = "none";
        valueDateInput.style.display = "none";
      }
    } else {
      valueGroup.style.display = "none";
    }
  });

  // Export Excel button
  document
    .getElementById("exportExcelBtn")
    ?.addEventListener("click", exportToExcel);

  // Upload type selection
  document.querySelectorAll('input[name="uploadType"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const updateInfo = document.getElementById("updateInfo");
      if (e.target.value === "update") {
        updateInfo.style.display = "block";
      } else {
        updateInfo.style.display = "none";
      }
    });
  });
}

// Switch sections
function switchSection(sectionId) {
  console.log("switchSection called with:", sectionId);

  // Hide all sections
  document
    .querySelectorAll(".section")
    .forEach((s) => s.classList.remove("active"));

  // Show target section
  const targetSection = document.getElementById(sectionId);
  console.log("Target section found:", !!targetSection, "for id:", sectionId);

  if (targetSection) {
    targetSection.classList.add("active");
    console.log("Added active class to section:", sectionId);

    // Refresh data if needed
    if (sectionId === "subscribers") {
      loadSubscribers();
    }
  } else {
    console.warn(`Section with id "${sectionId}" not found`);
    // Fallback to dashboard
    document.getElementById("dashboard")?.classList.add("active");
  }
}

// Load subscribers
async function loadSubscribers(page = 1, search = "") {
  try {
    let url = `/api/subscribers?page=${page}&limit=${itemsPerPage}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    const response = await authenticatedFetch(url);
    const result = await response.json();

    if (result.success) {
      allSubscribers = result.data; // Store for filtering
      displaySubscribers(result.data);
      displayPagination(result.pagination);
      currentPage = page;
    }
  } catch (error) {
    if (error.message === "Not authenticated") return; // Already redirected
    console.error("Error loading subscribers:", error);
    alert("خطأ في تحميل قائمة المشتركين");
  }
}

// Smart search function with special commands
async function handleSmartSearch(searchTerm) {
  const term = normalizeSearchValue(searchTerm);

  // If no data loaded, load it first
  if (allSubscribers.length === 0) {
    await loadSubscribers(1);
  }

  // Special search commands for empty/missing fields
  const emptyFieldSearches = {
    // Phone number searches
    "بدون هاتف": (sub) => !sub.phone || sub.phone.trim() === "",
    "لا هاتف": (sub) => !sub.phone || sub.phone.trim() === "",
    "no phone": (sub) => !sub.phone || sub.phone.trim() === "",
    "empty phone": (sub) => !sub.phone || sub.phone.trim() === "",

    // Start date searches
    "بدون تاريخ": (sub) => !sub.startDate || sub.startDate.trim() === "",
    "لا تاريخ": (sub) => !sub.startDate || sub.startDate.trim() === "",
    "no date": (sub) => !sub.startDate || sub.startDate.trim() === "",
    "empty date": (sub) => !sub.startDate || sub.startDate.trim() === "",

    // Contact date searches
    "بدون تاريخ اتصال": (sub) =>
      !sub.firstContactDate ||
      sub.firstContactDate.trim() === "" ||
      sub.firstContactDate === "-",
    "لا تاريخ اتصال": (sub) =>
      !sub.firstContactDate ||
      sub.firstContactDate.trim() === "" ||
      sub.firstContactDate === "-",
    "no contact date": (sub) =>
      !sub.firstContactDate ||
      sub.firstContactDate.trim() === "" ||
      sub.firstContactDate === "-",
    "بدون تاريخ اول اتصال": (sub) =>
      !sub.firstContactDate ||
      sub.firstContactDate.trim() === "" ||
      sub.firstContactDate === "-",

    // Password searches
    "بدون كلمة مرور": (sub) => !sub.password || sub.password.trim() === "",
    "لا كلمة مرور": (sub) => !sub.password || sub.password.trim() === "",
    "no password": (sub) => !sub.password || sub.password.trim() === "",
    "empty password": (sub) => !sub.password || sub.password.trim() === "",

    // Notes searches
    "بدون ملاحظات": (sub) => !sub.notes || sub.notes.trim() === "",
    "لا ملاحظات": (sub) => !sub.notes || sub.notes.trim() === "",
    "no notes": (sub) => !sub.notes || sub.notes.trim() === "",
    "empty notes": (sub) => !sub.notes || sub.notes.trim() === "",

    // Package searches
    "بدون باقة": (sub) => !sub.package || sub.package.trim() === "",
    "لا باقة": (sub) => !sub.package || sub.package.trim() === "",
    "no package": (sub) => !sub.package || sub.package.trim() === "",

    // Missing data (any field)
    "بيانات ناقصة": (sub) => {
      return (
        !sub.phone ||
        sub.phone.trim() === "" ||
        !sub.startDate ||
        sub.startDate.trim() === "" ||
        !sub.firstContactDate ||
        sub.firstContactDate.trim() === "" ||
        !sub.password ||
        sub.password.trim() === "" ||
        !sub.notes ||
        sub.notes.trim() === ""
      );
    },
    "معلومات ناقصة": (sub) => {
      return (
        !sub.phone ||
        sub.phone.trim() === "" ||
        !sub.startDate ||
        sub.startDate.trim() === "" ||
        !sub.firstContactDate ||
        sub.firstContactDate.trim() === "" ||
        !sub.password ||
        sub.password.trim() === "" ||
        !sub.notes ||
        sub.notes.trim() === ""
      );
    },
    "missing data": (sub) => {
      return (
        !sub.phone ||
        sub.phone.trim() === "" ||
        !sub.startDate ||
        sub.startDate.trim() === "" ||
        !sub.firstContactDate ||
        sub.firstContactDate.trim() === "" ||
        !sub.password ||
        sub.password.trim() === "" ||
        !sub.notes ||
        sub.notes.trim() === ""
      );
    },
    incomplete: (sub) => {
      return (
        !sub.phone ||
        sub.phone.trim() === "" ||
        !sub.startDate ||
        sub.startDate.trim() === "" ||
        !sub.firstContactDate ||
        sub.firstContactDate.trim() === "" ||
        !sub.password ||
        sub.password.trim() === "" ||
        !sub.notes ||
        sub.notes.trim() === ""
      );
    },
  };

  // Check if it's a special search command
  if (emptyFieldSearches[term]) {
    const filtered = allSubscribers.filter(emptyFieldSearches[term]);
    displaySubscribers(filtered);
    showSearchFeedback(`تم العثور على ${filtered.length} مشترك`);
    return;
  }

  // Regular search across all fields
  const filtered = allSubscribers.filter((sub) => {
    return (
      normalizeSearchValue(sub.username).includes(term) ||
      normalizeSearchValue(sub.fullName).includes(term) ||
      normalizeSearchValue(sub.phone).includes(term) ||
      normalizeSearchValue(sub.package).includes(term) ||
      normalizeSearchValue(sub.notes).includes(term) ||
      normalizeSearchValue(sub.monthlyPrice).includes(term) ||
      normalizeSearchValue(sub.startDate).includes(term) ||
      (sub.firstContactDate &&
        normalizeSearchValue(sub.firstContactDate).includes(term))
    );
  });

  displaySubscribers(filtered);
  showSearchFeedback(`تم العثور على ${filtered.length} مشترك`);
}

// Show search feedback
function showSearchFeedback(message) {
  // Remove existing feedback
  const existingFeedback = document.querySelector(".search-feedback");
  if (existingFeedback) {
    existingFeedback.remove();
  }

  // Create new feedback
  const feedback = document.createElement("div");
  feedback.className = "search-feedback";
  feedback.textContent = message;
  document.body.appendChild(feedback);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    feedback.remove();
  }, 3000);
}

// Add quick filter buttons
function addQuickFilters() {
  const filtersSection = document.querySelector(
    "#subscribers .filters-section",
  );
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

  // Insert after filters header
  const filtersHeader = filtersSection.querySelector(".filters-header");
  filtersHeader.after(quickFiltersDiv);

  // Add click handlers
  quickFiltersDiv.querySelectorAll(".quick-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const searchTerm = btn.dataset.search;
      const mainSearchInput = document.getElementById("mainSearchInput");
      mainSearchInput.value = searchTerm;

      if (searchTerm) {
        handleSmartSearch(searchTerm);
      } else {
        loadSubscribers(currentPage);
      }

      // Highlight active button
      quickFiltersDiv.querySelectorAll(".quick-filter-btn").forEach((b) => {
        b.classList.remove("active");
      });
      btn.classList.add("active");
    });
  });
}

// Apply column-based filters
function applyColumnFilters() {
  const filters = {};
  document.querySelectorAll(".column-filter").forEach((filter) => {
    const column = filter.dataset.column;
    const value = filter.value.trim().toLowerCase();
    if (value) {
      filters[column] = value;
    }
  });

  // If no filters, show all
  if (Object.keys(filters).length === 0) {
    displaySubscribers(allSubscribers);
    return;
  }

  const filtered = allSubscribers.filter((sub) => {
    for (const [column, filterValue] of Object.entries(filters)) {
      let cellValue = "";

      if (column === "startDate" || column === "firstContactDate") {
        // Format date for comparison
        cellValue = formatDate(sub[column]).toLowerCase();
      } else if (column === "isActive") {
        // Handle status filter
        const isActive = String(sub.isActive);
        if (filterValue !== isActive) {
          return false;
        }
        continue;
      } else if (column === "monthlyPrice") {
        cellValue = String(sub[column] || "");
      } else {
        cellValue = String(sub[column] || "").toLowerCase();
      }

      if (!cellValue.includes(filterValue)) {
        return false;
      }
    }
    return true;
  });

  displaySubscribers(filtered);
}

// Clear all column filters
function clearColumnFilters() {
  document.querySelectorAll(".column-filter").forEach((filter) => {
    filter.value = "";
  });
  // Also clear main search input
  const mainSearchInput = document.getElementById("mainSearchInput");
  if (mainSearchInput) {
    mainSearchInput.value = "";
  }
  // Clear quick filter active states
  document.querySelectorAll(".quick-filter-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  // Reload all subscribers without search
  loadSubscribers(1);
}

// Display subscribers in table
function displaySubscribers(subscribers) {
  const tbody = document.getElementById("subscribersTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";
  subscribers.forEach((sub) => {
    const isChecked = selectedIds.has(String(sub._id));
    const speed = sub.speed || 4;

    const row = document.createElement("tr");
    row.innerHTML = `
            <td class="checkbox-col">
              <input type="checkbox" class="row-checkbox" data-id="${sub._id}" ${isChecked ? "checked" : ""} onchange="handleRowSelect(this)">
            </td>
            <td class="id-col">${sub._id}</td>
            <td>${sub.username}</td>
            <td>${sub.password || ""}</td>
            <td>${sub.fullName || ""}</td>
            <td>${sub.facilityType || ""}</td>
            <td>${sub.phone || ""}</td>
            <td>${sub.package || ""}</td>
            <td>${formatDate(sub.startDate)}</td>
            <td>${sub.firstContactDate ? formatDate(sub.firstContactDate) : "-"}</td>
            <td>${sub.disconnectionDate ? formatDate(sub.disconnectionDate) : "-"}</td>
            <td><span class="speed-badge speed-${speed}">${speed} ميجا</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-profile modern-action-btn" onclick="openSubscriberProfile('${sub._id}')" title="عرض الملف الشخصي">
                        ملف
                    </button>
                    <button class="btn-delete modern-action-btn" onclick="deleteSubscriber('${sub._id}')" title="حذف المشترك">
                        حذف
                    </button>
                </div>
            </td>
        `;
    tbody.appendChild(row);
  });

  // Update select all checkbox state
  updateSelectAllCheckbox();
}

// Handle individual row checkbox selection
function handleRowSelect(checkbox) {
  const id = checkbox.dataset.id;
  if (checkbox.checked) {
    selectedIds.add(id);
  } else {
    selectedIds.delete(id);
  }
  updateSelectionUI();
}

// Handle select all checkbox
function handleSelectAll(e) {
  const checkboxes = document.querySelectorAll(".row-checkbox");
  checkboxes.forEach((cb) => {
    cb.checked = e.target.checked;
    const id = cb.dataset.id;
    if (e.target.checked) {
      selectedIds.add(id);
    } else {
      selectedIds.delete(id);
    }
  });
  updateSelectionUI();
}

// Update select all checkbox based on row selections
function updateSelectAllCheckbox() {
  const selectAll = document.getElementById("selectAllCheckbox");
  const checkboxes = document.querySelectorAll(".row-checkbox");
  if (!selectAll || checkboxes.length === 0) return;

  const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
  const someChecked = Array.from(checkboxes).some((cb) => cb.checked);

  selectAll.checked = allChecked;
  selectAll.indeterminate = someChecked && !allChecked;
}

// Update selection UI (show/hide buttons, update counts)
function updateSelectionUI() {
  const selectedCount = selectedIds.size;
  const deleteBtn = document.getElementById("deleteSelectedBtn");
  const bulkEditBtn = document.getElementById("bulkEditBtn");
  const countSpan = document.getElementById("selectedCount");

  if (selectedCount > 0) {
    deleteBtn.style.display = "inline-block";
    bulkEditBtn.style.display = "inline-block";
    countSpan.textContent = selectedCount;
  } else {
    deleteBtn.style.display = "none";
    bulkEditBtn.style.display = "none";
  }
}

// Delete selected subscribers
async function deleteSelectedSubscribers() {
  if (selectedIds.size === 0) return;

  if (!confirm(`هل أنت متأكد من حذف ${selectedIds.size} مشترك؟`)) return;

  try {
    const response = await authenticatedFetch("/api/subscribers/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    });
    const result = await response.json();

    if (result.success) {
      alert("تم حذف المشتركين المحددين بنجاح");
      selectedIds.clear();
      updateSelectionUI();
      loadSubscribers(currentPage);
      loadStats();
    } else {
      alert("فشل في حذف المشتركين: " + result.message);
    }
  } catch (error) {
    console.error("Error deleting selected subscribers:", error);
    alert("خطأ في حذف المشتركين المحددين");
  }
}

// Show bulk edit modal
function showBulkEditModal() {
  if (selectedIds.size === 0) return;

  document.getElementById("bulkEditCount").textContent = selectedIds.size;
  document.getElementById("bulkEditModal").style.display = "flex";
  document.getElementById("bulkEditForm").reset();
  document.getElementById("bulkValueGroup").style.display = "none";
}

// Hide bulk edit modal
function hideBulkEditModal() {
  document.getElementById("bulkEditModal").style.display = "none";
}

// Handle bulk edit form submission
async function handleBulkEdit(e) {
  e.preventDefault();

  const field = document.getElementById("bulkField").value;
  let value;

  if (field === "startDate" || field === "firstContactDate") {
    value = document.getElementById("bulkValueDate").value;
  } else {
    value = document.getElementById("bulkValue").value;
  }

  if (!field) {
    alert("يرجى اختيار الحقل");
    return;
  }

  try {
    const ids = Array.from(selectedIds);
    const response = await authenticatedFetch("/api/subscribers/bulk-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, field, value }),
    });

    const result = await response.json();
    if (result.success) {
      alert(`تم تحديث ${result.updated} مشترك بنجاح`);
      hideBulkEditModal();
      selectedIds.clear();
      updateSelectionUI();
      loadSubscribers();
      loadStats();
    } else {
      alert("خطأ في تحديث المشتركين: " + result.message);
    }
  } catch (error) {
    if (error.message === "Not authenticated") return;
    console.error("Error bulk updating:", error);
    alert("خطأ في تحديث المشتركين");
  }
}

// Display pagination
function displayPagination(pagination) {
  const container = document.getElementById("pagination");
  if (!container) return;

  container.innerHTML = "";

  if (pagination.page > 1) {
    const prevBtn = document.createElement("button");
    prevBtn.textContent = "السابق";
    prevBtn.onclick = () => loadSubscribers(pagination.page - 1);
    container.appendChild(prevBtn);
  }

  for (let i = 1; i <= pagination.pages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.classList.toggle("active", i === pagination.page);
    btn.onclick = () => loadSubscribers(i);
    container.appendChild(btn);
  }

  if (pagination.page < pagination.pages) {
    const nextBtn = document.createElement("button");
    nextBtn.textContent = "التالي";
    nextBtn.onclick = () => loadSubscribers(pagination.page + 1);
    container.appendChild(nextBtn);
  }
}

// Show add form
async function showAddForm() {
  document.getElementById("formTitle").textContent = "إضافة مشترك جديد";
  document.getElementById("subscriberFormElement").reset();
  document.getElementById("subscriberForm").style.display = "block";
  toggleFacilityTypeOther("facilityType", "facilityTypeOther");
  await loadAvailableUsernamesForAddForm();
  handleAddSubscriberAvailableUsernameChange();
}

// Hide form
function hideForm() {
  document.getElementById("subscriberForm").style.display = "none";
  document.getElementById("subscriberFormElement").reset();
  toggleFacilityTypeOther("facilityType", "facilityTypeOther");
  handleAddSubscriberAvailableUsernameChange();
}

// Handle form submit (Add new subscriber only)
async function handleFormSubmit(e) {
  e.preventDefault();

  const formData = {
    availableUsernameId: document.getElementById("availableUsernameForNewSubscriber")
      .value,
    fullName: document.getElementById("fullName").value,
    facilityType: getFacilityTypeValue("facilityType", "facilityTypeOther"),
    phone: document.getElementById("phone").value,
    package: document.getElementById("package").value,
    startDate: document.getElementById("startDate").value,
    firstContactDate: document.getElementById("firstContactDate").value || null,
    notes: document.getElementById("notes").value,
  };

  if (
    document.getElementById("facilityType")?.value === "أخرى" &&
    !formData.facilityType
  ) {
    alert("يرجى كتابة نوع المنشأة عند اختيار (أخرى)");
    return;
  }

  try {
    // ID is now auto-generated by the server based on package/line number
    if (!formData.package) {
      alert("يرجى إدخال رقم الخط لتوليد ID تلقائياً");
      return;
    }
    if (!formData.availableUsernameId) {
      alert("يرجى اختيار اسم مستخدم من الأسماء المتاحة");
      return;
    }

    const response = await authenticatedFetch("/api/subscribers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    const result = await response.json();
    if (result.success) {
      hideForm();
      // Show newest changes immediately after adding.
      loadSubscribers(1);
      loadStats();
      loadAvailableUsernames();
      loadAvailableUsernamesDropdown();

      const uploadResult = document.getElementById("uploadResult");
      const uploadMessage = document.getElementById("uploadMessage");
      if (uploadResult && uploadMessage) {
        uploadResult.style.display = "block";
        uploadMessage.className = "message success";
        uploadMessage.textContent = `✓ تم إضافة المشترك بنجاح (ID: ${result.id || "تم التوليد"})`;
        setTimeout(() => {
          uploadResult.style.display = "none";
        }, 3000);
      }
    } else {
      alert("خطأ: " + result.message);
    }
  } catch (error) {
    console.error("Error:", error);
    alert("خطأ في معالجة الطلب");
  }
}

// Export to Excel
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
      alert("خطأ في تصدير الملف: " + (result.message || "خطأ غير معروف"));
    }

    btn.textContent = originalText;
    btn.disabled = false;
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    alert("خطأ في تصدير الملف");
    const btn = document.getElementById("exportExcelBtn");
    btn.textContent = "تصدير Excel";
    btn.disabled = false;
  }
}

// Delete all subscribers
async function deleteAllSubscribers() {
  if (
    !confirm(
      "⚠️ تحذير: هل تريد فعلاً حذف جميع المشتركين؟\n\nهذا الإجراء لا يمكن التراجع عنه!",
    )
  ) {
    return;
  }

  if (!confirm("تأكيد نهائي: سيتم حذف جميع المشتركين. هل أنت متأكد؟")) {
    return;
  }

  try {
    const response = await authenticatedFetch(`/api/subscribers/all`, {
      method: "DELETE",
    });
    const result = await response.json();
    if (result.success) {
      loadSubscribers(currentPage);
      loadStats();

      const uploadResult = document.getElementById("uploadResult");
      const uploadMessage = document.getElementById("uploadMessage");
      if (uploadResult && uploadMessage) {
        uploadResult.style.display = "block";
        uploadMessage.className = "message success";
        uploadMessage.textContent = `✓ ${result.message}`;
        setTimeout(() => {
          uploadResult.style.display = "none";
        }, 3000);
      }
    } else {
      alert("خطأ في حذف المشتركين: " + result.message);
    }
  } catch (error) {
    console.error("Error deleting all subscribers:", error);
    alert("خطأ في حذف المشتركين");
  }
}

// Delete subscriber
async function deleteSubscriber(id) {
  if (
    !confirm("هل تريد فعلاً حذف هذا المشترك؟ لا يمكن التراجع عن هذا الإجراء.")
  ) {
    return;
  }

  try {
    const response = await authenticatedFetch(`/api/subscribers/${id}`, {
      method: "DELETE",
    });
    const result = await response.json();
    if (result.success) {
      loadSubscribers(currentPage);
      loadStats();

      const uploadResult = document.getElementById("uploadResult");
      const uploadMessage = document.getElementById("uploadMessage");
      if (uploadResult && uploadMessage) {
        uploadResult.style.display = "block";
        uploadMessage.className = "message success";
        uploadMessage.textContent = "✓ تم حذف المشترك بنجاح";
        setTimeout(() => {
          uploadResult.style.display = "none";
        }, 3000);
      }
    } else {
      alert("فشل حذف المشترك: " + result.message);
    }
  } catch (error) {
    if (error.message === "Not authenticated") return;
    console.error("Error deleting subscriber:", error);
    alert("خطأ في حذف المشترك");
  }
}

// Handle file upload
async function handleFileUpload(files) {
  if (!files || files.length === 0) return;

  const file = files[0];
  const formData = new FormData();
  formData.append("file", file);

  // Check upload type
  const uploadType =
    document.querySelector('input[name="uploadType"]:checked')?.value || "new";
  const endpoint =
    uploadType === "update"
      ? "/api/subscribers/upload-credentials"
      : "/api/subscribers/upload";

  try {
    const response = await authenticatedFetch(endpoint, {
      method: "POST",
      body: formData,
    });
    const result = await response.json();

    const uploadResult = document.getElementById("uploadResult");
    const uploadMessage = document.getElementById("uploadMessage");
    const uploadStats = document.getElementById("uploadStats");

    if (result.success) {
      uploadMessage.className = "message success";
      uploadMessage.textContent = result.message;

      let statsHTML = `
        <div class="stats-grid">
          <div class="stat-card">
            <h3>تم الاستيراد</h3>
            <p class="stat-number" style="color: var(--success-color);">${result.uploaded}</p>
            <p>مشترك جديد</p>
          </div>
      `;

      if (result.skipped && result.skipped.length > 0) {
        statsHTML += `
          <div class="stat-card">
            <h3>تم التخطي</h3>
            <p class="stat-number" style="color: var(--warning-color);">${result.skipped.length}</p>
            <p>مشترك موجود</p>
          </div>
        `;
      }

      if (result.missingFieldsCount && result.missingFieldsCount > 0) {
        statsHTML += `
          <div class="stat-card">
            <h3>حقول ناقصة</h3>
            <p class="stat-number" style="color: var(--info-color, #17a2b8);">${result.missingFieldsCount}</p>
            <p>مشترك بحقول فارغة</p>
          </div>
        `;
      }

      if (result.errors && result.errors.length > 0) {
        statsHTML += `
          <div class="stat-card">
            <h3>أخطاء</h3>
            <p class="stat-number" style="color: var(--danger-color);">${result.errors.length}</p>
            <p>صف به خطأ</p>
          </div>
        `;
      }

      statsHTML += `</div>`;

      // Add details if there are skipped, errors, or missing fields
      if (
        (result.skipped && result.skipped.length > 0) ||
        (result.errors && result.errors.length > 0) ||
        (result.withMissingFields && result.withMissingFields.length > 0)
      ) {
        statsHTML += `<div class="upload-details" style="margin-top: 20px;">`;

        // Show missing fields details
        if (result.withMissingFields && result.withMissingFields.length > 0) {
          const fieldNames = {
            password: "كلمة المرور",
            fullName: "اسم الزبون",
            phone: "رقم الجوال",
            package: "الخط/الباقة",
            monthlyPrice: "المبلغ",
            startDate: "تاريخ طلب الاشتراك",
          };

          statsHTML += `<div class="details-section" style="margin-bottom: 20px;">
            <h4 style="color: var(--info-color, #17a2b8); margin-bottom: 10px;">📋 مشتركين بحقول ناقصة:</h4>
            <div style="max-height: 200px; overflow-y: auto;">
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
              <thead>
                <tr style="background-color: var(--bg-color);">
                  <th style="padding: 8px; border: 1px solid var(--border-color); text-align: right;">اسم المستخدم</th>
                  <th style="padding: 8px; border: 1px solid var(--border-color); text-align: right;">الحقول الناقصة</th>
                </tr>
              </thead>
              <tbody>`;

          result.withMissingFields.slice(0, 20).forEach((item) => {
            const missingArabic = item.missingFields
              .map((f) => fieldNames[f] || f)
              .join("، ");
            statsHTML += `<tr>
              <td style="padding: 6px 8px; border: 1px solid var(--border-color);">${item.username}</td>
              <td style="padding: 6px 8px; border: 1px solid var(--border-color); color: var(--text-light);">${missingArabic}</td>
            </tr>`;
          });

          statsHTML += `</tbody></table></div>`;

          if (result.withMissingFields.length > 20) {
            statsHTML += `<p style="font-size: 11px; color: var(--text-light); margin-top: 8px;">... و ${
              result.withMissingFields.length - 20
            } مشترك آخر بحقول ناقصة</p>`;
          }

          statsHTML += `</div>`;
        }

        if (result.skipped && result.skipped.length > 0) {
          statsHTML += `<div class="details-section">
            <h4 style="color: var(--warning-color); margin-bottom: 10px;">المشتركين المخطي عليهم:</h4>
            <ul style="list-style: none; padding: 0;">`;
          result.skipped.forEach((item) => {
            statsHTML += `<li style="padding: 5px 0; border-bottom: 1px solid var(--border-color);">• ${item.username} - ${item.reason}</li>`;
          });
          statsHTML += `</ul></div>`;
        }

        if (result.errors && result.errors.length > 0) {
          statsHTML += `<div class="details-section">
            <h4 style="color: var(--danger-color); margin-bottom: 10px;">الصفوف بها أخطاء:</h4>
            <ul style="list-style: none; padding: 0;">`;
          result.errors.slice(0, 10).forEach((item) => {
            const rowInfo = item.row ? `الصف ${item.row}: ` : "";
            const userInfo = item.username ? `${item.username} - ` : "";
            statsHTML += `<li style="padding: 8px 0; border-bottom: 1px solid var(--border-color); font-size: 12px;">⚠️ ${rowInfo}${userInfo}${item.error}</li>`;
          });
          if (result.errors.length > 10) {
            statsHTML += `<li style="padding: 8px 0;">... و ${
              result.errors.length - 10
            } أخطاء أخرى</li>`;
          }
          statsHTML += `</ul>`;

          // Show detected columns for debugging
          if (result.detectedColumns && result.detectedColumns.length > 0) {
            statsHTML += `<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-color);">
              <p style="font-size: 11px; color: var(--text-light); margin-bottom: 8px;"><strong>الأعمدة المكتشفة في الملف:</strong></p>
              <p style="font-size: 11px; color: var(--text-color); background-color: var(--bg-color); padding: 8px; border-radius: 4px; margin: 0;">
                ${result.detectedColumns.join(" | ")}
              </p>
            </div>`;
          }

          statsHTML += `</div>`;
        }

        statsHTML += `</div>`;
      }

      uploadStats.innerHTML = statsHTML;
    } else {
      uploadMessage.className = "message error";
      uploadMessage.textContent = result.message;
    }

    uploadResult.style.display = "block";

    // Reload subscribers and dashboard cards after successful import/update.
    if (result.success && result.uploaded > 0) {
      setTimeout(() => {
        loadSubscribers(1);
        loadStats();
      }, 500);
    } else if (result.success) {
      setTimeout(() => {
        loadSubscribers(1);
        loadStats();
      }, 500);
    }
  } catch (error) {
    console.error("Error uploading file:", error);
    const uploadResult = document.getElementById("uploadResult");
    const uploadMessage = document.getElementById("uploadMessage");
    uploadMessage.className = "message error";
    uploadMessage.textContent = "خطأ في استيراد الملف. تأكد من صيغة الملف.";
    uploadResult.style.display = "block";
  }
}

// Load stats
async function loadStats() {
  try {
    // Get comprehensive dashboard stats
    const response = await authenticatedFetch(
      "/api/subscribers/dashboard-stats",
    );
    const result = await response.json();

    if (result.success) {
      const data = result.data;

      // Update main stat cards
      document.getElementById("totalSubscribers").textContent =
        data.overview.totalSubscribers;
      document.getElementById("availableUsernamesCount").textContent =
        data.overview.totalAvailableUsernames;
      document.getElementById("aboutToDisconnectCount").textContent =
        data.overview.expiringSubscribers;

      const expiredEl = document.getElementById("expiredCount");
      if (expiredEl) expiredEl.textContent = data.overview.expiredSubscribers;

      // Update week stats
      const newSubsWeekEl = document.getElementById("newSubscribersWeek");
      if (newSubsWeekEl)
        newSubsWeekEl.textContent = `+${data.thisWeek.newSubscribers} هذا الأسبوع`;

      const availableWeekEl = document.getElementById("availableAddedWeek");
      if (availableWeekEl)
        availableWeekEl.textContent = `+${data.thisWeek.availableUsernamesAdded} هذا الأسبوع`;

      // Update activity stats
      const weekNewSubsEl = document.getElementById("weekNewSubscribers");
      if (weekNewSubsEl)
        weekNewSubsEl.textContent = data.thisWeek.newSubscribers;

      const weekAvailableEl = document.getElementById("weekAvailableAdded");
      if (weekAvailableEl)
        weekAvailableEl.textContent = data.thisWeek.availableUsernamesAdded;

      const weekSpeedEl = document.getElementById("weekSpeedChanges");
      if (weekSpeedEl) weekSpeedEl.textContent = data.thisWeek.speedChanges;

      const weekUsernameEl = document.getElementById("weekUsernameChanges");
      if (weekUsernameEl)
        weekUsernameEl.textContent = data.thisWeek.usernameChanges;

      // Update speed chart
      updateSpeedChart(data.subscribersBySpeed, data.overview.totalSubscribers);

      // Update available by speed
      updateAvailableBySpeed(data.availableBySpeed);

      // Update days breakdown
      updateDaysBreakdown(
        data.availableDaysBreakdown,
        data.overview.totalAvailableUsernames,
      );

      // Update recent speed changes
      updateRecentSpeedChanges(data.recentSpeedChanges);
      updateRecentNewSubscribers(data.recentNewSubscribers);

      // Update current date
      updateCurrentDate();
    }

    // Load subscribers about to disconnect (separate call for detailed list)
    await loadSubscribersAboutToDisconnect();
  } catch (error) {
    if (error.message === "Not authenticated") return;
    console.error("Error loading stats:", error);
    // Fallback to old method if new endpoint fails
    await loadStatsLegacy();
  }
}

// Fallback stats loader
async function loadStatsLegacy() {
  try {
    const response = await authenticatedFetch("/api/subscribers?limit=10000");
    const result = await response.json();

    const availableResponse = await authenticatedFetch(
      "/api/subscribers/available-usernames?showUsed=false",
    );
    const availableResult = await availableResponse.json();

    if (result.success) {
      document.getElementById("totalSubscribers").textContent =
        result.data.length;
    }

    if (availableResult.success) {
      const availableCount = document.getElementById("availableUsernamesCount");
      if (availableCount) {
        availableCount.textContent = availableResult.data.length;
      }
    }
  } catch (error) {
    console.error("Error loading legacy stats:", error);
  }
}

// Update speed chart
function updateSpeedChart(speedData, total) {
  const speed4mCount = document.getElementById("speed4mCount");
  const speed8mCount = document.getElementById("speed8mCount");
  const speedDonutTotal = document.getElementById("speedDonutTotal");

  let count4m = 0,
    count8m = 0;

  if (speedData) {
    speedData.forEach((item) => {
      if (item.speed === 4) count4m = item.count;
      else if (item.speed === 8) count8m = item.count;
    });
  }

  if (speed4mCount) speed4mCount.textContent = count4m;
  if (speed8mCount) speed8mCount.textContent = count8m;
  if (speedDonutTotal) speedDonutTotal.textContent = count4m + count8m;

  // Draw donut chart
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

  const cx = size / 2;
  const cy = size / 2;
  const outerR = 72;
  const innerR = 48;
  const total = count4m + count8m;

  ctx.clearRect(0, 0, size, size);

  if (total === 0) {
    // Empty state - draw grey ring
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
    ctx.fillStyle = "#f1f5f9";
    ctx.fill();
    return;
  }

  const slices = [
    { value: count4m, color: "#f5a623" },
    { value: count8m, color: "#0891b2" },
  ];

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

  // Gap between slices
  if (count4m > 0 && count8m > 0) {
    const gapWidth = 0.03;
    const angles = [
      -Math.PI / 2,
      -Math.PI / 2 + (count4m / total) * Math.PI * 2,
    ];
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

// Update available by speed
function updateAvailableBySpeed(availableData) {
  const available4mCount = document.getElementById("available4mCount");
  const available8mCount = document.getElementById("available8mCount");

  let count4m = 0,
    count8m = 0;

  if (availableData) {
    availableData.forEach((item) => {
      if (item.speed === 4) count4m = item.count;
      else if (item.speed === 8) count8m = item.count;
    });
  }

  if (available4mCount) available4mCount.textContent = count4m;
  if (available8mCount) available8mCount.textContent = count8m;
}

// Update days breakdown
function updateDaysBreakdown(breakdownData, total) {
  const categories = {
    full: { progress: "fullDaysProgress", count: "fullDaysCount", value: 0 },
    half: { progress: "halfDaysProgress", count: "halfDaysCount", value: 0 },
    quarter: {
      progress: "quarterDaysProgress",
      count: "quarterDaysCount",
      value: 0,
    },
    low: { progress: "lowDaysProgress", count: "lowDaysCount", value: 0 },
  };

  if (breakdownData) {
    breakdownData.forEach((item) => {
      if (categories[item.category]) {
        categories[item.category].value = item.count;
      }
    });
  }

  Object.keys(categories).forEach((key) => {
    const cat = categories[key];
    const progressEl = document.getElementById(cat.progress);
    const countEl = document.getElementById(cat.count);

    if (progressEl) {
      const percentage = total > 0 ? (cat.value / total) * 100 : 0;
      progressEl.style.width = percentage + "%";
    }
    if (countEl) countEl.textContent = cat.value;
  });
}

// Update recent speed changes
function updateRecentSpeedChanges(changes) {
  const listEl = document.getElementById("recentSpeedChangesList");
  if (!listEl) return;

  if (!changes || changes.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-inbox"></i>
        <p>لا توجد تغييرات حديثة</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = changes
    .map(
      (change) => `
    <div class="recent-item">
      <div class="recent-item-title">
        <i class="fas fa-bolt"></i>
        ${change.fullName || change.username || "غير معروف"}
      </div>
      <div class="recent-item-detail">من ${change.old_speed}M إلى ${change.new_speed}M</div>
      <div class="recent-item-time">${formatDate(change.changed_at)}</div>
    </div>
  `,
    )
    .join("");
}

function updateRecentNewSubscribers(subscribers) {
  const listEl = document.getElementById("recentNewSubscribersList");
  if (!listEl) return;

  if (!subscribers || subscribers.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-inbox"></i>
        <p>لا توجد إضافات حديثة</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = subscribers
    .map(
      (sub) => `
    <div class="recent-item">
      <div class="recent-item-title">
        <i class="fas fa-user-plus"></i>
        ${sub.fullName || sub.username || "-"}
      </div>
      <div class="recent-item-detail">${sub.phone || "بدون هاتف"}</div>
      <div class="recent-item-time">${formatDate(sub.createdAt)}</div>
    </div>
  `,
    )
    .join("");
}

// Update current date display
function updateCurrentDate() {
  const dateEl = document.getElementById("currentDate");
  if (!dateEl) return;

  const now = new Date();
  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  dateEl.textContent = now.toLocaleDateString("ar-SA", options);
}

// Load subscribers about to be disconnected
async function loadSubscribersAboutToDisconnect() {
  try {
    const response = await authenticatedFetch(
      "/api/subscribers/about-to-disconnect",
    );
    const result = await response.json();

    const countElement = document.getElementById("aboutToDisconnectCount");
    const listElement = document.getElementById("aboutToDisconnectList");

    if (result.success && result.data.length > 0) {
      if (countElement) countElement.textContent = result.data.length;

      // Update the new card-based list (show first 5)
      if (listElement) {
        const itemsToShow = result.data.slice(0, 5);
        listElement.innerHTML = itemsToShow
          .map((subscriber) => {
            const disconnectionDate = new Date(subscriber.disconnectionDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            disconnectionDate.setHours(0, 0, 0, 0);

            const diffTime = disconnectionDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let daysText = "";

            if (diffDays < 0) {
              daysText = `منتهي منذ ${Math.abs(diffDays)} يوم`;
            } else if (diffDays === 0) {
              daysText = "اليوم!";
            } else if (diffDays <= 3) {
              daysText = `${diffDays} أيام`;
            } else {
              daysText = `${diffDays} أيام`;
            }

            return `
              <div class="expiring-item" onclick="openSubscriberProfile('${subscriber._id}')">
                <div class="expiring-item-name">${subscriber.fullName || subscriber.username || "-"}</div>
                <div class="expiring-item-info">${subscriber.phone || "-"}</div>
              </div>
            `;
          })
          .join("");
      }
    } else {
      if (countElement) countElement.textContent = "0";
      if (listElement) {
        listElement.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-check-circle"></i>
            <p>لا توجد اشتراكات تنتهي قريباً 🎉</p>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error("Error loading subscribers about to disconnect:", error);
  }
}

// ===========================================
// SUBSCRIBER PROFILE FUNCTIONS
// ===========================================

// Add old username to history table immediately (without refresh)
function addToUsernameHistoryTable(oldUsername, oldPassword, usageStartDate) {
  const historyBody = document.getElementById("usernameHistoryTableBody");
  const historyList = document.getElementById("usernameHistoryList");
  const today = formatDate(new Date());

  // Update the new modern history list
  if (historyList) {
    // Check if showing "no data" message
    const emptyMsg = historyList.querySelector(".profile-history-empty");
    if (emptyMsg) {
      historyList.innerHTML = "";
    }

    // Create new history item and add at the top
    const newItem = document.createElement("div");
    newItem.className = "profile-history-item";
    newItem.innerHTML = `
      <div class="profile-history-main">
        <span class="profile-history-username">${oldUsername}</span>
        <span class="profile-history-password">${oldPassword || "-"}</span>
      </div>
      <div class="profile-history-dates">
        <span>من: ${usageStartDate || "-"}</span>
        <span>إلى: ${today}</span>
      </div>
    `;
    historyList.insertBefore(newItem, historyList.firstChild);
  }

  // Also update hidden table for backward compatibility
  if (historyBody) {
    // Check if table shows "no data" message
    const noDataRow = historyBody.querySelector('td[colspan="4"]');
    if (noDataRow) {
      historyBody.innerHTML = "";
    }

    // Create new row and add at the top
    const newRow = document.createElement("tr");
    newRow.innerHTML = `
      <td>${oldUsername}</td>
      <td>${oldPassword || "-"}</td>
      <td>${usageStartDate || "-"}</td>
      <td>${today}</td>
    `;
    historyBody.insertBefore(newRow, historyBody.firstChild);
  }
}

// Add speed history entry to list immediately (without refresh)
function addToSpeedHistoryList(entry) {
  const speedHistoryList = document.getElementById("speedHistoryList");
  if (!speedHistoryList) return;

  // Check if showing "no data" message
  const emptyMsg = speedHistoryList.querySelector(".profile-history-empty");
  if (emptyMsg) {
    speedHistoryList.innerHTML = "";
  }

  // Create new history item and add at the top
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
    </div>
  `;
  speedHistoryList.insertBefore(newItem, speedHistoryList.firstChild);
}

// Open speed change username selection modal
async function openSpeedChangeUsernameModal(newSpeed) {
  try {
    // Fetch available usernames for the new speed
    const response = await authenticatedFetch(
      `/api/subscribers/available-usernames?speed=${newSpeed}`,
    );
    const result = await response.json();

    if (!result.success || !result.data || result.data.length === 0) {
      alert(
        `لا توجد أسماء مستخدمين متاحة للسرعة ${newSpeed} ميجا. يرجى إضافة أسماء مستخدمين أولاً.`,
      );
      // Reset speed dropdown to original value
      document.getElementById("profileSpeed").value = originalProfileSpeed;
      return;
    }

    // Build the modal content
    const availableUsernames = result.data;
    let optionsHtml = availableUsernames
      .map((u) => {
        const remainingDays =
          u.remainingDays !== undefined ? u.remainingDays : 31;
        return `<option value="${u.username}" data-password="${u.password || ""}" data-remaining="${remainingDays}">
          ${u.username} (${remainingDays} يوم متبقي)
        </option>`;
      })
      .join("");

    // Show the modal
    const modal = document.getElementById("speedChangeUsernameModal");
    const select = document.getElementById("speedChangeUsernameSelect");
    const speedLabel = document.getElementById("speedChangeSpeedLabel");

    if (modal && select && speedLabel) {
      speedLabel.textContent = `${newSpeed} ميجا`;
      select.innerHTML = `<option value="">-- اختر اسم مستخدم --</option>${optionsHtml}`;
      modal.style.display = "flex";
    }
  } catch (error) {
    console.error("Error loading available usernames:", error);
    alert("خطأ في تحميل أسماء المستخدمين المتاحة");
    document.getElementById("profileSpeed").value = originalProfileSpeed;
  }
}

// Handle speed change username selection
function confirmSpeedChangeUsername() {
  const select = document.getElementById("speedChangeUsernameSelect");
  if (!select || !select.value) {
    alert("يرجى اختيار اسم مستخدم");
    return;
  }

  const selectedOption = select.options[select.selectedIndex];
  const newUsername = select.value;
  const newPassword = selectedOption.dataset.password || "";

  // Update the profile form with new username and password
  document.getElementById("profileUsername").value = newUsername;
  document.getElementById("profilePassword").value = newPassword;

  // Close the modal
  closeSpeedChangeUsernameModal();

  // Trigger form submit
  document.getElementById("profileEditForm").dispatchEvent(new Event("submit"));
}

// Close speed change username modal
function closeSpeedChangeUsernameModal() {
  const modal = document.getElementById("speedChangeUsernameModal");
  if (modal) {
    modal.style.display = "none";
  }
  // Reset speed to original if cancelled
  if (
    document.getElementById("profileUsername").value === originalProfileUsername
  ) {
    document.getElementById("profileSpeed").value = originalProfileSpeed;
  }
}

// Format date for input field (YYYY-MM-DD)
function formatDateForInput(dateString) {
  if (!dateString) return "";
  const raw = String(dateString).trim();

  // Exact date string without time component.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  // Handle slash/dot/dash formats like 10/3/2026 or 3/10/2026.
  // Prefer day/month for ambiguous values to match Arabic expectation.
  const m = raw.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);

    let day;
    let month;

    if (a > 12 && b <= 12) {
      // DD/MM/YYYY
      day = a;
      month = b;
    } else if (a <= 12 && b > 12) {
      // MM/DD/YYYY
      month = a;
      day = b;
    } else {
      // Ambiguous case (both <= 12):
      // keep as MM/DD to avoid swapping in UI date control.
      month = a;
      day = b;
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const date = new Date(raw);
  if (isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Format date for profile display field (DD/MM/YYYY)
function formatDateForProfileDisplay(dateString) {
  const isoDate = formatDateForInput(dateString);
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

// Convert profile date input to API format (YYYY-MM-DD)
function normalizeProfileDateForApi(dateValue) {
  if (!dateValue) return "";
  const raw = String(dateValue).trim();
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const m = raw.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return raw;
}

// Open subscriber profile page
async function openSubscriberProfile(subscriberId, skipHashChange = false) {
  console.log("openSubscriberProfile called with ID:", subscriberId);
  currentProfileSubscriberId = subscriberId;
  localStorage.setItem("currentProfileSubscriberId", subscriberId);

  // Navigate to profile section (only if not already there)
  if (!skipHashChange && window.location.hash !== "#subscriber-profile") {
    window.location.hash = "subscriber-profile";
  }

  // Switch to profile section
  switchSection("subscriber-profile");

  try {
    console.log("Fetching profile data for:", subscriberId);
    const response = await authenticatedFetch(
      `/api/subscribers/profile/${subscriberId}`,
    );
    const result = await response.json();
    console.log("Profile data received:", result);

    if (result.success) {
      const subscriber = result.data.subscriber;
      const history = result.data.usernameHistory || [];
      const speedHistory = result.data.speedHistory || [];

      // Save original username and speed to track changes
      originalProfileUsername = subscriber.username || "";
      originalProfileSpeed = subscriber.speed || 4;

      // Update profile ID badge
      const idBadge = document.getElementById("profileIdBadge");
      if (idBadge) {
        idBadge.textContent = subscriber._id || "-";
      }

      // Populate edit form fields
      document.getElementById("profileEditId").value = subscriber._id || "";
      document.getElementById("profileId").value = subscriber._id || "";
      document.getElementById("profileUsername").value =
        subscriber.username || "";
      document.getElementById("profilePassword").value =
        subscriber.password || "";
      document.getElementById("profileFullName").value =
        subscriber.fullName || "";
      setFacilityTypeWithCustomSupport(
        "profileFacilityType",
        "profileFacilityTypeOther",
        subscriber.facilityType,
      );
      document.getElementById("profilePhone").value = subscriber.phone || "";
      document.getElementById("profilePackage").value =
        subscriber.package || "";
      document.getElementById("profileStartDate").value = formatDateForProfileDisplay(
        subscriber.startDate,
      );
      document.getElementById("profileFirstContactDate").value =
        formatDateForProfileDisplay(subscriber.firstContactDate);
      document.getElementById("profileDisconnectionDate").value =
        formatDateForProfileDisplay(subscriber.disconnectionDate);
      document.getElementById("profileSpeed").value = `${subscriber.speed || 4} ميجا`;
      document.getElementById("profileNotes").value = subscriber.notes || "";
      document.getElementById("newUsernameInput").value = "";
      document.getElementById("newPasswordInput").value = "";
      document.getElementById("newUsernameTargetSpeed").value = String(
        subscriber.speed || 4,
      );
      document.getElementById("newUsernameSpeedMatchHint").textContent =
        "اختر اسم مستخدم جديد وسرعة مطلوبة.";

      // Update timer display
      updateProfileTimer(
        subscriber.firstContactDate,
        subscriber.disconnectionDate,
        subscriber.speed,
      );

      // Populate username history (new modern list)
      const historyList = document.getElementById("usernameHistoryList");
      if (historyList) {
        if (history.length > 0) {
          historyList.innerHTML = history
            .map(
              (h) => `
            <div class="profile-history-item" data-history-id="${h.id}">
              <div class="profile-history-main">
                <span class="profile-history-username">${h.old_username}</span>
                <div class="profile-history-actions-inline">
                  <span class="profile-history-password">${h.old_password || "-"}</span>
                  <button type="button" class="history-action-btn history-edit-btn" onclick="editHistoryEntry(${h.id}, '${(h.old_username || "").replace(/'/g, "\\'")}', '${(h.old_password || "").replace(/'/g, "\\'")}', '${h.usage_start_date ? h.usage_start_date.split("T")[0] : ""}', '${h.usage_end_date ? h.usage_end_date.split("T")[0] : ""}')" title="تعديل">
                    <i class="fas fa-pen"></i>
                  </button>
                  <button type="button" class="history-action-btn history-delete-btn" onclick="deleteHistoryEntry(${h.id})" title="حذف">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
              <div class="profile-history-dates">
                <span>من: ${formatDate(h.usage_start_date) || "-"}</span>
                <span>إلى: ${formatDate(h.usage_end_date) || formatDate(h.changed_at)}</span>
              </div>
            </div>
          `,
            )
            .join("");
        } else {
          historyList.innerHTML =
            '<div class="profile-history-empty">لا توجد بيانات سابقة</div>';
        }
      }

      // Also update hidden table for backward compatibility
      const historyBody = document.getElementById("usernameHistoryTableBody");
      if (historyBody) {
        if (history.length > 0) {
          historyBody.innerHTML = history
            .map(
              (h) => `
            <tr>
              <td>${h.old_username}</td>
              <td>${h.old_password || "-"}</td>
              <td>${formatDate(h.usage_start_date) || "-"}</td>
              <td>${formatDate(h.usage_end_date) || formatDate(h.changed_at)}</td>
            </tr>
          `,
            )
            .join("");
        } else {
          historyBody.innerHTML =
            '<tr><td colspan="4" class="text-center">لا توجد بيانات سابقة</td></tr>';
        }
      }

      // Populate speed history
      const speedHistoryList = document.getElementById("speedHistoryList");
      if (speedHistoryList) {
        if (speedHistory.length > 0) {
          speedHistoryList.innerHTML = speedHistory
            .map(
              (h) => `
            <div class="profile-history-item speed-history-item">
              <div class="profile-history-main">
                <span class="speed-change-badge">${h.old_speed}M → ${h.new_speed}M</span>
                <span class="speed-days-badge">${h.days_used} يوم</span>
              </div>
              <div class="profile-history-dates">
                <span>من: ${formatDate(h.usage_start_date) || "-"}</span>
                <span>إلى: ${formatDate(h.usage_end_date) || formatDate(h.changed_at)}</span>
              </div>
            </div>
          `,
            )
            .join("");
        } else {
          speedHistoryList.innerHTML =
            '<div class="profile-history-empty">لا توجد بيانات سابقة</div>';
        }
      }

      // Load available usernames for the dropdown
      loadAvailableUsernamesDropdown();
    } else {
      alert("خطأ في تحميل بيانات المشترك: " + result.message);
      goBackToSubscribers();
    }
  } catch (error) {
    console.error("Error loading profile:", error);
    alert("خطأ في تحميل الملف الشخصي");
    goBackToSubscribers();
  }
}

// Update profile timer display
function updateProfileTimer(firstContactDate, disconnectionDate, speed) {
  const usageTimerEl = document.getElementById("usageTimerValue");
  const remainingDaysEl = document.getElementById("remainingDaysValue");
  const speedDisplayEl = document.getElementById("profileSpeedDisplay");
  const remainingCard = document.getElementById("remainingDaysCard");
  const parseDateOnly = (value) => {
    const normalized = formatDateForInput(value);
    if (!normalized) return null;
    const [year, month, day] = normalized.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  // Calculate usage days (from firstContactDate to today)
  let usageDays = 0;
  if (firstContactDate) {
    const startDate = parseDateOnly(firstContactDate);
    if (startDate) {
      const today = new Date();
      // Reset time parts to compare dates only
      startDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - startDate.getTime();
      usageDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (usageDays < 0) usageDays = 0;
    }
  }

  // Calculate remaining days (from today to disconnectionDate)
  let remainingDays = 0;
  if (disconnectionDate) {
    const endDate = parseDateOnly(disconnectionDate);
    if (endDate) {
      const today = new Date();
      // Reset time parts to compare dates only
      endDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      const diffTime = endDate.getTime() - today.getTime();
      // Inclusive counting: if today is the first day, remaining should be 31.
      remainingDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
  }

  // Update display (just the number, unit is separate)
  if (usageTimerEl) {
    usageTimerEl.textContent = usageDays;
  }

  if (remainingDaysEl) {
    if (remainingDays < 0) {
      remainingDaysEl.textContent = "منتهي";
      // Hide the unit when showing "منتهي"
      const unitEl = remainingDaysEl.nextElementSibling;
      if (unitEl && unitEl.classList.contains("profile-stat-unit")) {
        unitEl.style.visibility = "hidden";
      }
    } else {
      remainingDaysEl.textContent = remainingDays;
      // Show the unit
      const unitEl = remainingDaysEl.nextElementSibling;
      if (unitEl && unitEl.classList.contains("profile-stat-unit")) {
        unitEl.style.visibility = "visible";
      }
    }
  }

  // Update remaining days card color based on urgency
  if (remainingCard) {
    remainingCard.classList.remove("warning", "danger");
    if (remainingDays < 0) {
      remainingCard.classList.add("danger");
    } else if (remainingDays <= 3) {
      remainingCard.classList.add("danger");
    } else if (remainingDays <= 7) {
      remainingCard.classList.add("warning");
    }
  }

  // Update speed display (just the number)
  if (speedDisplayEl) {
    speedDisplayEl.textContent = speed || 4;
  }
}

// Go back to subscribers page
function goBackToSubscribers() {
  currentProfileSubscriberId = null;
  originalProfileUsername = null;
  originalProfileSpeed = null;
  localStorage.removeItem("currentProfileSubscriberId");
  window.location.hash = "subscribers";
}

function updateChangeUsernameSpeedPreview() {
  const usernameInput = document.getElementById("newUsernameInput");
  const targetSpeedEl = document.getElementById("newUsernameTargetSpeed");
  const hintEl = document.getElementById("newUsernameSpeedMatchHint");
  if (!usernameInput || !targetSpeedEl || !hintEl) return;

  const username = String(usernameInput.value || "").trim().toLowerCase();
  const targetSpeed = Number(targetSpeedEl.value || 4);
  if (!username) {
    hintEl.textContent = "اختر اسم مستخدم جديد وسرعة مطلوبة.";
    hintEl.style.color = "#64748b";
    return;
  }

  const actualSpeed = availableUsernameSpeedMap.get(username);
  if (!actualSpeed) {
    hintEl.textContent = "هذا الاسم غير موجود ضمن الأسماء المتاحة.";
    hintEl.style.color = "#dc2626";
    return;
  }

  if (actualSpeed !== targetSpeed) {
    hintEl.textContent = `الاسم متاح بسرعة ${actualSpeed} ميجا وليس ${targetSpeed} ميجا.`;
    hintEl.style.color = "#d97706";
    return;
  }

  hintEl.textContent = `ممتاز، الاسم متاح بسرعة ${actualSpeed} ميجا.`;
  hintEl.style.color = "#059669";
}

// Open import Excel modal
function openImportModal() {
  document.getElementById("importExcelModal").style.display = "flex";
}

// Close import Excel modal
function closeImportModal() {
  document.getElementById("importExcelModal").style.display = "none";
  // Reset the upload result
  document.getElementById("uploadResult").style.display = "none";
}

// Load available usernames into dropdown
async function loadAvailableUsernamesDropdown() {
  try {
    // Load both 4M and 8M usernames
    const response4M = await authenticatedFetch(
      "/api/subscribers/available-usernames?speed=4",
    );
    const response8M = await authenticatedFetch(
      "/api/subscribers/available-usernames?speed=8",
    );
    const result4M = await response4M.json();
    const result8M = await response8M.json();
    availableUsernameSpeedMap = new Map();

    const select = document.getElementById("availableUsernameSelect");
    select.innerHTML = '<option value="">اختر اسم مستخدم متاح...</option>';

    // Add 4M options
    if (result4M.success && result4M.data.length > 0) {
      const optgroup4M = document.createElement("optgroup");
      optgroup4M.label = "🔵 4 ميجا";
      result4M.data.forEach((u) => {
        const option = document.createElement("option");
        option.value = u.id;
        option.dataset.speed = "4";
        option.textContent = `${u.username}`;
        optgroup4M.appendChild(option);
        availableUsernameSpeedMap.set(
          String(u.username || "").toLowerCase(),
          4,
        );
      });
      select.appendChild(optgroup4M);
    }

    // Add 8M options
    if (result8M.success && result8M.data.length > 0) {
      const optgroup8M = document.createElement("optgroup");
      optgroup8M.label = "🟢 8 ميجا";
      result8M.data.forEach((u) => {
        const option = document.createElement("option");
        option.value = u.id;
        option.dataset.speed = "8";
        option.textContent = `${u.username}`;
        optgroup8M.appendChild(option);
        availableUsernameSpeedMap.set(
          String(u.username || "").toLowerCase(),
          8,
        );
      });
      select.appendChild(optgroup8M);
    }

    updateChangeUsernameSpeedPreview();
  } catch (error) {
    console.error("Error loading available usernames:", error);
  }
}

// Change subscriber username
async function changeSubscriberUsername() {
  if (!currentProfileSubscriberId) return;

  const newUsername = document.getElementById("newUsernameInput").value.trim();
  const newPassword = document.getElementById("newPasswordInput").value.trim();
  const targetSpeed =
    Number(document.getElementById("newUsernameTargetSpeed")?.value || 4) || 4;

  if (!newUsername) {
    alert("يرجى إدخال اسم المستخدم الجديد");
    return;
  }

  const actualSpeed = availableUsernameSpeedMap.get(newUsername.toLowerCase());
  if (!actualSpeed) {
    alert("اسم المستخدم غير متاح حالياً. اختر اسماً من الأسماء المتاحة.");
    return;
  }
  if (actualSpeed !== targetSpeed) {
    alert(
      `الاسم الذي أدخلته سرعته ${actualSpeed} ميجا. اختر السرعة المطابقة أو غيّر الاسم.`,
    );
    return;
  }

  if (!confirm("هل أنت متأكد من تغيير اسم المستخدم وكلمة المرور؟")) return;

  try {
    const response = await authenticatedFetch(
      `/api/subscribers/change-username/${currentProfileSubscriberId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newUsername, newPassword, targetSpeed }),
      },
    );

    const result = await response.json();

    if (result.success) {
      alert("تم تغيير اسم المستخدم وربطه بالسرعة بنجاح");
      // Clear inputs
      document.getElementById("newUsernameInput").value = "";
      document.getElementById("newPasswordInput").value = "";
      // Reload profile to reflect new speed/dates/history from backend.
      await openSubscriberProfile(currentProfileSubscriberId, true);
      loadSubscribers();
      loadAvailableUsernames();
      loadAvailableUsernamesDropdown();
      loadStats();
    } else {
      alert("خطأ في تغيير اسم المستخدم: " + result.message);
    }
  } catch (error) {
    console.error("Error changing username:", error);
    alert("خطأ في تغيير اسم المستخدم");
  }
}

// Assign available username to subscriber
async function assignAvailableUsername() {
  if (!currentProfileSubscriberId) {
    alert("لم يتم تحديد المشترك");
    return;
  }

  const availableUsernameId = document.getElementById(
    "availableUsernameSelect",
  ).value;

  console.log("Assigning username:", {
    subscriberId: currentProfileSubscriberId,
    availableUsernameId,
  });

  if (!availableUsernameId) {
    alert("يرجى اختيار اسم مستخدم متاح");
    return;
  }

  if (!confirm("هل أنت متأكد من تعيين هذا اسم المستخدم للمشترك؟")) return;

  try {
    const response = await authenticatedFetch(
      "/api/subscribers/assign-username",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriberId: currentProfileSubscriberId,
          availableUsernameId: availableUsernameId,
        }),
      },
    );

    const result = await response.json();

    if (result.success) {
      alert("تم تعيين اسم المستخدم بنجاح");
      // Reset dropdown
      document.getElementById("availableUsernameSelect").value = "";
      // Reload profile to reflect new speed/dates/history from backend.
      await openSubscriberProfile(currentProfileSubscriberId, true);
      loadSubscribers();
      loadAvailableUsernames();
      loadAvailableUsernamesDropdown();
      loadStats();
    } else {
      alert("خطأ في تعيين اسم المستخدم: " + result.message);
    }
  } catch (error) {
    console.error("Error assigning username:", error);
    alert("خطأ في تعيين اسم المستخدم");
  }
}

// ===========================================
// AVAILABLE USERNAMES SECTION FUNCTIONS
// ===========================================

let allAvailableUsernames = [];

// Load available usernames for both speeds
async function loadAvailableUsernames() {
  try {
    // Load 4M usernames
    const response4M = await authenticatedFetch(
      `/api/subscribers/available-usernames?speed=4`,
    );
    const result4M = await response4M.json();

    // Load 8M usernames
    const response8M = await authenticatedFetch(
      `/api/subscribers/available-usernames?speed=8`,
    );
    const result8M = await response8M.json();

    if (result4M.success) {
      displayAvailableUsernamesBySpeed(result4M.data, 4);
    }
    if (result8M.success) {
      displayAvailableUsernamesBySpeed(result8M.data, 8);
    }

    // Combine for dropdown
    allAvailableUsernames = [
      ...(result4M.data || []),
      ...(result8M.data || []),
    ];

    // Auto cleanup invalid entries
    await cleanupInvalidUsernames();
  } catch (error) {
    console.error("Error loading available usernames:", error);
    alert("خطأ في تحميل أسماء المستخدمين المتاحة");
  }
}

// Cleanup invalid usernames (headers that were accidentally imported)
async function cleanupInvalidUsernames() {
  try {
    await authenticatedFetch("/api/subscribers/available-usernames/cleanup", {
      method: "POST",
    });
  } catch (error) {
    // Silently ignore - this is just a cleanup
  }
}

// Current speed tab
let currentSpeedTab = 4;

// Switch speed tab
function switchSpeedTab(speed) {
  currentSpeedTab = speed;

  // Update tab buttons
  document.querySelectorAll(".speed-tab").forEach((tab) => {
    tab.classList.remove("active");
  });
  document
    .querySelector(`.speed-tab[data-speed="${speed}"]`)
    .classList.add("active");

  // Update panels
  document.querySelectorAll(".speed-panel").forEach((panel) => {
    panel.classList.remove("active");
  });
  document.getElementById(`panel-${speed}m`).classList.add("active");
}

// Display available usernames in table by speed
function displayAvailableUsernamesBySpeed(usernames, speed) {
  const tbody = document.getElementById(`availableUsernames${speed}MTableBody`);
  const countBadge = document.getElementById(`count${speed}M`);

  if (!tbody) return;

  tbody.innerHTML = "";

  // Update count badge
  if (countBadge) {
    countBadge.textContent = usernames ? usernames.length : 0;
  }

  if (!usernames || usernames.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-center">لا توجد أسماء مستخدمين متاحة</td></tr>';
    return;
  }

  usernames.forEach((u) => {
    const row = document.createElement("tr");
    const remainingDays = u.remainingDays !== undefined ? u.remainingDays : 31;
    const daysClass =
      remainingDays <= 7
        ? "days-warning"
        : remainingDays < 31
          ? "days-partial"
          : "days-full";
    row.innerHTML = `
      <td><strong>${u.username}</strong></td>
      <td><code>${u.password || "-"}</code></td>
      <td><span class="remaining-days-badge ${daysClass}">${remainingDays} يوم</span></td>
      <td>
        <div class="row-actions">
          <button class="row-btn edit" onclick="openEditAvailableUsername(${u.id}, '${u.username}', '${u.password || ""}')" title="تعديل">تعديل</button>
          <button class="row-btn delete" onclick="deleteAvailableUsername(${u.id})" title="حذف">حذف</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Open edit available username modal
function openEditAvailableUsername(id, username, password) {
  document.getElementById("editAvailableUsernameId").value = id;
  document.getElementById("editAvailableUsernameInput").value = username;
  document.getElementById("editAvailablePasswordInput").value = password;
  document.getElementById("editAvailableUsernameModal").style.display = "flex";
}

// Close edit available username modal
function closeEditAvailableUsernameModal() {
  document.getElementById("editAvailableUsernameModal").style.display = "none";
}

// Handle edit available username form submit
async function handleEditAvailableUsernameSubmit(e) {
  e.preventDefault();

  const id = document.getElementById("editAvailableUsernameId").value;
  const data = {
    username: document.getElementById("editAvailableUsernameInput").value,
    password: document.getElementById("editAvailablePasswordInput").value,
  };

  try {
    const response = await authenticatedFetch(
      `/api/subscribers/available-usernames/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    const result = await response.json();
    if (result.success) {
      closeEditAvailableUsernameModal();
      loadAvailableUsernames();
      alert("تم تحديث اسم المستخدم بنجاح");
    } else {
      alert("خطأ: " + result.message);
    }
  } catch (error) {
    console.error("Error updating available username:", error);
    alert("خطأ في تحديث اسم المستخدم");
  }
}

// Delete all available usernames by speed
async function deleteAllAvailableUsernamesBySpeed(speed) {
  if (
    !confirm(
      `هل أنت متأكد من حذف جميع أسماء المستخدمين المتاحة (${speed} ميجا)؟`,
    )
  )
    return;

  try {
    const response = await authenticatedFetch(
      `/api/subscribers/available-usernames/all?speed=${speed}`,
      {
        method: "DELETE",
      },
    );
    const result = await response.json();
    if (result.success) {
      loadAvailableUsernames();
      alert(`تم حذف ${result.deleted} اسم مستخدم`);
    } else {
      alert("خطأ: " + result.message);
    }
  } catch (error) {
    console.error("Error deleting all available usernames:", error);
    alert("خطأ في حذف أسماء المستخدمين");
  }
}

// Show add available username form
function showAddAvailableUsernameForm(speed) {
  document.getElementById("addUsernameModal").style.display = "flex";
  document.getElementById("availableUsernameSpeed").value =
    speed || currentSpeedTab;
  document.getElementById("modalSpeedLabel").textContent =
    `(${speed || currentSpeedTab} ميجا)`;
}

// Hide add available username form
function hideAvailableUsernameForm() {
  document.getElementById("addUsernameModal").style.display = "none";
  document.getElementById("availableUsernameFormElement").reset();
}

// Show upload available usernames area
function showUploadAvailableUsernamesArea(speed) {
  document.getElementById("uploadModal").style.display = "flex";
  document.getElementById("uploadAvailableUsernamesSpeed").value =
    speed || currentSpeedTab;
  document.getElementById("uploadSpeedLabel").textContent =
    `(${speed || currentSpeedTab} ميجا)`;
}

// Hide upload available usernames area
function hideUploadAvailableUsernamesArea() {
  document.getElementById("uploadModal").style.display = "none";
}

// Add single available username
async function addAvailableUsername(e) {
  e.preventDefault();

  const username = document.getElementById("availableUsername").value.trim();
  const password = document.getElementById("availablePassword").value.trim();
  const speed = document.getElementById("availableUsernameSpeed").value;

  if (!username) {
    alert("يرجى إدخال اسم المستخدم");
    return;
  }

  try {
    const response = await authenticatedFetch(
      "/api/subscribers/available-usernames",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, speed }),
      },
    );

    const result = await response.json();

    if (result.success) {
      alert("تمت إضافة اسم المستخدم بنجاح");
      hideAvailableUsernameForm();
      document.getElementById("availableUsernameFormElement").reset();
      loadAvailableUsernames();
    } else {
      alert("خطأ في إضافة اسم المستخدم: " + result.message);
    }
  } catch (error) {
    console.error("Error adding available username:", error);
    alert("خطأ في إضافة اسم المستخدم");
  }
}

// Delete available username
async function deleteAvailableUsername(id) {
  if (!confirm("هل أنت متأكد من حذف اسم المستخدم هذا؟")) return;

  try {
    const response = await authenticatedFetch(
      `/api/subscribers/available-usernames/${id}`,
      {
        method: "DELETE",
      },
    );

    const result = await response.json();

    if (result.success) {
      alert("تم حذف اسم المستخدم بنجاح");
      loadAvailableUsernames();
    } else {
      alert("خطأ في حذف اسم المستخدم: " + result.message);
    }
  } catch (error) {
    console.error("Error deleting available username:", error);
    alert("خطأ في حذف اسم المستخدم");
  }
}

// Upload available usernames from Excel
async function uploadAvailableUsernamesExcel(files) {
  if (!files || files.length === 0) return;

  const file = files[0];
  const speed = document.getElementById("uploadAvailableUsernamesSpeed").value;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("speed", speed);

  try {
    const response = await authenticatedFetch(
      "/api/subscribers/available-usernames/upload",
      {
        method: "POST",
        body: formData,
      },
    );

    const result = await response.json();

    if (result.success) {
      // Close modal first
      hideUploadAvailableUsernamesArea();
      // Reload data immediately
      await loadAvailableUsernames();
      // Show success message
      alert(
        `تم استيراد ${result.added} اسم مستخدم بنجاح${result.skipped > 0 ? ` (تم تخطي ${result.skipped})` : ""}`,
      );
    } else {
      alert("خطأ في استيراد الملف: " + result.message);
    }
  } catch (error) {
    console.error("Error uploading available usernames:", error);
    alert("خطأ في استيراد الملف");
  }
}

// Setup event listeners for new features
function setupNewFeatureListeners() {
  // Profile edit form submit
  document
    .getElementById("profileEditForm")
    ?.addEventListener("submit", handleProfileEditSubmit);
  document
    .getElementById("profileFacilityType")
    ?.addEventListener("change", () => {
      toggleFacilityTypeOther("profileFacilityType", "profileFacilityTypeOther");
    });

  // Profile modal buttons
  document
    .getElementById("changeUsernameBtn")
    ?.addEventListener("click", changeSubscriberUsername);
  document
    .getElementById("newUsernameInput")
    ?.addEventListener("input", updateChangeUsernameSpeedPreview);
  document
    .getElementById("newUsernameTargetSpeed")
    ?.addEventListener("change", updateChangeUsernameSpeedPreview);
  document
    .getElementById("assignAvailableUsernameBtn")
    ?.addEventListener("click", assignAvailableUsername);

  // Username history manual CRUD
  document
    .getElementById("toggleAddHistoryBtn")
    ?.addEventListener("click", toggleAddHistoryForm);
  document
    .getElementById("saveHistoryEntryBtn")
    ?.addEventListener("click", saveNewHistoryEntry);
  document
    .getElementById("cancelAddHistoryBtn")
    ?.addEventListener("click", closeAddHistoryForm);

  // Available usernames section
  document
    .getElementById("availableUsernameFormElement")
    ?.addEventListener("submit", addAvailableUsername);
  document
    .getElementById("editAvailableUsernameForm")
    ?.addEventListener("submit", handleEditAvailableUsernameSubmit);

  // SMS form
  document
    .getElementById("smsForm")
    ?.addEventListener("submit", handleSmsSubmit);

  // SMS search input handlers
  const smsSearch = document.getElementById("smsSubscriberSearch");
  if (smsSearch) {
    smsSearch.addEventListener("input", (e) => {
      showSmsSuggestions(e.target.value || "");
    });

    smsSearch.addEventListener("keydown", (e) => {
      const suggestions = document.getElementById("smsSuggestions");
      if (!suggestions) return;
      const items = Array.from(suggestions.querySelectorAll("li"));
      const activeIdx = items.findIndex((it) =>
        it.classList.contains("active"),
      );

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next =
          items[Math.min(items.length - 1, Math.max(0, activeIdx + 1))];
        items.forEach((it) => it.classList.remove("active"));
        if (next) next.classList.add("active");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = items[Math.max(0, activeIdx - 1)];
        items.forEach((it) => it.classList.remove("active"));
        if (prev) prev.classList.add("active");
      } else if (e.key === "Enter") {
        const active = items[activeIdx];
        if (active) {
          e.preventDefault();
          active.click();
        }
      } else if (e.key === "Escape") {
        suggestions.innerHTML = "";
      }
    });
  }

  // SMS recipient type toggle
  const recipientRadios = document.querySelectorAll(
    'input[name="smsRecipientType"]',
  );
  if (recipientRadios.length) {
    const subscriberGroup = document.getElementById("smsSubscriberGroup");
    const customGroup = document.getElementById("smsCustomPhoneGroup");
    const searchInput = document.getElementById("smsSubscriberSearch");
    const suggestions = document.getElementById("smsSuggestions");
    const customPhone = document.getElementById("smsCustomPhone");

    recipientRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        const value = radio.value;
        if (value === "subscriber") {
          if (subscriberGroup) subscriberGroup.style.display = "";
          if (customGroup) customGroup.style.display = "none";
          if (customPhone) customPhone.value = "";
        } else if (value === "custom") {
          if (subscriberGroup) subscriberGroup.style.display = "none";
          if (customGroup) customGroup.style.display = "";
          if (searchInput) searchInput.value = "";
          if (suggestions) {
            suggestions.innerHTML = "";
            suggestions.style.display = "none";
          }
        }
      });
    });
  }

  document
    .getElementById("smsClearSelectedBtn")
    ?.addEventListener("click", () => {
      selectedSmsRecipients.clear();
      renderSmsSelectedRecipients();
    });

  // SMS message character counter
  const smsMessage = document.getElementById("smsMessage");
  const smsCharCounter = document.getElementById("smsCharCount");
  if (smsMessage && smsCharCounter) {
    const updateCounter = () => {
      const max = smsMessage.getAttribute("maxlength") || 320;
      const current = smsMessage.value.length;
      smsCharCounter.textContent = `${current} / ${max}`;
    };
    smsMessage.addEventListener("input", updateCounter);
    updateCounter();
  }

  // Click outside to close suggestions
  document.addEventListener("click", (e) => {
    const wrapper = document.querySelector(".search-wrapper");
    if (!wrapper) return;
    if (!wrapper.contains(e.target)) {
      const suggestions = document.getElementById("smsSuggestions");
      if (suggestions) suggestions.innerHTML = "";
    }
  });

  // File upload for available usernames
  const chooseAvailableBtn = document.getElementById(
    "chooseAvailableUsernamesFileBtn",
  );
  const availableFileInput = document.getElementById("availableUsernamesFile");

  if (chooseAvailableBtn && availableFileInput) {
    chooseAvailableBtn.addEventListener("click", () => {
      availableFileInput.value = "";
      availableFileInput.click();
    });

    availableFileInput.addEventListener("change", (e) => {
      uploadAvailableUsernamesExcel(e.target.files);
    });
  }

  // Close modals when clicking outside
  document.querySelectorAll(".modal-overlay").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.style.display = "none";
      }
    });
  });
}

// Handle profile edit form submit
async function handleProfileEditSubmit(e) {
  e.preventDefault();

  if (!currentProfileSubscriberId) return;

  const formData = {
    password: document.getElementById("profilePassword").value,
    fullName: document.getElementById("profileFullName").value,
    facilityType: getFacilityTypeValue(
      "profileFacilityType",
      "profileFacilityTypeOther",
    ),
    phone: document.getElementById("profilePhone").value,
    package: document.getElementById("profilePackage").value,
    startDate: normalizeProfileDateForApi(
      document.getElementById("profileStartDate").value,
    ),
    firstContactDate:
      normalizeProfileDateForApi(
        document.getElementById("profileFirstContactDate").value,
      ) || null,
    notes: document.getElementById("profileNotes").value,
  };

  if (
    document.getElementById("profileFacilityType")?.value === "أخرى" &&
    !formData.facilityType
  ) {
    alert("يرجى كتابة نوع المنشأة عند اختيار (أخرى)");
    return;
  }

  try {
    const response = await authenticatedFetch(
      `/api/subscribers/${currentProfileSubscriberId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      },
    );

    const result = await response.json();

    if (result.success) {
      alert("تم حفظ التعديلات بنجاح");

      // Update all profile fields from response data
      if (result.data) {
        // Update username and password (important for speed change)
        if (result.data.username) {
          document.getElementById("profileUsername").value =
            result.data.username;
          originalProfileUsername = result.data.username;
        }
        if (result.data.password) {
          document.getElementById("profilePassword").value =
            result.data.password;
        }

        // Update dates in profile if they were changed (speed change resets them)
        if (result.data.disconnectionDate) {
          document.getElementById("profileDisconnectionDate").value =
            formatDateForProfileDisplay(result.data.disconnectionDate);
        }
        if (result.data.startDate) {
          document.getElementById("profileStartDate").value =
            formatDateForProfileDisplay(result.data.startDate);
        }
        if (result.data.firstContactDate) {
          document.getElementById("profileFirstContactDate").value =
            formatDateForProfileDisplay(result.data.firstContactDate);
          // Update timer display with new dates
          updateProfileTimer(
            result.data.firstContactDate,
            result.data.disconnectionDate,
            result.data.speed,
          );
        }
        if (result.data.speed !== undefined) {
          document.getElementById("profileSpeed").value = `${result.data.speed} ميجا`;
        }
      }
      loadSubscribers(); // Refresh the list
      loadStats(); // Refresh stats
    } else {
      alert("خطأ في حفظ التعديلات: " + result.message);
    }
  } catch (error) {
    console.error("Error updating subscriber:", error);
    alert("خطأ في حفظ التعديلات");
  }
}

// =============================================
// USERNAME HISTORY MANUAL CRUD
// =============================================

// Toggle add history form
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
  // Clear fields
  document.getElementById("historyOldUsername").value = "";
  document.getElementById("historyOldPassword").value = "";
  document.getElementById("historyStartDate").value = "";
  document.getElementById("historyEndDate").value = "";
  // Reset if was in edit mode
  const saveBtn = document.getElementById("saveHistoryEntryBtn");
  saveBtn.onclick = null;
  saveBtn.onclick = function () {
    saveNewHistoryEntry();
  };
  saveBtn.innerHTML = '<i class="fas fa-check"></i> حفظ';
}

// Save a new history entry
async function saveNewHistoryEntry() {
  const subscriberId = document.getElementById("profileEditId").value;
  const oldUsername = document
    .getElementById("historyOldUsername")
    .value.trim();
  const oldPassword = document
    .getElementById("historyOldPassword")
    .value.trim();
  const startDate = document.getElementById("historyStartDate").value;
  const endDate = document.getElementById("historyEndDate").value;

  if (!oldUsername) {
    showToast("اسم المستخدم القديم مطلوب", "error");
    return;
  }

  try {
    const response = await fetch(
      `/api/subscribers/username-history/${subscriberId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          old_username: oldUsername,
          old_password: oldPassword || null,
          usage_start_date: startDate || null,
          usage_end_date: endDate || null,
        }),
      },
    );

    const result = await response.json();
    if (result.success) {
      closeAddHistoryForm();
      await openSubscriberProfile(subscriberId, true);
      showToast("تم إضافة السجل بنجاح", "success");
    } else {
      showToast(result.message || "خطأ في إضافة السجل", "error");
    }
  } catch (error) {
    console.error("Error adding history entry:", error);
    showToast("خطأ في إضافة السجل", "error");
  }
}

// Add a history entry to the DOM
function addHistoryEntryToDOM(entry) {
  const historyList = document.getElementById("usernameHistoryList");
  if (!historyList) return;

  // Remove empty message if present
  const emptyMsg = historyList.querySelector(".profile-history-empty");
  if (emptyMsg) {
    historyList.innerHTML = "";
  }

  const startDateStr = entry.usage_start_date
    ? entry.usage_start_date.split("T")[0]
    : "";
  const endDateStr = entry.usage_end_date
    ? entry.usage_end_date.split("T")[0]
    : "";

  const newItem = document.createElement("div");
  newItem.className = "profile-history-item";
  newItem.setAttribute("data-history-id", entry.id);
  newItem.innerHTML = `
    <div class="profile-history-main">
      <span class="profile-history-username">${entry.old_username}</span>
      <div class="profile-history-actions-inline">
        <span class="profile-history-password">${entry.old_password || "-"}</span>
        <button type="button" class="history-action-btn history-edit-btn" onclick="editHistoryEntry(${entry.id}, '${(entry.old_username || "").replace(/'/g, "\\'")}', '${(entry.old_password || "").replace(/'/g, "\\'")}', '${startDateStr}', '${endDateStr}')" title="تعديل">
          <i class="fas fa-pen"></i>
        </button>
        <button type="button" class="history-action-btn history-delete-btn" onclick="deleteHistoryEntry(${entry.id})" title="حذف">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
    <div class="profile-history-dates">
      <span>من: ${formatDate(entry.usage_start_date) || "-"}</span>
      <span>إلى: ${formatDate(entry.usage_end_date) || "-"}</span>
    </div>
  `;

  // Add with animation
  newItem.style.opacity = "0";
  newItem.style.transform = "translateY(-10px)";
  historyList.insertBefore(newItem, historyList.firstChild);

  setTimeout(() => {
    newItem.style.transition = "all 0.3s ease";
    newItem.style.opacity = "1";
    newItem.style.transform = "translateY(0)";
  }, 10);
}

// Edit a history entry - populate the form with existing data
function editHistoryEntry(
  historyId,
  oldUsername,
  oldPassword,
  startDate,
  endDate,
) {
  const form = document.getElementById("addHistoryForm");
  const btn = document.getElementById("toggleAddHistoryBtn");

  // Show form
  form.style.display = "block";
  btn.innerHTML = '<i class="fas fa-times"></i>';
  btn.classList.add("active");

  // Fill fields
  document.getElementById("historyOldUsername").value = oldUsername || "";
  document.getElementById("historyOldPassword").value = oldPassword || "";
  document.getElementById("historyStartDate").value = startDate || "";
  document.getElementById("historyEndDate").value = endDate || "";

  // Change save button to update mode
  const saveBtn = document.getElementById("saveHistoryEntryBtn");
  saveBtn.innerHTML = '<i class="fas fa-save"></i> تحديث';
  saveBtn.onclick = function () {
    updateHistoryEntry(historyId);
  };

  // Scroll to form
  form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  document.getElementById("historyOldUsername").focus();
}

// Update an existing history entry
async function updateHistoryEntry(historyId) {
  const subscriberId = document.getElementById("profileEditId").value;
  const oldUsername = document
    .getElementById("historyOldUsername")
    .value.trim();
  const oldPassword = document
    .getElementById("historyOldPassword")
    .value.trim();
  const startDate = document.getElementById("historyStartDate").value;
  const endDate = document.getElementById("historyEndDate").value;

  if (!oldUsername) {
    showToast("اسم المستخدم القديم مطلوب", "error");
    return;
  }

  try {
    const response = await fetch(
      `/api/subscribers/username-history/${historyId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          old_username: oldUsername,
          old_password: oldPassword || null,
          usage_start_date: startDate || null,
          usage_end_date: endDate || null,
        }),
      },
    );

    const result = await response.json();
    if (result.success) {
      closeAddHistoryForm();
      await openSubscriberProfile(subscriberId, true);
      showToast("تم تحديث السجل بنجاح", "success");
    } else {
      showToast(result.message || "خطأ في تحديث السجل", "error");
    }
  } catch (error) {
    console.error("Error updating history entry:", error);
    showToast("خطأ في تحديث السجل", "error");
  }
}

// Update a history entry in the DOM
function updateHistoryEntryInDOM(historyId, data) {
  const historyItem = document.querySelector(
    `.profile-history-item[data-history-id="${historyId}"]`,
  );
  if (!historyItem) return;

  const startDateStr = data.usage_start_date || "";
  const endDateStr = data.usage_end_date || "";

  historyItem.innerHTML = `
    <div class="profile-history-main">
      <span class="profile-history-username">${data.old_username}</span>
      <div class="profile-history-actions-inline">
        <span class="profile-history-password">${data.old_password || "-"}</span>
        <button type="button" class="history-action-btn history-edit-btn" onclick="editHistoryEntry(${historyId}, '${(data.old_username || "").replace(/'/g, "\\'")}', '${(data.old_password || "").replace(/'/g, "\\'")}', '${startDateStr}', '${endDateStr}')" title="تعديل">
          <i class="fas fa-pen"></i>
        </button>
        <button type="button" class="history-action-btn history-delete-btn" onclick="deleteHistoryEntry(${historyId})" title="حذف">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
    <div class="profile-history-dates">
      <span>من: ${formatDate(data.usage_start_date) || "-"}</span>
      <span>إلى: ${formatDate(data.usage_end_date) || "-"}</span>
    </div>
  `;

  // Flash animation to show update
  historyItem.style.background = "#e0f2fe";
  setTimeout(() => {
    historyItem.style.transition = "background 0.5s ease";
    historyItem.style.background = "";
  }, 100);
}

// Delete a history entry
function deleteHistoryEntry(historyId) {
  showConfirm("هل تريد حذف هذا السجل؟", async () => {
    const subscriberId = document.getElementById("profileEditId").value;

    try {
      const response = await fetch(
        `/api/subscribers/username-history/${historyId}`,
        {
          method: "DELETE",
        },
      );

      const result = await response.json();
      if (result.success) {
        await openSubscriberProfile(subscriberId, true);
        showToast("تم حذف السجل بنجاح", "success");
      } else {
        showToast(result.message || "خطأ في حذف السجل", "error");
      }
    } catch (error) {
      console.error("Error deleting history entry:", error);
      showToast("خطأ في حذف السجل", "error");
    }
  });
}

// Remove a history entry from the DOM
function removeHistoryEntryFromDOM(historyId) {
  const historyItem = document.querySelector(
    `.profile-history-item[data-history-id="${historyId}"]`,
  );
  if (!historyItem) return;

  historyItem.style.transition = "all 0.3s ease";
  historyItem.style.opacity = "0";
  historyItem.style.transform = "translateX(20px)";

  setTimeout(() => {
    historyItem.remove();

    // Check if list is now empty
    const historyList = document.getElementById("usernameHistoryList");
    if (historyList && historyList.children.length === 0) {
      historyList.innerHTML =
        '<div class="profile-history-empty">لا توجد بيانات سابقة</div>';
    }
  }, 300);
}

// =====================
// STOPPED SUBSCRIBERS
// =====================
let selectedStoppedIds = new Set();

function setupStoppedSubscribersListeners() {
  document
    .getElementById("selectAllStoppedCheckbox")
    ?.addEventListener("change", handleSelectAllStopped);
  document
    .getElementById("reactivateSelectedStoppedBtn")
    ?.addEventListener("click", reactivateSelectedStoppedSubscribers);
}

// Load stopped subscribers
async function loadStoppedSubscribers() {
  try {
    selectedStoppedIds.clear();
    const selectAll = document.getElementById("selectAllStoppedCheckbox");
    if (selectAll) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    }

    const response = await authenticatedFetch("/api/subscribers/stopped");
    const result = await response.json();

    if (result.success) {
      displayStoppedSubscribers(result.data);
    } else {
      console.error("Error loading stopped subscribers:", result.message);
    }
  } catch (error) {
    console.error("Error loading stopped subscribers:", error);
  }
}

// Display stopped subscribers in table
function displayStoppedSubscribers(subscribers) {
  const tbody = document.getElementById("stoppedSubscribersTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!subscribers || subscribers.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center">لا يوجد مشتركين متوقفين</td></tr>';
    updateStoppedSelectionUI();
    return;
  }

  subscribers.forEach((s) => {
    const row = document.createElement("tr");
    const stoppedDate = s.stoppedAt
      ? new Date(s.stoppedAt).toLocaleDateString("ar-EG")
      : "-";
    row.innerHTML = `
      <td class="checkbox-col">
        <input type="checkbox" class="stopped-checkbox" data-id="${s.id}" ${selectedStoppedIds.has(s.id) ? "checked" : ""} onchange="handleStoppedCheckboxChange(this)">
      </td>
      <td><strong>${s.fullName || "-"}</strong></td>
      <td>${s.username || "-"}</td>
      <td>${s.phone || "-"}</td>
      <td>${s.speed || 4} ميجا</td>
      <td>${stoppedDate}</td>
      <td>${s.stoppedReason || "-"}</td>
      <td>
        <div class="row-actions">
          <button class="row-btn edit" onclick="reactivateSubscriber('${s.id}')" title="إعادة تفعيل">إعادة تفعيل</button>
          <button class="row-btn delete" onclick="deleteStoppedSubscriber('${s.id}')" title="حذف نهائي">حذف</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });

  updateStoppedSelectionUI();
}

function handleStoppedCheckboxChange(checkbox) {
  const id = checkbox.dataset.id;
  if (checkbox.checked) {
    selectedStoppedIds.add(id);
  } else {
    selectedStoppedIds.delete(id);
  }
  updateStoppedSelectionUI();
}

function handleSelectAllStopped(e) {
  const checkboxes = document.querySelectorAll(".stopped-checkbox");
  checkboxes.forEach((cb) => {
    cb.checked = e.target.checked;
    const id = cb.dataset.id;
    if (e.target.checked) {
      selectedStoppedIds.add(id);
    } else {
      selectedStoppedIds.delete(id);
    }
  });
  updateStoppedSelectionUI();
}

function updateStoppedSelectionUI() {
  const countEl = document.getElementById("selectedStoppedCount");
  const bulkBtn = document.getElementById("reactivateSelectedStoppedBtn");
  const selectAll = document.getElementById("selectAllStoppedCheckbox");
  const checkboxes = document.querySelectorAll(".stopped-checkbox");

  if (countEl) countEl.textContent = selectedStoppedIds.size;
  if (bulkBtn) {
    bulkBtn.style.display = selectedStoppedIds.size > 0 ? "inline-block" : "none";
  }

  if (selectAll) {
    const checkedCount = Array.from(checkboxes).filter((cb) => cb.checked).length;
    selectAll.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
  }
}

async function reactivateSelectedStoppedSubscribers() {
  if (selectedStoppedIds.size === 0) return;
  if (!confirm(`هل أنت متأكد من إعادة تفعيل ${selectedStoppedIds.size} مشترك؟`))
    return;

  try {
    const response = await authenticatedFetch("/api/subscribers/reactivate-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedStoppedIds) }),
    });
    const result = await response.json();

    if (result.success) {
      selectedStoppedIds.clear();
      updateStoppedSelectionUI();
      showToast(result.message || "تمت إعادة التفعيل بنجاح", "success");
      loadStoppedSubscribers();
      loadSubscribers();
      loadStats();
      loadAvailableUsernames();
    } else {
      showToast(result.message || "فشل في إعادة التفعيل", "error");
    }
  } catch (error) {
    console.error("Error bulk reactivating stopped subscribers:", error);
    showToast("خطأ في إعادة التفعيل الجماعي", "error");
  }
}

// Open stop subscriber modal
function openStopSubscriberModal() {
  document.getElementById("stopReasonInput").value = "";
  document.getElementById("stopSubscriberModal").style.display = "flex";
}

// Close stop subscriber modal
function closeStopSubscriberModal() {
  document.getElementById("stopSubscriberModal").style.display = "none";
}

// Confirm stop subscriber
async function confirmStopSubscriber() {
  if (!currentProfileSubscriberId) {
    alert("خطأ: لم يتم تحديد المشترك");
    return;
  }

  const reason = document.getElementById("stopReasonInput").value.trim();

  try {
    const response = await authenticatedFetch(
      `/api/subscribers/stop/${currentProfileSubscriberId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      },
    );

    const result = await response.json();

    if (result.success) {
      closeStopSubscriberModal();
      alert("تم إيقاف المشترك بنجاح");
      goBackToSubscribers();
      loadSubscribers();
      loadStats();
    } else {
      alert("خطأ: " + result.message);
    }
  } catch (error) {
    console.error("Error stopping subscriber:", error);
    alert("خطأ في إيقاف المشترك");
  }
}

// Reactivate stopped subscriber
async function reactivateSubscriber(id) {
  if (!confirm("هل أنت متأكد من إعادة تفعيل هذا المشترك؟")) return;

  try {
    const response = await authenticatedFetch(
      `/api/subscribers/reactivate/${id}`,
      { method: "POST" },
    );

    const result = await response.json();

    if (result.success) {
      alert("تم إعادة تفعيل المشترك بنجاح");
      loadStoppedSubscribers();
      loadSubscribers();
      loadStats();
    } else {
      alert("خطأ: " + result.message);
    }
  } catch (error) {
    console.error("Error reactivating subscriber:", error);
    alert("خطأ في إعادة تفعيل المشترك");
  }
}

// Delete stopped subscriber permanently
async function deleteStoppedSubscriber(id) {
  if (
    !confirm(
      "هل أنت متأكد من حذف هذا المشترك نهائياً؟ لا يمكن التراجع عن هذا الإجراء.",
    )
  )
    return;

  try {
    const response = await authenticatedFetch(
      `/api/subscribers/stopped/${id}`,
      { method: "DELETE" },
    );

    const result = await response.json();

    if (result.success) {
      alert("تم حذف المشترك نهائياً");
      loadStoppedSubscribers();
    } else {
      alert("خطأ: " + result.message);
    }
  } catch (error) {
    console.error("Error deleting stopped subscriber:", error);
    alert("خطأ في حذف المشترك");
  }
}

// Update switchSection to load available usernames and stopped subscribers
const originalSwitchSection = switchSection;
switchSection = async function (sectionId) {
  originalSwitchSection(sectionId);

  if (sectionId === "available-usernames") {
    loadAvailableUsernames();
  } else if (sectionId === "stopped-subscribers") {
    loadStoppedSubscribers();
  } else if (sectionId === "expiring-usernames") {
    loadExpiringUsernames();
  } else if (sectionId === "sms") {
    // Load subscribers then populate dropdown for SMS
    await loadSubscribers(1, "");
    populateSmsSubscriberDropdown();
  }
};

// Initialize new features after DOM loaded
document.addEventListener("DOMContentLoaded", () => {
  setupNewFeatureListeners();
  setupExpiringUsernamesListeners();
  setupStoppedSubscribersListeners();
});

// SMS helpers: populate dropdown and handle sending
// SMS recipients cache used by suggestions
let smsRecipients = [];
let selectedSmsRecipients = new Map();
let pendingSmsPrefillRecipients = [];

function populateSmsSubscriberDropdown() {
  try {
    smsRecipients = [];
    const list = typeof allSubscribers !== "undefined" ? allSubscribers : [];
    list.forEach((sub) => {
      const phone = (sub.phone || "").toString().trim();
      if (!phone) return;
      const label = `${sub.fullName || sub.username || "مشترك"} — ${phone}`;
      smsRecipients.push({
        id: String(sub._id || sub.id || phone),
        label,
        name: sub.fullName || sub.username || "مشترك",
        phone,
      });
    });

    // Reset search input
    const searchInput = document.getElementById("smsSubscriberSearch");
    const suggestions = document.getElementById("smsSuggestions");
    if (searchInput) searchInput.value = "";
    if (suggestions) {
      suggestions.innerHTML = "";
      suggestions.style.display = "none";
    }
    renderSmsSelectedRecipients();
    applyPendingSmsPrefill();
  } catch (e) {
    console.error("populateSmsSubscriberDropdown error:", e);
  }
}

function showSmsSuggestions(query) {
  const suggestions = document.getElementById("smsSuggestions");
  if (!suggestions) return;
  suggestions.innerHTML = "";
  suggestions.style.display = "none";
  if (!query) return;

  const q = query.toString().trim().toLowerCase();
  const matches = smsRecipients.filter(
    (r) =>
      !selectedSmsRecipients.has(r.phone) &&
      (r.label.toLowerCase().includes(q) || r.phone.includes(q)),
  );

  // Limit to 25 results
  matches.slice(0, 25).forEach((m, idx) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.dataset.phone = m.phone;
    li.innerHTML = `<span class=\"suggestion-name\">${escapeHtml(m.label.split(" — ")[0])}</span><span class=\"suggestion-phone\">${escapeHtml(m.phone)}</span>`;
    li.addEventListener("click", () => {
      selectSmsRecipient(m);
    });
    suggestions.appendChild(li);
  });

  if (matches.length > 0) {
    suggestions.style.display = "block";
  } else {
    suggestions.style.display = "none";
  }
}

function selectSmsRecipient(item) {
  const searchInput = document.getElementById("smsSubscriberSearch");
  const suggestions = document.getElementById("smsSuggestions");
  if (searchInput) searchInput.value = item.label;
  selectedSmsRecipients.set(item.phone, item);
  renderSmsSelectedRecipients();
  if (suggestions) {
    suggestions.innerHTML = "";
    suggestions.style.display = "none";
  }
}

function renderSmsSelectedRecipients() {
  const container = document.getElementById("smsSelectedRecipients");
  const badge = document.getElementById("smsSelectedCountBadge");
  const clearBtn = document.getElementById("smsClearSelectedBtn");
  if (!container || !badge) return;

  const selected = Array.from(selectedSmsRecipients.values());
  badge.textContent = `المحددون: ${selected.length}`;
  if (clearBtn) {
    clearBtn.style.display = selected.length > 0 ? "inline-flex" : "none";
  }

  if (selected.length === 0) {
    container.innerHTML =
      '<div class="sms-empty-selected">لا يوجد مشتركون محددون حالياً</div>';
    return;
  }

  container.innerHTML = selected
    .map(
      (item) => `
      <div class="sms-recipient-chip">
        <span class="sms-recipient-name">${escapeHtml(item.name || "مشترك")}</span>
        <span class="sms-recipient-phone">${escapeHtml(item.phone)}</span>
        <button type="button" class="sms-chip-remove" onclick="removeSmsRecipient('${String(item.phone).replace(/'/g, "\\'")}')">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `,
    )
    .join("");
}

function removeSmsRecipient(phone) {
  selectedSmsRecipients.delete(phone);
  renderSmsSelectedRecipients();
}

function applyPendingSmsPrefill() {
  if (!Array.isArray(pendingSmsPrefillRecipients)) return;
  if (pendingSmsPrefillRecipients.length === 0) return;

  pendingSmsPrefillRecipients.forEach((incoming) => {
    const phone = String(incoming.phone || "").trim();
    if (!phone) return;
    selectedSmsRecipients.set(phone, {
      id: incoming.id || phone,
      name: incoming.name || "مشترك",
      label: `${incoming.name || "مشترك"} — ${phone}`,
      phone,
    });
  });

  pendingSmsPrefillRecipients = [];
  renderSmsSelectedRecipients();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function handleSmsSubmit(e) {
  try {
    e.preventDefault();
    const customPhoneInput = document.getElementById("smsCustomPhone");
    const recipientType =
      document.querySelector('input[name="smsRecipientType"]:checked')
        ?.value || "subscriber";
    const messageEl = document.getElementById("smsMessage");
    if (!messageEl) return;

    let phone = "";
    let phones = [];
    if (recipientType === "custom" && customPhoneInput) {
      phone = customPhoneInput.value.trim();
    } else {
      phones = Array.from(selectedSmsRecipients.values()).map((item) =>
        String(item.phone || "").trim(),
      );
    }

    const message = messageEl.value.trim();

    if (!message) {
      showToast("يرجى كتابة نص الرسالة قبل الإرسال", "error");
      return;
    }

    if (recipientType === "subscriber" && phones.length === 0) {
      showToast("يرجى اختيار مشترك واحد على الأقل", "error");
      return;
    }

    if (recipientType === "custom" && !phone) {
      showToast("يرجى إدخال رقم الجوال ثم المحاولة مرة أخرى", "error");
      return;
    }

    const payload =
      recipientType === "custom" ? { phone, message } : { phones, message };
    const response = await authenticatedFetch("/api/subscribers/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (result.success) {
      if (recipientType === "subscriber") {
        const sentCount = result?.data?.sentCount ?? phones.length;
        const failedCount = result?.data?.failedCount ?? 0;
        showToast(
          failedCount > 0
            ? `تم إرسال ${sentCount} وفشل ${failedCount}`
            : `تم إرسال الرسالة إلى ${sentCount} مشترك`,
          failedCount > 0 ? "warning" : "success",
        );
      } else {
        showToast("تم إرسال الرسالة بنجاح", "success");
      }
      messageEl.value = "";
      if (recipientType === "subscriber") {
        selectedSmsRecipients.clear();
        renderSmsSelectedRecipients();
      }
    } else {
      showToast(result.message || "فشل الإرسال", "error");
    }
  } catch (err) {
    console.error("Error sending SMS:", err);
    showToast("خطأ في إرسال الرسالة. الرجاء المحاولة لاحقاً.", "error");
  }
}

// ===========================================
// EXPIRING USERNAMES SECTION
// ===========================================

let expiringUsernamesData = [];
let selectedExpiringIds = new Set();
const SPECIAL_RESET_USERNAME = "5962963140PP";

function setupExpiringUsernamesListeners() {
  // Select all checkbox
  document
    .getElementById("selectAllExpiringCheckbox")
    ?.addEventListener("change", handleSelectAllExpiring);

  // Bulk change button
  document
    .getElementById("bulkChangeUsernamesBtn")
    ?.addEventListener("click", openBulkChangeUsernamesModal);

  document
    .getElementById("sendExpiringSmsBtn")
    ?.addEventListener("click", sendSelectedExpiringToSms);

  // Speed filters
  document
    .getElementById("expiring4MFilter")
    ?.addEventListener("change", filterExpiringUsernames);
  document
    .getElementById("expiring8MFilter")
    ?.addEventListener("change", filterExpiringUsernames);

  // Speed selection in modal
  document
    .getElementById("bulkChangeSpeed")
    ?.addEventListener("change", updateAvailableCountForBulk);

  // Live search by old username (without button click)
  document.getElementById("oldUsernameSearchInput")?.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => searchByOldUsername(true), 300);
  });

  document
    .getElementById("oldUsernameSearchInput")
    ?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        clearTimeout(searchTimeout);
        searchByOldUsername();
      }
    });
}

// Load expiring usernames
async function loadExpiringUsernames() {
  try {
    const response = await authenticatedFetch(
      "/api/subscribers/expiring-usernames",
    );
    const result = await response.json();

    if (result.success) {
      expiringUsernamesData = result.data;
      filterExpiringUsernames();
    }
  } catch (error) {
    console.error("Error loading expiring usernames:", error);
    alert("خطأ في تحميل البيانات");
  }
}

// Filter expiring usernames by speed
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

// Display expiring usernames in table
function displayExpiringUsernames(subscribers) {
  const tableBody = document.getElementById("expiringUsernamesTableBody");
  if (!tableBody) return;

  if (!subscribers || subscribers.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="9" class="text-center">لا يوجد مشتركين تنتهي صلاحية اسمهم قريباً</td></tr>';
    return;
  }

  tableBody.innerHTML = subscribers
    .map((sub) => {
      const disconnectionDate = new Date(sub.disconnectionDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      disconnectionDate.setHours(0, 0, 0, 0);

      const diffTime = disconnectionDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let daysText = "";
      let daysClass = "";

      if (diffDays < 0) {
        daysText = `منتهي منذ ${Math.abs(diffDays)} يوم`;
        daysClass = "days-expired";
      } else if (diffDays === 0) {
        daysText = "اليوم!";
        daysClass = "days-today";
      } else if (diffDays === 1) {
        daysText = "غداً";
        daysClass = "days-urgent";
      } else {
        daysText = `${diffDays} أيام`;
        daysClass = "days-warning";
      }

      const isChecked = selectedExpiringIds.has(sub._id) ? "checked" : "";
      const showSpecialReset =
        String(sub.username || "").trim() === SPECIAL_RESET_USERNAME;

      return `
      <tr data-id="${sub._id}">
        <td class="checkbox-col">
          <input type="checkbox" class="expiring-checkbox" data-id="${sub._id}" ${isChecked} onchange="handleExpiringCheckboxChange(this)">
        </td>
        <td>${sub._id}</td>
        <td>${sub.username || "-"}</td>
        <td>${sub.fullName || "-"}</td>
        <td>${sub.phone || "-"}</td>
        <td>${sub.speed || 4} ميجا</td>
        <td>${formatDate(sub.disconnectionDate)}</td>
        <td><span class="days-badge ${daysClass}">${daysText}</span></td>
        <td>
          <button class="btn btn-info btn-sm modern-btn" onclick="openSubscriberProfile('${sub._id}')">ملف</button>
          ${
            showSpecialReset
              ? `<button class="btn btn-success btn-sm modern-btn" onclick="resetSpecialSubscriberCycle('${sub._id}')">Reset 31</button>`
              : ""
          }
        </td>
      </tr>
    `;
    })
    .join("");

  updateExpiringSelectedCount();
}

async function resetSpecialSubscriberCycle(subscriberId) {
  if (!subscriberId) return;

  if (!confirm("تأكيد: سيتم تجديد 31 يوم إضافية لهذا المشترك الخاص. هل تريد المتابعة؟")) {
    return;
  }

  try {
    const response = await authenticatedFetch(
      `/api/subscribers/expiring-usernames/reset-special/${subscriberId}`,
      {
        method: "POST",
      },
    );
    const result = await response.json();

    if (result.success) {
      showToast("تم تجديد 31 يوم بنجاح", "success");
      await loadExpiringUsernames();
      loadSubscribers();
      loadStats();
    } else {
      showToast(result.message || "فشل التجديد", "error");
    }
  } catch (error) {
    console.error("Error resetting special subscriber cycle:", error);
    showToast("خطأ في تنفيذ التجديد", "error");
  }
}

// Handle checkbox change for expiring usernames
function handleExpiringCheckboxChange(checkbox) {
  const id = checkbox.dataset.id;
  if (checkbox.checked) {
    selectedExpiringIds.add(id);
  } else {
    selectedExpiringIds.delete(id);
  }
  updateExpiringSelectedCount();
}

// Handle select all for expiring usernames
function handleSelectAllExpiring(e) {
  const checkboxes = document.querySelectorAll(".expiring-checkbox");
  checkboxes.forEach((cb) => {
    cb.checked = e.target.checked;
    const id = cb.dataset.id;
    if (e.target.checked) {
      selectedExpiringIds.add(id);
    } else {
      selectedExpiringIds.delete(id);
    }
  });
  updateExpiringSelectedCount();
}

// Update selected count for expiring usernames
function updateExpiringSelectedCount() {
  const countSpan = document.getElementById("expiringSelectedCount");
  const smsCountSpan = document.getElementById("expiringSmsSelectedCount");
  const bulkBtn = document.getElementById("bulkChangeUsernamesBtn");
  const sendSmsBtn = document.getElementById("sendExpiringSmsBtn");

  if (countSpan) countSpan.textContent = selectedExpiringIds.size;
  if (smsCountSpan) smsCountSpan.textContent = selectedExpiringIds.size;
  if (bulkBtn)
    bulkBtn.style.display =
      selectedExpiringIds.size > 0 ? "inline-block" : "none";
  if (sendSmsBtn)
    sendSmsBtn.style.display =
      selectedExpiringIds.size > 0 ? "inline-block" : "none";
}

function sendSelectedExpiringToSms() {
  if (selectedExpiringIds.size === 0) {
    showToast("يرجى تحديد مشترك واحد على الأقل", "error");
    return;
  }

  const selected = expiringUsernamesData
    .filter((sub) => selectedExpiringIds.has(sub._id))
    .map((sub) => ({
      id: String(sub._id || sub.id || sub.phone || ""),
      name: sub.fullName || sub.username || "مشترك",
      phone: String(sub.phone || "").trim(),
    }))
    .filter((sub) => sub.phone);

  if (selected.length === 0) {
    showToast("المشتركون المحددون لا يحتويون على أرقام هاتف صالحة", "error");
    return;
  }

  // Deduplicate by phone before passing to SMS section.
  const deduped = Array.from(
    new Map(selected.map((item) => [item.phone, item])).values(),
  );

  pendingSmsPrefillRecipients = deduped;
  const searchInput = document.getElementById("smsSubscriberSearch");
  if (searchInput) searchInput.value = "";

  window.location.hash = "sms";
  handleHashChange();
  showToast(`تم تجهيز ${deduped.length} مشترك في شاشة SMS`, "success");
}

// Open bulk change usernames modal
async function openBulkChangeUsernamesModal() {
  if (selectedExpiringIds.size === 0) {
    alert("يرجى تحديد مشترك واحد على الأقل");
    return;
  }

  document.getElementById("bulkChangeCount").textContent =
    selectedExpiringIds.size;

  await updateAvailableCountForBulk();

  document.getElementById("bulkChangeUsernamesModal").style.display = "flex";
}

// Close bulk change usernames modal
function closeBulkChangeUsernamesModal() {
  document.getElementById("bulkChangeUsernamesModal").style.display = "none";
}

// Update available count based on selected subscribers' speeds
async function updateAvailableCountForBulk() {
  try {
    // Count selected subscribers by speed
    let count4M = 0;
    let count8M = 0;

    // Get speeds from the table
    const tableBody = document.getElementById("expiringUsernamesTableBody");
    const rows = tableBody.querySelectorAll("tr");

    rows.forEach((row) => {
      const checkbox = row.querySelector('input[type="checkbox"]');
      if (checkbox && checkbox.checked) {
        const speedCell = row.cells[5]; // Speed column
        if (speedCell) {
          const speedText = speedCell.textContent.trim();
          if (speedText.includes("8")) {
            count8M++;
          } else {
            count4M++;
          }
        }
      }
    });

    // Get available usernames count for each speed
    const response4M = await authenticatedFetch(
      "/api/subscribers/available-usernames?speed=4",
    );
    const response8M = await authenticatedFetch(
      "/api/subscribers/available-usernames?speed=8",
    );
    const result4M = await response4M.json();
    const result8M = await response8M.json();

    const available4M = result4M.success ? result4M.data.length : 0;
    const available8M = result8M.success ? result8M.data.length : 0;

    document.getElementById("selected4MCount").textContent = count4M;
    document.getElementById("available4MCount").textContent = available4M;
    document.getElementById("selected8MCount").textContent = count8M;
    document.getElementById("available8MCount").textContent = available8M;

    // Store counts for validation
    window.bulkChangeData = { count4M, count8M, available4M, available8M };
  } catch (error) {
    console.error("Error fetching available count:", error);
  }
}

// Confirm bulk change usernames
async function confirmBulkChangeUsernames() {
  const subscriberIds = Array.from(selectedExpiringIds);
  const data = window.bulkChangeData || {};

  // Check available count for each speed
  if (data.count4M > data.available4M) {
    alert(
      `لا توجد أسماء مستخدمين كافية لـ 4 ميجا!\nالمتاح: ${data.available4M}\nالمطلوب: ${data.count4M}`,
    );
    return;
  }
  if (data.count8M > data.available8M) {
    alert(
      `لا توجد أسماء مستخدمين كافية لـ 8 ميجا!\nالمتاح: ${data.available8M}\nالمطلوب: ${data.count8M}`,
    );
    return;
  }

  if (
    !confirm(
      `هل أنت متأكد من تغيير أسماء المستخدمين لـ ${subscriberIds.length} مشترك؟`,
    )
  )
    return;

  try {
    const response = await authenticatedFetch(
      "/api/subscribers/bulk-change-usernames",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriberIds }),
      },
    );

    const result = await response.json();

    if (result.success) {
      closeBulkChangeUsernamesModal();

      let message = result.message;
      if (result.data.success.length > 0) {
        message += "\n\nالتغييرات الناجحة:\n";
        result.data.success.forEach((s) => {
          message += `- ${s.oldUsername} → ${s.newUsername}\n`;
        });
      }
      if (result.data.failed.length > 0) {
        message += "\n\nالفاشلة:\n";
        result.data.failed.forEach((f) => {
          message += `- ID: ${f.subscriberId} - ${f.reason}\n`;
        });
      }

      alert(message);

      // Clear selection and reload
      selectedExpiringIds.clear();
      document.getElementById("selectAllExpiringCheckbox").checked = false;
      loadExpiringUsernames();
      loadAvailableUsernames();
      loadSubscribers();
    } else {
      alert("خطأ: " + result.message);
    }
  } catch (error) {
    console.error("Error bulk changing usernames:", error);
    alert("خطأ في تغيير أسماء المستخدمين");
  }
}

// Search by old username
async function searchByOldUsername(isSilent = false) {
  const searchInput = document.getElementById("oldUsernameSearchInput");
  const resultDiv = document.getElementById("oldUsernameSearchResult");
  const username = searchInput.value.trim();

  if (!username) {
    if (resultDiv) {
      resultDiv.style.display = "none";
      resultDiv.innerHTML = "";
    }
    if (!isSilent) {
      alert("يرجى إدخال اسم المستخدم للبحث");
    }
    return;
  }

  try {
    const response = await authenticatedFetch(
      `/api/subscribers/search-old-username?username=${encodeURIComponent(username)}`,
    );
    const result = await response.json();

    resultDiv.style.display = "block";

    if (result.success && result.found) {
      resultDiv.innerHTML = `
        <div class="search-results-container">
          <h4>نتائج البحث عن "${username}"</h4>
          <table class="data-table modern-table">
            <thead>
              <tr>
                <th>الاسم المستخدم القديم</th>
                <th>كلمة المرور القديمة</th>
                <th>تاريخ التغيير</th>
                <th>المشترك الحالي</th>
                <th>اسم المستخدم الحالي</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${result.data
                .map(
                  (h) => `
                <tr>
                  <td>${h.old_username}</td>
                  <td>${h.old_password || "-"}</td>
                  <td>${formatDate(h.changed_at)}</td>
                  <td>${h.fullName || "-"}</td>
                  <td>${h.currentUsername || "-"}</td>
                  <td>
                    <button class="btn btn-info btn-sm modern-btn" onclick="openSubscriberProfile('${h.subscriberId}')">
                      فتح الملف
                    </button>
                  </td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `;
    } else {
      resultDiv.innerHTML = `
        <div class="no-results" style="padding: 15px; background: var(--bg-color); border-radius: 8px; text-align: center;">
          <p>لم يتم العثور على مشترك بهذا الاسم القديم "${username}"</p>
        </div>
      `;
    }
  } catch (error) {
    console.error("Error searching by old username:", error);
    resultDiv.innerHTML = `
      <div class="error-result" style="padding: 15px; background: #fee; border-radius: 8px; text-align: center; color: #c00;">
        <p>خطأ في البحث</p>
      </div>
    `;
  }
}

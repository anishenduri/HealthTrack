/* =========================================================
   HEALTH TRACK APPLICATION
========================================================= */

const API_BASE_URL = "https://healthtrack-production-baec.up.railway.app";
const ACTIVE_PATIENT_STORAGE_KEY = "healthtrack_active_patient_id";

let labTrendChart = null;
let modalTrendChart = null;
let activePatient = null;
let cachedMonitoringRecords = [];

// Modal specific state
let currentModalParam = null;
let currentModalRecords = [];

// Chat Assistant State
let chatMessages = [];
let isChatBotTyping = false;

// Lab Reports Pagination & Cache State
let cachedPatientReports = [];
let currentLabPage = 1;
const LAB_REPORTS_PER_PAGE = 5;

/* =========================================================
   LOCAL STORAGE ACTIVE PATIENT PERSISTENCE
========================================================= */

function saveActivePatientId(patientId) {
    if (!patientId) {
        clearActivePatientId();
        return;
    }
    try {
        localStorage.setItem(ACTIVE_PATIENT_STORAGE_KEY, String(patientId));
    } catch (e) {
        console.warn("Could not save active patient ID to localStorage:", e);
    }
}

function getSavedActivePatientId() {
    try {
        const id = localStorage.getItem(ACTIVE_PATIENT_STORAGE_KEY);
        return id && !isNaN(Number(id)) ? Number(id) : null;
    } catch (e) {
        return null;
    }
}

function clearActivePatientId() {
    try {
        localStorage.removeItem(ACTIVE_PATIENT_STORAGE_KEY);
    } catch (e) {
        console.warn("Could not clear active patient ID from localStorage:", e);
    }
}

/* =========================================================
   DATE, TIME & AGE UTILITIES
========================================================= */

function getTodayISODate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getCurrentLocalISODatetime() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
}

function extractDateFromTimestamp(timestamp) {
    if (!timestamp) return null;
    if (typeof timestamp === "string") {
        const trimmed = timestamp.trim();
        if (trimmed.length >= 10 && trimmed.charAt(4) === "-" && trimmed.charAt(7) === "-") {
            return trimmed.slice(0, 10);
        }
    }
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }
    return null;
}

function calculateAge(dateOfBirthString) {
    if (!dateOfBirthString) return "—";
    const dob = new Date(dateOfBirthString);
    if (isNaN(dob.getTime())) return "—";

    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
    }

    return age >= 0 ? `${age} yrs` : "—";
}

function formatValue(value) {
    if (value === null || value === undefined || value === "") {
        return "—";
    }
    return value;
}

function formatDisplayDate(dateValue) {
    if (!dateValue) return "—";
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return dateValue;

    return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function formatTrendDate(dateValue) {
    if (!dateValue) return "Unknown";
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return dateValue;

    return date.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function formatTimeOrDateTime(timestamp) {
    if (!timestamp) return "—";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;

    return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
}

function getTrendUnit(data) {
    if (data && data.length > 0 && data[0].unit) {
        return data[0].unit;
    }
    return "Value";
}

/* =========================================================
   NAVIGATION
========================================================= */

const navItems = document.querySelectorAll(".nav-item");
const sections = document.querySelectorAll(".page-section");
const pageTitle = document.getElementById("page-title");
const pageSubtitle = document.getElementById("page-subtitle");

const pageInformation = {
    dashboard: { title: "Dashboard", subtitle: "Patient health overview" },
    patients: { title: "Patients", subtitle: "Patient profile management" },
    monitoring: { title: "Monitoring", subtitle: "Patient health observations" },
    labs: { title: "Lab Reports", subtitle: "Laboratory reports and results" },
    trends: { title: "Lab Trends", subtitle: "Historical laboratory analytics" },
    chatbot: { title: "Health Assistant", subtitle: "AI-powered clinical information assistant" }
};

function navigateTo(sectionName) {
    sections.forEach(function(section) {
        section.classList.remove("active");
    });

    const target = document.getElementById(`section-${sectionName}`);
    if (target) {
        target.classList.add("active");
    }

    navItems.forEach(function(item) {
        item.classList.remove("active");
        if (item.dataset.section === sectionName) {
            item.classList.add("active");
        }
    });

    if (pageInformation[sectionName]) {
        pageTitle.textContent = pageInformation[sectionName].title;
        pageSubtitle.textContent = pageInformation[sectionName].subtitle;
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    closeMobileSidebar();

    if (sectionName === "dashboard" && activePatient) {
        refreshDashboardData();
    }

    if (sectionName === "monitoring") {
        initMonitoringDefaults();
        if (activePatient && activePatient.id) {
            loadMonitoringHistory();
        }
    }

    if (sectionName === "chatbot") {
        updateChatbotPatientContext();
        scrollChatToBottom();
    }
}

navItems.forEach(function(item) {
    item.addEventListener("click", function() {
        navigateTo(item.dataset.section);
    });
});

/* =========================================================
   MOBILE SIDEBAR
========================================================= */

const mobileMenu = document.getElementById("mobile-menu");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");

if (mobileMenu) {
    mobileMenu.addEventListener("click", function() {
        sidebar.classList.add("open");
        sidebarOverlay.classList.add("active");
    });
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", closeMobileSidebar);
}

function closeMobileSidebar() {
    if (sidebar) {
        sidebar.classList.remove("open");
    }
    if (sidebarOverlay) {
        sidebarOverlay.classList.remove("active");
    }
}

/* =========================================================
   ACTIVE PATIENT CONTEXT MANAGEMENT & PROFILE FETCHING
========================================================= */

async function fetchPatientProfile(patientId) {
    if (!patientId || isNaN(Number(patientId))) return null;
    try {
        const response = await fetch(`${API_BASE_URL}/patients/${patientId}`);
        if (response.ok) {
            const data = await response.json();
            return data;
        }
    } catch (e) {
        console.error(`Failed to fetch patient profile for ID ${patientId}:`, e);
    }
    return null;
}

function setActivePatient(patient) {
    activePatient = patient;

    if (patient && patient.id) {
        saveActivePatientId(patient.id);
    } else {
        clearActivePatientId();
    }

    const badgeName = document.getElementById("active-patient-name-display");
    const badgeContainer = document.getElementById("active-patient-badge");

    if (badgeName && badgeContainer) {
        if (!patient) {
            badgeName.textContent = "No Patient Active";
            badgeContainer.className = "active-patient-badge";
        } else if (patient.name) {
            badgeName.textContent = `${patient.name} (ID: #${patient.id})`;
            badgeContainer.className = "active-patient-badge";
        } else {
            badgeName.textContent = `Patient ID #${patient.id}`;
            badgeContainer.className = "active-patient-badge id-only";
        }
    }

    const fields = [
        "monitoring-patient-id",
        "history-patient-id",
        "trend-patient-id",
        "lab-patient-id",
        "results-patient-id",
        "dashboard-select-id"
    ];

    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = patient ? patient.id : "";
        }
    });

    displayPatient(patient);
    displayDashboardPatient(patient);
    updateChatbotPatientContext();

    if (patient) {
        refreshDashboardData();
        loadMonitoringHistory();
    } else {
        resetDashboardVitals();
        cachedMonitoringRecords = [];
    }
}

async function switchActivePatientById() {
    const input = document.getElementById("dashboard-select-id");
    if (!input || !input.value) {
        alert("Please enter a Patient ID.");
        return;
    }

    const patientId = Number(input.value);
    const profile = await fetchPatientProfile(patientId);

    if (profile) {
        setActivePatient(profile);
    } else {
        alert(`Patient #${patientId} not found in database.`);
        clearActivePatientId();
        setActivePatient(null);
    }
}

async function restoreActivePatientFromStorage() {
    const savedId = getSavedActivePatientId();
    if (savedId) {
        const profile = await fetchPatientProfile(savedId);
        if (profile) {
            setActivePatient(profile);
            return;
        } else {
            clearActivePatientId();
            setActivePatient(null);
        }
    } else {
        setActivePatient(null);
    }
}

window.addEventListener("storage", async function(event) {
    if (event.key === ACTIVE_PATIENT_STORAGE_KEY) {
        await restoreActivePatientFromStorage();
    }
});

/* =========================================================
   PATIENT FORM & VALIDATION
========================================================= */

const patientForm = document.getElementById("patient-form");
const patientSubmitBtn = document.getElementById("patient-submit-btn");

function showFieldError(fieldId, errorId, message) {
    const input = document.getElementById(fieldId);
    const errorSpan = document.getElementById(errorId);
    if (input && errorSpan) {
        input.classList.add("field-invalid");
        errorSpan.textContent = message;
        errorSpan.classList.add("visible");
    }
}

function clearFieldError(fieldId, errorId) {
    const input = document.getElementById(fieldId);
    const errorSpan = document.getElementById(errorId);
    if (input && errorSpan) {
        input.classList.remove("field-invalid");
        errorSpan.textContent = "";
        errorSpan.classList.remove("visible");
    }
}

function setFormBannerMessage(bannerId, text, type) {
    const banner = document.getElementById(bannerId);
    if (!banner) return;

    banner.className = `alert-banner visible ${type}`;
    const icon = type === "success" ? "✓ " : type === "error" ? "⚠ " : "ℹ ";
    banner.textContent = `${icon}${text}`;
}

function clearFormBannerMessage(bannerId) {
    const banner = document.getElementById(bannerId);
    if (!banner) return;
    banner.className = "alert-banner";
    banner.textContent = "";
}

["name", "date_of_birth", "gender"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener("input", function() {
            if (id === "name") clearFieldError("name", "name-error");
            if (id === "date_of_birth") clearFieldError("date_of_birth", "dob-error");
            if (id === "gender") clearFieldError("gender", "gender-error");
        });
        el.addEventListener("change", function() {
            if (id === "name") clearFieldError("name", "name-error");
            if (id === "date_of_birth") clearFieldError("date_of_birth", "dob-error");
            if (id === "gender") clearFieldError("gender", "gender-error");
        });
    }
});

if (patientForm) {
    patientForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const nameInput = document.getElementById("name");
        const dobInput = document.getElementById("date_of_birth");
        const genderInput = document.getElementById("gender");

        const name = nameInput.value.trim();
        const dateOfBirth = dobInput.value;
        const gender = genderInput.value;

        let hasError = false;

        if (!name) {
            showFieldError("name", "name-error", "Please enter the patient's full name.");
            hasError = true;
        } else if (name.length < 2) {
            showFieldError("name", "name-error", "Patient name must be at least 2 characters.");
            hasError = true;
        }

        if (!dateOfBirth) {
            showFieldError("date_of_birth", "dob-error", "Please select a date of birth.");
            hasError = true;
        } else {
            const chosenDate = new Date(dateOfBirth);
            const today = new Date();
            if (chosenDate > today) {
                showFieldError("date_of_birth", "dob-error", "Date of birth cannot be in the future.");
                hasError = true;
            }
        }

        if (!gender) {
            showFieldError("gender", "gender-error", "Please select a gender option.");
            hasError = true;
        }

        if (hasError) return;

        clearFormBannerMessage("patient-message");
        patientSubmitBtn.disabled = true;
        patientSubmitBtn.classList.add("loading");
        const btnText = patientSubmitBtn.querySelector(".btn-text");
        if (btnText) btnText.textContent = "Creating Patient Profile...";

        try {
            const response = await fetch(`${API_BASE_URL}/patients/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: name,
                    date_of_birth: dateOfBirth,
                    gender: gender
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Failed to create patient profile");
            }

            setFormBannerMessage("patient-message", `Patient created successfully. Assigned Patient ID: #${data.id}`, "success");
            setActivePatient(data);
            patientForm.reset();

        } catch(error) {
            console.error(error);
            setFormBannerMessage("patient-message", error.message || "An unexpected error occurred.", "error");
        } finally {
            patientSubmitBtn.disabled = false;
            patientSubmitBtn.classList.remove("loading");
            if (btnText) btnText.textContent = "Create Patient Record";
        }
    });
}

/* =========================================================
   DISPLAY PATIENT (PATIENTS VIEW & DASHBOARD HERO)
========================================================= */

function displayPatient(patient) {
    const container = document.getElementById("patient-info");
    if (!container) return;

    if (!patient) {
        container.innerHTML = `
            <div class="empty-state compact">
                <div class="empty-icon" aria-hidden="true">♙</div>
                <h3>No patient loaded</h3>
                <p>Complete the form on the right to register and activate a patient profile.</p>
            </div>
        `;
        return;
    }

    const hasRealName = Boolean(patient.name);
    const displayName = hasRealName ? patient.name : "Patient profile not found";
    const avatarLetter = hasRealName ? patient.name.charAt(0).toUpperCase() : "#";
    const formattedDob = patient.date_of_birth ? formatDisplayDate(patient.date_of_birth) : "—";
    const computedAge = patient.date_of_birth ? calculateAge(patient.date_of_birth) : "—";
    const formattedGender = formatValue(patient.gender);

    container.innerHTML = `
        <div class="patient-overview-card">
            <div class="patient-overview-header">
                <div class="patient-avatar-circle" aria-hidden="true">
                    ${avatarLetter}
                </div>
                <div>
                    <h3>${displayName}</h3>
                    <span class="patient-id-badge">Patient ID: #${formatValue(patient.id)}</span>
                </div>
            </div>

            <div class="patient-quick-stats">
                <div class="patient-stat-box">
                    <span>Age</span>
                    <strong>${computedAge}</strong>
                </div>
                <div class="patient-stat-box">
                    <span>Date of Birth</span>
                    <strong>${formattedDob}</strong>
                </div>
                <div class="patient-stat-box">
                    <span>Gender</span>
                    <strong>${formattedGender}</strong>
                </div>
            </div>

            <div class="patient-card-actions">
                <button class="primary-btn" type="button" onclick="navigateTo('dashboard')">
                    Go to Dashboard
                </button>
                <button class="secondary-btn" type="button" onclick="navigateTo('monitoring')">
                    Add Vitals
                </button>
            </div>
        </div>
    `;
}

function displayDashboardPatient(patient) {
    const container = document.getElementById("dashboard-patient-container");
    if (!container) return;

    if (!patient) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon" aria-hidden="true">♙</div>
                <h3>No patient selected</h3>
                <p>Enter a Patient ID above or create a new profile to display clinical overview.</p>
                <button class="primary-btn" type="button" onclick="navigateTo('patients')">
                    Add Patient
                </button>
            </div>
        `;
        return;
    }

    const hasRealName = Boolean(patient.name);
    const displayName = hasRealName ? patient.name : `Patient ID #${patient.id}`;
    const avatarLetter = hasRealName ? patient.name.charAt(0).toUpperCase() : "#";
    const formattedDob = patient.date_of_birth ? formatDisplayDate(patient.date_of_birth) : "—";
    const computedAge = patient.date_of_birth ? calculateAge(patient.date_of_birth) : "—";
    const formattedGender = formatValue(patient.gender);
    const subtitle = hasRealName ? "Patient Profile Record" : "Telemetry Active (Unregistered ID)";

    container.innerHTML = `
        <div class="patient-profile-strip">
            <div class="patient-main-info">
                <div class="patient-avatar-circle" aria-hidden="true">
                    ${avatarLetter}
                </div>
                <div>
                    <h3>${displayName}</h3>
                    <span>${subtitle}</span>
                </div>
            </div>

            <div class="patient-meta-grid">
                <div class="meta-item">
                    <span>Patient ID</span>
                    <strong>#${formatValue(patient.id)}</strong>
                </div>
                <div class="meta-item">
                    <span>Age</span>
                    <strong>${computedAge}</strong>
                </div>
                <div class="meta-item">
                    <span>Date of Birth</span>
                    <strong>${formattedDob}</strong>
                </div>
                <div class="meta-item">
                    <span>Gender</span>
                    <strong>${formattedGender}</strong>
                </div>
                <div class="meta-item">
                    <span>Status</span>
                    <strong style="color: var(--green);">Active</strong>
                </div>
            </div>
        </div>
    `;
}

/* =========================================================
   DASHBOARD LIVE DATA REFRESH & TODAY-ONLY CALCULATIONS
========================================================= */

async function refreshDashboardData() {
    if (!activePatient || !activePatient.id) return;

    const todayISO = getTodayISODate();

    try {
        const response = await fetch(`${API_BASE_URL}/monitoring/patient/${activePatient.id}`);
        if (response.ok) {
            const allRecords = await response.json();
            cachedMonitoringRecords = allRecords;

            // Strict Filter: Include ONLY observations whose actual timestamp date is TODAY
            const todayMonitoringRecords = (allRecords || []).filter(r => {
                return extractDateFromTimestamp(r.time) === todayISO;
            });

            updateDashboardVitalsAndObservations(todayMonitoringRecords);
            renderDashboardTiles(todayMonitoringRecords);
        } else {
            resetDashboardVitals();
            renderDashboardTiles([]);
        }
    } catch (e) {
        console.error("Dashboard monitoring fetch error:", e);
        resetDashboardVitals();
        renderDashboardTiles([]);
    }

    try {
        const labResponse = await fetch(`${API_BASE_URL}/labs/patient/${activePatient.id}`);
        if (labResponse.ok) {
            const allReports = await labResponse.json();

            // Strict Filter: Include ONLY lab reports whose actual report_date is TODAY
            const todayLabReports = (allReports || []).filter(rep => {
                return extractDateFromTimestamp(rep.report_date) === todayISO;
            });

            updateDashboardLabReports(todayLabReports);
        } else {
            updateDashboardLabReports([]);
        }
    } catch (e) {
        console.error("Dashboard lab fetch error:", e);
        updateDashboardLabReports([]);
    }
}

/* =========================================================
   DASHBOARD VITAL SUMMARY AVERAGES (TODAY ONLY)
========================================================= */

function updateDashboardVitalsAndObservations(todayRecords) {
    if (!todayRecords || todayRecords.length === 0) {
        resetDashboardVitals();
        return;
    }

    // 1. Blood Pressure: Separate Systolic and Diastolic Averages
    let systolicSum = 0;
    let diastolicSum = 0;
    let bpCount = 0;

    todayRecords.forEach(r => {
        if (r.bp && typeof r.bp === "string") {
            const parts = r.bp.replace(/\s+/g, "").split("/").map(Number);
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] > 0 && parts[1] > 0) {
                systolicSum += parts[0];
                diastolicSum += parts[1];
                bpCount++;
            }
        }
    });

    if (bpCount > 0) {
        const avgSys = Math.round(systolicSum / bpCount);
        const avgDia = Math.round(diastolicSum / bpCount);
        document.getElementById("dash-stat-bp").textContent = `${avgSys}/${avgDia}`;
        document.getElementById("dash-stat-bp-time").textContent = `Today's Avg (${bpCount} reading${bpCount > 1 ? "s" : ""})`;
    } else {
        document.getElementById("dash-stat-bp").textContent = "—";
        document.getElementById("dash-stat-bp-time").textContent = "No reading today";
    }

    // 2. Generic Numeric Field Averaging Helper
    function calculateFieldAverage(fieldName, precision = 1) {
        let sum = 0;
        let count = 0;

        todayRecords.forEach(r => {
            const val = r[fieldName];
            if (val !== null && val !== undefined && val !== "" && !isNaN(Number(val))) {
                sum += Number(val);
                count++;
            }
        });

        if (count === 0) return null;
        const avg = sum / count;
        return precision === 0 ? Math.round(avg) : Number(avg.toFixed(precision));
    }

    // 3. O2 Saturation
    const avgO2 = calculateFieldAverage("oxygen", 1);
    document.getElementById("dash-stat-o2").textContent = avgO2 !== null ? avgO2 : "—";

    // 4. Pulse
    const avgPulse = calculateFieldAverage("pulse", 1);
    document.getElementById("dash-stat-pulse").textContent = avgPulse !== null ? avgPulse : "—";

    // 5. Temperature
    const avgTemp = calculateFieldAverage("temperature", 1);
    document.getElementById("dash-stat-temp").textContent = avgTemp !== null ? avgTemp : "—";

    // 6. Blood Glucose
    const avgGlucose = calculateFieldAverage("glucose", 1);
    document.getElementById("dash-stat-glucose").textContent = avgGlucose !== null ? avgGlucose : "—";

    // 7. Urine Output
    const avgUrine = calculateFieldAverage("urine_output", 1);
    document.getElementById("dash-stat-urine").textContent = avgUrine !== null ? avgUrine : "—";
}

/* =========================================================
   DASHBOARD TILES RENDERING (TODAY ONLY)
========================================================= */

function renderDashboardTiles(todayRecords) {
    renderVitalsTile(todayRecords);
    renderFoodTile(todayRecords);
    renderMedicineTile(todayRecords);
}

/* 1. VITALS TILE */
function renderVitalsTile(todayRecords) {
    const container = document.getElementById("tile-vitals-container");
    if (!container) return;

    const vitalsRecords = (todayRecords || []).filter(r => 
        r.bp || r.oxygen !== null || r.pulse !== null || r.temperature !== null || r.glucose !== null || r.urine_output !== null
    );

    let html = `
        <table id="table-tile-vitals">
            <thead>
                <tr>
                    <th>Time</th>
                    <th>BP</th>
                    <th>O2</th>
                    <th>Pulse</th>
                    <th>Temp</th>
                    <th>Glucose</th>
                    <th>Urine Output</th>
                    <th style="width: 80px;">Action</th>
                </tr>
            </thead>
            <tbody id="tbody-tile-vitals">
    `;

    if (vitalsRecords.length === 0) {
        html += `
            <tr class="empty-row-placeholder">
                <td colspan="8" style="text-align: center; color: var(--muted); padding: 16px;">
                    No vitals recorded today. Click [+] to add an observation.
                </td>
            </tr>
        `;
    } else {
        vitalsRecords.forEach(r => {
            const tempVal = r.temperature !== null && r.temperature !== undefined ? `${r.temperature}°C` : "—";
            const o2Val = r.oxygen !== null && r.oxygen !== undefined ? `${r.oxygen}%` : "—";
            const urineVal = r.urine_output !== null && r.urine_output !== undefined ? `${r.urine_output} ml` : "—";

            html += `
                <tr>
                    <td data-label="Time">${formatTimeOrDateTime(r.time)}</td>
                    <td data-label="BP"><strong>${formatValue(r.bp)}</strong></td>
                    <td data-label="O2">${o2Val}</td>
                    <td data-label="Pulse">${formatValue(r.pulse)}</td>
                    <td data-label="Temp">${tempVal}</td>
                    <td data-label="Glucose">${formatValue(r.glucose)}</td>
                    <td data-label="Urine Output">${urineVal}</td>
                    <td data-label="Action">
                        <button type="button" class="secondary-btn" style="padding: 3px 8px; font-size: 11px;" onclick="navigateTo('monitoring')">Edit</button>
                    </td>
                </tr>
            `;
        });
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
}

/* 2. FOOD TILE */
function renderFoodTile(todayRecords) {
    const container = document.getElementById("tile-food-container");
    if (!container) return;

    const foodRecords = (todayRecords || []).filter(r => Boolean(r.food_name));

    let html = `
        <table id="table-tile-food">
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Food Name</th>
                    <th>Quantity / Description</th>
                    <th style="width: 80px;">Action</th>
                </tr>
            </thead>
            <tbody id="tbody-tile-food">
    `;

    if (foodRecords.length === 0) {
        html += `
            <tr class="empty-row-placeholder">
                <td colspan="4" style="text-align: center; color: var(--muted); padding: 16px;">
                    No food entries recorded today. Click [+] to log a meal.
                </td>
            </tr>
        `;
    } else {
        foodRecords.forEach(r => {
            let foodName = r.food_name || "—";
            let quantity = "Recorded";
            if (foodName.includes(" - ")) {
                const parts = foodName.split(" - ");
                foodName = parts[0];
                quantity = parts[1];
            } else if (foodName.includes(",")) {
                const parts = foodName.split(",");
                foodName = parts[0];
                quantity = parts.slice(1).join(",").trim();
            }

            html += `
                <tr>
                    <td data-label="Time">${formatTimeOrDateTime(r.time)}</td>
                    <td data-label="Food Name"><strong>${formatValue(foodName)}</strong></td>
                    <td data-label="Quantity">${formatValue(quantity)}</td>
                    <td data-label="Action">
                        <button type="button" class="secondary-btn" style="padding: 3px 8px; font-size: 11px;" onclick="navigateTo('monitoring')">Edit</button>
                    </td>
                </tr>
            `;
        });
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
}

/* 3. MEDICINE TILE */
function renderMedicineTile(todayRecords) {
    const container = document.getElementById("tile-medicine-container");
    if (!container) return;

    const medicineRecords = (todayRecords || []).filter(r => Boolean(r.medicine_given));

    let html = `
        <table id="table-tile-medicine">
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Medicine Given</th>
                    <th style="width: 80px;">Action</th>
                </tr>
            </thead>
            <tbody id="tbody-tile-medicine">
    `;

    if (medicineRecords.length === 0) {
        html += `
            <tr class="empty-row-placeholder">
                <td colspan="3" style="text-align: center; color: var(--muted); padding: 16px;">
                    No medication entries recorded today. Click [+] to log administered medicine.
                </td>
            </tr>
        `;
    } else {
        medicineRecords.forEach(r => {
            html += `
                <tr>
                    <td data-label="Time">${formatTimeOrDateTime(r.time)}</td>
                    <td data-label="Medicine Given"><strong>${formatValue(r.medicine_given)}</strong></td>
                    <td data-label="Action">
                        <button type="button" class="secondary-btn" style="padding: 3px 8px; font-size: 11px;" onclick="navigateTo('monitoring')">Edit</button>
                    </td>
                </tr>
            `;
        });
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
}

/* =========================================================
   DASHBOARD LAB REPORTS (TODAY ONLY)
========================================================= */

function updateDashboardLabReports(todayReports) {
    const labContainer = document.getElementById("dashboard-recent-labs");
    if (!labContainer) return;

    if (!todayReports || todayReports.length === 0) {
        labContainer.innerHTML = `
            <div class="empty-state compact">
                <p>No lab reports registered for today.</p>
            </div>
        `;
        return;
    }

    let html = "";
    todayReports.forEach(report => {
        html += `
            <div class="dash-lab-item">
                <div class="dash-lab-info">
                    <h4>${report.report_type || "Diagnostic Lab Report"}</h4>
                    <span>${report.laboratory_name || "Lab"} • ${report.report_date ? formatTrendDate(report.report_date) : "Today"}</span>
                </div>
                <button class="secondary-btn" type="button" onclick="navigateTo('labs'); loadLabResults(${report.id});">
                    View Results
                </button>
            </div>
        `;
    });

    labContainer.innerHTML = html;
}

function resetDashboardVitals() {
    document.getElementById("dash-stat-bp").textContent = "—";
    document.getElementById("dash-stat-bp-time").textContent = "No reading today";
    document.getElementById("dash-stat-o2").textContent = "—";
    document.getElementById("dash-stat-pulse").textContent = "—";
    document.getElementById("dash-stat-temp").textContent = "—";
    document.getElementById("dash-stat-glucose").textContent = "—";
    document.getElementById("dash-stat-urine").textContent = "—";
}

/* =========================================================
   INLINE ROW ADDITION (+) & ASYNC SAVE
========================================================= */

function showInlineEntryRow(tileType) {
    if (!activePatient || !activePatient.id) {
        alert("Please select or create an active patient first.");
        return;
    }

    const currentLocalTime = getCurrentLocalISODatetime();

    if (tileType === "vitals") {
        const tbody = document.getElementById("tbody-tile-vitals");
        if (!tbody || document.getElementById("row-inline-vitals")) return;
        
        const emptyRow = tbody.querySelector(".empty-row-placeholder");
        if (emptyRow) emptyRow.remove();

        const tr = document.createElement("tr");
        tr.id = "row-inline-vitals";
        tr.className = "inline-edit-row";
        tr.innerHTML = `
            <td data-label="Time"><input type="datetime-local" id="inline-vitals-time" value="${currentLocalTime}"></td>
            <td data-label="BP"><input type="text" id="inline-vitals-bp" placeholder="120/80"></td>
            <td data-label="O2"><input type="number" step="0.1" id="inline-vitals-oxygen" placeholder="98"></td>
            <td data-label="Pulse"><input type="number" step="0.1" id="inline-vitals-pulse" placeholder="72"></td>
            <td data-label="Temp"><input type="number" step="0.1" id="inline-vitals-temp" placeholder="98.4"></td>
            <td data-label="Glucose"><input type="number" step="0.1" id="inline-vitals-glucose" placeholder="95"></td>
            <td data-label="Urine Output"><input type="number" step="0.1" id="inline-vitals-urine" placeholder="200"></td>
            <td data-label="Action">
                <button type="button" class="row-save-btn" onclick="saveInlineRow('vitals')">Save</button>
                <button type="button" class="row-cancel-btn" onclick="cancelInlineRow('vitals')">✕</button>
            </td>
        `;
        tbody.appendChild(tr);
    } 
    else if (tileType === "food") {
        const tbody = document.getElementById("tbody-tile-food");
        if (!tbody || document.getElementById("row-inline-food")) return;
        
        const emptyRow = tbody.querySelector(".empty-row-placeholder");
        if (emptyRow) emptyRow.remove();

        const tr = document.createElement("tr");
        tr.id = "row-inline-food";
        tr.className = "inline-edit-row";
        tr.innerHTML = `
            <td data-label="Time"><input type="datetime-local" id="inline-food-time" value="${currentLocalTime}"></td>
            <td data-label="Food Name"><input type="text" id="inline-food-name" placeholder="e.g. Rice / Apple"></td>
            <td data-label="Quantity"><input type="text" id="inline-food-quantity" placeholder="e.g. 200 g / 1 piece"></td>
            <td data-label="Action">
                <button type="button" class="row-save-btn" onclick="saveInlineRow('food')">Save</button>
                <button type="button" class="row-cancel-btn" onclick="cancelInlineRow('food')">✕</button>
            </td>
        `;
        tbody.appendChild(tr);
    } 
    else if (tileType === "medicine") {
        const tbody = document.getElementById("tbody-tile-medicine");
        if (!tbody || document.getElementById("row-inline-medicine")) return;
        
        const emptyRow = tbody.querySelector(".empty-row-placeholder");
        if (emptyRow) emptyRow.remove();

        const tr = document.createElement("tr");
        tr.id = "row-inline-medicine";
        tr.className = "inline-edit-row";
        tr.innerHTML = `
            <td data-label="Time"><input type="datetime-local" id="inline-medicine-time" value="${currentLocalTime}"></td>
            <td data-label="Medicine Given"><input type="text" id="inline-medicine-name" placeholder="e.g. Paracetamol 500mg"></td>
            <td data-label="Action">
                <button type="button" class="row-save-btn" onclick="saveInlineRow('medicine')">Save</button>
                <button type="button" class="row-cancel-btn" onclick="cancelInlineRow('medicine')">✕</button>
            </td>
        `;
        tbody.appendChild(tr);
    }
}

function cancelInlineRow(tileType) {
    const row = document.getElementById(`row-inline-${tileType}`);
    if (row) row.remove();
    refreshDashboardData();
}

async function saveInlineRow(tileType) {
    if (!activePatient || !activePatient.id) {
        alert("Active Patient ID missing.");
        return;
    }

    const getVal = id => {
        const el = document.getElementById(id);
        return (el && el.value !== "") ? el.value.trim() : null;
    };

    let requestData = {
        patient_id: Number(activePatient.id),
        time: null,
        bp: null,
        oxygen: null,
        pulse: null,
        temperature: null,
        glucose: null,
        urine_output: null,
        food_name: null,
        medicine_given: null
    };

    if (tileType === "vitals") {
        requestData.time = getVal("inline-vitals-time") || getCurrentLocalISODatetime();
        requestData.bp = getVal("inline-vitals-bp");
        requestData.oxygen = getVal("inline-vitals-oxygen") ? Number(getVal("inline-vitals-oxygen")) : null;
        requestData.pulse = getVal("inline-vitals-pulse") ? Number(getVal("inline-vitals-pulse")) : null;
        requestData.temperature = getVal("inline-vitals-temp") ? Number(getVal("inline-vitals-temp")) : null;
        requestData.glucose = getVal("inline-vitals-glucose") ? Number(getVal("inline-vitals-glucose")) : null;
        requestData.urine_output = getVal("inline-vitals-urine") ? Number(getVal("inline-vitals-urine")) : null;
    } 
    else if (tileType === "food") {
        requestData.time = getVal("inline-food-time") || getCurrentLocalISODatetime();
        const fName = getVal("inline-food-name");
        const fQty = getVal("inline-food-quantity");
        if (!fName && !fQty) {
            alert("Please enter food details.");
            return;
        }
        requestData.food_name = fQty ? `${fName || "Food"} - ${fQty}` : fName;
    } 
    else if (tileType === "medicine") {
        requestData.time = getVal("inline-medicine-time") || getCurrentLocalISODatetime();
        const med = getVal("inline-medicine-name");
        if (!med) {
            alert("Please enter medicine name.");
            return;
        }
        requestData.medicine_given = med;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/monitoring/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to save record");
        }

        await refreshDashboardData();

    } catch (error) {
        console.error("Save inline row error:", error);
        alert("Error saving record: " + error.message);
    }
}

/* =========================================================
   MONITORING TAB (AUTOMATIC DATE FILTERING & STEPPERS)
========================================================= */

function initMonitoringDefaults() {
    const datePicker = document.getElementById("monitoring-date-filter");
    if (datePicker && !datePicker.value) {
        datePicker.value = getTodayISODate();
    }

    const timeInput = document.getElementById("monitoring-time");
    if (timeInput && !timeInput.value) {
        timeInput.value = getCurrentLocalISODatetime();
    }
}

function handlePatientIdInput() {
    loadMonitoringHistory();
}

function stepMonitoringDate(offsetDays) {
    const datePicker = document.getElementById("monitoring-date-filter");
    if (!datePicker) return;

    let currentDateStr = datePicker.value || getTodayISODate();
    const [year, month, day] = currentDateStr.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);

    dateObj.setDate(dateObj.getDate() + offsetDays);

    const nextYear = dateObj.getFullYear();
    const nextMonth = String(dateObj.getMonth() + 1).padStart(2, "0");
    const nextDay = String(dateObj.getDate()).padStart(2, "0");

    datePicker.value = `${nextYear}-${nextMonth}-${nextDay}`;
    loadMonitoringHistory();
}

function setMonitoringDateToToday() {
    const datePicker = document.getElementById("monitoring-date-filter");
    if (datePicker) {
        datePicker.value = getTodayISODate();
    }
    loadMonitoringHistory();
}

function setMonitoringDateToAll() {
    const datePicker = document.getElementById("monitoring-date-filter");
    if (datePicker) {
        datePicker.value = "";
    }
    loadMonitoringHistory();
}

const monitoringForm = document.getElementById("monitoring-form");

if (monitoringForm) {
    monitoringForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const patientId = document.getElementById("monitoring-patient-id").value;

        if (!patientId) {
            setFormBannerMessage("monitoring-message", "Please enter a Patient ID.", "error");
            return;
        }

        function getValue(id) {
            const value = document.getElementById(id).value;
            return value === "" ? null : value;
        }

        const time = getValue("monitoring-time");
        const bp = getValue("monitoring-bp");
        const oxygen = getValue("monitoring-oxygen");
        const pulse = getValue("monitoring-pulse");
        const temperature = getValue("monitoring-temperature");
        const glucose = getValue("monitoring-glucose");
        const urine = getValue("monitoring-urine");
        const food = getValue("monitoring-food");
        const medicine = getValue("monitoring-medicine");

        const requestData = {
            patient_id: Number(patientId),
            time: time,
            bp: bp,
            oxygen: oxygen === null ? null : Number(oxygen),
            pulse: pulse === null ? null : Number(pulse),
            temperature: temperature === null ? null : Number(temperature),
            glucose: glucose === null ? null : Number(glucose),
            urine_output: urine === null ? null : Number(urine),
            food_name: food,
            medicine_given: medicine
        };

        try {
            setFormBannerMessage("monitoring-message", "Saving monitoring record...", "info");

            const response = await fetch(`${API_BASE_URL}/monitoring/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Failed to save monitoring record");
            }

            setFormBannerMessage("monitoring-message", "Monitoring record saved successfully.", "success");

            document.getElementById("history-patient-id").value = patientId;

            const recordDate = extractDateFromTimestamp(time) || getTodayISODate();
            const datePicker = document.getElementById("monitoring-date-filter");
            if (datePicker) {
                datePicker.value = recordDate;
            }

            loadMonitoringHistory();

            if (activePatient && Number(activePatient.id) === Number(patientId)) {
                refreshDashboardData();
            }

        } catch(error) {
            console.error(error);
            setFormBannerMessage("monitoring-message", error.message, "error");
        }
    });
}

async function loadMonitoringHistory() {
    const patientId = document.getElementById("history-patient-id").value;
    const container = document.getElementById("monitoring-history");
    const datePicker = document.getElementById("monitoring-date-filter");
    const selectedDate = datePicker ? datePicker.value : getTodayISODate();

    if (!patientId) {
        container.innerHTML = `<p class="field-error-msg visible">Please enter a Patient ID.</p>`;
        return;
    }

    container.innerHTML = "<p>Loading monitoring records...</p>";

    try {
        const response = await fetch(`${API_BASE_URL}/monitoring/patient/${patientId}`);
        const allRecords = await response.json();

        if (!response.ok) {
            throw new Error(allRecords.detail || "Failed to load monitoring records");
        }

        cachedMonitoringRecords = allRecords;
        renderFilteredMonitoringRecords(allRecords, selectedDate);

    } catch(error) {
        console.error(error);
        container.innerHTML = `<p class="field-error-msg visible">${error.message}</p>`;
    }
}

function renderFilteredMonitoringRecords(allRecords, selectedDate) {
    const container = document.getElementById("monitoring-history");
    const tagBadge = document.getElementById("date-view-tag");
    const labelHeader = document.getElementById("date-view-label");
    const countBadge = document.getElementById("date-record-count");
    const headingEl = document.getElementById("monitoring-view-heading");

    const todayISO = getTodayISODate();

    let filteredRecords = [];
    let isToday = selectedDate === todayISO;
    let isAll = !selectedDate;

    if (isAll) {
        filteredRecords = allRecords;
        if (tagBadge) {
            tagBadge.textContent = "ALL DATES";
            tagBadge.className = "date-tag-badge all";
        }
        if (labelHeader) labelHeader.textContent = "All Historical Monitoring Records";
        if (headingEl) headingEl.textContent = "All Historical Records";
    } else {
        filteredRecords = allRecords.filter(rec => {
            const recDate = extractDateFromTimestamp(rec.time);
            return recDate === selectedDate;
        });

        if (isToday) {
            if (tagBadge) {
                tagBadge.textContent = "TODAY";
                tagBadge.className = "date-tag-badge";
            }
            if (labelHeader) labelHeader.textContent = `Monitoring — ${formatTrendDate(todayISO)}`;
            if (headingEl) headingEl.textContent = `Today's Monitoring Records (${formatTrendDate(todayISO)})`;
        } else {
            if (tagBadge) {
                tagBadge.textContent = "HISTORICAL";
                tagBadge.className = "date-tag-badge history";
            }
            if (labelHeader) labelHeader.textContent = `Monitoring — ${formatTrendDate(selectedDate)}`;
            if (headingEl) headingEl.textContent = `Monitoring History (${formatTrendDate(selectedDate)})`;
        }
    }

    if (countBadge) {
        countBadge.textContent = `${filteredRecords.length} record${filteredRecords.length === 1 ? "" : "s"}`;
    }

    if (!filteredRecords || filteredRecords.length === 0) {
        container.innerHTML = `
            <div class="empty-state compact">
                <p>No monitoring records found for ${isAll ? "this patient" : (isToday ? "today (" + formatTrendDate(todayISO) + ")" : formatTrendDate(selectedDate))}.</p>
            </div>
        `;
        return;
    }

    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Time</th>
                    <th>BP</th>
                    <th>O2</th>
                    <th>Pulse</th>
                    <th>Temperature</th>
                    <th>Glucose</th>
                    <th>Urine Output</th>
                    <th>Food</th>
                    <th>Medicine</th>
                </tr>
            </thead>
            <tbody>
    `;

    filteredRecords.forEach(function(record) {
        tableHTML += `
            <tr>
                <td data-label="Time"><strong>${formatTimeOrDateTime(record.time)}</strong></td>
                <td data-label="BP"><strong>${formatValue(record.bp)}</strong></td>
                <td data-label="O2">${formatValue(record.oxygen)}</td>
                <td data-label="Pulse">${formatValue(record.pulse)}</td>
                <td data-label="Temperature">${formatValue(record.temperature)}</td>
                <td data-label="Glucose">${formatValue(record.glucose)}</td>
                <td data-label="Urine Output">${formatValue(record.urine_output)}</td>
                <td data-label="Food">${formatValue(record.food_name)}</td>
                <td data-label="Medicine">${formatValue(record.medicine_given)}</td>
            </tr>
        `;
    });

    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

/* =========================================================
   REFERENCE RANGE PARSING & RESULT CLASSIFICATION
========================================================= */

function parseReferenceLimits(lowVal, highVal, textVal) {
    if (lowVal !== null && lowVal !== undefined && highVal !== null && highVal !== undefined) {
        return { low: Number(lowVal), high: Number(highVal), rawText: `${lowVal} - ${highVal}` };
    }

    if (textVal && typeof textVal === "string") {
        const cleanText = textVal.trim();
        
        const rangeMatch = cleanText.match(/^([0-9.]+)\s*(?:-|–|to)\s*([0-9.]+)/i);
        if (rangeMatch) {
            return {
                low: parseFloat(rangeMatch[1]),
                high: parseFloat(rangeMatch[2]),
                rawText: cleanText
            };
        }

        const lessMatch = cleanText.match(/^<\s*([0-9.]+)/i);
        if (lessMatch) {
            return { low: null, high: parseFloat(lessMatch[1]), rawText: cleanText };
        }

        const greaterMatch = cleanText.match(/^>\s*([0-9.]+)/i);
        if (greaterMatch) {
            return { low: parseFloat(greaterMatch[1]), high: null, rawText: cleanText };
        }

        return { low: null, high: null, rawText: cleanText };
    }

    return null;
}

function evaluateResultStatus(numericVal, textVal, parsedLimits, defaultFlag) {
    if (numericVal !== null && numericVal !== undefined && parsedLimits) {
        const val = Number(numericVal);
        if (parsedLimits.low !== null && val < parsedLimits.low) return "low";
        if (parsedLimits.high !== null && val > parsedLimits.high) return "high";
        if ((parsedLimits.low !== null || parsedLimits.high !== null)) return "normal";
    }

    if (defaultFlag && typeof defaultFlag === "string") {
        return defaultFlag.toLowerCase();
    }

    if (textVal && typeof textVal === "string") {
        const t = textVal.trim().toLowerCase();
        if (t === "positive" || t === "reactive" || t === "abnormal" || t === "high") return "high";
        if (t === "negative" || t === "non-reactive" || t === "normal") return "normal";
    }

    return "unknown";
}

/* =========================================================
   LAB REPORT FORM & RESULTS
========================================================= */

const labReportForm = document.getElementById("lab-report-form");

if (labReportForm) {
    labReportForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const patientId = document.getElementById("lab-patient-id").value;
        const reportDate = document.getElementById("lab-report-date").value;
        const reportType = document.getElementById("lab-report-type").value;
        const laboratoryName = document.getElementById("lab-laboratory-name").value;
        const fileInput = document.getElementById("lab-file");

        if (!patientId) {
            setFormBannerMessage("lab-message", "Please enter Patient ID.", "error");
            return;
        }

        if (!fileInput.files.length) {
            setFormBannerMessage("lab-message", "Please select a lab report file.", "error");
            return;
        }

        const file = fileInput.files[0];

        try {
            setFormBannerMessage("lab-message", "Creating lab report...", "info");

            const createResponse = await fetch(`${API_BASE_URL}/labs/reports`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    patient_id: Number(patientId),
                    report_date: reportDate || null,
                    report_type: reportType || null,
                    laboratory_name: laboratoryName || null,
                    file_name: file.name
                })
            });

            const report = await createResponse.json();

            if (!createResponse.ok) {
                throw new Error(report.detail || "Failed to create lab report");
            }

            const reportId = report.id;

            setFormBannerMessage("lab-message", "Uploading lab report file...", "info");

            const formData = new FormData();
            formData.append("file", file);

            const uploadResponse = await fetch(`${API_BASE_URL}/labs/reports/${reportId}/upload`, {
                method: "POST",
                body: formData
            });

            const uploadData = await uploadResponse.json();

            if (!uploadResponse.ok) {
                throw new Error(uploadData.detail || "Failed to upload lab report");
            }

            setFormBannerMessage("lab-message", "Report uploaded. Analyzing with Gemini...", "info");

            const analyzeResponse = await fetch(`${API_BASE_URL}/labs/reports/${reportId}/analyze`, {
                method: "POST"
            });

            const analysis = await analyzeResponse.json();

            if (!analyzeResponse.ok) {
                throw new Error(analysis.detail || "Gemini analysis failed");
            }

            setFormBannerMessage("lab-message", `Analysis complete. ${analysis.components_extracted} components extracted.`, "success");

            await loadLabResults(reportId);

            document.getElementById("results-patient-id").value = patientId;
            await loadPatientLabReports();

            if (activePatient && Number(activePatient.id) === Number(patientId)) {
                refreshDashboardData();
            }

        } catch(error) {
            console.error(error);
            setFormBannerMessage("lab-message", "Error: " + error.message, "error");
        }
    });
}

async function loadPatientLabReports() {
    const patientId = document.getElementById("results-patient-id").value;
    const container = document.getElementById("lab-reports-container");
    const paginationContainer = document.getElementById("lab-reports-pagination");

    if (!patientId) {
        container.innerHTML = `<p class="field-error-msg visible">Please enter Patient ID.</p>`;
        if (paginationContainer) paginationContainer.style.display = "none";
        return;
    }

    container.innerHTML = "<p>Loading lab reports...</p>";
    if (paginationContainer) paginationContainer.style.display = "none";

    try {
        const response = await fetch(`${API_BASE_URL}/labs/patient/${patientId}`);
        const reports = await response.json();

        if (!response.ok) {
            throw new Error(reports.detail || "Failed to load lab reports");
        }

        if (!Array.isArray(reports) || reports.length === 0) {
            cachedPatientReports = [];
            container.innerHTML = `
                <div class="empty-state compact">
                    <p>No lab reports available yet.</p>
                </div>
            `;
            if (paginationContainer) paginationContainer.style.display = "none";
            return;
        }

        // Sort reports newest -> oldest safely using existing report_date field
        cachedPatientReports = reports.slice().sort((a, b) => {
            const timeA = a.report_date ? new Date(a.report_date).getTime() : 0;
            const timeB = b.report_date ? new Date(b.report_date).getTime() : 0;
            return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
        });

        currentLabPage = 1;
        renderLabReportsPage(currentLabPage);

    } catch(error) {
        console.error(error);
        container.innerHTML = `<p class="field-error-msg visible">Error: ${error.message}</p>`;
        if (paginationContainer) paginationContainer.style.display = "none";
    }
}

function renderLabReportsPage(pageNumber) {
    const container = document.getElementById("lab-reports-container");
    const totalReports = cachedPatientReports.length;
    const totalPages = Math.ceil(totalReports / LAB_REPORTS_PER_PAGE);

    if (pageNumber < 1) pageNumber = 1;
    if (pageNumber > totalPages && totalPages > 0) pageNumber = totalPages;
    currentLabPage = pageNumber;

    const startIndex = (currentLabPage - 1) * LAB_REPORTS_PER_PAGE;
    const endIndex = Math.min(startIndex + LAB_REPORTS_PER_PAGE, totalReports);
    const paginatedItems = cachedPatientReports.slice(startIndex, endIndex);

    let html = "";
    paginatedItems.forEach(function(report) {
        const reportTitle = report.report_type || "Diagnostic Lab Report";
        const formattedDate = report.report_date ? formatTrendDate(report.report_date) : "Unknown Date";
        const labName = report.laboratory_name || "Unspecified Laboratory";

        html += `
            <div class="lab-report-card">
                <div class="lab-report-header">
                    <div class="lab-report-avatar" aria-hidden="true">▣</div>
                    <div class="lab-report-details">
                        <h3>${escapeHTML(reportTitle)} <span class="lab-report-id-badge">#${report.id}</span></h3>
                        <div class="lab-report-meta">
                            <span>📅 ${escapeHTML(formattedDate)}</span>
                            <span>🏥 ${escapeHTML(labName)}</span>
                        </div>
                    </div>
                </div>
                <div class="lab-report-actions">
                    <button type="button" class="secondary-btn" onclick="loadLabResults(${report.id})">
                        View Results
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    renderLabPaginationControls(totalPages, totalReports, startIndex + 1, endIndex);
}

function renderLabPaginationControls(totalPages, totalReports, fromIndex, toIndex) {
    const paginationContainer = document.getElementById("lab-reports-pagination");
    if (!paginationContainer) return;

    if (totalReports <= LAB_REPORTS_PER_PAGE) {
        paginationContainer.style.display = "none";
        paginationContainer.innerHTML = "";
        return;
    }

    paginationContainer.style.display = "flex";

    let pagesButtonsHtml = "";
    for (let i = 1; i <= totalPages; i++) {
        pagesButtonsHtml += `
            <button type="button" class="pagination-btn ${i === currentLabPage ? 'active' : ''}" onclick="changeLabReportsPage(${i})">
                ${i}
            </button>
        `;
    }

    paginationContainer.innerHTML = `
        <span class="pagination-summary">
            Showing ${fromIndex}–${toIndex} of ${totalReports} reports
        </span>
        <div class="pagination-pages">
            <button type="button" class="pagination-btn" onclick="changeLabReportsPage(${currentLabPage - 1})" ${currentLabPage === 1 ? 'disabled' : ''}>
                ‹ Previous
            </button>
            ${pagesButtonsHtml}
            <button type="button" class="pagination-btn" onclick="changeLabReportsPage(${currentLabPage + 1})" ${currentLabPage === totalPages ? 'disabled' : ''}>
                Next ›
            </button>
        </div>
    `;
}

function changeLabReportsPage(pageNumber) {
    renderLabReportsPage(pageNumber);
}

async function loadLabResults(reportId) {
    const container = document.getElementById("lab-results-container");

    if (!reportId) {
        container.innerHTML = "<p>Please select a lab report.</p>";
        return;
    }

    container.innerHTML = "<p>Loading lab results...</p>";

    try {
        const response = await fetch(`${API_BASE_URL}/labs/reports/${reportId}/results`);
        const results = await response.json();

        if (!response.ok) {
            throw new Error(results.detail || "Failed to load lab results");
        }

        if (results.length === 0) {
            container.innerHTML = "<p>No lab results found.</p>";
            return;
        }

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Test Parameter</th>
                        <th>Result</th>
                        <th>Unit</th>
                        <th>Reference Range</th>
                        <th>Status</th>
                        <th style="width: 40px; text-align: right;"></th>
                    </tr>
                </thead>
                <tbody>
        `;

        results.forEach(function(result) {
            let numericVal = (result.value_numeric !== null && result.value_numeric !== undefined) ? result.value_numeric : null;
            let textVal = (result.value_text !== null && result.value_text !== undefined) ? result.value_text : null;
            let displayVal = numericVal !== null ? numericVal : (textVal !== null ? textVal : "—");

            const parsedLimits = parseReferenceLimits(result.reference_range_low, result.reference_range_high, result.reference_range_text);
            const statusKey = evaluateResultStatus(numericVal, textVal, parsedLimits, result.flag);
            const statusDisplay = statusKey.toUpperCase();

            let refRangeDisplay = parsedLimits ? parsedLimits.rawText : "—";
            let statusBadgeClass = `status-${statusKey}`;
            let rowHighlightClass = (statusKey === "low" || statusKey === "high" || statusKey === "positive" || statusKey === "abnormal") ? `row-abnormal-${statusKey}` : "";

            const encodedParam = encodeURIComponent(result.component_name || "");
            const encodedUnit = encodeURIComponent(result.unit || "");
            const encodedLow = parsedLimits && parsedLimits.low !== null ? parsedLimits.low : "";
            const encodedHigh = parsedLimits && parsedLimits.high !== null ? parsedLimits.high : "";
            const encodedRefText = encodeURIComponent(refRangeDisplay);

            html += `
                <tr class="clickable-param-row ${rowHighlightClass}" onclick="openParamModal('${encodedParam}', '${encodedUnit}', '${encodedLow}', '${encodedHigh}', '${encodedRefText}')" title="Click to view ${formatValue(result.component_name)} trend graph">
                    <td data-label="Test Parameter"><strong>${formatValue(result.component_name)}</strong></td>
                    <td data-label="Result">${displayVal}</td>
                    <td data-label="Unit">${formatValue(result.unit)}</td>
                    <td data-label="Reference Range">${refRangeDisplay}</td>
                    <td data-label="Status">
                        <span class="lab-status ${statusBadgeClass}">${statusDisplay}</span>
                    </td>
                    <td class="param-action-arrow">›</td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;

    } catch(error) {
        console.error(error);
        container.innerHTML = `<p class="field-error-msg visible">Error: ${error.message}</p>`;
    }
}

/* =========================================================
   HISTORICAL PARAMETER TREND MODAL & VISUALIZATION
========================================================= */

async function openParamModal(encParam, encUnit, lowStr, highStr, encRefText) {
    const paramName = decodeURIComponent(encParam);
    const unit = decodeURIComponent(encUnit);
    const refText = decodeURIComponent(encRefText);

    if (!activePatient || !activePatient.id) {
        alert("Active Patient ID missing.");
        return;
    }

    currentModalParam = {
        name: paramName,
        unit: unit,
        refLow: lowStr !== "" ? parseFloat(lowStr) : null,
        refHigh: highStr !== "" ? parseFloat(highStr) : null,
        refText: refText !== "—" ? refText : null
    };

    document.getElementById("param-modal-title").textContent = `${paramName} Trend`;
    document.getElementById("param-modal-unit-label").textContent = unit ? `Unit: ${unit}` : "";
    document.getElementById("param-modal-range-display").textContent = currentModalParam.refText ? `Reference: ${currentModalParam.refText}` : "";
    document.getElementById("param-modal-msg").textContent = "Loading historical parameter records...";

    document.getElementById("param-modal-backdrop").classList.add("active");

    try {
        const response = await fetch(`${API_BASE_URL}/labs/patient/${activePatient.id}/trends/${encodeURIComponent(paramName)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to load trend data");
        }

        currentModalRecords = Array.isArray(data) ? data : [];

        const dateValues = currentModalRecords
            .map(r => extractDateFromTimestamp(r.report_date))
            .filter(Boolean)
            .sort();

        if (dateValues.length > 0) {
            document.getElementById("param-filter-from").value = dateValues[0];
            document.getElementById("param-filter-to").value = dateValues[dateValues.length - 1];
        } else {
            document.getElementById("param-filter-from").value = "";
            document.getElementById("param-filter-to").value = "";
        }

        renderParamModalChart();

    } catch (e) {
        console.error("Param modal fetch error:", e);
        document.getElementById("param-modal-msg").textContent = `Error: ${e.message}`;
    }
}

function closeParamModal(event) {
    if (event && event.target && event.target.id !== "param-modal-backdrop" && !event.target.classList.contains("modal-close-btn")) {
        return;
    }
    const backdrop = document.getElementById("param-modal-backdrop");
    if (backdrop) backdrop.classList.remove("active");

    if (modalTrendChart) {
        modalTrendChart.destroy();
        modalTrendChart = null;
    }
}

function renderParamModalChart() {
    const fromDate = document.getElementById("param-filter-from").value;
    const toDate = document.getElementById("param-filter-to").value;
    const msgEl = document.getElementById("param-modal-msg");
    const canvas = document.getElementById("param-modal-chart");
    const ctx = canvas.getContext("2d");

    if (modalTrendChart) {
        modalTrendChart.destroy();
        modalTrendChart = null;
    }

    if (!currentModalRecords || currentModalRecords.length === 0) {
        msgEl.textContent = "No historical results available.";
        return;
    }

    let filtered = currentModalRecords.filter(item => {
        const itemDate = extractDateFromTimestamp(item.report_date);
        if (!itemDate) return true;
        if (fromDate && itemDate < fromDate) return false;
        if (toDate && itemDate > toDate) return false;
        return true;
    });

    if (filtered.length === 0) {
        msgEl.textContent = "No results found within the selected date range.";
        return;
    }

    const numericPoints = [];
    let hasNonNumeric = false;

    filtered.forEach(item => {
        let val = null;
        if (item.value !== null && item.value !== undefined && !isNaN(Number(item.value))) {
            val = Number(item.value);
        } else if (item.value_numeric !== null && item.value_numeric !== undefined && !isNaN(Number(item.value_numeric))) {
            val = Number(item.value_numeric);
        } else {
            hasNonNumeric = true;
        }

        numericPoints.push({
            dateStr: formatTrendDate(item.report_date),
            rawDate: item.report_date,
            value: val,
            flag: item.flag || "normal"
        });
    });

    if (hasNonNumeric && numericPoints.every(p => p.value === null)) {
        msgEl.textContent = "Graph unavailable for non-numeric findings. Textual status: " + filtered.map(f => f.value || f.value_text || f.flag).join(", ");
        return;
    }

    if (filtered.length === 1) {
        msgEl.textContent = "Only one historical result is available.";
    } else {
        msgEl.textContent = "";
    }

    const labels = numericPoints.map(p => p.dateStr);
    const dataValues = numericPoints.map(p => p.value);

    const pointColors = numericPoints.map(p => {
        if (currentModalParam && currentModalParam.refLow !== null && p.value !== null && p.value < currentModalParam.refLow) {
            return "#dc2626";
        }
        if (currentModalParam && currentModalParam.refHigh !== null && p.value !== null && p.value > currentModalParam.refHigh) {
            return "#dc2626";
        }
        return "#2563eb";
    });

    const datasets = [
        {
            label: `${currentModalParam.name} (${currentModalParam.unit || "Value"})`,
            data: dataValues,
            borderColor: "#2563eb",
            backgroundColor: "rgba(37, 99, 235, 0.08)",
            pointBackgroundColor: pointColors,
            pointBorderColor: pointColors,
            pointRadius: 6,
            pointHoverRadius: 8,
            tension: 0.25,
            fill: true
        }
    ];

    if (currentModalParam && currentModalParam.refHigh !== null) {
        datasets.push({
            label: `Upper Limit (${currentModalParam.refHigh})`,
            data: new Array(labels.length).fill(currentModalParam.refHigh),
            borderColor: "rgba(220, 38, 38, 0.4)",
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        });
    }

    if (currentModalParam && currentModalParam.refLow !== null) {
        datasets.push({
            label: `Lower Limit (${currentModalParam.refLow})`,
            data: new Array(labels.length).fill(currentModalParam.refLow),
            borderColor: "rgba(220, 38, 38, 0.4)",
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        });
    }

    modalTrendChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: "index"
            },
            plugins: {
                legend: {
                    display: true,
                    position: "top",
                    labels: {
                        boxWidth: 12,
                        font: { size: 11 }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: "Report Date" }
                },
                y: {
                    title: { display: true, text: currentModalParam.unit || "Value" },
                    beginAtZero: false
                }
            }
        }
    });
}

/* =========================================================
   MAIN SECTION LAB HISTORICAL TREND (STANDALONE TAB)
========================================================= */

async function loadLabTrend() {
    const patientId = document.getElementById("trend-patient-id").value;
    const component = document.getElementById("trend-component").value.trim();
    const container = document.getElementById("lab-trend-container");

    if (!patientId) {
        container.innerHTML = `<p class="field-error-msg visible">Please enter Patient ID.</p>`;
        return;
    }

    if (!component) {
        container.innerHTML = `<p class="field-error-msg visible">Please enter a lab component.</p>`;
        return;
    }

    container.innerHTML = "<p>Loading lab trend...</p>";

    try {
        const response = await fetch(`${API_BASE_URL}/labs/patient/${patientId}/trends/${encodeURIComponent(component)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to load lab trend");
        }

        if (data.length === 0) {
            container.innerHTML = `
                <div class="empty-state compact">
                    <p>No historical results found for <strong>${component}</strong>.</p>
                </div>
            `;
            return;
        }

        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Component</th>
                        <th>Value</th>
                        <th>Unit</th>
                        <th>Flag</th>
                    </tr>
                </thead>
                <tbody>
        `;

        data.forEach(function(item) {
            let value = "—";
            if (item.value !== null && item.value !== undefined) {
                value = item.value;
            } else if (item.value_text !== null && item.value_text !== undefined) {
                value = item.value_text;
            }

            tableHTML += `
                <tr>
                    <td data-label="Date">${formatValue(item.report_date)}</td>
                    <td data-label="Component">${formatValue(item.component_name)}</td>
                    <td data-label="Value">${value}</td>
                    <td data-label="Unit">${formatValue(item.unit)}</td>
                    <td data-label="Flag">${formatValue(item.flag)}</td>
                </tr>
            `;
        });

        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;

    } catch(error) {
        console.error(error);
        container.innerHTML = `<p class="field-error-msg visible">Error: ${error.message}</p>`;
    }
}

async function loadLabTrendChart() {
    const patientId = document.getElementById("trend-patient-id").value;
    const component = document.getElementById("trend-component").value.trim();

    if (!patientId) {
        alert("Please enter Patient ID.");
        return;
    }

    if (!component) {
        alert("Please enter a lab component.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/labs/patient/${patientId}/trends/${encodeURIComponent(component)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to load lab trend");
        }

        if (!data || data.length === 0) {
            alert(`No historical results found for ${component}`);
            return;
        }

        const labels = data.map(item => formatTrendDate(item.report_date));
        const values = data.map(item => {
            if (item.value !== null && item.value !== undefined) return Number(item.value);
            if (item.value_numeric !== null && item.value_numeric !== undefined) return Number(item.value_numeric);
            return null;
        });

        const canvas = document.getElementById("lab-trend-chart");
        const ctx = canvas.getContext("2d");

        if (labTrendChart) {
            labTrendChart.destroy();
        }

        labTrendChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [{
                    label: component,
                    data: values,
                    borderColor: "#2563eb",
                    backgroundColor: "rgba(37, 99, 235, 0.08)",
                    tension: 0.3,
                    fill: true,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: "index"
                },
                plugins: {
                    title: {
                        display: true,
                        text: `${component} - Historical Trend`
                    },
                    legend: {
                        display: true
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: "Report Date"
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: getTrendUnit(data)
                        },
                        beginAtZero: false
                    }
                }
            }
        });

    } catch(error) {
        console.error("Lab trend error:", error);
        alert("Error loading trend: " + error.message);
    }
}

/* =========================================================
   HEALTH ASSISTANT (AI CHATBOT) IMPLEMENTATION
========================================================= */

function initChatbotAssistant() {
    chatMessages = [
        {
            sender: "assistant",
            text: "Hello! I'm your HealthTrack AI Assistant. I can help you understand the health information available in HealthTrack.",
            timestamp: new Date().toISOString()
        }
    ];
    renderChatMessages();
    updateChatbotPatientContext();
}

function updateChatbotPatientContext() {
    const nameEl = document.getElementById("chat-patient-name");
    const idBadgeEl = document.getElementById("chat-patient-id-badge");

    if (!nameEl || !idBadgeEl) return;

    if (activePatient && activePatient.id) {
        nameEl.textContent = `Patient: ${activePatient.name || "Patient Profile Loaded"}`;
        idBadgeEl.textContent = `Patient ID: #${activePatient.id}`;
    } else {
        nameEl.textContent = "Patient: No patient selected";
        idBadgeEl.textContent = "Patient ID: —";
    }
}

function renderChatMessages() {
    const container = document.getElementById("chat-messages-container");
    if (!container) return;

    let html = "";
    chatMessages.forEach(msg => {
        const isUser = msg.sender === "user";
        const timeFormatted = formatTimeOrDateTime(msg.timestamp);

        html += `
            <div class="chat-bubble-wrapper ${isUser ? 'user' : 'assistant'}">
                <div class="chat-bubble-avatar">${isUser ? 'You' : 'AI'}</div>
                <div class="chat-bubble">
                    <p>${escapeHTML(msg.text)}</p>
                    <span class="chat-bubble-time">${timeFormatted}</span>
                </div>
            </div>
        `;
    });

    if (isChatBotTyping) {
        html += `
            <div class="chat-bubble-wrapper assistant">
                <div class="chat-bubble-avatar">AI</div>
                <div class="chat-bubble">
                    <div class="chat-typing-indicator">
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
    scrollChatToBottom();
}

function scrollChatToBottom() {
    const container = document.getElementById("chat-messages-container");
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function handleChatInputKeydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSendChatMessage(event);
    }
}

async function handleSendChatMessage(event) {
    if (event) event.preventDefault();

    if (!activePatient || !activePatient.id) {
        alert("Please select or activate a patient before consulting the Health Assistant.");
        return;
    }

    const input = document.getElementById("chat-message-input");
    const sendBtn = document.getElementById("chat-send-btn");
    if (!input) return;

    const userText = input.value.trim();
    if (!userText || isChatBotTyping) return;

    // 1. Append and render User message immediately
    chatMessages.push({
        sender: "user",
        text: userText,
        timestamp: new Date().toISOString()
    });

    input.value = "";
    input.style.height = "auto";
    isChatBotTyping = true;
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.classList.add("loading");
    }
    renderChatMessages();

    // 2. Query backend POST /chatbot/ask
    try {
        const response = await fetch(`${API_BASE_URL}/chatbot/ask`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                patient_id: Number(activePatient.id),
                question: userText
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Unable to retrieve clinical analysis at this time.");
        }

        chatMessages.push({
            sender: "assistant",
            text: data.answer || "No response received from clinical model.",
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("Chatbot request error:", error);
        chatMessages.push({
            sender: "assistant",
            text: `Assistant unavailable: ${error.message || "Please check server connectivity."}`,
            timestamp: new Date().toISOString()
        });
    } finally {
        isChatBotTyping = false;
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.classList.remove("loading");
        }
        renderChatMessages();
    }
}

function escapeHTML(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/\n/g, "<br>");
}

/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", async function() {
    initMonitoringDefaults();
    initChatbotAssistant();
    await restoreActivePatientFromStorage();
    navigateTo("dashboard");
});
// Electron dependencies removed. Web context assumed.

const DEFAULT_FLEXIBLE_DAYS = 14;
const FIXED_COMPANY_DAYS = 16;

function getEmpDisplayName(emp) {
    return emp.nickname ? `${emp.name} (${emp.nickname})` : emp.name;
}

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let currentUserId = 1;
let showNamesOnCalendar = false;

if (currentYear < 2026) currentYear = 2026;

// Init selects
const yearSelect = document.getElementById('year-select');
for (let y = 2026; y <= 2100; y++) {
    const option = document.createElement('option');
    option.value = y;
    option.textContent = y;
    if (y === currentYear) option.selected = true;
    yearSelect.appendChild(option);
}

// Check role
const userRole = localStorage.getItem('role') || 'employee';
const loggedUserId = parseInt(localStorage.getItem('userId'), 10);
if (userRole !== 'admin') {
    document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('fixed-vacation-cb').parentElement.style.display = 'none';

    // An employee can ONLY see their own tab
    currentUserId = loggedUserId;
} else {
    // Current user id defaults to the first employee loaded later if not set
}

// Sidebar 
const employeeList = document.getElementById('employee-list');
const confirmModal = document.getElementById('confirm-modal');
const confirmModalMsg = document.getElementById('confirm-modal-msg');
const empModal = document.getElementById('emp-modal');

let pendingDateStr = null;
let pendingType = null;

function renderSidebar() {
    employeeList.innerHTML = '';
    let currentGroup = "";

    // Safety check
    if (!Storage.data.employees || !Array.isArray(Storage.data.employees)) {
        Storage.data.employees = getInitialStore().employees;
    }

    Storage.data.employees.forEach(emp => {
        if (emp.hideFromList) return;

        if (emp.dept !== currentGroup) {
            const title = document.createElement('div');
            title.className = 'group-title';
            title.textContent = emp.dept;
            employeeList.appendChild(title);
            currentGroup = emp.dept;
        }
        const item = document.createElement('div');
        item.className = 'employee-item';
        item.id = `emp-item-${emp.id}`;

        if (emp.id === currentUserId) item.classList.add('selected');

        item.innerHTML = `
        <div class="color-dot" style="background-color: ${emp.color};"></div>
        <span>${emp.name}</span>
      `;
        item.onclick = () => selectEmployee(emp.id);
        employeeList.appendChild(item);
    });
}

function selectEmployee(id) {
    if (userRole !== 'admin' && id !== loggedUserId) {
        showCustomAlert("Como empleado, solo puedes ver tus propios datos.");
        return;
    }

    currentUserId = id;
    document.querySelectorAll('.employee-item').forEach(el => el.classList.remove('selected'));
    const selectedEl = document.getElementById(`emp-item-${id}`);
    if (selectedEl) selectedEl.classList.add('selected');

    document.getElementById('fixed-vacation-cb').checked = false;

    document.getElementById('extra-days-input').value = Storage.data.extraDays[id] || 0;

    updateUI();
}

async function init() {
    await Storage.load();
    if (!Storage.data.substitutions) Storage.data.substitutions = {};
    // Validate currentUserId
    if (!Storage.data.employees.find(e => e.id === currentUserId) && Storage.data.employees.length > 0) {
        currentUserId = Storage.data.employees[0].id;
    }
    renderSidebar();
    updateUI();
}

function updateUI() {
    renderCalendar(currentYear, currentMonth, currentUserId, Storage.data, showNamesOnCalendar);
    updateStats();
}

function updateStats() {
    const statsDiv = document.getElementById('user-stats');
    const userVac = Storage.data.userVacations[currentUserId] || [];

    const flexBase = DEFAULT_FLEXIBLE_DAYS;
    const extra = Storage.data.extraDays[currentUserId] || 0;
    const totalFlexible = flexBase + extra;
    const globalTotal = FIXED_COMPANY_DAYS + totalFlexible;

    const vacCount = userVac.filter(v => v.type === 'vacation').length;
    const apCount = userVac.filter(v => v.type === 'personal').length;
    const totalUsed = vacCount + apCount;

    if (currentUserId === 19 || currentUserId === 20) {
        statsDiv.innerHTML = `
      <strong>Sin límites de días</strong><br>
      Vacaciones marcadas: ${vacCount}<br>
      Asuntos Propios: ${apCount}
    `;
    } else {
        const remainingFlex = totalFlexible - totalUsed;
        statsDiv.innerHTML = `
      <strong style="color:var(--secondary-color)">📊 Cómputo Global: ${globalTotal} días</strong><br>
      <hr style="margin:6px 0;border-color:#eee">
      Días Empresa (fijos): ${FIXED_COMPANY_DAYS}<br>
      Días Elegibles: ${flexBase}<br>
      Días Extra: ${extra}<br>
      <hr style="margin:6px 0;border-color:#eee">
      Vacaciones Gastadas: ${vacCount}<br>
      Asuntos Propios: ${apCount}<br>
      <strong>Restantes (elegibles): ${remainingFlex}</strong>
    `;
    }
}

async function onDayClick(dateStr) {
    const isAdminSelection = document.getElementById('fixed-vacation-cb').checked;

    if (isAdminSelection) {
        if (userRole !== 'admin') {
            showCustomAlert("Solo los administradores pueden hacer esto.");
            return;
        }

        const idx = Storage.data.fixedVacations.indexOf(dateStr);
        const isAdding = idx < 0;

        const success = await Storage.toggleFixedVacation(dateStr, isAdding);
        if (success) {
            if (isAdding) Storage.data.fixedVacations.push(dateStr);
            else Storage.data.fixedVacations.splice(idx, 1);
            updateUI();
        }
    } else {
        if (userRole !== 'admin' && currentUserId !== loggedUserId) {
            showCustomAlert("No puedes modificar los días de otra persona.");
            return;
        }

        if (Storage.data.fixedVacations.includes(dateStr)) {
            showCustomAlert("Este día es una vacación global obligatoria de la empresa.");
            return;
        }

        const type = document.querySelector('input[name="selection-type"]:checked').value;

        if (!Storage.data.userVacations[currentUserId]) {
            Storage.data.userVacations[currentUserId] = [];
        }

        const userVacList = Storage.data.userVacations[currentUserId];
        const existingIdx = userVacList.findIndex(v => v.date === dateStr);

        if (existingIdx >= 0) {
            const success = await Storage.toggleVacation(currentUserId, dateStr, type, false);
            if (success) {
                userVacList.splice(existingIdx, 1);
                updateUI();
            }
        } else {
            const base = DEFAULT_FLEXIBLE_DAYS;
            const extra = Storage.data.extraDays[currentUserId] || 0;
            const totalAllowed = base + extra;
            const currentlyUsed = userVacList.length;

            if (currentlyUsed >= totalAllowed && currentUserId !== 19 && currentUserId !== 20) {
                pendingDateStr = dateStr;
                pendingType = type;
                confirmModalMsg.textContent = `El empleado ya ha agotado sus ${totalAllowed} días. ¿Deseas concederle 1 día extra y marcar esta fecha?`;
                confirmModal.style.display = 'flex';
                return;
            }

            const checkResult = canBookVacation(currentUserId, dateStr, Storage.data);
            if (!checkResult.allowed) {
                if (userRole === 'admin') {
                    if (!window.confirm("Aviso Jefe: " + checkResult.reason + "\n\n¿Quieres sobreescribir esta regla y asignar el día de todos modos?")) {
                        return;
                    }
                } else {
                    showCustomAlert(checkResult.reason);
                    return;
                }
            }

            if (type === 'personal') {
                if (!window.confirm("Aviso: Vas a coger un día de 'Asuntos Propios'. ¿Estás seguro de continuar?")) {
                    return;
                }
            }

            const success = await Storage.toggleVacation(currentUserId, dateStr, type, true);
            if (success) {
                userVacList.push({ date: dateStr, type: type });
                updateUI();
            }
        }
    }
}

document.getElementById('prev-month').onclick = () => { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; yearSelect.value = currentYear; } updateUI(); };
document.getElementById('next-month').onclick = () => { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; yearSelect.value = currentYear; } updateUI(); };
yearSelect.onchange = (e) => { currentYear = parseInt(e.target.value); updateUI(); };

document.getElementById('grant-days-btn').onclick = async () => {
    const uid = currentUserId;
    const extra = parseInt(document.getElementById('extra-days-input').value) || 0;

    document.getElementById('grant-days-btn').disabled = true;
    const success = await Storage.updateExtraDays(uid, extra);
    document.getElementById('grant-days-btn').disabled = false;

    if (success) {
        Storage.data.extraDays[uid] = extra;
        showCustomAlert(`Días extra guardados correctamente para ${getEmpDisplayName(Storage.data.employees.find(e => e.id === uid))}`);
        updateUI();
    } else {
        showCustomAlert('Error al guardar los días extra en el servidor. Revisa tu conexión.');
    }
};

document.getElementById('confirm-cancel').onclick = () => { confirmModal.style.display = 'none'; pendingDateStr = null; pendingType = null; };
document.getElementById('confirm-accept').onclick = async () => {
    if (!pendingDateStr) return;
    const checkResult = canBookVacation(currentUserId, pendingDateStr, Storage.data);
    if (!checkResult.allowed) {
        if (userRole === 'admin') {
            if (!window.confirm("Aviso Jefe: " + checkResult.reason + "\n\n¿Quieres sobreescribir esta regla y asignar el día de todos modos?")) {
                confirmModal.style.display = 'none'; pendingDateStr = null; pendingType = null; return;
            }
        } else {
            confirmModal.style.display = 'none'; showCustomAlert(checkResult.reason); pendingDateStr = null; pendingType = null; return;
        }
    }
    if (!Storage.data.extraDays[currentUserId]) Storage.data.extraDays[currentUserId] = 0;
    Storage.data.extraDays[currentUserId] += 1;
    document.getElementById('extra-days-input').value = Storage.data.extraDays[currentUserId];
    Storage.data.userVacations[currentUserId].push({ date: pendingDateStr, type: pendingType });
    confirmModal.style.display = 'none'; pendingDateStr = null; pendingType = null;
    await Storage.save(); updateUI();
};

function showCustomAlert(msg) { document.getElementById('custom-alert-msg').textContent = msg; document.getElementById('custom-alert').style.display = 'flex'; }
document.getElementById('custom-alert-btn').onclick = () => { document.getElementById('custom-alert').style.display = 'none'; };

// EMPLOYEE MANAGEMENT
let editingEmpId = null;

document.getElementById('toggle-names-btn').onclick = () => {
    showNamesOnCalendar = !showNamesOnCalendar;
    document.getElementById('toggle-names-btn').textContent = showNamesOnCalendar ? "Mostrar Colores en Calendario" : "Mostrar Nombres en Calendario";
    updateUI();
};

// CATEGORY MODAL LOGIC
const categoryModal = document.getElementById('category-modal');
const categoryModalTitle = document.getElementById('category-modal-title');
const categoryModalList = document.getElementById('category-modal-list');
const categoryModalNewInput = document.getElementById('category-modal-new-input');
let currentCategoryTarget = null; // 'dept' or 'group'

function openCategoryModal(type) {
    currentCategoryTarget = type;
    categoryModalTitle.textContent = type === 'dept' ? 'Seleccionar Departamento' : 'Seleccionar Grupo';
    categoryModalNewInput.value = '';

    // Grab unique values
    const items = new Set();
    Storage.data.employees.forEach(emp => {
        if (type === 'dept' && emp.dept) items.add(emp.dept);
        if (type === 'group' && emp.group) items.add(emp.group);
    });

    categoryModalList.innerHTML = '';
    if (items.size === 0) {
        categoryModalList.innerHTML = '<p style="color:#999; font-size:0.9rem;">No hay opciones guardadas todavía.</p>';
    } else {
        items.forEach(item => {
            const btn = document.createElement('button');
            btn.textContent = item;
            btn.style.padding = '8px 12px';
            btn.style.border = '1px solid var(--primary-color)';
            btn.style.background = 'white';
            btn.style.color = 'var(--primary-color)';
            btn.style.borderRadius = '4px';
            btn.style.cursor = 'pointer';
            btn.onclick = () => selectCategory(item);
            categoryModalList.appendChild(btn);
        });
    }

    categoryModal.style.display = 'flex';
}

function selectCategory(value) {
    if (currentCategoryTarget === 'dept') document.getElementById('emp-dept').value = value;
    if (currentCategoryTarget === 'group') document.getElementById('emp-group').value = value;
    categoryModal.style.display = 'none';
}

document.getElementById('category-modal-add-btn').onclick = () => {
    const val = categoryModalNewInput.value.trim();
    if (val) selectCategory(val);
};

document.getElementById('category-modal-cancel').onclick = () => {
    categoryModal.style.display = 'none';
};

document.getElementById('emp-dept').onclick = () => openCategoryModal('dept');
document.getElementById('emp-group').onclick = () => openCategoryModal('group');

document.getElementById('manage-emp-btn').onclick = () => {
    renderEmpManageList();
    empModal.style.display = 'flex';
};

document.getElementById('emp-modal-close').onclick = () => {
    empModal.style.display = 'none';
};

function renderEmpManageList() {
    const container = document.getElementById('emp-list-manage');
    container.innerHTML = '<h3>Empleados Existentes</h3>';
    Storage.data.employees.forEach(emp => {
        const div = document.createElement('div');
        div.style.padding = '8px';
        div.style.border = '1px solid #ccc';
        div.style.marginBottom = '5px';
        div.style.cursor = 'pointer';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.borderRadius = '4px';
        div.innerHTML = `<span><span style="color:${emp.color}">●</span> ${getEmpDisplayName(emp)} (${emp.dept})</span>`;
        div.onclick = () => loadEmpForm(emp);
        container.appendChild(div);
    });
}

function loadEmpForm(emp) {
    editingEmpId = emp.id;
    document.getElementById('emp-name').value = emp.name;
    document.getElementById('emp-nickname').value = emp.nickname || '';
    document.getElementById('emp-dept').value = emp.dept;
    document.getElementById('emp-group').value = emp.group;
    document.getElementById('emp-color').value = emp.color;
    document.getElementById('emp-hide').checked = emp.hideFromList || false;
    document.getElementById('emp-delete-btn').style.display = 'block';
}

document.getElementById('emp-new-btn').onclick = () => {
    editingEmpId = null;
    document.getElementById('emp-name').value = '';
    document.getElementById('emp-nickname').value = '';
    document.getElementById('emp-dept').value = '';
    document.getElementById('emp-group').value = '';
    document.getElementById('emp-color').value = '#000000';
    document.getElementById('emp-hide').checked = false;
    document.getElementById('emp-delete-btn').style.display = 'none';
};

document.getElementById('emp-save-btn').onclick = async () => {
    const name = document.getElementById('emp-name').value;
    const nickname = document.getElementById('emp-nickname').value;
    const dept = document.getElementById('emp-dept').value;
    const group = document.getElementById('emp-group').value;
    const color = document.getElementById('emp-color').value;
    const hide = document.getElementById('emp-hide').checked;

    if (!name || !dept || !group) {
        showCustomAlert("Por favor, rellena nombre, departamento y grupo.");
        return;
    }

    if (editingEmpId) {
        // Edit existing — call server API
        const success = await Storage.updateEmployee({
            id: editingEmpId, name, nickname, dept, group, color, hideFromList: hide
        });
        if (success) {
            const emp = Storage.data.employees.find(e => e.id === editingEmpId);
            if (emp) {
                emp.name = name;
                emp.nickname = nickname;
                emp.dept = dept;
                emp.group = group;
                emp.color = color;
                emp.hideFromList = hide;
            }
            renderEmpManageList();
            renderSidebar();
            updateUI();
            showCustomAlert("Empleado guardado correctamente.");
        } else {
            showCustomAlert("Error al guardar el empleado en el servidor.");
        }
    } else {
        // Create new — call server API
        const newId = await Storage.createEmployee({
            name, nickname, dept, group, color, hideFromList: hide
        });
        if (newId) {
            Storage.data.employees.push({
                id: newId, name, nickname, dept, group, color, hideFromList: hide
            });
            renderEmpManageList();
            renderSidebar();
            updateUI();
            showCustomAlert("Empleado creado correctamente.");
        } else {
            showCustomAlert("Error al crear el empleado en el servidor.");
        }
    }
};

document.getElementById('emp-delete-btn').onclick = async () => {
    if (editingEmpId) {
        const empIdx = Storage.data.employees.findIndex(e => e.id === editingEmpId);
        if (empIdx >= 0) {
            const success = await Storage.deleteEmployee(editingEmpId);
            if (success) {
                Storage.data.employees.splice(empIdx, 1);
                if (Storage.data.userVacations[editingEmpId]) delete Storage.data.userVacations[editingEmpId];
                if (Storage.data.extraDays[editingEmpId]) delete Storage.data.extraDays[editingEmpId];

                if (currentUserId === editingEmpId) {
                    currentUserId = Storage.data.employees[0] ? Storage.data.employees[0].id : null;
                }
                document.getElementById('emp-new-btn').click();
                renderEmpManageList();
                renderSidebar();
                updateUI();
                showCustomAlert("Empleado eliminado.");
            } else {
                showCustomAlert("Error al eliminar el empleado del servidor.");
            }
        }
    }
};

// EXPORT FUNCTIONS
let currentEmpTabId = null;
let currentEmpViewMode = 'list'; // 'list' or 'calendar'

document.getElementById('toggle-emp-view-btn').onclick = () => {
    currentEmpViewMode = currentEmpViewMode === 'list' ? 'calendar' : 'list';
    document.getElementById('toggle-emp-view-btn').textContent = currentEmpViewMode === 'list' ? "Ver como Calendario Anual" : "Ver como Listado Clásico";
    selectEmpTab(currentEmpTabId);
};

// TABS LOGIC
document.getElementById('tab-calendar').onclick = () => switchTab('calendar');
document.getElementById('tab-employees').onclick = () => switchTab('employees');
document.getElementById('tab-substitutions').onclick = () => switchTab('substitutions');

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.view').forEach(view => view.style.display = 'none');

    // Si es empleado, bloqueamos ir a otra pestaña distinta de employees
    if (userRole !== 'admin' && tab !== 'employees') {
        tab = 'employees';
    }

    if (tab === 'calendar') {
        document.getElementById('tab-calendar').classList.add('active');
        document.getElementById('view-calendar').style.display = 'flex';
        updateUI();
    } else if (tab === 'employees') {
        document.getElementById('tab-employees').classList.add('active');
        document.getElementById('view-employees').style.display = 'flex';
        renderEmpTabList();
    } else {
        document.getElementById('tab-substitutions').classList.add('active');
        document.getElementById('view-substitutions').style.display = 'flex';
        renderSubstitutionsTab();
    }
}

function renderEmpTabList() {
    const container = document.getElementById('tab-emp-list');
    container.innerHTML = '';
    let currentGroup = "";
    Storage.data.employees.forEach(emp => {
        if (emp.hideFromList) return;
        if (emp.dept !== currentGroup) {
            const title = document.createElement('div');
            title.className = 'group-title';
            title.textContent = emp.dept;
            container.appendChild(title);
            currentGroup = emp.dept;
        }
        const item = document.createElement('div');
        item.className = 'employee-item';
        if (emp.id === currentEmpTabId) item.classList.add('selected');
        item.innerHTML = `
        <div class="color-dot" style="background-color: ${emp.color};"></div>
        <span>${getEmpDisplayName(emp)}</span>
      `;
        item.onclick = () => selectEmpTab(emp.id);
        container.appendChild(item);
    });
}

function selectEmpTab(id) {
    currentEmpTabId = id;
    renderEmpTabList(); // refresh selection
    const emp = Storage.data.employees.find(e => e.id === id);
    if (emp) {
        document.getElementById('emp-details-placeholder').style.display = 'none';
        document.getElementById('emp-details-content').style.display = 'block';

        document.getElementById('det-emp-name').textContent = getEmpDisplayName(emp);
        document.getElementById('det-emp-dept').textContent = `${emp.dept} - ${emp.group}`;

        const userVac = Storage.data.userVacations[emp.id] || [];
        const flexBase = DEFAULT_FLEXIBLE_DAYS;
        const extra = Storage.data.extraDays[emp.id] || 0;
        const totalFlexible = flexBase + extra;
        const globalTotal = FIXED_COMPANY_DAYS + totalFlexible;
        const vacCount = userVac.filter(v => v.type === 'vacation').length;
        const apCount = userVac.filter(v => v.type === 'personal').length;
        const totalUsed = vacCount + apCount;

        if (emp.id === 19 || emp.id === 20) {
            document.getElementById('det-emp-stats').textContent = `Días usados: ${vacCount} Vac. / ${apCount} AP (Sin límites)`;
        } else {
            const remainingFlex = totalFlexible - totalUsed;
            document.getElementById('det-emp-stats').textContent = `Cómputo Global: ${globalTotal} días | Elegibles restantes: ${remainingFlex} (de ${totalFlexible})`;
        }

        const ul = document.getElementById('det-emp-dates');
        const calView = document.getElementById('emp-calendar-view');
        const listView = document.getElementById('emp-list-view');

        ul.innerHTML = '';
        const allData = getUserVacationsData(emp);
        if (allData.length === 0) {
            ul.innerHTML = '<li style="color: #666;">Ningún día seleccionado</li>';
        } else {
            allData.forEach(row => {
                const li = document.createElement('li');
                li.style.padding = '8px';
                li.style.background = '#f9f9f9';
                li.style.borderLeft = `4px solid ${row.RawType === 'fixed' ? '#000000' : emp.color}`;
                li.textContent = `${row.Fecha} - ${row.Tipo}`;
                ul.appendChild(li);
            });
        }

        if (currentEmpViewMode === 'list') {
            listView.style.display = 'block';
            calView.style.display = 'none';
        } else {
            listView.style.display = 'none';
            calView.style.display = 'flex';
            const year = parseInt(document.getElementById('year-select').value);
            renderYearlyCalendar('emp-calendar-view', year, Storage.data, false, emp.id);
        }
    }
}

function getUserVacationsData(emp) {
    const vacs = (Storage.data.userVacations[emp.id] || []).map(v => ({ date: v.date, type: v.type }));
    const fixed = (Storage.data.fixedVacations || []).map(d => ({ date: d, type: 'fixed' }));

    const allVacs = [...vacs, ...fixed];
    const sorted = allVacs.sort((a, b) => a.date.localeCompare(b.date));

    return sorted.map(v => {
        const [y, m, d] = v.date.split('-');
        let tipoStr = '';
        if (v.type === 'vacation') tipoStr = 'Vacaciones';
        else if (v.type === 'personal') tipoStr = 'Asuntos Propios';
        else if (v.type === 'fixed') tipoStr = 'Fijadas Empresa';

        return {
            Fecha: `${d}/${m}/${y}`,
            Tipo: tipoStr,
            RawType: v.type
        };
    });
}

function getGlobalVacationsData() {
    let allVacs = [];
    for (const uid in Storage.data.userVacations) {
        const emp = Storage.data.employees.find(e => e.id === parseInt(uid));
        if (!emp) continue;
        Storage.data.userVacations[uid].forEach(v => {
            allVacs.push({ emp: getEmpDisplayName(emp), dept: emp.dept, date: v.date, type: v.type });
        });
    }
    allVacs.sort((a, b) => a.date.localeCompare(b.date));
    return allVacs.map(v => {
        const [y, m, d] = v.date.split('-');
        return {
            Empleado: v.emp,
            Departamento: v.dept,
            Fecha: `${d}/${m}/${y}`,
            Tipo: v.type === 'vacation' ? 'Vacaciones' : 'Asuntos Propios'
        };
    });
}

function getShareText(emp, data) {
    let text = `*Vacaciones Seleccionadas: ${getEmpDisplayName(emp)}*\n\n`;
    if (data.length === 0) return text + "Sin días seleccionados.";
    data.forEach(row => {
        text += `- ${row.Fecha} (${row.Tipo})\n`;
    });
    return text;
}

// EXPORT MODAL LOGIC
const exportModal = document.getElementById('export-options-modal');
const exportDisplayOptions = document.getElementById('export-display-options');
let pendingExportType = null;

document.querySelectorAll('input[name="export-format"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'calendar') exportDisplayOptions.style.display = 'block';
        else exportDisplayOptions.style.display = 'none';
    });
});

document.getElementById('export-modal-cancel').onclick = () => {
    exportModal.style.display = 'none';
    pendingExportType = null;
};

document.getElementById('export-modal-accept').onclick = () => {
    exportModal.style.display = 'none';
    const format = document.querySelector('input[name="export-format"]:checked').value;
    const display = document.querySelector('input[name="export-display"]:checked').value;
    const showNames = display === 'names';

    if (pendingExportType === 'employee-pdf') processEmployeePdfExport(format, showNames);
    else if (pendingExportType === 'employee-excel') processEmployeeExcelExport(format, showNames);
    else if (pendingExportType === 'global-pdf') processGlobalPdfExport(format, showNames);
    else if (pendingExportType === 'global-excel') processGlobalExcelExport(format, showNames);
    else if (pendingExportType === 'sub-pdf') processSubPdfExport(format, showNames);
    else if (pendingExportType === 'sub-excel') processSubExcelExport(format, showNames);
};

function openExportModal(type) {
    pendingExportType = type;
    exportModal.style.display = 'flex';
}

document.getElementById('export-pdf-btn').onclick = () => openExportModal('employee-pdf');
document.getElementById('export-excel-btn').onclick = () => openExportModal('employee-excel');
document.getElementById('export-global-pdf-btn').onclick = () => openExportModal('global-pdf');
document.getElementById('export-global-excel-btn').onclick = () => openExportModal('global-excel');
document.getElementById('export-sub-pdf-btn').onclick = () => openExportModal('sub-pdf');
document.getElementById('export-sub-excel-btn').onclick = () => openExportModal('sub-excel');

// EXPORT IMPLEMENTATIONS
async function processEmployeePdfExport(format, showNames) {
    const emp = Storage.data.employees.find(e => e.id === currentEmpTabId);
    if (!emp) return;

    if (format === 'list') {
        const { jsPDF } = window.jspdf;
        const data = getUserVacationsData(emp).filter(row => row.RawType !== 'fixed');
        const doc = new jsPDF();
        doc.text(`Vacaciones Seleccionadas: ${getEmpDisplayName(emp)}`, 14, 15);
        doc.text(`Departamento: ${emp.dept}`, 14, 25);
        const tableData = data.map(row => [row.Fecha, row.Tipo]);
        doc.autoTable({ startY: 30, head: [['Fecha', 'Tipo']], body: tableData });
        doc.save(`Vacaciones_${emp.name.replace(/\s+/g, '_')}.pdf`);
        showCustomAlert("PDF exportado exitosamente.");
    } else {
        await generateCalendarPDF(`Vacaciones_${emp.name.replace(/\s+/g, '_')}_Calendario`, emp.id, showNames);
    }
}

async function processEmployeeExcelExport(format, showNames) {
    const emp = Storage.data.employees.find(e => e.id === currentEmpTabId);
    if (!emp) return;

    if (format === 'list') {
        const data = getUserVacationsData(emp).filter(row => row.RawType !== 'fixed');
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Vacaciones");
        XLSX.writeFile(wb, `Vacaciones_${emp.name.replace(/\s+/g, '_')}.xlsx`);
        showCustomAlert("Excel exportado exitosamente.");
    } else {
        generateCalendarExcel(`Vacaciones_${emp.name.replace(/\s+/g, '_')}_Calendario`, emp.id, showNames);
    }
}

async function processGlobalPdfExport(format, showNames) {
    if (format === 'list') {
        const { jsPDF } = window.jspdf;
        const data = getGlobalVacationsData();
        const doc = new jsPDF();
        doc.text(`Vacaciones Globales de la Empresa`, 14, 15);
        const tableData = data.map(row => [row.Empleado, row.Departamento, row.Fecha, row.Tipo]);
        doc.autoTable({ startY: 25, head: [['Empleado', 'Departamento', 'Fecha', 'Tipo']], body: tableData });
        doc.save(`Vacaciones_Globales.pdf`);
        showCustomAlert("PDF Global exportado exitosamente.");
    } else {
        await generateCalendarPDF(`Vacaciones_Globales_Calendario`, null, showNames);
    }
}

async function processGlobalExcelExport(format, showNames) {
    if (format === 'list') {
        const data = getGlobalVacationsData();
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Vacaciones Globales");
        XLSX.writeFile(wb, `Vacaciones_Globales.xlsx`);
        showCustomAlert("Excel Global exportado exitosamente.");
    } else {
        generateCalendarExcel(`Vacaciones_Globales_Calendario`, null, showNames);
    }
}

// SUBSTITUTION EXPORTS LOGIC
function getSubstitutionsData() {
    const selectedEmpId = document.getElementById('sub-emp-select').value;
    let data = [];
    if (!Storage.data.substitutions) return data;

    // Loop through all dates
    for (const date in Storage.data.substitutions) {
        for (const uid in Storage.data.substitutions[date]) {
            const subName = Storage.data.substitutions[date][uid].trim();
            if (!subName) continue;
            
            const emp = Storage.data.employees.find(e => e.id === parseInt(uid));
            if (!emp) continue;

            // If filtering by employee
            if (selectedEmpId !== 'all') {
                const isSubstituted = (emp.id === parseInt(selectedEmpId));
                const isSubstituting = subName.toLowerCase().includes(Storage.data.employees.find(e => e.id === parseInt(selectedEmpId)).name.toLowerCase()) || 
                                       subName.toLowerCase().includes(Storage.data.employees.find(e => e.id === parseInt(selectedEmpId)).nickname.toLowerCase());
                if (!isSubstituted && !isSubstituting) continue;
            }

            const [y, m, d] = date.split('-');
            data.push({
                FechaRaw: date,
                Fecha: `${d}/${m}/${y}`,
                Ausente: getEmpDisplayName(emp),
                Sustituto: subName
            });
        }
    }
    data.sort((a, b) => a.FechaRaw.localeCompare(b.FechaRaw));
    return data;
}

async function processSubPdfExport(format, showNames) {
    if (format === 'list') {
        const { jsPDF } = window.jspdf;
        const data = getSubstitutionsData();
        const doc = new jsPDF();
        
        const selectedEmpId = document.getElementById('sub-emp-select').value;
        const title = selectedEmpId === 'all' ? `Listado Global de Sustituciones` : `Sustituciones de ${getEmpDisplayName(Storage.data.employees.find(e => e.id === parseInt(selectedEmpId)))}`;
        
        doc.text(title, 14, 15);
        const tableData = data.map(row => [row.Fecha, row.Ausente, row.Sustituto]);
        doc.autoTable({ startY: 25, head: [['Fecha', 'Personal Ausente', 'Personal Sustituto']], body: tableData });
        const filename = selectedEmpId === 'all' ? 'Sustituciones_Globales' : `Sustituciones_${data[0] ? data[0].Ausente.replace(/\s+/g, '_') : 'Empleado'}`;
        
        doc.save(`${filename}.pdf`);
        showCustomAlert("PDF de Sustituciones exportado con éxito.");
    } else {
        showCustomAlert("El formato de Calendario Anual visual para Sustituciones aún está en desarrollo. Exportado como listado automáticamente.");
        processSubPdfExport('list', showNames);
    }
}

async function processSubExcelExport(format, showNames) {
    const XLSX = window.XLSX;
    if (format === 'list') {
        const data = getSubstitutionsData();
        const exportData = data.map(({ FechaRaw, ...rest }) => rest);
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sustituciones");
        
        const selectedEmpId = document.getElementById('sub-emp-select').value;
        const filename = selectedEmpId === 'all' ? 'Sustituciones_Globales' : `Sustituciones_${data[0] ? data[0].Ausente.replace(/\s+/g, '_') : 'Empleado'}`;

        XLSX.writeFile(wb, `${filename}.xlsx`);
        showCustomAlert("Excel de Sustituciones exportado con éxito.");
    } else {
        showCustomAlert("El formato de Calendario Anual visual para Sustituciones aún está en desarrollo. Exportado como listado automáticamente.");
        processSubExcelExport('list', showNames);
    }
}

async function generateCalendarPDF(filename, focusEmpId, showNames) {
    const year = parseInt(document.getElementById('year-select').value);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfPageHeight = pdf.internal.pageSize.getHeight();
    const title = focusEmpId ? `Calendario de Vacaciones: ${getEmpDisplayName(Storage.data.employees.find(e => e.id === focusEmpId))} - ${year}` : `Calendario Global de Vacaciones - ${year}`;

    showCustomAlert("Generando PDF (Puede tardar unos segundos)...");

    for (let i = 0; i < 6; i++) {
        const startMonth = i * 2;
        const endMonth = startMonth + 1;

        const tempDiv = document.createElement('div');
        tempDiv.id = `print-calendar-container-${i}`;
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '0';
        tempDiv.style.width = '1000px';
        tempDiv.style.display = 'flex';
        tempDiv.style.flexWrap = 'wrap';
        tempDiv.style.gap = '15px';
        tempDiv.style.padding = '20px';
        tempDiv.style.background = 'white';
        tempDiv.style.height = 'auto'; // allow natural vertical scaling
        document.body.appendChild(tempDiv);

        renderYearlyCalendar(tempDiv.id, year, Storage.data, showNames, focusEmpId, startMonth, endMonth);

        try {
            const canvas = await html2canvas(tempDiv, {
                scale: 2,
                windowWidth: tempDiv.scrollWidth,
                windowHeight: tempDiv.scrollHeight
            });
            const imgData = canvas.toDataURL('image/png');

            if (i > 0) pdf.addPage();

            pdf.setFontSize(16);
            pdf.text(`${title} (Parte ${i + 1}/6)`, 40, 40);

            let finalWidth = pdfWidth - 40;
            let finalHeight = (canvas.height * finalWidth) / canvas.width;

            if (finalHeight > pdfPageHeight - 80) {
                finalHeight = pdfPageHeight - 80;
                finalWidth = (canvas.width * finalHeight) / canvas.height;
            }

            let xOffset = (pdfWidth - finalWidth) / 2;
            if (xOffset < 20) xOffset = 20;

            pdf.addImage(imgData, 'PNG', xOffset, 60, finalWidth, finalHeight);
        } catch (e) {
            console.error("Error capturando mes", e);
        } finally {
            document.body.removeChild(tempDiv);
        }
    }

    try {
        pdf.save(`${filename}.pdf`);
        showCustomAlert("Calendario PDF exportado exitosamente.");
    } catch (e) {
        showCustomAlert("Error al generar PDF del calendario.");
    }
}

function generateCalendarExcel(filename, focusEmpId, showNames) {
    const year = parseInt(document.getElementById('year-select').value);
    const wb = XLSX.utils.book_new();
    const ws_data = [];

    let title = focusEmpId ? `Calendario de Vacaciones: ${getEmpDisplayName(Storage.data.employees.find(e => e.id === focusEmpId))} - ${year}` : `Calendario Global de Vacaciones - ${year}`;
    ws_data.push([title]);
    ws_data.push([]);

    for (let month = 0; month < 12; month++) {
        ws_data.push([monthNamesList[month]]);
        ws_data.push(['L', 'M', 'X', 'J', 'V', 'S', 'D']);

        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);

        let currentWeek = [];
        for (let i = 0; i < firstDay; i++) {
            currentWeek.push("");
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            let cellText = `${day}`;

            let dayVacs = [];
            for (const uid in Storage.data.userVacations) {
                if (focusEmpId && parseInt(uid) !== parseInt(focusEmpId)) continue;
                const match = Storage.data.userVacations[uid].find(v => v.date === dateStr);
                if (match) {
                    const emp = Storage.data.employees.find(e => e.id === parseInt(uid));
                    if (emp) dayVacs.push(showNames ? (emp.nickname || emp.name.split(' ')[0]) : "X");
                }
            }

            if (Storage.data.fixedVacations.includes(dateStr)) {
                cellText += " [Fijo]";
            }

            if (dayVacs.length > 0) {
                cellText += `\n(${dayVacs.join(', ')})`;
            }

            currentWeek.push(cellText);

            if (currentWeek.length === 7) {
                ws_data.push(currentWeek);
                currentWeek = [];
            }
        }

        if (currentWeek.length > 0) {
            while (currentWeek.length < 7) currentWeek.push("");
            ws_data.push(currentWeek);
        }
        ws_data.push([]);
    }

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, "Calendario");
    XLSX.writeFile(wb, `${filename}.xlsx`);
    showCustomAlert("Excel Calendario exportado exitosamente.");
}

document.getElementById('share-global-wa-btn').onclick = () => {
    const data = getGlobalVacationsData();
    let text = `*Vacaciones Globales*\n\n`;
    if (data.length === 0) text += "Sin días seleccionados.";
    data.forEach(row => {
        text += `- ${row.Empleado}: ${row.Fecha} (${row.Tipo})\n`;
    });
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
};

// SUBSTITUTIONS LOGIC
const subMonthSelect = document.getElementById('sub-month-select');
const monthNamesList = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
let currentSubMonth = new Date().getMonth();

function renderSubstitutionsTab() {
    subMonthSelect.innerHTML = '';
    monthNamesList.forEach((m, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${m} ${currentYear}`;
        if (i === currentSubMonth) opt.selected = true;
        subMonthSelect.appendChild(opt);
    });

    subMonthSelect.onchange = (e) => {
        currentSubMonth = parseInt(e.target.value);
        renderSubList();
    };

    renderSubList();
}

function renderSubList() {
    const subList = document.getElementById('sub-list');
    subList.innerHTML = '';

    const y = currentYear;
    const m = currentSubMonth;
    const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;

    // Find who is on vacation this month
    let vacsThisMonth = [];
    for (const uid in Storage.data.userVacations) {
        const emp = Storage.data.employees.find(e => e.id === parseInt(uid));
        if (!emp) continue;
        Storage.data.userVacations[uid].forEach(v => {
            if (v.date.startsWith(prefix)) {
                vacsThisMonth.push({ emp, date: v.date, type: v.type });
            }
        });
    }

    vacsThisMonth.sort((a, b) => a.date.localeCompare(b.date));

    if (vacsThisMonth.length === 0) {
        subList.innerHTML = '<p>No hay vacaciones registradas en este mes.</p>';
        return;
    }

    vacsThisMonth.forEach(vac => {
        const [yy, mm, dd] = vac.date.split('-');

        const div = document.createElement('div');
        div.style.padding = '1rem';
        div.style.background = '#f9f9f9';
        div.style.border = '1px solid #ddd';
        div.style.borderRadius = '4px';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'space-between';

        const info = document.createElement('div');
        info.innerHTML = `<strong>${getEmpDisplayName(vac.emp)}</strong> - ${dd}/${mm}/${yy} (${vac.type === 'vacation' ? 'Vacaciones' : 'Asuntos Propios'})`;

        const subDiv = document.createElement('div');
        subDiv.style.display = 'flex';
        subDiv.style.gap = '10px';
        subDiv.style.alignItems = 'center';

        const subInput = document.createElement('input');
        subInput.type = 'text';
        subInput.placeholder = 'Nombre del sustituto';
        subInput.style.padding = '6px';

        // Load existing substitute
        if (Storage.data.substitutions && Storage.data.substitutions[vac.date] && Storage.data.substitutions[vac.date][vac.emp.id]) {
            subInput.value = Storage.data.substitutions[vac.date][vac.emp.id];
        }

        const saveSubBtn = document.createElement('button');
        saveSubBtn.textContent = 'Guardar Sustituto';
        saveSubBtn.style.padding = '6px 10px';
        saveSubBtn.style.cursor = 'pointer';
        saveSubBtn.style.background = 'var(--primary-color)';
        saveSubBtn.style.color = 'white';
        saveSubBtn.style.border = 'none';
        saveSubBtn.style.borderRadius = '4px';

        saveSubBtn.onclick = async () => {
            saveSubBtn.disabled = true;
            const success = await Storage.updateSubstitution(vac.date, vac.emp.id, subInput.value);
            saveSubBtn.disabled = false;
            if (success) {
                if (!Storage.data.substitutions) Storage.data.substitutions = {};
                if (!Storage.data.substitutions[vac.date]) Storage.data.substitutions[vac.date] = {};
                Storage.data.substitutions[vac.date][vac.emp.id] = subInput.value;
                showCustomAlert(`Sustituto guardado para el día ${dd}/${mm}/${yy}`);
            } else {
                showCustomAlert("Error al guardar sustituto en el servidor.");
            }
        };

        subDiv.appendChild(subInput);
        subDiv.appendChild(saveSubBtn);

        div.appendChild(info);
        div.appendChild(subDiv);
        subList.appendChild(div);
    });
}

// Initializing application
init();

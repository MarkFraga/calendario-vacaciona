// Electron dependencies removed. Web context assumed.

const DEFAULT_FLEXIBLE_DAYS = 14;

function getEmpDisplayName(emp) {
    return emp.nickname ? `${emp.name} (${emp.nickname})` : emp.name;
}

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let currentUserId = 1;

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
    // Validate currentUserId
    if (!Storage.data.employees.find(e => e.id === currentUserId) && Storage.data.employees.length > 0) {
        currentUserId = Storage.data.employees[0].id;
    }
    renderSidebar();
    updateUI();
}

function updateUI() {
    renderCalendar(currentYear, currentMonth, currentUserId, Storage.data);
    updateStats();
}

function updateStats() {
    const statsDiv = document.getElementById('user-stats');
    const userVac = Storage.data.userVacations[currentUserId] || [];

    const base = DEFAULT_FLEXIBLE_DAYS;
    const extra = Storage.data.extraDays[currentUserId] || 0;
    const totalAllowed = base + extra;

    const vacCount = userVac.filter(v => v.type === 'vacation').length;
    const apCount = userVac.filter(v => v.type === 'personal').length;

    if (currentUserId === 19 || currentUserId === 20) {
        statsDiv.innerHTML = `
      <strong>Sin límites de días</strong><br>
      Vacaciones marcadas: ${vacCount}<br>
      Asuntos Propios: ${apCount}
    `;
    } else {
        const remaining = totalAllowed - (vacCount + apCount);
        statsDiv.innerHTML = `
      Días Libres Base: ${base}<br>
      Días Extra: ${extra}<br>
      <strong>Total Permitido: ${totalAllowed}</strong><br>
      Vacaciones Gastadas: ${vacCount}<br>
      Asuntos Propios Gastados: ${apCount}<br>
      <strong>Restantes: ${remaining}</strong>
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
            if (!checkResult.allowed && userRole !== 'admin') { // Admins can override rules if they want to physically click it, but web prevents employee overriding.
                showCustomAlert(checkResult.reason);
                return;
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
    if (!checkResult.allowed) { confirmModal.style.display = 'none'; showCustomAlert(checkResult.reason); pendingDateStr = null; pendingType = null; return; }
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
        // Edit existing
        const emp = Storage.data.employees.find(e => e.id === editingEmpId);
        if (emp) {
            emp.name = name;
            emp.nickname = nickname;
            emp.dept = dept;
            emp.group = group;
            emp.color = color;
            emp.hideFromList = hide;
        }
    } else {
        // Create new
        const newId = Math.max(...Storage.data.employees.map(e => e.id), 0) + 1;
        Storage.data.employees.push({
            id: newId,
            name: name,
            nickname: nickname,
            dept: dept,
            group: group,
            color: color,
            hideFromList: hide
        });
    }

    await Storage.save();
    renderEmpManageList();
    renderSidebar();
    updateUI();
    showCustomAlert("Empleado guardado.");
};

document.getElementById('emp-delete-btn').onclick = async () => {
    if (editingEmpId) {
        const empIdx = Storage.data.employees.findIndex(e => e.id === editingEmpId);
        if (empIdx >= 0) {
            Storage.data.employees.splice(empIdx, 1);
            if (Storage.data.userVacations[editingEmpId]) delete Storage.data.userVacations[editingEmpId];
            if (Storage.data.extraDays[editingEmpId]) delete Storage.data.extraDays[editingEmpId];

            await Storage.save();
            if (currentUserId === editingEmpId) {
                currentUserId = Storage.data.employees[0] ? Storage.data.employees[0].id : null;
            }
            document.getElementById('emp-new-btn').click();
            renderEmpManageList();
            renderSidebar();
            updateUI();
            showCustomAlert("Empleado eliminado.");
        }
    }
};

// EXPORT FUNCTIONS
let currentEmpTabId = null;

// TABS LOGIC
document.getElementById('tab-calendar').onclick = () => switchTab('calendar');
document.getElementById('tab-employees').onclick = () => switchTab('employees');

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.view').forEach(view => view.style.display = 'none');
    if (tab === 'calendar') {
        document.getElementById('tab-calendar').classList.add('active');
        document.getElementById('view-calendar').style.display = 'flex';
        updateUI();
    } else {
        document.getElementById('tab-employees').classList.add('active');
        document.getElementById('view-employees').style.display = 'flex';
        renderEmpTabList();
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
        const base = DEFAULT_FLEXIBLE_DAYS;
        const extra = Storage.data.extraDays[emp.id] || 0;
        const totalAllowed = base + extra;
        const vacCount = userVac.filter(v => v.type === 'vacation').length;
        const apCount = userVac.filter(v => v.type === 'personal').length;

        if (emp.id === 19 || emp.id === 20) {
            document.getElementById('det-emp-stats').textContent = `Días usados: ${vacCount} Vac. / ${apCount} AP (Sin límites)`;
        } else {
            const remaining = totalAllowed - (vacCount + apCount);
            document.getElementById('det-emp-stats').textContent = `Días restantes: ${remaining} (de ${totalAllowed})`;
        }

        const ul = document.getElementById('det-emp-dates');
        ul.innerHTML = '';
        const sorted = userVac.slice().sort((a, b) => a.date.localeCompare(b.date));
        if (sorted.length === 0) {
            ul.innerHTML = '<li style="color: #666;">Ningún día seleccionado</li>';
        } else {
            sorted.forEach(v => {
                const [y, m, d] = v.date.split('-');
                const li = document.createElement('li');
                li.style.padding = '8px';
                li.style.background = '#f9f9f9';
                li.style.borderLeft = `4px solid ${emp.color}`;
                li.textContent = `${d}/${m}/${y} - ${v.type === 'vacation' ? 'Vacaciones' : 'Asuntos Propios'}`;
                ul.appendChild(li);
            });
        }
    }
}

function getUserVacationsData(emp) {
    const vacs = Storage.data.userVacations[emp.id] || [];
    const sorted = vacs.slice().sort((a, b) => a.date.localeCompare(b.date));
    return sorted.map(v => {
        const [y, m, d] = v.date.split('-');
        return {
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

document.getElementById('export-pdf-btn').onclick = async () => {
    const { jsPDF } = window.jspdf;

    const emp = Storage.data.employees.find(e => e.id === currentEmpTabId);
    if (!emp) return;
    const data = getUserVacationsData(emp);

    const doc = new jsPDF();
    doc.text(`Vacaciones Seleccionadas: ${getEmpDisplayName(emp)}`, 14, 15);
    doc.text(`Departamento: ${emp.dept}`, 14, 25);

    const tableData = data.map(row => [row.Fecha, row.Tipo]);
    doc.autoTable({
        startY: 30,
        head: [['Fecha', 'Tipo']],
        body: tableData,
    });

    // Native Browser Download
    doc.save(`Vacaciones_${emp.name.replace(/\s+/g, '_')}.pdf`);
    showCustomAlert("PDF exportado exitosamente.");
};

document.getElementById('export-excel-btn').onclick = async () => {
    const emp = Storage.data.employees.find(e => e.id === currentEmpTabId);
    if (!emp) return;
    const data = getUserVacationsData(emp);

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vacaciones");

    // Native Browser Download
    XLSX.writeFile(wb, `Vacaciones_${emp.name.replace(/\s+/g, '_')}.xlsx`);
    showCustomAlert("Excel exportado exitosamente.");
};

document.getElementById('share-wa-btn').onclick = () => {
    const emp = Storage.data.employees.find(e => e.id === currentEmpTabId);
    if (!emp) return;
    const data = getUserVacationsData(emp);
    const text = encodeURIComponent(getShareText(emp, data));
    window.open(`https://wa.me/?text=${text}`, '_blank');
};

document.getElementById('share-email-btn').onclick = () => {
    const emp = Storage.data.employees.find(e => e.id === currentEmpTabId);
    if (!emp) return;
    const data = getUserVacationsData(emp);
    const subject = encodeURIComponent(`Vacaciones de ${getEmpDisplayName(emp)}`);
    const body = encodeURIComponent(getShareText(emp, data));
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
};

init();

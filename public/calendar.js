const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
    // 0 is Sunday, 1 is Monday in JS. We want 0 to be Monday for our grid.
    const date = new Date(year, month, 1);
    let day = date.getDay();
    // Adjust to make Monday = 0
    return day === 0 ? 6 : day - 1;
}

function renderCalendar(year, month, currentUserId, store) {
    const container = document.getElementById('calendar-grid');
    container.innerHTML = '';

    document.getElementById('current-month').textContent = `${monthNames[month]} ${year}`;

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    // Fill empty slots before 1st of month
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'day-cell inactive';
        container.appendChild(emptyCell);
    }

    // Fill days
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const cell = document.createElement('div');
        cell.className = 'day-cell';

        // Check weekend
        const currentDayOfWeek = new Date(year, month, day).getDay();
        if (currentDayOfWeek === 0 || currentDayOfWeek === 6) {
            cell.classList.add('weekend');
        }

        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        cell.appendChild(dayNumber);

        const barsContainer = document.createElement('div');
        barsContainer.className = 'vacation-bars';

        // Highlight if fixed
        if (store.fixedVacations.includes(dateStr)) {
            cell.classList.add('fixed-vacation');
        }

        // Add bars for all vacations
        const dayVacations = [];
        for (const uid in store.userVacations) {
            const uVacations = store.userVacations[uid];
            const match = uVacations.find(v => v.date === dateStr);
            if (match) {
                dayVacations.push({ uid: parseInt(uid), type: match.type });
            }
        }

        dayVacations.forEach(v => {
            const emp = store.employees.find(e => e.id === v.uid);
            if (emp) {
                const bar = document.createElement('div');
                bar.className = 'vacation-bar';
                if (v.type === 'personal') {
                    bar.style.height = '8px';
                    bar.style.backgroundImage = `repeating-linear-gradient(45deg, white, white 4px, ${emp.color} 4px, ${emp.color} 8px)`;
                    bar.style.border = `1px solid ${emp.color}`;
                } else {
                    bar.style.backgroundColor = emp.color;
                }
                barsContainer.appendChild(bar);
            }
        });

        cell.appendChild(barsContainer);

        // Interaction
        cell.onclick = () => onDayClick(dateStr);

        container.appendChild(cell);
    }
}

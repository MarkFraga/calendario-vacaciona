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

function renderCalendar(year, month, currentUserId, store, showNames = false) {
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
        cell.onclick = () => {
            if (window.onDayClick) window.onDayClick(dateStr);
        };

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
                const barContainer = document.createElement('div');
                barContainer.style.display = 'flex';
                barContainer.style.alignItems = 'center';
                barContainer.style.marginBottom = '2px';

                const bar = document.createElement('div');
                bar.className = 'vacation-bar';
                if (v.type === 'personal') {
                    bar.style.height = showNames ? 'auto' : '8px';
                    bar.style.backgroundImage = `repeating-linear-gradient(45deg, white, white 4px, ${emp.color} 4px, ${emp.color} 8px)`;
                    bar.style.border = `1px solid ${emp.color}`;
                } else {
                    bar.style.height = showNames ? 'auto' : '6px';
                    bar.style.backgroundColor = emp.color;
                }

                if (showNames) {
                    bar.style.backgroundColor = 'transparent';
                    bar.style.backgroundImage = 'none';
                    bar.style.border = 'none';

                    const nameSpan = document.createElement('span');
                    nameSpan.textContent = getEmpDisplayName(emp);
                    nameSpan.style.color = emp.color;
                    nameSpan.style.fontSize = '0.75rem';
                    nameSpan.style.fontWeight = 'bold';
                    nameSpan.style.whiteSpace = 'nowrap';
                    nameSpan.style.overflow = 'hidden';
                    nameSpan.style.textOverflow = 'ellipsis';

                    if (v.type === 'personal') {
                        nameSpan.style.textDecoration = 'underline';
                    }

                    barContainer.appendChild(nameSpan);
                } else {
                    barContainer.appendChild(bar);
                }

                barsContainer.appendChild(barContainer);
            }
        });

        cell.appendChild(barsContainer);

        container.appendChild(cell);
    }
}

function renderYearlyCalendar(containerId, year, store, showNames = false, focusEmpId = null, startMonth = 0, endMonth = 11) {
    const mainContainer = document.getElementById(containerId);
    if (!mainContainer) return;
    mainContainer.innerHTML = '';

    for (let month = startMonth; month <= endMonth; month++) {
        const monthWrapper = document.createElement('div');
        monthWrapper.className = 'mini-month';
        monthWrapper.style.border = '1px solid #ddd';
        monthWrapper.style.borderRadius = '8px';
        monthWrapper.style.padding = '10px';
        monthWrapper.style.width = '300px';
        monthWrapper.style.background = 'white';

        const monthTitle = document.createElement('h4');
        monthTitle.textContent = monthNames[month];
        monthTitle.style.textAlign = 'center';
        monthTitle.style.marginBottom = '10px';
        monthTitle.style.color = 'var(--primary-color)';
        monthWrapper.appendChild(monthTitle);

        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
        grid.style.gap = '2px';

        const daysOfWeek = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
        daysOfWeek.forEach(d => {
            const header = document.createElement('div');
            header.textContent = d;
            header.style.textAlign = 'center';
            header.style.fontWeight = 'bold';
            header.style.fontSize = '0.8rem';
            grid.appendChild(header);
        });

        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);

        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            grid.appendChild(empty);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const cell = document.createElement('div');
            cell.style.border = '1px solid #eee';
            cell.style.height = '40px';
            cell.style.position = 'relative';
            cell.style.display = 'flex';
            cell.style.flexDirection = 'column';
            cell.style.overflow = 'hidden';
            cell.style.cursor = 'pointer';
            cell.onclick = () => {
                if (window.onDayClick && localStorage.getItem('role') === 'admin') {
                    window.onDayClick(dateStr, focusEmpId);
                }
            };

            const dayNum = document.createElement('span');
            dayNum.textContent = day;
            dayNum.style.fontSize = '0.75rem';
            dayNum.style.position = 'absolute';
            dayNum.style.top = '2px';
            dayNum.style.right = '2px';
            dayNum.style.zIndex = '1';

            const currentDayOfWeek = new Date(year, month, day).getDay();
            if (currentDayOfWeek === 0 || currentDayOfWeek === 6) {
                cell.style.background = '#f5f5f5';
                dayNum.style.color = '#999';
            }
            cell.appendChild(dayNum);

            const barsContainer = document.createElement('div');
            barsContainer.style.marginTop = '14px';
            barsContainer.style.display = 'flex';
            barsContainer.style.flexDirection = 'column';
            barsContainer.style.gap = '1px';

            if (store.fixedVacations.includes(dateStr)) {
                cell.style.outline = '2px solid black';
                cell.style.outlineOffset = '-2px';
            }

            const dayVacations = [];
            for (const uid in store.userVacations) {
                if (focusEmpId && parseInt(uid) !== focusEmpId) continue;
                const uVacations = store.userVacations[uid];
                const match = uVacations.find(v => v.date === dateStr);
                if (match) {
                    dayVacations.push({ uid: parseInt(uid), type: match.type });
                }
            }

            dayVacations.forEach(v => {
                const emp = store.employees.find(e => e.id === v.uid);
                if (emp) {
                    const barContainer = document.createElement('div');
                    barContainer.style.display = 'flex';
                    barContainer.style.alignItems = 'center';
                    barContainer.style.width = '100%';

                    const bar = document.createElement('div');
                    bar.style.width = '100%';
                    if (v.type === 'personal') {
                        bar.style.height = showNames ? 'auto' : '4px';
                        bar.style.backgroundImage = `repeating-linear-gradient(45deg, white, white 2px, ${emp.color} 2px, ${emp.color} 4px)`;
                        bar.style.border = `1px solid ${emp.color}`;
                    } else {
                        bar.style.height = showNames ? 'auto' : '4px';
                        bar.style.backgroundColor = emp.color;
                    }

                    if (showNames) {
                        bar.style.backgroundColor = 'transparent';
                        bar.style.backgroundImage = 'none';
                        bar.style.border = 'none';

                        const nameSpan = document.createElement('span');
                        let shortName = emp.nickname ? emp.nickname : emp.name.split(' ')[0];
                        // If showNames is enabled, allow the full name/nickname to stretch
                        nameSpan.textContent = shortName;
                        nameSpan.style.color = emp.color;
                        nameSpan.style.fontSize = '0.55rem';
                        nameSpan.style.fontWeight = 'bold';
                        nameSpan.style.whiteSpace = 'nowrap';
                        nameSpan.style.overflow = 'hidden';
                        nameSpan.style.textOverflow = 'ellipsis';
                        nameSpan.style.lineHeight = '1';

                        if (v.type === 'personal') nameSpan.style.textDecoration = 'underline';
                        barContainer.appendChild(nameSpan);
                    } else {
                        barContainer.appendChild(bar);
                    }
                    barsContainer.appendChild(barContainer);
                }
            });

            cell.appendChild(barsContainer);
            grid.appendChild(cell);
        }

        monthWrapper.appendChild(grid);
        mainContainer.appendChild(monthWrapper);
    }
}

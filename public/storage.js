// Storage Web Adapter - Replaces Electron ipcRenderer with fetch API
const API_URL = '/api';

const Storage = {
    data: {
        employees: [],
        extraDays: {},
        userVacations: {},
        fixedVacations: []
    },

    getAuthHeaders() {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/login.html';
            return {};
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    },

    async load() {
        try {
            const res = await fetch(`${API_URL}/data`, {
                headers: this.getAuthHeaders()
            });

            if (res.status === 401 || res.status === 403) {
                window.location.href = '/login.html';
                return false;
            }

            if (!res.ok) throw new Error("Failed to load data");

            const loadedData = await res.json();
            // Deep merge ensures we don't accidentally wipe arrays if they are empty
            this.data = { ...this.data, ...loadedData };
            console.log("Data loaded from server:", this.data);
            return true;
        } catch (error) {
            console.error("Error loading data:", error);
            return false;
        }
    },

    // In the web version, saving entire state is inefficient and dangerous if concurrent users exist.
    // So 'save()' is mostly a placeholder now, as individual actions will hit their own endpoints.
    async save() {
        console.warn("Storage.save() is deprecated in Web Mode. Please use specific API endpoints.");
        return true;
    },

    // API specific mutators
    async toggleVacation(userId, date, type, isAdding) {
        try {
            const res = await fetch(`${API_URL}/vacations`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ userId, date, type, isAdding })
            });
            if (res.status === 403) {
                alert("No tienes permisos para editar las vacaciones de otro usuario.");
                return false;
            }
            return res.ok;
        } catch (e) {
            console.error(e);
            return false;
        }
    },

    async toggleFixedVacation(date, isAdding) {
        try {
            const res = await fetch(`${API_URL}/admin/fixed_vacation`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ date, isAdding })
            });
            if (res.status === 403) alert("Solo los administradores pueden hacer esto.");
            return res.ok;
        } catch (e) {
            return false;
        }
    },

    async updateExtraDays(userId, extraDays) {
        try {
            const res = await fetch(`${API_URL}/admin/extra_days`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ userId, extraDays })
            });
            return res.ok;
        } catch (e) {
            return false;
        }
    },

    async updateEmployee(empData) {
        try {
            const res = await fetch(`${API_URL}/admin/employee`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(empData)
            });
            return res.ok;
        } catch (e) {
            console.error(e);
            return false;
        }
    },

    async createEmployee(empData) {
        try {
            const res = await fetch(`${API_URL}/admin/employee`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(empData)
            });
            if (!res.ok) return null;
            const data = await res.json();
            return data.id || null;
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    async deleteEmployee(empId) {
        try {
            const res = await fetch(`${API_URL}/admin/employee/${empId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });
            return res.ok;
        } catch (e) {
            console.error(e);
            return false;
        }
    }
};

// Logout logic
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            localStorage.removeItem('userId');
            window.location.href = '/login.html';
        });
    }
});

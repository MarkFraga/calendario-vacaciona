// checks if a vacation date is allowed for a user given the current store
function canBookVacation(userId, dateStr, store) {
    const user = store.employees.find(e => e.id === userId);
    if (!user) return { allowed: false, reason: "Usuario no encontrado" };

    if (user.id === 19 || user.id === 20) {
        return { allowed: true }; // JEFE and Admin have no restrictions
    }

    // Comodín has no conflicts with other employees
    if (user.id === 18) {
        return { allowed: true };
    }

    // Find everyone else who has booked this date
    const conflictingUsers = [];
    for (const uid in store.userVacations) {
        const pId = parseInt(uid);
        if (pId !== userId && pId !== 19 && pId !== 20 && pId !== 18) {
            const dates = store.userVacations[pId];
            if (dates.some(d => d.date === dateStr)) {
                conflictingUsers.push(store.employees.find(e => e.id === pId));
            }
        }
    }

    if (conflictingUsers.length === 0) {
        return { allowed: true };
    }

    // Apply Department Rules

    // 1. Oficina: 1 & 2 cannot overlap
    if (user.dept === "Oficina") {
        if (conflictingUsers.some(u => u.dept === "Oficina")) {
            return { allowed: false, reason: "Conflicto en Oficina: otro administrativo ya tiene este día." };
        }
    }

    // 2. Almacén 
    if (user.dept === "Almacén") {
        if (user.group === "Fijos") {
            // cannot overlap with another Fijo
            if (conflictingUsers.some(u => u.group === "Fijos")) {
                return { allowed: false, reason: "Conflicto en Almacén: otro Fijo ya tiene este día." };
            }
        } else if (user.group === "Producción") {
            // cannot overlap with another Producción
            if (conflictingUsers.some(u => u.group === "Producción")) {
                return { allowed: false, reason: "Conflicto en Almacén: otro de Producción ya tiene este día." };
            }
        }
        // Fijo + Producción = OK.
    }

    // 3. Rutas (Repartidor + Comercial same route)
    if (user.group.startsWith("Ruta ")) {
        if (conflictingUsers.some(u => u.group === user.group)) {
            return { allowed: false, reason: `Conflicto en ${user.group}: tu compañero ya tiene este día.` };
        }
    }

    return { allowed: true };
}

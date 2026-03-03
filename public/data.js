// Employee data is loaded from the server via Storage.load()
// This file only provides the fallback getInitialStore() function

const EMPLOYEES = [
    { id: 1, name: "Administrativo 1", dept: "Oficina", group: "Oficina", color: "#2196F3" },
    { id: 2, name: "Administrativo 2", dept: "Oficina", group: "Oficina", color: "#4CAF50" },
    { id: 3, name: "Almacén Fijo 1", dept: "Almacén", group: "Fijos", color: "#FF9800" },
    { id: 4, name: "Almacén Fijo 2", dept: "Almacén", group: "Fijos", color: "#9C27B0" },
    { id: 5, name: "Producción Almacén 1", dept: "Almacén", group: "Producción", color: "#00BCD4" },
    { id: 6, name: "Producción Almacén 2", dept: "Almacén", group: "Producción", color: "#795548" },
    { id: 7, name: "Producción Almacén 3", dept: "Almacén", group: "Producción", color: "#607D8B" },
    { id: 8, name: "Repartidor Ruta 1", dept: "Reparto", group: "Ruta 1", color: "#E91E63" },
    { id: 10, name: "Repartidor Ruta 2", dept: "Reparto", group: "Ruta 2", color: "#3F51B5" },
    { id: 12, name: "Repartidor Ruta 3", dept: "Reparto", group: "Ruta 3", color: "#009688" },
    { id: 14, name: "Repartidor Ruta 4", dept: "Reparto", group: "Ruta 4", color: "#FFC107" },
    { id: 16, name: "Repartidor Ruta 5", dept: "Reparto", group: "Ruta 5", color: "#F44336" },
    { id: 9, name: "Comercial Ruta 1", dept: "Comercial", group: "Ruta 1", color: "#CDDC39" },
    { id: 11, name: "Comercial Ruta 2", dept: "Comercial", group: "Ruta 2", color: "#FF5722" },
    { id: 13, name: "Comercial Ruta 3", dept: "Comercial", group: "Ruta 3", color: "#8BC34A" },
    { id: 15, name: "Comercial Ruta 4", dept: "Comercial", group: "Ruta 4", color: "#673AB7" },
    { id: 17, name: "Comercial Ruta 5", dept: "Comercial", group: "Ruta 5", color: "#03A9F4" },
    { id: 18, name: "Trabajador Comodín", dept: "Comodín", group: "Comodín", color: "#FFEB3B" },
    { id: 19, name: "JEFE", dept: "Dirección", group: "Dirección", color: "#000000" },
    { id: 20, name: "Usuario Principal", dept: "Admin", group: "Admin", color: "#E8836B", hideFromList: true }
];

// Default empty state for the store (fallback if server data fails to load)
function getInitialStore() {
    return {
        employees: JSON.parse(JSON.stringify(EMPLOYEES)),
        fixedVacations: [],
        userVacations: {},
        extraDays: {}
    };
}

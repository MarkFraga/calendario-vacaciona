document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error-message');
    const btn = document.querySelector('.login-btn');

    btn.textContent = 'Iniciando...';
    btn.disabled = true;
    errorDiv.textContent = '';

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Save token and role, redirect to app
            localStorage.setItem('token', data.token);
            localStorage.setItem('role', data.role);
            localStorage.setItem('userId', data.userId);
            window.location.href = '/index.html';
        } else {
            errorDiv.textContent = data.error || 'Credenciales incorrectas';
            btn.textContent = 'Entrar al Calendario';
            btn.disabled = false;
        }
    } catch (error) {
        errorDiv.textContent = 'Error de red. Inténtalo de nuevo.';
        btn.textContent = 'Entrar al Calendario';
        btn.disabled = false;
    }
});

// If already logged in, skip login screen
if (localStorage.getItem('token')) {
    window.location.href = '/index.html';
}

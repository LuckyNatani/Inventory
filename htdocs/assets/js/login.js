// /js/login.js

// LOGIN HANDLER
if (document.getElementById('login-form')) {
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData(e.target);

      const res = await fetch('api/login.php', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        localStorage.setItem('username', data.username);
        localStorage.setItem('userId', data.user_id);

        const redirectUrl = localStorage.getItem('redirectAfterLogin');
        if (redirectUrl) {
          localStorage.removeItem('redirectAfterLogin');
          location.href = redirectUrl;
        } else {
          location.href = 'inventory.html';
        }
      } else {
        const errorBox = document.getElementById('loginError');
        const errorText = errorBox.querySelector('.error-text');

        errorText.textContent = data.message;
        errorBox.classList.remove('hidden');
        errorBox.classList.add('shake');

        setTimeout(() => {
          errorBox.classList.remove('shake');
        }, 500);

        setTimeout(() => {
          errorBox.classList.add('hidden');
        }, 3000);
      }
    } catch (err) {
      console.error('Login error:', err);
      const errorBox = document.getElementById('loginError');
      const errorText = errorBox.querySelector('.error-text');

      errorText.textContent = "An error occurred. Please check console.";
      errorBox.classList.remove('hidden');
      errorBox.classList.add('shake');

      setTimeout(() => {
        errorBox.classList.remove('shake');
      }, 500);
    }
  });
}
// Add smooth focus animations
document.querySelectorAll('.form-input').forEach(input => {
  input.addEventListener('focus', function () {
    this.parentElement.style.transform = 'scale(1.02)';
  });

  input.addEventListener('blur', function () {
    this.parentElement.style.transform = 'scale(1)';
  });
});
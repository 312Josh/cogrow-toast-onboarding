const form = document.querySelector('#toast-intake');
const statusEl = document.querySelector('#form-status');
const submitButton = form.querySelector('button[type="submit"]');
const filesInput = document.querySelector('#assets');
const fileList = document.querySelector('#file-list');
let widgetId;

function setStatus(message, kind = '') {
  statusEl.textContent = message;
  statusEl.className = `form-status ${kind}`;
}

function validateFiles() {
  const files = [...filesInput.files];
  const allowed = new Set(['png', 'jpg', 'jpeg', 'webp', 'pdf', 'docx']);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (files.length > 12 || files.some(file => file.size > 8 * 1024 * 1024) || total > 30 * 1024 * 1024 || files.some(file => !allowed.has(file.name.split('.').pop().toLowerCase()))) {
    setStatus('Please choose up to 12 supported files, no more than 8 MB each and 30 MB total.', 'error');
    return false;
  }
  fileList.textContent = files.length ? `${files.length} file${files.length === 1 ? '' : 's'} selected · ${(total / 1048576).toFixed(1)} MB total` : 'No files selected.';
  return true;
}
filesInput.addEventListener('change', validateFiles);

async function ready() {
  try {
    const response = await fetch('/api/toast-onboarding-config', { cache: 'no-store' });
    if (!response.ok) throw new Error('Intake is not available');
    const config = await response.json();
    if (!config.enabled || !config.siteKey) throw new Error('Intake is not ready yet. Please email CoGrow for help.');
    for (let i = 0; i < 40 && !window.turnstile; i++) await new Promise(resolve => setTimeout(resolve, 100));
    if (!window.turnstile) throw new Error('Verification could not load. Please refresh the page.');
    widgetId = window.turnstile.render('#turnstile', { sitekey: config.siteKey, theme: 'dark' });
    submitButton.disabled = false;
    setStatus('Ready when you are.');
  } catch (error) {
    setStatus(error.message || 'Intake is unavailable. Please email CoGrow for help.', 'error');
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity() || !validateFiles()) return;
  if (!window.turnstile?.getResponse(widgetId)) {
    setStatus('Complete the verification before sending.', 'error');
    return;
  }
  submitButton.disabled = true;
  setStatus('Uploading your materials. Please keep this page open.');
  try {
    const response = await fetch('/api/toast-onboarding', { method: 'POST', body: new FormData(form) });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Upload failed. Please try again.');
    form.reset();
    fileList.textContent = 'No files selected.';
    form.innerHTML = `<div class="complete"><p class="mono lime">Received</p><h2>We have your materials.</h2><p>Save this reference number: <strong>${result.reference}</strong>. We'll review your submission and follow up about Toast access and next steps.</p></div>`;
  } catch (error) {
    setStatus(error.message || 'Upload failed. Please try again.', 'error');
    window.turnstile?.reset(widgetId);
    submitButton.disabled = false;
  }
});

ready();

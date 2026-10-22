const API_BASE_URL = '/api';

async function apiRequest(path, options = {}) {
  const { method = 'GET', token, body } = options;

  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
    });
  } catch {
    throw new Error(
      'Server waliin wal qunnamuun hin danda\'amne. Backend kee hojjechaa jiraachuu isaa mirkaneessi.'
    );
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error('Deebiin server irraa dhufe sirrii miti.');
  }

  if (!response.ok || !result.success) {
    throw new Error(
      result.message || `Request kufe (${response.status})`
    );
  }

  return result.data;
}

export function registerBusiness(formData) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: formData,
  });
}

export function loginUser(credentials) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: credentials,
  });
}

export function getCurrentUser(token) {
  return apiRequest('/auth/me', { token });
}

/**
 * API Service - handles all backend communication
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

class APIService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('access_token');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('access_token', token);
  }

  getToken() {
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
      ...options,
    });

    if (response.status === 401) {
      this.clearToken();
      window.location.href = '/login';
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || error.error || 'API Error');
    }

    return response.json();
  }

  // Auth endpoints
  async login(email, password) {
    return this.request('/auth/session-login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    return this.request('/auth/logout/', { method: 'POST' });
  }

  async getProfile() {
    return this.request('/auth/profile/');
  }

  async refreshToken(refreshToken) {
    return this.request('/auth/token/refresh/', {
      method: 'POST',
      body: JSON.stringify({ refresh: refreshToken }),
    });
  }

  // Users endpoints
  async createUser(userData) {
    return this.request('/auth/users/', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // Courses endpoints
  async getCourses() {
    return this.request('/courses/');
  }

  async createCourse(courseData) {
    return this.request('/courses/', {
      method: 'POST',
      body: JSON.stringify(courseData),
    });
  }

  async getGroups() {
    return this.request('/groups/');
  }

  async createGroup(groupData) {
    return this.request('/groups/', {
      method: 'POST',
      body: JSON.stringify(groupData),
    });
  }

  // Attendance endpoints
  async getLessons() {
    return this.request('/lessons/');
  }

  async createLesson(lessonData) {
    return this.request('/lessons/', {
      method: 'POST',
      body: JSON.stringify(lessonData),
    });
  }

  async markAttendance(attendanceData) {
    return this.request('/attendance/mark/', {
      method: 'POST',
      body: JSON.stringify(attendanceData),
    });
  }

  async requestMakeup(makeupData) {
    return this.request('/makeups/request/', {
      method: 'POST',
      body: JSON.stringify(makeupData),
    });
  }

  async approveMakeup(makeupId, approvalData) {
    return this.request(`/makeups/${makeupId}/approve/`, {
      method: 'PATCH',
      body: JSON.stringify(approvalData),
    });
  }

  // Finance endpoints
  async getSubscriptions() {
    return this.request('/finance/subscriptions/');
  }

  async getActiveSubscription() {
    return this.request('/finance/subscriptions/active/');
  }

  async getBalance() {
    return this.request('/finance/payments/balance/');
  }

  async getPayments() {
    return this.request('/finance/payments/');
  }

  async getMyPayments() {
    return this.request('/finance/payments/my_payments/');
  }

  async createSubscription(subscriptionData) {
    return this.request('/finance/subscriptions/', {
      method: 'POST',
      body: JSON.stringify(subscriptionData),
    });
  }

  async createPayment(paymentData) {
    return this.request('/finance/payments/', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  }
}

export default new APIService();

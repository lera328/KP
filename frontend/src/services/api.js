/**
 * API Service - handles all backend communication
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const normalizeErrorValue = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeErrorValue(item)).filter(Boolean).join(', ');
  }

  if (value && typeof value === 'object') {
    return Object.values(value)
      .map((item) => normalizeErrorValue(item))
      .filter(Boolean)
      .join(', ');
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
};

const formatApiErrorMessage = (payload) => {
  if (!payload) {
    return 'Ошибка API';
  }

  if (typeof payload === 'string') {
    return payload;
  }

  if (payload.detail) {
    return normalizeErrorValue(payload.detail) || 'Ошибка API';
  }

  if (payload.error) {
    return normalizeErrorValue(payload.error) || 'Ошибка API';
  }

  const entries = Object.entries(payload)
    .map(([field, value]) => {
      const normalized = normalizeErrorValue(value);
      if (!normalized) return '';
      if (field === 'non_field_errors') return normalized;
      return `${field}: ${normalized}`;
    })
    .filter(Boolean);

  if (entries.length > 0) {
    return entries.join('; ');
  }

  return 'Ошибка API';
};

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

  getMultipartHeaders() {
    const headers = {};
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
      if (!endpoint.includes('session-login')) {
        window.location.href = '/login';
        return null;
      }
    }

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      const message = formatApiErrorMessage(errorPayload);
      const err = new Error(message);
      err.status = response.status;
      throw err;
    }

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return null;
    }

    return response.json();
  }

  async requestFormData(endpoint, formData, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      headers: this.getMultipartHeaders(),
      body: formData,
      ...options,
    });

    if (response.status === 401) {
      this.clearToken();
      window.location.href = '/login';
      return null;
    }

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      throw new Error(formatApiErrorMessage(errorPayload));
    }

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return null;
    }

    return response.json();
  }

  // Auth endpoints
  async login(identifier, password) {
    return this.request('/auth/session-login/', {
      method: 'POST',
      body: JSON.stringify({ email: identifier, password }),
    });
  }

  async logout() {
    return this.request('/auth/logout/', { method: 'POST' });
  }

  async requestPasswordReset(email) {
    return this.request('/auth/password/reset-request/', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async confirmPasswordReset(token, newPassword) {
    return this.request('/auth/password/reset-confirm/', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    });
  }

  async changeOwnPassword({ oldPassword, newPassword }) {
    return this.request('/auth/password/change/', {
      method: 'POST',
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    });
  }

  async adminResetUserPassword(userId) {
    return this.request(`/auth/users/${userId}/reset-password/`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async getChurnRisk() {
    return this.request('/auth/users/churn-risk/');
  }

  async getDashboardMetrics({ from, to, groupId } = {}) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (groupId) params.set('group_id', groupId);
    const query = params.toString();
    return this.request(`/auth/dashboard/metrics/${query ? `?${query}` : ''}`);
  }

  async downloadDashboardCsv({ from, to, groupId } = {}) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (groupId) params.set('group_id', groupId);
    const query = params.toString();
    const response = await fetch(
      `${this.baseURL}/auth/dashboard/export.csv${query ? `?${query}` : ''}`,
      { headers: this.getHeaders() },
    );
    if (response.status === 401) {
      this.clearToken();
      window.location.href = '/login';
      return null;
    }
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      throw new Error(formatApiErrorMessage(errorPayload));
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const filename = match ? match[1] : 'КиберШкола_report.csv';
    return { blob, filename };
  }

  async getProfile() {
    return this.request('/auth/profile/');
  }

  async getParentChildren() {
    return this.request('/auth/parent/children/');
  }

  async getParentAttendance(studentId = '') {
    const query = studentId ? `?student_id=${studentId}` : '';
    return this.request(`/auth/parent/attendance/${query}`);
  }

  async getParentBilling() {
    return this.request('/auth/parent/billing/');
  }

  async getProjectsFeed() {
    return this.request('/auth/projects/feed/');
  }

  async likeProject(projectId) {
    return this.request(`/auth/projects/${projectId}/like/`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async unlikeProject(projectId) {
    return this.request(`/auth/projects/${projectId}/like/`, {
      method: 'DELETE',
    });
  }

  async getStudentProjects() {
    return this.request('/auth/student/projects/');
  }

  async getPortfolio({ studentId } = {}) {
    const query = studentId ? `?student_id=${encodeURIComponent(studentId)}` : '';
    return this.request(`/auth/student/portfolio/${query}`);
  }

  async downloadPortfolioPdf({ studentId } = {}) {
    const query = studentId ? `?student_id=${encodeURIComponent(studentId)}` : '';
    const response = await fetch(`${this.baseURL}/auth/student/portfolio/pdf/${query}`, {
      headers: this.getHeaders(),
    });

    if (response.status === 401) {
      this.clearToken();
      window.location.href = '/login';
      return null;
    }

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      throw new Error(formatApiErrorMessage(errorPayload));
    }

    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const filename = match ? match[1] : 'portfolio.pdf';
    return { blob, filename };
  }

  async createStudentProject(payload) {
    const formData = new FormData();
    formData.append('title', payload.title || '');
    formData.append('description', payload.description || '');
    formData.append('project_url', payload.project_url || '');
    (payload.photos || []).forEach((file) => {
      formData.append('photos', file);
    });
    (payload.files || []).forEach((file) => {
      formData.append('files', file);
    });

    return this.requestFormData('/auth/student/projects/', formData, {
      method: 'POST',
    });
  }

  async refreshToken(refreshToken) {
    return this.request('/auth/token/refresh/', {
      method: 'POST',
      body: JSON.stringify({ refresh: refreshToken }),
    });
  }

  // Users endpoints
  async getUsers() {
    return this.request('/auth/users/');
  }

  async createUser(userData) {
    return this.request('/auth/users/', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(userId, userData) {
    return this.request(`/auth/users/${userId}/`, {
      method: 'PATCH',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(userId) {
    return this.request(`/auth/users/${userId}/`, {
      method: 'DELETE',
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

  async updateCourse(courseId, courseData) {
    return this.request(`/courses/${courseId}/`, {
      method: 'PATCH',
      body: JSON.stringify(courseData),
    });
  }

  async deleteCourse(courseId) {
    return this.request(`/courses/${courseId}/`, {
      method: 'DELETE',
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

  async updateGroup(groupId, groupData) {
    return this.request(`/groups/${groupId}/`, {
      method: 'PATCH',
      body: JSON.stringify(groupData),
    });
  }

  async deleteGroup(groupId) {
    return this.request(`/groups/${groupId}/`, {
      method: 'DELETE',
    });
  }

  async getGroup(groupId) {
    return this.request(`/groups/${groupId}/`);
  }

  async getGroupComments(groupId) {
    return this.request(`/groups/${groupId}/comments/`);
  }

  async addGroupComment(groupId, text) {
    return this.request(`/groups/${groupId}/comments/`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  async deleteGroupComment(groupId, commentId) {
    return this.request(`/groups/${groupId}/comments/${commentId}/`, {
      method: 'DELETE',
    });
  }

  async getTeacherStudentDetail(studentId, params = {}) {
    const query = new URLSearchParams();
    if (params.days) query.set('days', params.days);
    const qs = query.toString();
    return this.request(
      `/auth/teacher/students/${studentId}/${qs ? `?${qs}` : ''}`,
    );
  }

  // Attendance endpoints
  async getLessons() {
    return this.request('/lessons/');
  }

  async getLesson(lessonId) {
    return this.request(`/lessons/${lessonId}/`);
  }

  async getMyAttendance() {
    return this.request('/attendance/my/');
  }

  async getLessonTopics() {
    return this.request('/topics/');
  }

  async createLessonTopic(topicData) {
    return this.request('/topics/', {
      method: 'POST',
      body: JSON.stringify(topicData),
    });
  }

  async createLesson(lessonData) {
    return this.request('/lessons/', {
      method: 'POST',
      body: JSON.stringify(lessonData),
    });
  }

  async setupGroupSchedule(payload) {
    return this.request('/lessons/setup-group-schedule/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async addExtraLesson(payload) {
    return this.request('/lessons/add-extra/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateLesson(lessonId, lessonData) {
    return this.request(`/lessons/${lessonId}/`, {
      method: 'PATCH',
      body: JSON.stringify(lessonData),
    });
  }

  async deleteLesson(lessonId) {
    return this.request(`/lessons/${lessonId}/`, {
      method: 'DELETE',
    });
  }

  async conductLesson(lessonId, payload) {
    return this.request(`/lessons/${lessonId}/conduct/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateMakeupSlots(lessonIds) {
    return this.request('/lessons/makeup-slots/', {
      method: 'POST',
      body: JSON.stringify({ lesson_ids: lessonIds }),
    });
  }

  async getLocations() {
    return this.request('/locations/');
  }

  async createLocation(data) {
    return this.request('/locations/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLocation(locationId, data) {
    return this.request(`/locations/${locationId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteLocation(locationId) {
    return this.request(`/locations/${locationId}/`, {
      method: 'DELETE',
    });
  }

  async getTeacherMakeupSlots({ from, to } = {}) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    return this.request(`/teacher/makeup-slots/${query ? `?${query}` : ''}`);
  }

  async saveTeacherMakeupSlots({ create = [], delete: deleteIds = [] } = {}) {
    return this.request('/teacher/makeup-slots/', {
      method: 'POST',
      body: JSON.stringify({ create, delete: deleteIds }),
    });
  }

  async getTeacherSalary(params = {}) {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.teacher_id) query.set('teacher_id', params.teacher_id);
    const qs = query.toString();
    return this.request(`/teacher/salary/${qs ? `?${qs}` : ''}`);
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

  async suggestMakeupSlots(absenceRecordId) {
    return this.request(`/makeups/suggest/?absence_record_id=${encodeURIComponent(absenceRecordId)}`);
  }

  async getMyMakeups() {
    return this.request('/makeups/my/');
  }

  async getParentMakeups() {
    return this.request('/makeups/parent/');
  }

  async getAdminMakeups() {
    return this.request('/makeups/admin/');
  }

  async approveMakeup(makeupId, approvalData) {
    return this.request(`/makeups/${makeupId}/approve/`, {
      method: 'PATCH',
      body: JSON.stringify(approvalData),
    });
  }

  async rejectMakeup(makeupId) {
    return this.request(`/makeups/${makeupId}/reject/`, {
      method: 'DELETE',
    });
  }

  async adminAssignMakeup(data) {
    return this.request('/makeups/admin/assign/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async parentCancelMakeup(makeupId) {
    return this.request(`/makeups/${makeupId}/parent-cancel/`, {
      method: 'DELETE',
    });
  }

  async getAdminAbsencesAndSlots() {
    return this.request('/makeups/admin/absences-and-slots/');
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

  async deactivateSubscription(subscriptionId) {
    return this.request(`/finance/subscriptions/${subscriptionId}/deactivate/`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
  }

  async createPayment(paymentData) {
    return this.request('/finance/payments/', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  }

  async getPaymentPlans() {
    return this.request('/finance/payments/plans/');
  }

  async updatePaymentPlans(plans) {
    return this.request('/finance/payments/plans/update/', {
      method: 'PUT',
      body: JSON.stringify(plans),
    });
  }

  async initiateParentPayment(payload) {
    return this.request('/finance/payments/parent/initiate/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async sendPaymentReminders(payload = {}) {
    return this.request('/notifications/payment-reminders/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async deleteProject(projectId) {
    return this.request(`/auth/projects/${projectId}/`, {
      method: 'DELETE',
    });
  }

  async getNotificationEvents() {
    return this.request('/notifications/events/');
  }

  async getTelegramStatus() {
    return this.request('/notifications/telegram/status/');
  }

  async createTelegramLink() {
    return this.request('/notifications/telegram/link/', { method: 'POST' });
  }

  async unlinkTelegram() {
    return this.request('/notifications/telegram/unlink/', { method: 'POST' });
  }

  async sendTelegramTest() {
    return this.request('/notifications/telegram/test/', { method: 'POST' });
  }

  async getAdminPaymentIntents() {
    return this.request('/finance/payments/admin/intents/');
  }

  async createAdminPayment(payload) {
    return this.request('/finance/payments/admin/create/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async cancelAdminPaymentIntent(intentId) {
    return this.request(`/finance/payments/admin/intents/${intentId}/cancel/`, {
      method: 'POST',
    });
  }
}

export default new APIService();

let currentUser = null;
let currentMembers = [];
let allUsers = [];
let positiveCategories = {};
let negativeCategories = {};
let confirmCallback = null;
let cancelCallback = null;
let notificationTimeout = null;
let currentMemberId = null; // لحفظ معرف العضو الحالي

const fetchOptions = (options = {}) => {
    const defaultOptions = {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
    };

    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers,
        },
    };

    if (finalOptions.method === 'GET' || !finalOptions.method) {
        delete finalOptions.body;
    }

    return finalOptions;
};

document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    setupEventListeners();
    checkLoginStatus();
}

function setupEventListeners() {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('change-password-form').addEventListener('submit', handleChangePassword);
    document.getElementById('add-point-form').addEventListener('submit', handleAddPoint);
    document.getElementById('add-member-form').addEventListener('submit', handleAddMember);
    document.getElementById('add-user-form').addEventListener('submit', handleAddUser);
    document.getElementById('edit-member-form').addEventListener('submit', handleEditMemberSubmit);
    document.getElementById('edit-user-form').addEventListener('submit', handleEditUserSubmit);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() { switchTab(this.dataset.tab); });
    });
    document.getElementById('period-filter').addEventListener('change', handlePeriodChange);
    document.getElementById('apply-filter').addEventListener('click', applyCustomFilter);
    document.getElementById('apply-logs-filter').addEventListener('click', loadLogs);
    document.getElementById('point-type').addEventListener('change', updatePointCategories);
    document.getElementById('members-list').addEventListener('click', handleMemberCardClick);
    document.getElementById('add-member-btn').addEventListener('click', showAddMemberModal);
    document.getElementById('add-user-btn').addEventListener('click', showAddUserModal);
    document.getElementById('edit-member-btn').addEventListener('click', handleEditMember);
    document.getElementById('delete-member-btn').addEventListener('click', requestDeleteMember);
    
    // إضافة مستمع لتغيير نوع الملاحظة
    document.getElementById('note-type-filter').addEventListener('change', handleNoteTypeChange);

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal && modal.id === 'confirm-modal' && typeof cancelCallback === 'function') {
                cancelCallback();
                confirmCallback = null;
                cancelCallback = null;
            } else if (modal) {
                closeModal(modal);
            }
        });
    });

    document.addEventListener('click', e => {
        const modal = e.target;
        if (modal.classList.contains('modal')) {
            if (modal.id === 'confirm-modal' && typeof cancelCallback === 'function') {
                cancelCallback();
                confirmCallback = null;
                cancelCallback = null;
            } else {
                closeModal(modal);
            }
        }
    });

    document.getElementById('confirm-modal-ok').addEventListener('click', handleConfirm);
    document.getElementById('notification-close').addEventListener('click', hideNotification);
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}
const showLoginScreen = () => showScreen('login-screen');
const showChangePasswordScreen = () => showScreen('change-password-screen');

function showMainScreen() {
    showScreen('main-screen');
    document.getElementById('user-name').textContent = currentUser.username;
    document.getElementById('user-role').textContent = getRoleDisplayName(currentUser.role);
    setupTabsBasedOnRole();
    switchTab('members');
    loadInitialData();
}

async function checkLoginStatus() {
    try {
        const response = await fetch('/api/current-user', fetchOptions());
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            showMainScreen();
        } else {
            showLoginScreen();
        }
    } catch (error) {
        console.error('Error checking login status:', error);
        showLoginScreen();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const loginData = Object.fromEntries(new FormData(e.target));
    showLoading();
    try {
        const response = await fetch('/api/login', fetchOptions({
            method: 'POST',
            body: JSON.stringify(loginData)
        }));
        const data = await response.json();
        if (response.ok) {
            currentUser = data.user;
            if (data.first_login) {
                showChangePasswordScreen();
            } else {
                showMainScreen();
            }
        } else {
            showError('login-error', data.error);
        }
    } catch (err) {
        showError('login-error', 'حدث خطأ في الاتصال بالخادم');
    } finally {
        hideLoading();
    }
}

async function handleChangePassword(e) {
    e.preventDefault();
    const passwordData = Object.fromEntries(new FormData(e.target));
    showLoading();
    try {
        const response = await fetch('/api/change-password', fetchOptions({
            method: 'POST',
            body: JSON.stringify(passwordData)
        }));
        const data = await response.json();
        if (response.ok) {
            currentUser.first_login = false;
            showNotification('تم تغيير كلمة المرور بنجاح!', 'success');
            showMainScreen();
        } else {
            showError('change-password-error', data.error);
        }
    } catch (err) {
        showError('change-password-error', 'حدث خطأ في الاتصال بالخادم');
    } finally {
        hideLoading();
    }
}

async function handleLogout() {
    try {
        await fetch('/api/logout', fetchOptions({ method: 'POST' }));
        currentUser = null;
        showLoginScreen();
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn, .tab-pane').forEach(el => el.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab-content`).classList.add('active');

    const loadAction = {
        members: loadMembers,
        points: loadPointsData,
        logs: loadLogs,
        users: loadUsers,
    };
    if (loadAction[tabName]) loadAction[tabName]();
}

function setupTabsBasedOnRole() {
    const rolePermissions = {
        visor: [],
        co_leader: ['points'],
        leader: ['points', 'logs', 'users']
    };
    const userAllowedTabs = rolePermissions[currentUser.role] || [];
    document.querySelectorAll('#points-tab, #logs-tab, #users-tab').forEach(tab => {
        const tabName = tab.id.replace('-tab', '');
        tab.style.display = userAllowedTabs.includes(tabName) ? 'block' : 'none';
    });
    const addMemberBtn = document.getElementById('add-member-btn');
    if(addMemberBtn) addMemberBtn.style.display = (currentUser.role !== 'visor') ? 'inline-flex' : 'none';
    const addUserBtnContainer = document.querySelector('#users-tab-content .header-actions');
    if(addUserBtnContainer) addUserBtnContainer.style.display = (currentUser.role === 'leader') ? 'flex' : 'none';
}

async function loadInitialData() {
    try {
        const response = await fetch('/api/categories', fetchOptions());
        if (response.ok) {
            const data = await response.json();
            const positiveCategoriesObject = data.positive_categories;
            if (Array.isArray(positiveCategoriesObject)) {
                positiveCategories = positiveCategoriesObject;
            } else if (positiveCategoriesObject) {
                positiveCategories = Object.values(positiveCategoriesObject);
            }
            const negativeCategoriesObject = data.negative_categories;
            if (Array.isArray(negativeCategoriesObject)) {
                negativeCategories = negativeCategoriesObject;
            } else if (negativeCategoriesObject) {
                const negativeCategoryOrder = [
                    'WEAK_INTERACTION', 'MISSED_MEETING', 'DESIGN_SHORTCOMING',
                    'INAPPROPRIATE_BEHAVIOR', 'OTHER'
                ];
                negativeCategories = negativeCategoryOrder
                    .filter(key => negativeCategoriesObject.hasOwnProperty(key))
                    .map(key => negativeCategoriesObject[key]);
            }
        }
    } catch (error) {
        console.error('Failed to load categories', error);
    }
}

async function loadMembers() {
    showLoading();
    try {
        const period = document.getElementById('period-filter').value;
        let url = `/api/members?period=${period}`;
        if (period === 'custom') {
            const startDate = document.getElementById('start-date').value;
            const endDate = document.getElementById('end-date').value;
            if (startDate && endDate) {
                url += `&start_date=${startDate}&end_date=${endDate}`;
            }
        }
        const response = await fetch(url, fetchOptions());
        const data = await response.json();
        if (response.ok) {
            currentMembers = data.members;
            displayMembers(currentMembers);
        } else {
            showNotification(data.error, 'error');
        }
    } catch (err) {
        showNotification('فشل تحميل الأعضاء', 'error');
    } finally {
        hideLoading();
    }
}

function displayMembers(members) {
    const list = document.getElementById('members-list');
    if (!members || members.length === 0) {
        list.innerHTML = '<p class="no-data">لا يوجد أعضاء</p>';
        return;
    }
    list.innerHTML = members.map(member => `
        <div class="member-card" data-id="${member.id}">
            <div class="member-header"><h4 class="member-name">${member.name}</h4></div>
            <div class="member-stats">
                <div class="stat-item"><span class="stat-label">الإيجابيات</span><span class="stat-value positive">${member.positive_count}</span></div>
                <div class="stat-item"><span class="stat-label">السلبيات</span><span class="stat-value negative">${member.negative_count}</span></div>
                <div class="stat-item"><span class="stat-label">المجموع</span><span class="stat-value ${member.total_points >= 0 ? 'positive' : 'negative'}">${member.total_points}</span></div>
            </div>
            <div class="member-actions"><button class="btn btn-secondary" onclick="event.stopPropagation(); showMemberDetails(${member.id})">التفاصيل</button></div>
        </div>`).join('');
}

function handlePeriodChange() {
    document.getElementById('custom-dates').style.display = (document.getElementById('period-filter').value === 'custom') ? 'flex' : 'none';
    if(document.getElementById('period-filter').value !== 'custom') loadMembers();
}
const applyCustomFilter = () => loadMembers();

function handleMemberCardClick(e) {
    if (window.innerWidth > 768) return;
    const card = e.target.closest(".member-card");
    if (card && card.dataset.id) {
        const period = document.getElementById("period-filter").value;
        const noteType = document.getElementById("note-type-filter") ? document.getElementById("note-type-filter").value : "negative"; // الافتراضي سلبي
        showMemberDetails(card.dataset.id, period, noteType);
    }
}

// دالة جديدة لمعالجة تغيير نوع الملاحظة
function handleNoteTypeChange() {
    if (currentMemberId) {
        const noteType = document.getElementById('note-type-filter').value;
        const period = document.getElementById('period-filter').value;
        showMemberDetails(currentMemberId, period, noteType);
    }
}

// دالة محدثة لعرض تفاصيل العضو
async function showMemberDetails(memberId, period = 'week', noteType = 'negative') {
    currentMemberId = memberId; // حفظ معرف العضو الحالي
    showLoading();
    try {
        const response = await fetch(`/api/members/${memberId}?period=${period}&note_type=${noteType}`, fetchOptions());
        const data = await response.json();
        if (response.ok) {
            const member = data.member;
            const stats = data.statistics;
            const filteredNotes = data.filtered_notes;

            document.getElementById('member-details-name').textContent = member.name;
            document.getElementById('total-positive').textContent = stats.total_positive;
            document.getElementById('total-negative').textContent = stats.total_negative;
            document.getElementById('chat-activities').textContent = stats.filtered_chat_activities;
            document.getElementById('current-week-positive').textContent = stats.current_week_positive;
            document.getElementById('current-week-negative').textContent = stats.current_week_negative;
            document.getElementById('previous-week-positive').textContent = stats.previous_week_positive;
            document.getElementById('previous-week-negative').textContent = stats.previous_week_negative;
            document.getElementById('performance-status').textContent = stats.performance;
            document.getElementById('performance-status').className = `performance-badge ${getPerformanceClass(stats.performance)}`;

            // تحديث عرض الملاحظات
            displayNotes(filteredNotes, 'negative-notes-list');

            // تحديث قيم الفلاتر في المودال
            document.getElementById('note-type-filter').value = noteType;
            document.getElementById('notes-period-display').textContent = getPeriodDisplayName(period);

            document.getElementById('member-details-modal').classList.add('active');
        } else {
            showNotification(data.error, 'error');
        }
    } catch (err) {
        console.error('Error fetching member details:', err);
        showNotification('فشل تحميل تفاصيل العضو', 'error');
    } finally {
        hideLoading();
    }
}

// دالة لعرض أسماء الفترات
function getPeriodDisplayName(period) {
    const periods = {
        'today': 'اليوم',
        'week': 'آخر أسبوع',
        'month': 'آخر شهر',
        'custom': 'فترة مخصصة',
        'all': 'جميع الأوقات'
    };
    return periods[period] || period;
}

function displayNotes(notes, containerId) {
    const container = document.getElementById(containerId);
    if (!notes || notes.length === 0) {
        container.innerHTML = 	erase<p class="no-data">لا توجد ملاحظات</p>
        return;
    }
    container.innerHTML = notes.map(note => `
        <div class="note-item ${note.point_type}">
            <div class="note-category">${note.category}</div>
            ${note.description ? `<div class="note-description">${note.description}</div>` : ''}
            <div class="note-date">${formatDate(note.created_at)}</div>
        </div>`).join('');
}

async function loadPointsData() {
    loadRecentPoints();
    try {
        const res = await fetch('/api/members?period=all', fetchOptions());
        if (res.ok) {
            const data = await res.json();
            populateMembersSelect(data.members);
        }
    } catch (e) { console.error("Failed to load members for points form", e); }
}

async function loadRecentPoints() {
    try {
        const res = await fetch('/api/points?limit=10', fetchOptions());
        if (res.ok) {
            const data = await res.json();
            displayRecentPoints(data.points);
        }
    } catch (e) { console.error("Failed to load recent points", e); }
}

function displayRecentPoints(points) {
    const list = document.getElementById('recent-points');
    list.innerHTML = !points || points.length === 0 ? '<p class="no-data">لا توجد نقاط حديثة</p>' :
    points.map(point => `
        <div class="point-item">
            <div class="point-info">
                <div class="point-member">${point.member_name}</div>
                <div class="point-category">${point.category}</div>
                ${point.description ? `<div class="point-description">${point.description}</div>` : ''}
                <div class="point-date">${formatDate(point.created_at)}</div>
                <div class="point-creator">أضافها: ${point.creator_name || 'غير محدد'}</div>
            </div>
            <div class="point-actions">
                <span class="point-type ${point.point_type}">${point.point_type === 'positive' ? 'إيجابية' : 'سلبية'}</span>
                ${(currentUser.role === 'leader' || currentUser.role === 'co_leader') ? `<button class="btn btn-danger btn-sm" onclick="requestDeletePoint(${point.id}, '${point.member_name}', '${point.category}')">حذف</button>` : ''}
            </div>
        </div>`).join('');
}

function formatDate(dateString) {
    return formatDateForDisplay(dateString);
}

function formatDateForDisplay(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getRoleDisplayName(role) {
    const roles = { leader: 'Leader Event', co_leader: 'Co Leader Event', visor: 'Visor' };
    return roles[role] || role;
}

function getActionDisplayName(action) {
    const actions = { 'create': 'إضافة', 'update': 'تحديث', 'delete': 'حذف', 'login': 'تسجيل دخول', 'unknown': 'غير معروف', 'logout': 'تسجيل خروج', 'password_change': 'تغيير كلمة السر', 'reactivate': 'إعادة تفعيل'};
    return actions[action] || action;
}

function getPerformanceClass(performance) {
    const classes = { 'متحسن': 'improved', 'ثابت': 'stable', 'متراجع': 'declined' };
    return classes[performance] || 'stable';
}

const showAddMemberModal = () => document.getElementById('add-member-modal').classList.add('active');
const showAddUserModal = () => document.getElementById('add-user-modal').classList.add('active');

function closeModal(modal) {
    if (modal) {
        modal.classList.remove('active');
    } else {
        document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
    }
}

const showLoading = () => document.getElementById('loading').style.display = 'flex';
const hideLoading = () => document.getElementById('loading').style.display = 'none';

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const messageElement = document.getElementById('notification-message');
    if (notificationTimeout) clearTimeout(notificationTimeout);
    messageElement.innerHTML = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'flex';
    setTimeout(() => notification.classList.add('show'), 10);
    notificationTimeout = setTimeout(hideNotification, 5000);
}

function hideNotification() {
    const notification = document.getElementById('notification');
    notification.classList.remove('show');
    if (notificationTimeout) clearTimeout(notificationTimeout);
    setTimeout(() => { notification.style.display = 'none'; }, 500);
}

function showError(elementId, message) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function showConfirmModal(message, onConfirm, onCancel = null) {
    document.getElementById('confirm-modal-message').innerHTML = message.replace(/\n/g, '<br>');
    confirmCallback = onConfirm;
    cancelCallback = onCancel;
    document.getElementById('confirm-modal').classList.add('active');
}

function handleConfirm() {
    if (typeof confirmCallback === 'function') {
        confirmCallback();
    }
    closeModal(document.getElementById('confirm-modal'));
    confirmCallback = null;
    cancelCallback = null;
}

// باقي الدوال المطلوبة للتطبيق
async function handleAddPoint(e) {
    e.preventDefault();
    const formData = Object.fromEntries(new FormData(e.target));
    showLoading();
    try {
        const response = await fetch('/api/points', fetchOptions({
            method: 'POST',
            body: JSON.stringify(formData)
        }));
        const data = await response.json();
        if (response.ok) {
            showNotification('تم إضافة النقطة بنجاح!', 'success');
            e.target.reset();
            loadRecentPoints();
            loadMembers();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (err) {
        showNotification('فشل إضافة النقطة', 'error');
    } finally {
        hideLoading();
    }
}

async function handleAddMember(e) {
    e.preventDefault();
    const formData = Object.fromEntries(new FormData(e.target));
    showLoading();
    try {
        const response = await fetch('/api/members', fetchOptions({
            method: 'POST',
            body: JSON.stringify(formData)
        }));
        const data = await response.json();
        if (response.ok) {
            showNotification('تم إضافة العضو بنجاح!', 'success');
            closeModal(document.getElementById('add-member-modal'));
            e.target.reset();
            loadMembers();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (err) {
        showNotification('فشل إضافة العضو', 'error');
    } finally {
        hideLoading();
    }
}

async function handleAddUser(e) {
    e.preventDefault();
    const formData = Object.fromEntries(new FormData(e.target));
    showLoading();
    try {
        const response = await fetch('/api/users', fetchOptions({
            method: 'POST',
            body: JSON.stringify(formData)
        }));
        const data = await response.json();
        if (response.ok) {
            showNotification('تم إضافة المستخدم بنجاح!', 'success');
            closeModal(document.getElementById('add-user-modal'));
            e.target.reset();
            loadUsers();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (err) {
        showNotification('فشل إضافة المستخدم', 'error');
    } finally {
        hideLoading();
    }
}

function handleEditMember() {
    const memberName = document.getElementById('member-details-name').textContent;
    document.getElementById('edit-member-name').value = memberName;
    closeModal(document.getElementById('member-details-modal'));
    document.getElementById('edit-member-modal').classList.add('active');
}

async function handleEditMemberSubmit(e) {
    e.preventDefault();
    const formData = Object.fromEntries(new FormData(e.target));
    showLoading();
    try {
        const response = await fetch(`/api/members/${currentMemberId}`, fetchOptions({
            method: 'PUT',
            body: JSON.stringify(formData)
        }));
        const data = await response.json();
        if (response.ok) {
            showNotification('تم تحديث العضو بنجاح!', 'success');
            closeModal(document.getElementById('edit-member-modal'));
            loadMembers();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (err) {
        showNotification('فشل تحديث العضو', 'error');
    } finally {
        hideLoading();
    }
}

async function handleEditUserSubmit(e) {
    e.preventDefault();
    const formData = Object.fromEntries(new FormData(e.target));
    showLoading();
    try {
        const response = await fetch(`/api/users/${currentUserId}`, fetchOptions({
            method: 'PUT',
            body: JSON.stringify(formData)
        }));
        const data = await response.json();
        if (response.ok) {
            showNotification('تم تحديث المستخدم بنجاح!', 'success');
            closeModal(document.getElementById('edit-user-modal'));
            loadUsers();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (err) {
        showNotification('فشل تحديث المستخدم', 'error');
    } finally {
        hideLoading();
    }
}

function requestDeleteMember() {
    const memberName = document.getElementById('member-details-name').textContent;
    showConfirmModal(
        `هل أنت متأكد من حذف العضو "${memberName}"؟\nسيتم حذف جميع النقاط المرتبطة بهذا العضو.`,
        async () => {
            showLoading();
            try {
                const response = await fetch(`/api/members/${currentMemberId}`, fetchOptions({
                    method: 'DELETE'
                }));
                const data = await response.json();
                if (response.ok) {
                    showNotification('تم حذف العضو بنجاح!', 'success');
                    closeModal(document.getElementById('member-details-modal'));
                    loadMembers();
                } else {
                    showNotification(data.error, 'error');
                }
            } catch (err) {
                showNotification('فشل حذف العضو', 'error');
            } finally {
                hideLoading();
            }
        }
    );
}

function updatePointCategories() {
    const pointType = document.getElementById('point-type').value;
    const categorySelect = document.getElementById('point-category');
    
    categorySelect.innerHTML = '<option value="">اختر الفئة</option>';
    
    if (pointType === 'positive') {
        positiveCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        });
    } else if (pointType === 'negative') {
        negativeCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        });
    }
}

function populateMembersSelect(members) {
    const select = document.getElementById('point-member');
    select.innerHTML = '<option value="">اختر العضو</option>';
    members.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = member.name;
        select.appendChild(option);
    });
}

async function loadLogs() {
    showLoading();
    try {
        const actionFilter = document.getElementById('action-filter').value;
        const targetFilter = document.getElementById('target-filter').value;
        let url = '/api/logs?';
        if (actionFilter) url += `action=${actionFilter}&`;
        if (targetFilter) url += `target=${targetFilter}&`;
        
        const response = await fetch(url, fetchOptions());
        const data = await response.json();
        if (response.ok) {
            displayLogs(data.logs);
        } else {
            showNotification(data.error, 'error');
        }
    } catch (err) {
        showNotification('فشل تحميل السجلات', 'error');
    } finally {
        hideLoading();
    }
}

function displayLogs(logs) {
    const container = document.getElementById('logs-list');
    if (!logs || logs.length === 0) {
        container.innerHTML = '<p class="no-data">لا توجد سجلات</p>';
        return;
    }
    container.innerHTML = logs.map(log => `
        <div class="log-item">
            <div class="log-action">${getActionDisplayName(log.action_type)}</div>
            <div class="log-details">${log.details}</div>
            <div class="log-date">${formatDate(log.created_at)}</div>
            <div class="log-user">بواسطة: ${log.creator_name || 'غير محدد'}</div>
        </div>`).join('');
}

async function loadUsers() {
    showLoading();
    try {
        const response = await fetch('/api/users', fetchOptions());
        const data = await response.json();
        if (response.ok) {
            allUsers = data.users;
            displayUsers(allUsers);
        } else {
            showNotification(data.error, 'error');
        }
    } catch (err) {
        showNotification('فشل تحميل المستخدمين', 'error');
    } finally {
        hideLoading();
    }
}

function displayUsers(users) {
    const container = document.getElementById('users-list');
    if (!users || users.length === 0) {
        container.innerHTML = '<p class="no-data">لا يوجد مستخدمين</p>';
        return;
    }
    container.innerHTML = users.map(user => `
        <div class="user-card">
            <div class="user-info">
                <h4>${user.username}</h4>
                <span class="user-role">${getRoleDisplayName(user.role)}</span>
            </div>
            <div class="user-actions">
                <button class="btn btn-secondary" onclick="editUser(${user.id})">تعديل</button>
                ${currentUser.role === 'leader' && user.id !== currentUser.id ? `<button class="btn btn-danger" onclick="deleteUser(${user.id})">حذف</button>` : ''}
            </div>
        </div>`).join('');
}

function editUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (user) {
        document.getElementById('edit-user-username').value = user.username;
        document.getElementById('edit-user-role').value = user.role;
        currentUserId = userId;
        document.getElementById('edit-user-modal').classList.add('active');
    }
}

function deleteUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (user) {
        showConfirmModal(
            `هل أنت متأكد من حذف المستخدم "${user.username}"؟`,
            async () => {
                showLoading();
                try {
                    const response = await fetch(`/api/users/${userId}`, fetchOptions({
                        method: 'DELETE'
                    }));
                    const data = await response.json();
                    if (response.ok) {
                        showNotification('تم حذف المستخدم بنجاح!', 'success');
                        loadUsers();
                    } else {
                        showNotification(data.error, 'error');
                    }
                } catch (err) {
                    showNotification('فشل حذف المستخدم', 'error');
                } finally {
                    hideLoading();
                }
            }
        );
    }
}

function requestDeletePoint(pointId, memberName, category) {
    showConfirmModal(
        `هل أنت متأكد من حذف النقطة "${category}" للعضو "${memberName}"؟`,
        async () => {
            showLoading();
            try {
                const response = await fetch(`/api/points/${pointId}`, fetchOptions({
                    method: 'DELETE'
                }));
                const data = await response.json();
                if (response.ok) {
                    showNotification('تم حذف النقطة بنجاح!', 'success');
                    loadRecentPoints();
                    loadMembers();
                } else {
                    showNotification(data.error, 'error');
                }
            } catch (err) {
                showNotification('فشل حذف النقطة', 'error');
            } finally {
                hideLoading();
            }
        }
    );
}

let currentUser = null;
let currentMembers = [];
let allUsers = [];
let positiveCategories = {};
let negativeCategories = {};
let confirmCallback = null;
let cancelCallback = null;
let notificationTimeout = null;

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
    const card = e.target.closest('.member-card');
    if (card && card.dataset.id) {
        showMemberDetails(card.dataset.id);
    }
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
function getRoleDisplayName(role) {
    const roles = { leader: 'Leader Event', co_leader: 'Co Leader Event', visor: 'Visor' };
    return roles[role] || role;
}
function getActionDisplayName(action) {
    const actions = { 'create': 'إضافة', 'update': 'تحديث', 'delete': 'حذف', 'login': 'تسجيل دخول', 'unknown': 'غير معروف', 'logout': 'تسجيل خروج', 'password_change': 'تغيير كلمة السر', 'reactivate': 'إعادة تفعيل'};
    return actions[action] || action;
}
function getPerformanceClass(performance) {
    const classes = { 'محسن': 'improved', 'مستقر': 'stable', 'متراجع': 'declined' };
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

function populateMembersSelect(members) {
    const select = document.getElementById('point-member');
    select.innerHTML = '<option value="">اختر العضو</option>' + members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
}
function updatePointCategories() {
    const type = document.getElementById('point-type').value;
    const select = document.getElementById('point-category');
    const categories = type === 'positive' ? positiveCategories : type === 'negative' ? negativeCategories : [];
    select.innerHTML = '<option value="">اختر الفئة</option>' + categories.map(c => `<option value="${c}">${c}</option>`).join('');
}

async function showMemberDetails(memberId) {
    showLoading();
    try {
        const periodFilter = document.getElementById('period-filter').value;
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        const noteType = document.getElementById('note-type-filter')?.value || 'negative';

        let url = `/api/members/${memberId}`;
        const params = new URLSearchParams();
        
        if (periodFilter) {
            params.append('period', periodFilter);
            if (periodFilter === 'custom' && startDate && endDate) {
                params.append('start_date', startDate);
                params.append('end_date', endDate);
            }
        }
        
        params.append('note_type', noteType);
        
        if (params.toString()) {
            url += '?' + params.toString();
        }

        const response = await fetch(url, fetchOptions());
        if (response.ok) {
            const data = await response.json();
            const modal = document.getElementById('member-details-modal');
            const { member, statistics, notes, note_type } = data;
            modal.dataset.memberId = member.id;
            document.getElementById('member-details-name').textContent = member.name;
            document.getElementById('total-positive').textContent = statistics.total_positive;
            document.getElementById('total-negative').textContent = statistics.total_negative;
            document.getElementById('chat-activities').textContent = statistics.filtered_chat_activities || 0;
            document.getElementById('current-week-positive').textContent = statistics.current_week_positive;
            document.getElementById('previous-week-positive').textContent = statistics.previous_week_positive;
            document.getElementById('current-week-negative').textContent = statistics.current_week_negative;
            document.getElementById('previous-week-negative').textContent = statistics.previous_week_negative;
            const perfStatus = document.getElementById('performance-status');
            perfStatus.textContent = statistics.performance;
            perfStatus.className = `performance-badge ${getPerformanceClass(statistics.performance)}`;
            
            const notesList = document.getElementById('notes-list');
            const notesTitle = document.getElementById('notes-title');
            
            // تحديث عنوان الملاحظات
            notesTitle.textContent = note_type === 'positive' ? 'الملاحظات الإيجابية' : 'الملاحظات السلبية';
            
            // تحديث قائمة الملاحظات
            notesList.innerHTML = notes.length === 0 ? 
                `<p class="no-data">لا توجد ${note_type === 'positive' ? 'ملاحظات إيجابية' : 'ملاحظات سلبية'}</p>` :
                notes.map(note => `
                <div class="note-item ${note.point_type === 'positive' ? 'positive-note' : 'negative-note'}">
                    <div class="note-category">${note.category}</div>
                    ${note.description ? `<div class="note-description">${note.description}</div>` : ''}
                    <div class="note-date">${formatDate(note.created_at)}</div>
                </div>`).join('');
            
            const canEdit = currentUser.role === 'leader' || currentUser.role === 'co_leader';
            const canDelete = currentUser.role === 'leader';
            document.getElementById('edit-member-btn').style.display = canEdit ? 'inline-flex' : 'none';
            document.getElementById('delete-member-btn').style.display = canDelete ? 'inline-flex' : 'none';
            modal.classList.add('active');
        } else {
            const data = await response.json();
            showNotification(data.error, 'error');
        }
    } catch(e) {
        showNotification('فشل في عرض تفاصيل العضو', 'error');
    } finally {
        hideLoading();
    }
}

async function handleAddMember(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    showLoading();
    try {
        const response = await fetch('/api/members', fetchOptions({
            method: 'POST',
            body: JSON.stringify(data)
        }));
        if(response.ok) {
            closeModal(document.getElementById('add-member-modal'));
            loadMembers();
            showNotification('تم إضافة العضو بنجاح', 'success');
            e.target.reset();
        } else {
            const errorData = await response.json();
            showNotification(errorData.error, 'error');
        }
    } catch(err) {
        showNotification('فشل إضافة العضو', 'error');
    } finally {
        hideLoading();
    }
}

function handleEditMember() {
    const memberId = document.getElementById('member-details-modal').dataset.memberId;
    const member = currentMembers.find(m => m.id == memberId);
    if(member) {
        document.getElementById('edit-member-modal').dataset.memberId = memberId;
        document.getElementById('edit-member-name').value = member.name;
        document.getElementById('edit-member-modal').classList.add('active');
    }
}

async function handleEditMemberSubmit(e) {
    e.preventDefault();
    const memberId = parseInt(document.getElementById('edit-member-modal').dataset.memberId);
    const data = Object.fromEntries(new FormData(e.target));
    showLoading();
    try {
        const response = await fetch(`/api/members/${memberId}`, fetchOptions({
            method: 'PUT',
            body: JSON.stringify(data)
        }));
        if (response.ok) {
            closeModal(document.getElementById('edit-member-modal'));
            loadMembers();
            if(document.getElementById('member-details-modal').classList.contains('active')) {
               showMemberDetails(memberId);
            }
            showNotification('تم تحديث العضو بنجاح', 'success');
        } else {
            const errorData = await response.json();
            showNotification(errorData.error, 'error');
        }
    } catch(err) {
        showNotification('فشل تحديث العضو', 'error');
    } finally {
        hideLoading();
    }
}

function requestDeleteMember() {
    const memberId = parseInt(document.getElementById('member-details-modal').dataset.memberId);
    const memberName = currentMembers.find(m => m.id === memberId)?.name || '';

    showConfirmModal(`هل أنت متأكد من حذف العضو "${memberName}"؟\nهذا الإجراء سيحذف كل نقاطه أيضاً ولا يمكن التراجع عنه.`, () => {
        handleDeleteMember(memberId);
    });
}

async function handleDeleteMember(memberId) {
    showLoading();
    try {
        const response = await fetch(`/api/members/${memberId}`, fetchOptions({ method: 'DELETE' }));
        if (response.ok) {
            closeModal(document.getElementById('member-details-modal'));
            loadMembers();
            showNotification('تم حذف العضو بنجاح', 'success');
        } else {
            const errorData = await response.json();
            showNotification(errorData.error, 'error');
        }
    } catch(err) {
        showNotification('فشل حذف العضو', 'error');
    } finally {
        hideLoading();
    }
}

async function handleAddPoint(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.member_id = parseInt(data.member_id);
    showLoading();
    try {
        const response = await fetch('/api/points', fetchOptions({
            method: 'POST',
            body: JSON.stringify(data)
        }));
        if (response.ok) {
            e.target.reset();
            updatePointCategories();
            loadRecentPoints();
            showNotification('تم إضافة النقطة بنجاح', 'success');
        } else {
            const errorData = await response.json();
            showNotification(errorData.error, 'error');
        }
    } catch (err) {
        showNotification('فشل إضافة النقطة', 'error');
    } finally {
        hideLoading();
    }
}

function requestDeletePoint(pointId, memberName, category) {
    const message = `هل أنت متأكد من حذف هذه النقطة؟\n\nالعضو: ${memberName}\nالفئة: ${category}`;
    showConfirmModal(message, () => deletePoint(pointId));
}

async function deletePoint(pointId) {
    showLoading();
    try {
        const response = await fetch(`/api/points/${pointId}`, fetchOptions({ method: 'DELETE' }));
        if (response.ok) {
            loadRecentPoints();
            if(document.querySelector('.tab-btn[data-tab="members"]').classList.contains('active')) {
                loadMembers();
            }
            showNotification('تم حذف النقطة بنجاح', 'success');
        } else {
            const errorData = await response.json();
            showNotification(errorData.error, 'error');
        }
    } catch (err) {
        showNotification('فشل حذف النقطة', 'error');
    } finally {
        hideLoading();
    }
}

async function loadLogs() {
    showLoading();
    try {
        const actionFilter = document.getElementById('action-filter').value;
        const targetFilter = document.getElementById('target-filter').value;
        const query = new URLSearchParams({
            action_type: actionFilter,
            target_type: targetFilter
        }).toString();

        const response = await fetch(`/api/logs?${query}`, fetchOptions());
        const data = await response.json();
        const list = document.getElementById('logs-list');
        list.innerHTML = !data.logs || data.logs.length === 0 ? '<p class="no-data">لا توجد سجلات</p>' : 
        data.logs.map(log => `
            <div class="log-item">
                <div class="log-header">
                    <span class="log-action ${log.action_type || 'unknown'}">${getActionDisplayName(log.action_type || 'غير معروف')}</span>
                    <span class="log-date">${formatDate(log.created_at)}</span>
                </div>
                <div class="log-details">${log.details}</div>
                <div class="log-creator">بواسطة: ${log.creator_name || 'غير معروف'}</div>
            </div>
        `).join('');
    } catch(err) {
        showNotification('فشل تحميل السجلات', 'error');
    } finally {
        hideLoading();
    }
}

async function loadUsers() {
    showLoading();
    try {
        const response = await fetch('/api/users', fetchOptions());
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const list = document.getElementById('users-list');
        allUsers = Array.isArray(data.users) ? data.users : Array.isArray(data) ? data : [];
        list.innerHTML = allUsers.length === 0 ? '<p class="no-data">لا يوجد مستخدمون</p>' :
        allUsers.map(user => `
            <div class="user-item">
                <div class="user-info">
                    <h4>${user.username}</h4>
                    <span class="user-role-badge ${user.role}">${getRoleDisplayName(user.role)}</span>
                </div>
                <div class="user-actions">
                ${(currentUser.role === 'leader' && user.id !== currentUser.id) ? `
                    <button class="btn btn-secondary btn-sm" onclick="showEditUserModal(${user.id})">تعديل</button>
                    <button class="btn btn-danger btn-sm" onclick="requestDeleteUser(${user.id}, '${user.username}')">حذف</button>
                ` : ''}
                </div>
            </div>
        `).join('');
    } catch(err) {
        console.error("Failed to load users:", err);
        showNotification('فشل تحميل المستخدمين', 'error');
    } finally {
        hideLoading();
    }
}

async function handleAddUser(e) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    showLoading();
    try {
        const response = await fetch('/api/users', fetchOptions({
            method: 'POST',
            body: JSON.stringify(data)
        }));

        if (response.ok) {
            closeModal(document.getElementById('add-user-modal'));
            loadUsers();
            showNotification('تم إضافة المستخدم بنجاح', 'success');
            form.reset();
        } else {
            const errorData = await response.json();
            if (response.status === 409 && errorData.error === 'USER_INACTIVE') {
                showConfirmModal(
                    `المستخدم "${data.username}" موجود بالفعل ولكنه غير مفعل.\n\n- اضغط <b>موافق</b> لإعادة تفعيله.\n- اضغط <b>إلغاء</b> لعرض خيار الحذف والإنشاء من جديد.`,
                    () => {
                        handleReactivateUser(errorData.user_id, data.username);
                    },
                    () => {
                        closeModal(document.getElementById('confirm-modal'));
                        setTimeout(() => {
                            showConfirmModal(
                                `⚠️ <b>تحذير خطير</b> ⚠️\n\nهل أنت متأكد من رغبتك في <b>حذف</b> المستخدم القديم "${data.username}" بكل بياناته (السجلات، النقاط، إلخ) وإنشاء مستخدم جديد ونظيف بنفس الاسم؟\n\n<b>لا يمكن التراجع عن هذا الإجراء!</b>`,
                                () => {
                                    handleForceCreateUser(data);
                                }
                            );
                        }, 300);
                    }
                );
            } else {
                showNotification(errorData.error, 'error');
            }
        }
    } catch (e) {
        showNotification('فشل إضافة المستخدم', 'error');
    } finally {
        hideLoading();
    }
}

async function handleReactivateUser(userId, username) {
    showLoading();
    try {
        const response = await fetch(`/api/users/${userId}/reactivate`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        if (response.ok) {
            closeModal(document.getElementById('add-user-modal'));
            loadUsers();
            showNotification(`تمت إعادة تفعيل المستخدم "${username}" بنجاح.`, 'success');
        } else {
            const errorData = await response.json().catch(() => ({}));
            showNotification(errorData.error || 'فشل في إعادة تفعيل المستخدم.', 'error');
        }
    } catch (err) {
        showNotification('فشل في إعادة تفعيل المستخدم.', 'error');
    } finally {
        hideLoading();
    }
}

async function handleForceCreateUser(userData) {
    showLoading();
    try {
        const response = await fetch('/api/users/force-create', fetchOptions({
            method: 'POST',
            body: JSON.stringify(userData)
        }));

        if (response.ok) {
            closeModal(document.getElementById('add-user-modal'));
            loadUsers();
            showNotification(`تم إنشاء المستخدم "${userData.username}" من جديد.`, 'success');
        } else {
            const errorData = await response.json();
            showNotification(errorData.error || 'فشل إنشاء المستخدم الجديد.', 'error');
        }
    } catch (err) {
        showNotification('فشل إنشاء المستخدم الجديد.', 'error');
    } finally {
        hideLoading();
    }
}

function showEditUserModal(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    const modal = document.getElementById('edit-user-modal');
    modal.dataset.userId = userId;
    document.getElementById('edit-user-username').value = user.username;
    document.getElementById('edit-user-role').value = user.role;
    document.getElementById('edit-user-password').value = '';
    modal.classList.add('active');
}

async function handleEditUserSubmit(e) {
    e.preventDefault();
    const modal = document.getElementById('edit-user-modal');
    const userId = modal.dataset.userId;
    const formData = new FormData(e.target);
    const data = {
        username: formData.get('username'),
        role: formData.get('role'),
    };
    const password = formData.get('password');
    if (password) {
        data.password = password;
    }
    showLoading();
    try {
        const response = await fetch(`/api/users/${userId}`, fetchOptions({
            method: 'PUT',
            body: JSON.stringify(data)
        }));
        if (response.ok) {
            closeModal(modal);
            loadUsers();
            showNotification('تم تحديث المستخدم بنجاح', 'success');
        } else {
            const errorData = await response.json();
            showNotification(errorData.error, 'error');
        }
    } catch (err) {
        showNotification('فشل تحديث المستخدم', 'error');
    } finally {
        hideLoading();
    }
}

function requestDeleteUser(userId, username) {
     showConfirmModal(`هل أنت متأكد من حذف المستخدم "${username}"؟`, () => {
         handleDeleteUser(userId);
     });
}

async function handleDeleteUser(userId) {
    showLoading();
    try {
        const response = await fetch(`/api/users/${userId}`, fetchOptions({ method: 'DELETE' }));
        if (response.ok) {
            loadUsers();
            showNotification('تم حذف المستخدم بنجاح', 'success');
        } else { 
            const errorData = await response.json();
            showNotification(errorData.error, 'error');
        }
    } catch(e) {
        showNotification('فشل حذف المستخدم', 'error');
    } finally {
        hideLoading();
    }
}

let currentUser = null;
let currentMembers = [];
let allUsers = [];
let positiveCategories = {};
let negativeCategories = {};
let confirmCallback = null;
let cancelCallback = null;
let notificationTimeout = null;
// متغيرات جديدة لإدارة فلاتر مودال تفاصيل العضو
let currentMemberDetailsPeriod = 'all';
let currentMemberDetailsStartDate = null;
let currentMemberDetailsEndDate = null;
let currentMemberId = null;

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
    

    // إضافة event listener لتغيير نوع الملاحظات
    document.getElementById('modal-note-type-filter').addEventListener('change', refreshMemberNotes);
    
    // إضافة event listeners للفلاتر داخل مودال تفاصيل العضو
    document.getElementById('modal-period-filter').addEventListener('change', handleModalPeriodChange);
    document.getElementById('modal-apply-filter').addEventListener('click', applyModalCustomFilter);
    
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
            <div class="member-actions"><button class="btn btn-secondary" onclick="event.stopPropagation(); showMemberDetails(${member.id}, document.getElementById('period-filter').value, document.getElementById('start-date').value, document.getElementById('end-date').value)">التفاصيل</button></div>
        </div>`).join('');
}

function handlePeriodChange() {
    document.getElementById('custom-dates').style.display = (document.getElementById('period-filter').value === 'custom') ? 'flex' : 'none';
    if(document.getElementById('period-filter').value !== 'custom') loadMembers();
}
const applyCustomFilter = () => loadMembers();

// دالة جديدة لمعالجة تغيير الفترة داخل مودال تفاصيل العضو
function handleModalPeriodChange() {
    const modalPeriodFilter = document.getElementById('modal-period-filter');
    const modalCustomDates = document.getElementById('modal-custom-dates');
    
    if (modalPeriodFilter.value === 'custom') {
        modalCustomDates.style.display = 'flex';
    } else {
        modalCustomDates.style.display = 'none';
        // إعادة تحميل بيانات العضو مباشرة عند تغيير الفترة (غير مخصصة)
        currentMemberDetailsPeriod = modalPeriodFilter.value;
        currentMemberDetailsStartDate = null;
        currentMemberDetailsEndDate = null;
        if (currentMemberId) {
            showMemberDetails(currentMemberId, currentMemberDetailsPeriod);
        }
    }
}

// دالة جديدة لتطبيق الفلتر المخصص داخل مودال تفاصيل العضو
function applyModalCustomFilter() {
    const modalPeriodFilter = document.getElementById('modal-period-filter');
    const modalStartDate = document.getElementById('modal-start-date');
    const modalEndDate = document.getElementById('modal-end-date');
    
    currentMemberDetailsPeriod = modalPeriodFilter.value;
    currentMemberDetailsStartDate = modalStartDate.value;
    currentMemberDetailsEndDate = modalEndDate.value;
    
    if (currentMemberId) {
        showMemberDetails(currentMemberId, currentMemberDetailsPeriod, currentMemberDetailsStartDate, currentMemberDetailsEndDate);
    }
}

function handleMemberCardClick(e) {
    if (window.innerWidth > 768) return;
    const card = e.target.closest('.member-card');
    if (card && card.dataset.id) {
        const period = document.getElementById('period-filter').value;
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        showMemberDetails(card.dataset.id, period, startDate, endDate);
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

function populateMembersSelect(members) {
    const select = document.getElementById('member-select');
    select.innerHTML = '<option value="">اختر العضو</option>' + 
        members.map(member => `<option value="${member.id}">${member.name}</option>`).join('');
}

function updatePointCategories() {
    const type = document.getElementById('point-type').value;
    const select = document.getElementById('point-category');
    const categories = type === 'positive' ? positiveCategories : type === 'negative' ? negativeCategories : [];
    select.innerHTML = '<option value="">اختر الفئة</option>' + categories.map(c => `<option value="${c}">${c}</option>`).join('');
}

// دالة معدلة لعرض تفاصيل العضو مع دعم الفلاتر المنفصلة
async function showMemberDetails(memberId, period = null, startDate = null, endDate = null) {
    showLoading();
    try {
        // تحديد الفلاتر المستخدمة
        const periodToUse = period !== null ? period : currentMemberDetailsPeriod;
        const startDateToUse = startDate !== null ? startDate : currentMemberDetailsStartDate;
        const endDateToUse = endDate !== null ? endDate : currentMemberDetailsEndDate;
        
        // تحديث المتغيرات الحالية
        currentMemberDetailsPeriod = periodToUse;
        currentMemberDetailsStartDate = startDateToUse;
        currentMemberDetailsEndDate = endDateToUse;
        currentMemberId = memberId;
        
        // بناء URL للطلب
        let url = `/api/members/${memberId}?period=${periodToUse}`;
        if (periodToUse === 'custom' && startDateToUse && endDateToUse) {
            url += `&start_date=${startDateToUse}&end_date=${endDateToUse}`;
        }
        
        const response = await fetch(url, fetchOptions());
        const data = await response.json();
        if (response.ok) {
            displayMemberDetails(data.member);
            
            // تحديث فلاتر المودال لتعكس الحالة الحالية
            document.getElementById('modal-period-filter').value = periodToUse;
            if (periodToUse === 'custom') {
                document.getElementById('modal-start-date').value = startDateToUse || '';
                document.getElementById('modal-end-date').value = endDateToUse || '';
                document.getElementById('modal-custom-dates').style.display = 'flex';
            } else {
                document.getElementById('modal-custom-dates').style.display = 'none';
            }
            
            document.getElementById('member-details-modal').classList.add('active');
        } else {
            showNotification(data.error, 'error');
        }
    } catch (err) {
        showNotification('فشل تحميل تفاصيل العضو', 'error');
    } finally {
        hideLoading();
    }
}

function displayMemberDetails(member) {
    document.getElementById('modal-member-name').textContent = member.name;
    document.getElementById('modal-member-id').textContent = member.id;
    document.getElementById('modal-positive-count').textContent = member.positive_count;
    document.getElementById('modal-negative-count').textContent = member.negative_count;
    document.getElementById('modal-total-points').textContent = member.total_points;
    document.getElementById('modal-total-points').className = `stat-value ${member.total_points >= 0 ? 'positive' : 'negative'}`;
    
    if (member.performance) {
        document.getElementById('modal-performance').textContent = member.performance;
        document.getElementById('modal-performance').className = `performance ${getPerformanceClass(member.performance)}`;
    }
    
    displayMemberNotes(member.notes || []);
}

function displayMemberNotes(notes) {
    const noteTypeFilter = document.getElementById('modal-note-type-filter').value;
    const filteredNotes = noteTypeFilter ? notes.filter(note => note.point_type === noteTypeFilter) : notes;
    
    const list = document.getElementById('modal-member-notes');
    list.innerHTML = !filteredNotes || filteredNotes.length === 0 ? '<p class="no-data">لا توجد ملاحظات</p>' :
    filteredNotes.map(note => `
        <div class="note-item">
            <div class="note-info">
                <div class="note-category">${note.category}</div>
                ${note.description ? `<div class="note-description">${note.description}</div>` : ''}
                <div class="note-date">${formatDate(note.created_at)}</div>
                <div class="note-creator">أضافها: ${note.creator_name || 'غير محدد'}</div>
            </div>
            <div class="note-actions">
                <span class="note-type ${note.point_type}">${note.point_type === 'positive' ? 'إيجابية' : 'سلبية'}</span>
                ${(currentUser.role === 'leader' || currentUser.role === 'co_leader') ? `<button class="btn btn-danger btn-sm" onclick="requestDeletePoint(${note.id}, '${note.member_name}', '${note.category}')">حذف</button>` : ''}
            </div>
        </div>`).join('');
}

function refreshMemberNotes() {
    if (currentMemberId) {
        showMemberDetails(currentMemberId, currentMemberDetailsPeriod, currentMemberDetailsStartDate, currentMemberDetailsEndDate);
    }
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
        confirmCallback = null;
        cancelCallback = null;
    }
    closeModal(document.getElementById('confirm-modal'));
}

async function handleAddPoint(e) {
    e.preventDefault();
    const pointData = Object.fromEntries(new FormData(e.target));
    showLoading();
    try {
        const response = await fetch('/api/points', fetchOptions({
            method: 'POST',
            body: JSON.stringify(pointData)
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
    const memberData = Object.fromEntries(new FormData(e.target));
    showLoading();
    try {
        const response = await fetch('/api/members', fetchOptions({
            method: 'POST',
            body: JSON.stringify(memberData)
        }));
        const data = await response.json();
        if (response.ok) {
            showNotification('تم إضافة العضو بنجاح!', 'success');
            closeModal(document.getElementById('add-member-modal'));
            e.target.reset();
            loadMembers();
            loadPointsData();
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
    const userData = Object.fromEntries(new FormData(e.target));
    showLoading();
    try {
        const response = await fetch('/api/users', fetchOptions({
            method: 'POST',
            body: JSON.stringify(userData)
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
    const memberId = document.getElementById('modal-member-id').textContent;
    const memberName = document.getElementById('modal-member-name').textContent;
    
    document.getElementById('edit-member-id').value = memberId;
    document.getElementById('edit-member-name').value = memberName;
    
    closeModal(document.getElementById('member-details-modal'));
    document.getElementById('edit-member-modal').classList.add('active');
}

async function handleEditMemberSubmit(e) {
    e.preventDefault();
    const memberData = Object.fromEntries(new FormData(e.target));
    const memberId = memberData.id;
    delete memberData.id;
    
    showLoading();
    try {
        const response = await fetch(`/api/members/${memberId}`, fetchOptions({
            method: 'PUT',
            body: JSON.stringify(memberData)
        }));
        const data = await response.json();
        if (response.ok) {
            showNotification('تم تحديث العضو بنجاح!', 'success');
            closeModal(document.getElementById('edit-member-modal'));
            loadMembers();
            loadPointsData();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (err) {
        showNotification('فشل تحديث العضو', 'error');
    } finally {
        hideLoading();
    }
}

function requestDeleteMember() {
    const memberId = document.getElementById('modal-member-id').textContent;
    const memberName = document.getElementById('modal-member-name').textContent;
    
    showConfirmModal(
        `هل أنت متأكد من حذف العضو "${memberName}"؟\nسيتم حذف جميع النقاط المرتبطة بهذا العضو.`,
        () => deleteMember(memberId)
    );
}

async function deleteMember(memberId) {
    showLoading();
    try {
        const response = await fetch(`/api/members/${memberId}`, fetchOptions({
            method: 'DELETE'
        }));
        const data = await response.json();
        if (response.ok) {
            showNotification('تم حذف العضو بنجاح!', 'success');
            closeModal(document.getElementById('member-details-modal'));
            loadMembers();
            loadPointsData();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (err) {
        showNotification('فشل حذف العضو', 'error');
    } finally {
        hideLoading();
    }
}

function requestDeletePoint(pointId, memberName, category) {
    showConfirmModal(
        `هل أنت متأكد من حذف النقطة "${category}" للعضو "${memberName}"؟`,
        () => deletePoint(pointId)
    );
}

async function deletePoint(pointId) {
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
            if (currentMemberId) {
                showMemberDetails(currentMemberId, currentMemberDetailsPeriod, currentMemberDetailsStartDate, currentMemberDetailsEndDate);
            }
        } else {
            showNotification(data.error, 'error');
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
        const startDate = document.getElementById('logs-start-date').value;
        const endDate = document.getElementById('logs-end-date').value;
        let url = '/api/logs';
        if (startDate && endDate) {
            url += `?start_date=${startDate}&end_date=${endDate}`;
        }
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
    const list = document.getElementById('logs-list');
    list.innerHTML = !logs || logs.length === 0 ? '<p class="no-data">لا توجد سجلات</p>' :
    logs.map(log => `
        <div class="log-item">
            <div class="log-info">
                <div class="log-user">${log.username}</div>
                <div class="log-action">${getActionDisplayName(log.action)}</div>
                <div class="log-details">${log.details || 'لا توجد تفاصيل'}</div>
                <div class="log-date">${formatDate(log.timestamp)}</div>
            </div>
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
    const list = document.getElementById('users-list');
    list.innerHTML = !users || users.length === 0 ? '<p class="no-data">لا يوجد مستخدمين</p>' :
    users.map(user => `
        <div class="user-card">
            <div class="user-info">
                <div class="user-name">${user.username}</div>
                <div class="user-role">${getRoleDisplayName(user.role)}</div>
                <div class="user-status ${user.is_active ? 'active' : 'inactive'}">${user.is_active ? 'نشط' : 'غير نشط'}</div>
            </div>
            <div class="user-actions">
                <button class="btn btn-secondary" onclick="editUser(${user.id}, '${user.username}', '${user.role}', ${user.is_active})">تعديل</button>
                ${user.is_active ? 
                    `<button class="btn btn-warning" onclick="requestDeactivateUser(${user.id}, '${user.username}')">إلغاء تفعيل</button>` :
                    `<button class="btn btn-success" onclick="requestReactivateUser(${user.id}, '${user.username}')">إعادة تفعيل</button>`
                }
            </div>
        </div>`).join('');
}

function editUser(userId, username, role, isActive) {
    document.getElementById('edit-user-id').value = userId;
    document.getElementById('edit-user-username').value = username;
    document.getElementById('edit-user-role').value = role;
    document.getElementById('edit-user-modal').classList.add('active');
}

async function handleEditUserSubmit(e) {
    e.preventDefault();
    const userData = Object.fromEntries(new FormData(e.target));
    const userId = userData.id;
    delete userData.id;
    
    showLoading();
    try {
        const response = await fetch(`/api/users/${userId}`, fetchOptions({
            method: 'PUT',
            body: JSON.stringify(userData)
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

function requestDeactivateUser(userId, username) {
    showConfirmModal(
        `هل أنت متأكد من إلغاء تفعيل المستخدم "${username}"؟`,
        () => deactivateUser(userId)
    );
}

function requestReactivateUser(userId, username) {
    showConfirmModal(
        `هل أنت متأكد من إعادة تفعيل المستخدم "${username}"؟`,
        () => reactivateUser(userId)
    );
}

async function deactivateUser(userId) {
    showLoading();
    try {
        const response = await fetch(`/api/users/${userId}/deactivate`, fetchOptions({
            method: 'POST'
        }));
        const data = await response.json();
        if (response.ok) {
            showNotification('تم إلغاء تفعيل المستخدم بنجاح!', 'success');
            loadUsers();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (err) {
        showNotification('فشل إلغاء تفعيل المستخدم', 'error');
    } finally {
        hideLoading();
    }
}

async function reactivateUser(userId) {
    showLoading();
    try {
        const response = await fetch(`/api/users/${userId}/reactivate`, fetchOptions({
            method: 'POST'
        }));
        const data = await response.json();
        if (response.ok) {
            showNotification('تم إعادة تفعيل المستخدم بنجاح!', 'success');
            loadUsers();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (err) {
        showNotification('فشل إعادة تفعيل المستخدم', 'error');
    } finally {
        hideLoading();
    }
}

function formatDateForDisplay(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}


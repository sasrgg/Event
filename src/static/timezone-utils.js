// مساعد لإدارة التوقيت السعودي (UTC+3)
const SAUDI_TIMEZONE = 'Asia/Riyadh';

/**
 * تحويل التاريخ إلى التوقيت السعودي
 * @param {string|Date} dateInput - التاريخ المراد تحويله
 * @returns {Date} - التاريخ بالتوقيت السعودي
 */
function toSaudiTime(dateInput) {
    if (!dateInput) return null;
    
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return null;
    
    // تحويل إلى التوقيت السعودي
    return new Date(date.toLocaleString("en-US", { timeZone: SAUDI_TIMEZONE }));
}

/**
 * تنسيق التاريخ للعرض بالتوقيت السعودي
 * @param {string|Date} dateInput - التاريخ المراد تنسيقه
 * @param {Object} options - خيارات التنسيق
 * @returns {string} - التاريخ المنسق
 */
function formatSaudiDate(dateInput, options = {}) {
    if (!dateInput) return '';
    
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    
    const defaultOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Riyadh'
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    try {
        return date.toLocaleDateString('ar-EG', finalOptions);
    } catch (error) {
        // في حالة فشل التحويل، استخدم طريقة بديلة
        console.warn('فشل في تحويل التاريخ باستخدام toLocaleDateString:', error);
        
        // حساب الفارق الزمني يدوياً (3 ساعات)
        const utcTime = date.getTime();
        const saudiOffset = 3 * 60 * 60 * 1000; // 3 ساعات بالميلي ثانية
        const saudiTime = new Date(utcTime + saudiOffset);
        
        return saudiTime.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

/**
 * الحصول على التاريخ والوقت الحالي بالتوقيت السعودي
 * @returns {Date} - التاريخ والوقت الحالي بالتوقيت السعودي
 */
function getCurrentSaudiTime() {
    return new Date(new Date().toLocaleString("en-US", { timeZone: SAUDI_TIMEZONE }));
}

/**
 * تحويل التاريخ المحلي إلى UTC مع مراعاة التوقيت السعودي
 * @param {Date} localDate - التاريخ المحلي
 * @returns {string} - التاريخ بصيغة ISO UTC
 */
function localToUTC(localDate) {
    if (!localDate) return null;
    
    // إنشاء تاريخ جديد مع افتراض أن التاريخ المدخل هو بالتوقيت السعودي
    const saudiDate = new Date(localDate.toLocaleString("en-US", { timeZone: SAUDI_TIMEZONE }));
    const utcDate = new Date(localDate.getTime() - (saudiDate.getTime() - localDate.getTime()));
    
    return utcDate.toISOString();
}

/**
 * تحويل تاريخ UTC إلى التوقيت السعودي
 * @param {string} utcDateString - التاريخ بصيغة UTC
 * @returns {Date} - التاريخ بالتوقيت السعودي
 */
function utcToSaudiTime(utcDateString) {
    if (!utcDateString) return null;
    
    const utcDate = new Date(utcDateString);
    if (isNaN(utcDate.getTime())) return null;
    
    return new Date(utcDate.toLocaleString("en-US", { timeZone: SAUDI_TIMEZONE }));
}

/**
 * تنسيق التاريخ للعرض في الجداول والقوائم
 * @param {string|Date} dateInput - التاريخ المراد تنسيقه
 * @returns {string} - التاريخ المنسق للعرض
 */
function formatDateForDisplay(dateInput) {
    if (!dateInput) return '';
    
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    
    try {
        // محاولة التحويل المباشر إلى التوقيت السعودي
        return date.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Riyadh'
        });
    } catch (error) {
        console.warn('فشل في التحويل المباشر، استخدام الطريقة البديلة:', error);
        
        // الطريقة البديلة: إضافة 3 ساعات يدوياً
        const utcTime = date.getTime();
        const saudiOffset = 3 * 60 * 60 * 1000; // 3 ساعات بالميلي ثانية
        const saudiTime = new Date(utcTime + saudiOffset);
        
        return saudiTime.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

/**
 * تنسيق التاريخ للعرض المختصر (بدون وقت)
 * @param {string|Date} dateInput - التاريخ المراد تنسيقه
 * @returns {string} - التاريخ المنسق بدون وقت
 */
function formatDateOnly(dateInput) {
    return formatSaudiDate(dateInput, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * تنسيق الوقت فقط
 * @param {string|Date} dateInput - التاريخ المراد استخراج الوقت منه
 * @returns {string} - الوقت المنسق
 */
function formatTimeOnly(dateInput) {
    return formatSaudiDate(dateInput, {
        hour: '2-digit',
        minute: '2-digit'
    });
}


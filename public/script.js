// 日志管理系统
const Logger = {
    enabled: false, // 在生产环境中设为false
    debugLevel: 'info', // 'debug', 'info', 'warn', 'error'
    
    // 日志级别优先级
    _levels: { debug: 0, info: 1, warn: 2, error: 3 },
    
    // 检查是否应该输出日志
    _shouldLog: function(level) {
        return this._levels[level] >= this._levels[this.debugLevel];
    },
    
    debug: function(message, ...args) {
        if (this.enabled && this._shouldLog('debug')) {
            console.log('🐛 [DEBUG]', message, ...args);
        }
    },
    
    info: function(message, ...args) {
        if (this.enabled && this._shouldLog('info')) {
            console.log('ℹ️ [INFO]', message, ...args);
        }
    },
    
    log: function(message, ...args) {
        // 保持向后兼容，映射到info级别
        this.info(message, ...args);
    },
    
    warn: function(message, ...args) {
        if (this.enabled && this._shouldLog('warn')) {
            console.warn('⚠️ [WARN]', message, ...args);
        }
    },
    
    error: function(message, ...args) {
        // 错误日志始终显示
        console.error('❌ [ERROR]', message, ...args);
    },
    
    // 图表相关日志
    chart: {
        debug: function(message, ...args) {
            Logger.debug('[CHART]', message, ...args);
        },
        info: function(message, ...args) {
            Logger.info('[CHART]', message, ...args);
        },
        warn: function(message, ...args) {
            Logger.warn('[CHART]', message, ...args);
        },
        error: function(message, ...args) {
            Logger.error('[CHART]', message, ...args);
        }
    },
    
    // 时间轴相关日志
    timeline: {
        debug: function(message, ...args) {
            Logger.debug('[TIMELINE]', message, ...args);
        },
        info: function(message, ...args) {
            Logger.info('[TIMELINE]', message, ...args);
        },
        warn: function(message, ...args) {
            Logger.warn('[TIMELINE]', message, ...args);
        },
        error: function(message, ...args) {
            Logger.error('[TIMELINE]', message, ...args);
        }
    },
    
    // 备份相关日志
    backup: {
        debug: function(message, ...args) {
            Logger.debug('[BACKUP]', message, ...args);
        },
        info: function(message, ...args) {
            Logger.info('[BACKUP]', message, ...args);
        },
        warn: function(message, ...args) {
            Logger.warn('[BACKUP]', message, ...args);
        },
        error: function(message, ...args) {
            Logger.error('[BACKUP]', message, ...args);
        }
    }
};

// 北京时间格式化工具函数
const BeijingTime = {
    // 获取北京时间 Date 对象
    getBeijingTime(dateInput = null) {
        let inputDate;
        if (dateInput) {
            // 如果输入是字符串，先转换为Date对象
            inputDate = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
        } else {
            inputDate = new Date();
        }
        
        // 获取UTC时间戳，然后加上8小时（北京时间UTC+8）
        const utcTime = inputDate.getTime() + (inputDate.getTimezoneOffset() * 60000);
        const beijingTime = new Date(utcTime + (8 * 3600000));
        return beijingTime;
    },
    
    // 格式化为北京时间字符串 (YYYY/M/D HH:mm:ss 格式)
    formatDateTime(dateInput = null) {
        const beijingTime = this.getBeijingTime(dateInput);
        const year = beijingTime.getFullYear();
        const month = beijingTime.getMonth() + 1;
        const day = beijingTime.getDate();
        const hour = String(beijingTime.getHours()).padStart(2, '0');
        const minute = String(beijingTime.getMinutes()).padStart(2, '0');
        const second = String(beijingTime.getSeconds()).padStart(2, '0');
        return `${year}/${month}/${day} ${hour}:${minute}:${second}`;
    },
    
    // 格式化为北京时间日期字符串 (YYYY/M/D 格式)
    formatDate(dateInput = null) {
        const beijingTime = this.getBeijingTime(dateInput);
        const year = beijingTime.getFullYear();
        const month = beijingTime.getMonth() + 1;
        const day = beijingTime.getDate();
        return `${year}/${month}/${day}`;
    },
    
    // 格式化为简短的月日格式 (M/D 格式)
    formatShortDate(dateInput = null) {
        const beijingTime = this.getBeijingTime(dateInput);
        const month = beijingTime.getMonth() + 1;
        const day = beijingTime.getDate();
        return `${month}/${day}`;
    }
};

let chart;
let currentRecords = [];
let allRecords = [];

// 查询频率限制
let lastQueryTime = 0;
const QUERY_COOLDOWN = 30000; // 30秒

// 密码保护功能
const ADMIN_PASSWORD = '3.1415926';

// 登录状态检查
async function checkLoginStatus() {
    try {
        const response = await fetch('/api/login-status');
        const result = await response.json();
        
        if (!result.isLoggedIn) {
            // 未登录，重定向到登录页面
            window.location.href = '/login.html';
            return false;
        }
        
        // 已登录，可以显示用户信息
        displayLoginInfo(result);
        return true;
    } catch (error) {
        console.error('检查登录状态失败:', error);
        // 出错时也重定向到登录页面
        window.location.href = '/login.html';
        return false;
    }
}

// 显示登录信息
function displayLoginInfo(loginInfo) {
    // 可以在这里添加显示用户登录信息的逻辑
    console.log('用户已登录:', loginInfo.loginMethod, '登录时间:', loginInfo.loginTime);
    
    // 在页面头部添加登录状态和退出按钮
    addLoginStatusToHeader(loginInfo);
}

// 在页面头部添加登录状态信息
function addLoginStatusToHeader(loginInfo) {
    const header = document.querySelector('h1');
    if (header && !document.querySelector('.login-status')) {
        const loginStatus = document.createElement('div');
        loginStatus.className = 'login-status';
        loginStatus.style.cssText = `
            position: absolute;
            top: 10px;
            right: 20px;
            font-size: 14px;
            color: #666;
            background: rgba(255, 255, 255, 0.9);
            padding: 8px 12px;
            border-radius: 5px;
            border: 1px solid #ddd;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        
        const loginMethod = loginInfo.loginMethod === 'qrcode' ? '扫码登录' : '密码登录';
        const loginTime = BeijingTime.formatDateTime(loginInfo.loginTime);
        
        loginStatus.innerHTML = `
            <div style="margin-bottom: 5px;">
                <span style="color: #4CAF50;">●</span> 已登录 (${loginMethod})
            </div>
            <div style="font-size: 12px; color: #999; margin-bottom: 8px;">
                ${loginTime}
            </div>
            <button onclick="logout()" style="
                background: #f44336;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 12px;
            ">退出登录</button>
        `;
        
        // 确保header有相对定位
        header.style.position = 'relative';
        header.appendChild(loginStatus);
    }
}

// 退出登录
async function logout() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST'
        });
        
        if (response.ok) {
            // 退出成功，重定向到登录页面
            window.location.href = '/login.html';
        } else {
            alert('退出登录失败，请重试');
        }
    } catch (error) {
        console.error('退出登录失败:', error);
        alert('退出登录失败，请重试');
    }
}
let isAdminUnlocked = false;

// 倒计时相关
let countdownInterval = null;

// 开始倒计时显示
function startCountdown(initialSeconds) {
    const queryStatus = document.getElementById('queryStatus');
    
    // 清除之前的倒计时
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    let remainingSeconds = initialSeconds;
    
    // 立即显示初始倒计时
    queryStatus.textContent = `查询过于频繁，请等待 ${remainingSeconds} 秒后再试`;
    queryStatus.style.color = '#dc3545';
    
    // 每秒更新倒计时
    countdownInterval = setInterval(() => {
        remainingSeconds--;
        
        if (remainingSeconds > 0) {
            queryStatus.textContent = `查询过于频繁，请等待 ${remainingSeconds} 秒后再试`;
        } else {
            // 倒计时结束，恢复原始状态
            clearInterval(countdownInterval);
            countdownInterval = null;
            queryStatus.textContent = '点击查询按钮获取最新余额';
            queryStatus.style.color = '#666';
        }
    }, 1000);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 首先检查登录状态
    checkLoginStatus();
    
    // 事件绑定助手函数
    function bindEvents(eventMap) {
        Object.entries(eventMap).forEach(([elementId, handler]) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.addEventListener('click', handler);
            }
        });
    }
    
    // 批量绑定点击事件
    bindEvents({
        queryBtn: queryElectricity,
        testConnectionBtn: testConnection,
        refreshHistoryBtn: refreshHistory,
        restoreDataBtn: showRestoreModal,
        confirmRestoreBtn: confirmRestore,
        createBackupBtn: createManualBackup,
        refreshBackupListBtn: refreshBackupList,
        selectAllBackupsBtn: selectAllBackups,
        unselectAllBackupsBtn: unselectAllBackups,
        deleteSelectedBackupsBtn: deleteSelectedBackups,
        showBackupManageBtn: toggleBackupManageContent,
        confirmClearBtn: function() {
            const modal = document.getElementById('clearDataModal');
            if (modal.dataset.action === 'old') {
                clearOldData();
            } else if (modal.dataset.action === 'selected') {
                clearSelectedData();
            } else if (modal.dataset.action === 'all') {
                clearAllData();
            }
            hideClearModal();
        },
        cancelClearBtn: hideClearModal
    });

    // 绑定事件监听器
    const historyType = document.getElementById('historyViewType');
    const historyDays = document.getElementById('historyDays');
    const selectedDate = document.getElementById('selectedDate');
    const queryBtn = document.getElementById('queryBtn');
    const debugBtn = document.getElementById('debugBtn');
    const testConnectionBtn = document.getElementById('testConnectionBtn');
    const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
    const clearOldDataBtn = document.getElementById('clearOldDataBtn');
    const clearSelectedBtn = document.getElementById('clearSelectedBtn');
    const clearAllDataBtn = document.getElementById('clearAllDataBtn');
    const restoreDataBtn = document.getElementById('restoreDataBtn');
    const confirmClearBtn = document.getElementById('confirmClearBtn');
    const cancelClearBtn = document.getElementById('cancelClearBtn');
    const confirmRestoreBtn = document.getElementById('confirmRestoreBtn');
    const createBackupBtn = document.getElementById('createBackupBtn');
    const refreshBackupListBtn = document.getElementById('refreshBackupListBtn');
    
    // 为数据备份与恢复模态框的关闭按钮绑定事件
    const restoreModalCloseBtn = document.querySelector('#restoreDataModal .close');
    
    // 图表时间范围按钮
    const chartButtons = document.querySelectorAll('.chart-btn[data-period]');
    chartButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const period = this.dataset.period;
            showChartByPeriod(period);
            
            // 更新按钮状态
            chartButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // 同步更新历史记录的时间范围选择
            syncHistoryDaysWithChartPeriod(period);
        });
    });
    
    if (historyType) {
        historyType.addEventListener('change', onHistoryControlChange);
    }
    if (historyDays) {
        historyDays.addEventListener('change', onHistoryControlChange);
    }
    if (selectedDate) {
        selectedDate.addEventListener('change', onHistoryControlChange);
        // 设置默认日期为今天（北京时间）
        const beijingTime = new Date(Date.now() + 8 * 60 * 60 * 1000);
        const today = beijingTime.toISOString().split('T')[0];
        selectedDate.value = today;
        // 在详细模式下立即触发数据更新
        setTimeout(() => {
            if (historyType && historyType.value === 'detailed') {
                onHistoryControlChange();
            }
        }, 100);
    }

    // 绑定日期导航按钮事件
    const prevDayBtn = document.getElementById('prevDayBtn');
    const nextDayBtn = document.getElementById('nextDayBtn');
    
    if (prevDayBtn) {
        prevDayBtn.addEventListener('click', function() {
            navigateDate(-1);
        });
    }
    
    if (nextDayBtn) {
        nextDayBtn.addEventListener('click', function() {
            navigateDate(1);
        });
    }

    // 特殊的清理数据按钮事件（需要复杂逻辑）
    if (clearOldDataBtn) {
        clearOldDataBtn.addEventListener('click', function() {
            // 根据当前视图类型显示不同的清空方式
            const historyType = document.getElementById('historyViewType');
            if (historyType && historyType.value === 'detailed') {
                // 详细记录模式：启用复选框选择模式
                toggleSelectionMode();
            } else {
                // 汇总模式：显示日期范围选择
                const dateRangeDiv = document.getElementById('dateRangeDiv');
                const clearDataMessage = document.getElementById('clearDataMessage');
                if (dateRangeDiv) dateRangeDiv.style.display = 'flex';
                if (clearDataMessage) clearDataMessage.textContent = '请选择要删除的日期范围：';
                
                // 设置模态框的action为old
                const modal = document.getElementById('clearDataModal');
                if (modal) modal.dataset.action = 'old';
                
                showClearModal();
            }
        });
    }
    
    if (clearSelectedBtn) {
        clearSelectedBtn.addEventListener('click', function() {
            const selectedIds = getSelectedRecordIds();
            if (selectedIds.length === 0) {
                alert('请先选择要删除的记录');
                return;
            }
            
            // 隐藏日期范围选择
            const dateRangeDiv = document.getElementById('dateRangeDiv');
            const clearDataMessage = document.getElementById('clearDataMessage');
            if (dateRangeDiv) dateRangeDiv.style.display = 'none';
            if (clearDataMessage) clearDataMessage.textContent = `确定要删除选中的 ${selectedIds.length} 条记录吗？`;
            
            // 设置模态框的action为selected
            const modal = document.getElementById('clearDataModal');
            if (modal) modal.dataset.action = 'selected';
            
            showClearModal();
        });
    }
    
    if (clearAllDataBtn) {
        clearAllDataBtn.addEventListener('click', function() {
            // 隐藏日期范围选择
            const dateRangeDiv = document.getElementById('dateRangeDiv');
            const clearDataMessage = document.getElementById('clearDataMessage');
            if (dateRangeDiv) dateRangeDiv.style.display = 'none';
            if (clearDataMessage) clearDataMessage.textContent = '确定要删除所有记录吗？此操作不可撤销。';
            
            // 设置模态框的action为all
            const modal = document.getElementById('clearDataModal');
            if (modal) modal.dataset.action = 'all';
            
            showClearModal();
        });
    }

    // 模态框关闭按钮
    if (restoreModalCloseBtn) {
        restoreModalCloseBtn.addEventListener('click', function() {
            hideRestoreModal();
        });
    }
    
    // 模态框点击外部关闭
    window.onclick = function(event) {
        const clearModal = document.getElementById('clearDataModal');
        const restoreModal = document.getElementById('restoreDataModal');
        const passwordModal = document.getElementById('passwordModal');
        
        if (clearModal && event.target == clearModal) {
            hideClearModal();
        }
        if (restoreModal && event.target == restoreModal) {
            hideRestoreModal();
        }
        if (passwordModal && event.target == passwordModal) {
            hidePasswordModal();
        }
    }
    
    // 为页面底部的"上次查询时间"文字添加点击事件
    const lastUpdateElement = document.getElementById('lastUpdate');
    if (lastUpdateElement) {
        lastUpdateElement.style.cursor = 'pointer';
        // lastUpdateElement.style.textDecoration = 'underline';
        lastUpdateElement.addEventListener('click', showPasswordModal);
    }
    
    // 初始化管理员功能的显示状态
    updateAdminButtonsVisibility();
    
    // 初始化图表
    initializeChart();
    
    // 初始加载历史记录
    loadHistory();
    
    // 加载统计信息
    loadStats();
    
    // 加载系统最后查询时间
    loadLastSystemQuery();
});

async function queryElectricity() {
    const button = document.getElementById('queryBtn');
    const balanceAmount = document.getElementById('balanceAmount');
    const lastQueryTimeEl = document.getElementById('lastQueryTime');
    const queryStatus = document.getElementById('queryStatus');
    
    // 首先检查登录状态
    const isLoggedIn = await checkLoginStatus();
    if (!isLoggedIn) {
        return; // checkLoginStatus会自动重定向到登录页面
    }
    
    try {
        button.disabled = true;
        queryStatus.textContent = '正在查询中...';
        queryStatus.style.color = '#ffa500';
        
        const response = await fetch('/api/query');
        const data = await response.json();
        
        if (data.success && response.ok) {
            // 确保 remainingAmount 是数字
            const remainingAmount = parseFloat(data.remainingAmount);
            if (isNaN(remainingAmount)) {
                throw new Error(`服务器返回的余额数据格式错误: ${data.remainingAmount}`);
            }
            
            balanceAmount.textContent = remainingAmount.toFixed(2);
            lastQueryTimeEl.textContent = BeijingTime.formatDateTime(data.queryTime);
            queryStatus.textContent = data.message;
            queryStatus.style.color = '#28a745';
            
            // 自动切换到当天的记录
            await switchToToday();
            
            // 重新加载数据，但不更新"最后更新时间"（那个显示系统定时查询时间）
            await loadHistory();
            await loadStats();
        } else {
            // 处理服务端返回的错误信息
            if (response.status === 401) {
                // 未授权，重定向到登录页面
                window.location.href = '/login.html';
                return;
            } else if (response.status === 429 && data.remainingTime) {
                // 服务端返回的频率限制错误，开始倒计时显示
                startCountdown(data.remainingTime);
            } else {
                queryStatus.textContent = `查询失败：${data.message || data.error}`;
                queryStatus.style.color = '#dc3545';
            }
        }
    } catch (error) {
        queryStatus.textContent = `网络错误：${error.message}`;
        queryStatus.style.color = '#dc3545';
    } finally {
        button.disabled = false;
    }
}

async function loadHistory() {
    try {
        const historyType = document.getElementById('historyViewType');
        const historyDays = document.getElementById('historyDays');
        const selectedDate = document.getElementById('selectedDate');
        
        const type = historyType ? historyType.value : 'summary';
        let apiUrl = '';
        
        Logger.log('loadHistory called:', { type, selectedDate: selectedDate?.value });
        
        if (type === 'detailed') {
            // 详细模式：使用选择的日期，调用新的records API
            // 获取北京时间的当前日期
            const now = new Date();
            const beijingNow = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
            const beijingDateStr = beijingNow.toISOString().split('T')[0];
            const date = selectedDate ? selectedDate.value : beijingDateStr;
            apiUrl = `/api/records?date=${date}`;
            Logger.log('详细模式 API URL:', apiUrl);
        } else {
            // 汇总模式：使用天数范围，调用history API获取完整汇总信息
            const days = historyDays ? historyDays.value : '7';
            apiUrl = `/api/history?days=${days}&type=summary`;
            Logger.log('汇总模式 API URL:', apiUrl);
        }
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        Logger.log('API 响应:', { status: response.status, dataLength: data?.length });
        
        if (response.ok) {
            if (type === 'detailed') {
                // 详细记录直接使用返回的数组
                allRecords = Array.isArray(data) ? data : [];
                currentRecords = allRecords;
                Logger.log('详细模式数据:', currentRecords.length, '条记录');
            } else {
                // 汇总模式：同时获取汇总数据和耗电量数据，然后合并
                const days = historyDays ? historyDays.value : '7';
                try {
                    // 获取耗电量数据
                    const consumptionResponse = await fetch(`/api/stats/daily-consumption?days=${days}`);
                    const consumptionData = await consumptionResponse.json();
                    
                    // 原始汇总数据已经在data变量中
                    const summaryData = Array.isArray(data) ? data : [];
                    
                    // 合并数据：以汇总数据为基础，添加耗电量信息
                    if (consumptionData.chart_data && summaryData.length > 0) {
                        // 创建耗电量数据的映射（按日期）
                        const consumptionMap = {};
                        consumptionData.chart_data.forEach(item => {
                            consumptionMap[item.date] = item.consumption;
                        });
                        
                        // 合并数据
                        allRecords = summaryData.map(record => ({
                            ...record,
                            consumption: consumptionMap[record.date] || 0 // 添加耗电量
                        }));
                    } else if (consumptionData.chart_data) {
                        // 如果没有汇总数据，只使用耗电量数据
                        allRecords = consumptionData.chart_data.map(item => ({
                            date: item.date,
                            consumption: item.consumption,
                            min_amount: '--',
                            max_amount: '--',
                            query_count: '--'
                        }));
                    } else {
                        // 如果都没有，使用原始汇总数据
                        allRecords = summaryData;
                    }
                } catch (error) {
                    Logger.error('获取耗电量数据失败:', error);
                    // 发生错误时，使用原始汇总数据
                    allRecords = Array.isArray(data) ? data : [];
                }
                currentRecords = allRecords;
                Logger.log('汇总模式数据:', currentRecords.length, '条记录');
            }
            
            updateChart();
            updateHistoryTable();
        }
    } catch (error) {
        Logger.error('加载历史记录失败：', error);
    }
}

// 初始化图表
function initializeChart() {
    const ctx = document.getElementById('electricityChart');
    if (!ctx) return;
    
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '剩余电量 (度)',
                data: [],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: '剩余电量 (度)'
                    },
                    ticks: {
                        stepSize: 0.01,
                        includeBounds: true,
                        callback: function(value) {
                            return value.toFixed(2);
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    // 禁用自动边界调整
                    bounds: 'data',
                    grace: 0
                },
                x: {
                    title: {
                        display: true,
                        text: '时间'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#667eea',
                    borderWidth: 1
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

function updateChart() {
    if (!chart) return;
    
    const historyType = document.getElementById('historyViewType');
    const isDetailed = historyType && historyType.value === 'detailed';
    
    if (!isDetailed) {
        // 汇总模式：显示按天汇总的耗电量柱状图
        Logger.log('切换到汇总模式');
        const historyDays = document.getElementById('historyDays');
        const days = historyDays ? historyDays.value : '7';
        
        fetch(`/api/stats/daily-consumption?days=${days}`)
            .then(response => response.json())
            .then(data => {
                Logger.chart.info('汇总模式数据:', data);
                
                // 完全重新配置图表为柱状图
                chart.destroy(); // 先销毁现有图表
                const ctx = document.getElementById('electricityChart');
                
                // 重新创建柱状图
                chart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: [],
                        datasets: [{
                            label: '日耗电量 (度)',
                            data: [],
                            backgroundColor: 'rgba(102, 126, 234, 0.6)',
                            borderColor: '#667eea',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                title: {
                                    display: true,
                                    text: '耗电量 (度)'
                                },
                                beginAtZero: true,
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                },
                                ticks: {
                                    callback: function(value) {
                                        return value.toFixed(3);
                                    }
                                }
                            },
                            x: {
                                type: 'category',
                                title: {
                                    display: true,
                                    text: '日期'
                                },
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                }
                            }
                        },
                        plugins: {
                            legend: {
                                display: true,
                                position: 'top'
                            },
                            tooltip: {
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                titleColor: '#fff',
                                bodyColor: '#fff',
                                borderColor: '#667eea',
                                borderWidth: 1,
                                callbacks: {
                                    label: function(context) {
                                        const consumption = context.parsed.y;
                                        const cost = (consumption * 0.55).toFixed(2);
                                        let level = '';
                                        if (consumption <= 5) {
                                            level = '低耗电 (0-5度)';
                                        } else if (consumption <= 10) {
                                            level = '中低耗电 (5-10度)';
                                        } else if (consumption <= 15) {
                                            level = '中高耗电 (10-15度)';
                                        } else {
                                            level = '高耗电 (15度以上)';
                                        }
                                        return [
                                            `耗电量: ${consumption.toFixed(2)} 度`,
                                            `电费: 约￥${cost}`,
                                            `等级: ${level}`
                                        ];
                                    }
                                }
                            }
                        },
                        interaction: {
                            intersect: false,
                            mode: 'index'
                        }
                    }
                });
                
                if (data.chart_data && data.chart_data.length > 0) {
                    const labels = data.chart_data.map(item => {
                        return BeijingTime.formatShortDate(item.date);
                    });
                    const consumptions = data.chart_data.map(item => item.consumption);
                    
                    // 根据耗电量生成分级颜色
                    const getConsumptionColor = (consumption) => {
                        if (consumption <= 5) {
                            return '#e8f4fd'; // 浅蓝色 0-5度
                        } else if (consumption <= 10) {
                            return '#a8d5f2'; // 中浅蓝 5-10度
                        } else if (consumption <= 15) {
                            return '#5ba3d0'; // 中蓝色 10-15度
                        } else {
                            return '#2e5984'; // 深蓝色 15度以上
                        }
                    };
                    
                    const getBorderColor = (consumption) => {
                        if (consumption <= 5) {
                            return '#b8dff7';
                        } else if (consumption <= 10) {
                            return '#7fc3e8';
                        } else if (consumption <= 15) {
                            return '#4a8bb8';
                        } else {
                            return '#1e3a5f';
                        }
                    };
                    
                    // 为每个数据点生成对应的颜色
                    const backgroundColors = consumptions.map(consumption => getConsumptionColor(consumption));
                    const borderColors = consumptions.map(consumption => getBorderColor(consumption));
                    
                    chart.data.labels = labels;
                    chart.data.datasets[0].data = consumptions;
                    chart.data.datasets[0].backgroundColor = backgroundColors;
                    chart.data.datasets[0].borderColor = borderColors;
                    
                    Logger.chart.debug('汇总图表数据设置完成:', { 
                        labels: labels.length, 
                        data: consumptions.length,
                        consumptions,
                        colorLevels: consumptions.map(c => {
                            if (c <= 5) return '0-5度';
                            else if (c <= 10) return '5-10度';
                            else if (c <= 15) return '10-15度';
                            else return '15度以上';
                        })
                    });
                } else {
                    Logger.chart.info('汇总模式无数据');
                }
                
                chart.update();
                Logger.chart.info('汇总图表更新完成');
            })
            .catch(error => {
                Logger.chart.error('获取汇总图表数据失败:', error);
                // 创建空的柱状图
                chart.destroy();
                const ctx = document.getElementById('electricityChart');
                chart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: [],
                        datasets: [{
                            label: '日耗电量 (度)',
                            data: [],
                            backgroundColor: 'rgba(102, 126, 234, 0.6)',
                            borderColor: '#667eea',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                title: {
                                    display: true,
                                    text: '耗电量 (度)'
                                },
                                beginAtZero: true,
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                }
                            },
                            x: {
                                type: 'category',
                                title: {
                                    display: true,
                                    text: '日期'
                                },
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                }
                            }
                        }
                    }
                });
            });
        return;
    }
    
    // 详细模式：显示剩余电量，按真实时间比例
    Logger.log('切换到详细模式');
    if (currentRecords.length === 0) {
        chart.data.labels = [];
        chart.data.datasets = [];
        chart.update();
        return;
    }
    
    // 准备数据点，区分手动和自动查询，但合并到一条线上
    const allData = [];
    
    currentRecords.forEach(record => {
        const timestamp = new Date(record.query_time || record.timestamp).getTime();
        const amount = parseFloat(record.remaining_amount || 0);
        const isAuto = record.is_auto === 1 || record.is_auto === '1';
        
        allData.push({ 
            x: timestamp, 
            y: amount,
            isAuto: isAuto
        });
    });
    
    // 按时间排序
    allData.sort((a, b) => a.x - b.x);
    
    // 销毁旧图表，重新创建线图
    chart.destroy();
    const ctx = document.getElementById('electricityChart');
    
    // 计算Y轴范围 - 使用和拖动更新时相同的逻辑
    const yValues = allData.map(d => d.y);
    let yAxisConfig = {
        title: {
            display: true,
            text: '剩余电量 (度)'
        },
        grid: {
            color: 'rgba(0, 0, 0, 0.1)'
        }
    };
    
    if (yValues.length > 0) {
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);
        const yRange = maxY - minY;
        
        // 根据数据范围动态调整步长，但最小0.05
        let yStepSize = 0.05; // 最小步长
        if (yRange > 10) {
            yStepSize = 1;
        } else if (yRange > 5) {
            yStepSize = 0.5;
        } else if (yRange > 2) {
            yStepSize = 0.2;
        } else if (yRange > 1) {
            yStepSize = 0.1;
        } else {
            yStepSize = 0.05; // 最小步长
        }
        
        // 计算对齐到0或5结尾的边界
        function alignToValidEnd(value, isMin) {
            // 将值转换为以0.05为单位的整数
            const scaled = Math.round(value * 20); // 乘以20是因为1/0.05=20
            
            // 查找满足条件的0或5结尾的值：与原值相差大于0.05且是最近的
            let aligned;
            if (isMin) {
                // 向下寻找0或5结尾，且与原值相差大于0.05
                for (let i = scaled - 1; i >= 0; i--) { // 从scaled-1开始，确保有差距
                    const testValue = i / 20;
                    const lastDigit = Math.abs(Math.round(testValue * 100)) % 10;
                    if (lastDigit === 0 || lastDigit === 5) {
                        // 检查与原值的差距是否大于0.05
                        if (Math.abs(value - testValue) > 0.05) {
                            aligned = testValue;
                            break;
                        }
                    }
                }
            } else {
                // 向上寻找0或5结尾，且与原值相差大于0.05
                for (let i = scaled + 1; i <= 4000; i++) { // 从scaled+1开始，确保有差距
                    const testValue = i / 20;
                    const lastDigit = Math.abs(Math.round(testValue * 100)) % 10;
                    if (lastDigit === 0 || lastDigit === 5) {
                        // 检查与原值的差距是否大于0.05
                        if (Math.abs(testValue - value) > 0.05) {
                            aligned = testValue;
                            break;
                        }
                    }
                }
            }
            
            return aligned || value;
        }
        
        // 直接基于数据范围对齐边界，不添加额外边距
        yAxisConfig.min = Math.max(0, alignToValidEnd(minY, true));
        yAxisConfig.max = alignToValidEnd(maxY, false);
        
        // 确保最小显示范围（0.1度）
        if (yAxisConfig.max - yAxisConfig.min < 0.1) {
            const center = (yAxisConfig.min + yAxisConfig.max) / 2;
            yAxisConfig.min = Math.max(0, alignToValidEnd(center - 0.05, true));
            yAxisConfig.max = alignToValidEnd(center + 0.05, false);
        }
        
        // 使用和拖动更新时相同的刻度配置
        yAxisConfig.ticks = {
            stepSize: yStepSize,
            callback: function(value) {
                // 只显示0或5结尾的刻度
                const rounded = Math.round(value * 100) / 100;
                const lastDigit = Math.abs(Math.round(rounded * 100)) % 10;
                
                if (lastDigit === 0 || lastDigit === 5) {
                    if (yStepSize >= 1) {
                        return rounded.toFixed(0);
                    } else if (yStepSize >= 0.1) {
                        return rounded.toFixed(1);
                    } else {
                        return rounded.toFixed(2);
                    }
                }
                return null; // 不显示不符合条件的刻度
            }
        };
        
        Logger.chart.debug('详细模式Y轴范围:', {
            minY: minY.toFixed(3),
            maxY: maxY.toFixed(3),
            yRange: yRange.toFixed(3),
            yStepSize: yStepSize,
            axisMin: yAxisConfig.min.toFixed(3),
            axisMax: yAxisConfig.max.toFixed(3)
        });
    }
    
    // 计算时间轴范围
    const timestamps = allData.map(d => d.x);
    let timeAxisConfig = {
        type: 'time',
        time: {
            unit: 'minute',
            stepSize: 1,
            displayFormats: {
                hour: 'HH:mm',
                minute: 'HH:mm'
            },
            tooltipFormat: 'yyyy-MM-dd HH:mm:ss'
        },
        title: {
            display: true,
            text: '时间'
        },
        ticks: {
            maxTicksLimit: 20,
            autoSkip: true
        }
    };
    
    if (timestamps.length > 0) {
        const minTime = Math.min(...timestamps);
        const maxTime = Math.max(...timestamps);
        const timeRange = maxTime - minTime;
        // 增加padding以确保数据点完全显示，特别是最右端的点
        const padding = Math.max(timeRange * 0.08, 1 * 60 * 1000); // 增加到8%，至少1分钟
        
        timeAxisConfig.min = minTime - padding;
        timeAxisConfig.max = maxTime + padding;
    }
    
    // 创建新的线图
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: '剩余电量',
                data: allData,
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.1)',
                borderWidth: 2,
                fill: false,
                tension: 0.1,
                pointRadius: 3, // 统一数据点大小
                pointBackgroundColor: function(context) {
                    // 使用当前数据集中的数据点
                    if (!context.dataset.data || context.dataIndex >= context.dataset.data.length) {
                        return 'rgb(54, 162, 235)'; // 默认颜色
                    }
                    const dataPoint = context.dataset.data[context.dataIndex];
                    return dataPoint && dataPoint.isAuto ? 'rgb(54, 162, 235)' : 'rgb(255, 99, 132)';
                },
                pointBorderColor: function(context) {
                    // 使用当前数据集中的数据点
                    if (!context.dataset.data || context.dataIndex >= context.dataset.data.length) {
                        return 'rgb(54, 162, 235)'; // 默认颜色
                    }
                    const dataPoint = context.dataset.data[context.dataIndex];
                    return dataPoint && dataPoint.isAuto ? 'rgb(54, 162, 235)' : 'rgb(255, 99, 132)';
                },
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: timeAxisConfig,
                y: yAxisConfig
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#667eea',
                    borderWidth: 1,
                    callbacks: {
                        title: function(context) {
                            const dataPoint = allData[context[0].dataIndex];
                            if (dataPoint) {
                                const date = new Date(dataPoint.x);
                                return BeijingTime.formatDateTime(date);
                            }
                            return '';
                        },
                        label: function(context) {
                            const dataPoint = allData[context.dataIndex];
                            const queryType = dataPoint && dataPoint.isAuto ? '自动查询' : '手动查询';
                            const amount = context.parsed.y.toFixed(2);
                            return `剩余电量: ${amount} 度 (${queryType})`;
                        },
                        afterBody: function(context) {
                            const dataPoint = allData[context[0].dataIndex];
                            if (dataPoint) {
                                const currentIndex = context[0].dataIndex;
                                if (currentIndex > 0) {
                                    const prevDataPoint = allData[currentIndex - 1];
                                    const change = dataPoint.y - prevDataPoint.y;
                                    const changeText = change > 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
                                    const changeType = change > 0 ? '增加' : '消耗';
                                    return [`变化: ${changeText} 度 (${changeType})`];
                                }
                            }
                            return [];
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
    
    Logger.chart.info('详细模式图表创建完成');
    
    // 延迟初始化时间轴控制条
    setTimeout(() => {
        initializeTimeRangeSlider();
    }, 100);
}

function updateHistoryTable() {
    const tbody = document.querySelector('#historyTable tbody');
    const thead = document.querySelector('#historyTable thead');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (currentRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999;">暂无记录</td></tr>';
        return;
    }
    
    const historyType = document.getElementById('historyViewType');
    const isDetailed = historyType && historyType.value === 'detailed';
    
    if (!isDetailed && currentRecords[0] && currentRecords[0].date) {
        // 汇总数据显示 - 设置汇总表头
        if (thead) {
            thead.innerHTML = `
                <tr>
                    <th>日期</th>
                    <th>耗电量</th>
                    <th>最低电量</th>
                    <th>最高电量</th>
                    <th>查询次数</th>
                </tr>
            `;
        }
        
        currentRecords.forEach(record => {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = BeijingTime.formatDate(record.date);
            
            // 耗电量列：显示耗电量和费用
            const consumptionCell = row.insertCell(1);
            if (record.consumption && record.consumption > 0) {
                const consumption = record.consumption.toFixed(2);
                const cost = (record.consumption * 0.55).toFixed(2);
                consumptionCell.textContent = `${consumption} 度(￥${cost})`;
            } else {
                consumptionCell.textContent = '-- 度';
            }
            
            row.insertCell(2).textContent = `${record.min_amount ? record.min_amount.toFixed(2) : '--'} 度`;
            row.insertCell(3).textContent = `${record.max_amount ? record.max_amount.toFixed(2) : '--'} 度`;
            row.insertCell(4).textContent = record.query_count || '--';
        });
    } else {
        // 详细数据显示 - 设置详细表头
        if (thead) {
            thead.innerHTML = `
                <tr>
                    <th><input type="checkbox" id="selectAll"></th>
                    <th>查询时间</th>
                    <th>剩余电量</th>
                    <th>查询类型</th>
                    <th>变化量</th>
                </tr>
            `;
        }
        
        currentRecords.forEach((record, index) => {
            const row = tbody.insertRow();
            
            // 添加checkbox
            const checkboxCell = row.insertCell(0);
            checkboxCell.innerHTML = `<input type="checkbox" class="record-checkbox" data-id="${record.id}">`;
            
            const queryTime = new Date(record.query_time || record.timestamp);
            row.insertCell(1).textContent = BeijingTime.formatDateTime(queryTime);
            
            // 剩余电量列，如果是异常数据则标红
            const amountCell = row.insertCell(2);
            amountCell.textContent = `${record.remaining_amount} 度`;
            
            // 检查是否为异常数据
            if (record.is_abnormal) {
                amountCell.style.color = '#dc3545';
                amountCell.style.fontWeight = 'bold';
                amountCell.title = `该数据可能异常: ${record.abnormal_reason}`;
                amountCell.style.cursor = 'help';
            }
            
            // 显示查询类型
            const queryTypeCell = row.insertCell(3);
            const queryType = (record.is_auto === 1 || record.is_auto === '1') ? '自动' : '手动';
            queryTypeCell.textContent = queryType;
            queryTypeCell.style.color = queryType === '自动' ? '#007bff' : '#dc3545';
            queryTypeCell.style.fontWeight = 'bold';
            
            // 计算变化
            let change = '';
            if (index < currentRecords.length - 1) {
                const nextAmount = parseFloat(currentRecords[index + 1].remaining_amount);
                const currentAmount = parseFloat(record.remaining_amount);
                const diff = currentAmount - nextAmount;
                if (diff > 0) {
                    change = `+${diff.toFixed(2)}`;
                } else if (diff < 0) {
                    change = diff.toFixed(2);
                } else {
                    change = '0.00';
                }
            } else {
                change = '-';
            }
            row.insertCell(4).textContent = change;
        });
    }
    
    // 绑定checkbox事件
    bindCheckboxEvents();
}

// 绑定checkbox事件
function bindCheckboxEvents() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.record-checkbox');
    const clearSelectedBtn = document.getElementById('clearSelectedBtn');
    
    if (selectAll) {
        selectAll.addEventListener('change', function() {
            checkboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
            updateClearSelectedButton();
        });
    }
    
    // 支持shift+click多选
    let lastChecked = null;
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('click', function(e) {
            if (e.shiftKey && lastChecked) {
                const start = Array.from(checkboxes).indexOf(lastChecked);
                const end = Array.from(checkboxes).indexOf(this);
                const [min, max] = [Math.min(start, end), Math.max(start, end)];
                
                for (let i = min; i <= max; i++) {
                    checkboxes[i].checked = this.checked;
                }
            }
            lastChecked = this;
            
            // 更新全选状态
            if (selectAll) {
                const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                const someChecked = Array.from(checkboxes).some(cb => cb.checked);
                selectAll.checked = allChecked;
                selectAll.indeterminate = someChecked && !allChecked;
            }
            
            updateClearSelectedButton();
        });
    });
    
    updateClearSelectedButton();
}

// 更新删除选中按钮的显示状态
function updateClearSelectedButton() {
    const clearSelectedBtn = document.getElementById('clearSelectedBtn');
    const historyType = document.getElementById('historyViewType');
    const isDetailed = historyType && historyType.value === 'detailed';
    const selectedCount = document.querySelectorAll('.record-checkbox:checked').length;
    
    if (clearSelectedBtn) {
        if (isDetailed && selectedCount > 0) {
            clearSelectedBtn.style.display = 'inline-block';
            clearSelectedBtn.textContent = `删除选中 (${selectedCount})`;
        } else {
            clearSelectedBtn.style.display = 'none';
        }
    }
}

// 获取选中的记录ID
function getSelectedRecordIds() {
    const checkboxes = document.querySelectorAll('.record-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.dataset.id);
}

// 加载统计信息
async function loadStats(updateTodayConsumption = true) {
    try {
        const historyType = document.getElementById('historyViewType');
        const isDetailed = historyType && historyType.value === 'detailed';
        
        const todayQueries = document.getElementById('todayQueries');
        const avgBalance = document.getElementById('avgBalance');
        const minBalance = document.getElementById('minBalance');
        const maxBalance = document.getElementById('maxBalance');
        
        // 更新标签文字
        const avgLabel = avgBalance ? avgBalance.closest('.stat-card').querySelector('h3') : null;
        const minLabel = minBalance ? minBalance.closest('.stat-card').querySelector('h3') : null;
        const maxLabel = maxBalance ? maxBalance.closest('.stat-card').querySelector('h3') : null;
        
        // 在详细模式下获取选定日期，在汇总模式下使用今日
        let targetDate = '';
        if (isDetailed) {
            const selectedDate = document.getElementById('selectedDate');
            if (selectedDate && selectedDate.value) {
                targetDate = selectedDate.value;
            } else {
                // 如果没有选定日期，使用北京时间的今日日期
                const beijingTime = new Date(Date.now() + 8 * 60 * 60 * 1000);
                targetDate = beijingTime.toISOString().split('T')[0];
            }
        }
        
        // 获取指定日期的查询次数（详细模式）或今日查询次数（汇总模式）
        const statsUrl = isDetailed && targetDate ? `/api/stats/today?date=${targetDate}` : '/api/stats/today';
        const statsResponse = await fetch(statsUrl);
        const stats = await statsResponse.json();
        
        if (!isDetailed) {
            // 汇总模式：显示今日耗电量、日均耗电量、日最高/最低耗电量
            const historyDays = document.getElementById('historyDays');
            const days = historyDays ? historyDays.value : '7';
            
            const consumptionResponse = await fetch(`/api/stats/daily-consumption?days=${days}`);
            const consumptionStats = await consumptionResponse.json();
            
            // 在汇总模式下，始终确保第一个卡片显示今日耗电量
            let todayConsumption = null;
            if (updateTodayConsumption) {
                const todayConsumptionResponse = await fetch('/api/stats/consumption');
                todayConsumption = await todayConsumptionResponse.json();
            } else {
                // 即使不更新今日耗电量，也需要确保第一个卡片的标签和数据正确
                // 如果当前第一个卡片不是显示今日耗电量，则获取数据并设置
                const todayCard = todayQueries ? todayQueries.closest('.stat-card') : null;
                const todayLabel = todayCard ? todayCard.querySelector('h3') : null;
                
                if (todayLabel && todayLabel.textContent !== '今日耗电量') {
                    const todayConsumptionResponse = await fetch('/api/stats/consumption');
                    todayConsumption = await todayConsumptionResponse.json();
                }
            }
            
            if (avgLabel) avgLabel.textContent = '日均耗电量';
            if (minLabel) minLabel.textContent = '日最低耗电量';
            if (maxLabel) maxLabel.textContent = '日最高耗电量';
            
            if (avgBalance) {
                const avgConsumption = (consumptionStats.avg_daily_consumption || 0).toFixed(2);
                const avgCost = (avgConsumption * 0.55).toFixed(2);
                avgBalance.innerHTML = `${avgConsumption}<br><small>约￥${avgCost}</small>`;
            }
            if (minBalance) {
                const minText = (consumptionStats.min_daily_consumption || 0).toFixed(2);
                const minCost = (minText * 0.55).toFixed(2);
                const minDate = consumptionStats.min_consumption_date || '--';
                // 将日期格式从2025-07-27转换为25.7.27
                const formattedMinDate = minDate !== '--' ? 
                    minDate.replace(/^20(\d{2})-0?(\d{1,2})-0?(\d{1,2})$/, '$1.$2.$3') : '--';
                minBalance.innerHTML = `${minText}<br><small>￥${minCost} ${formattedMinDate}</small>`;
            }
            if (maxBalance) {
                const maxText = (consumptionStats.max_daily_consumption || 0).toFixed(2);
                const maxCost = (maxText * 0.55).toFixed(2);
                const maxDate = consumptionStats.max_consumption_date || '--';
                // 将日期格式从2025-07-27转换为25.7.27
                const formattedMaxDate = maxDate !== '--' ? 
                    maxDate.replace(/^20(\d{2})-0?(\d{1,2})-0?(\d{1,2})$/, '$1.$2.$3') : '--';
                maxBalance.innerHTML = `${maxText}<br><small>￥${maxCost} ${formattedMaxDate}</small>`;
            }
            
            // 在汇总模式下，第一个卡片始终显示今日耗电量
            if (todayConsumption && todayQueries) {
                const todayCard = todayQueries.closest('.stat-card');
                if (todayCard) {
                    const todayLabel = todayCard.querySelector('h3');
                    if (todayLabel) todayLabel.textContent = '今日耗电量';
                    const todayConsumptionValue = (todayConsumption.today_consumption || 0).toFixed(2);
                    const todayCost = (todayConsumptionValue * 0.55).toFixed(2);
                    todayQueries.innerHTML = `${todayConsumptionValue}<br><small>约￥${todayCost}</small>`;
                }
            }
        } else {
            // 详细模式：显示选定日期的耗电量、每小时最高/最低耗电量
            const consumptionUrl = targetDate ? `/api/stats/consumption?date=${targetDate}` : '/api/stats/consumption';
            const consumptionResponse = await fetch(consumptionUrl);
            const consumptionStats = await consumptionResponse.json();
            
            // 获取选定日期的格式化显示
            const dateLabel = targetDate ? BeijingTime.formatShortDate(targetDate + 'T00:00:00') : '今日';
            
            if (avgLabel) avgLabel.textContent = '当日耗电量';
            if (minLabel) minLabel.textContent = '每小时最低耗电量';
            if (maxLabel) maxLabel.textContent = '每小时最高耗电量';
            
            if (avgBalance) {
                const todayConsumptionValue = (consumptionStats.today_consumption || 0).toFixed(2);
                const todayCost = (todayConsumptionValue * 0.55).toFixed(2);
                avgBalance.innerHTML = `${todayConsumptionValue}<br><small>约￥${todayCost}</small>`;
            }
            if (minBalance) {
                const minText = (consumptionStats.min_daily_change || 0).toFixed(2);
                const minPeriod = consumptionStats.min_change_period || '--';
                minBalance.innerHTML = `${minText}<br><small>${minPeriod}</small>`;
            }
            if (maxBalance) {
                const maxText = (consumptionStats.max_daily_change || 0).toFixed(2);
                const maxPeriod = consumptionStats.max_change_period || '--';
                maxBalance.innerHTML = `${maxText}<br><small>${maxPeriod}</small>`;
            }
            
            // 在详细模式下，第一个卡片显示选定日期的查询次数
            if (todayQueries) {
                const todayCard = todayQueries.closest('.stat-card');
                if (todayCard) {
                    const todayLabel = todayCard.querySelector('h3');
                    const dateLabel = targetDate ? BeijingTime.formatShortDate(targetDate + 'T00:00:00') : '今日';
                    if (todayLabel) todayLabel.textContent = '当日查询次数';
                    todayQueries.textContent = stats.today_queries || '0';
                }
            }
        }
        
        // 获取最近的一条记录作为当前余额
        const recentResponse = await fetch('/api/records?days=1');
        const recentData = await recentResponse.json();
        
        if (recentData && recentData.length > 0) {
            const latestData = recentData[0];
            const balanceAmount = document.getElementById('balanceAmount');
            const lastQueryTime = document.getElementById('lastQueryTime');
            const queryStatus = document.getElementById('queryStatus');
            
            if (balanceAmount) balanceAmount.textContent = latestData.remaining_amount.toFixed(2);
            
            // 显示最后一次查询时间（区分手动和自动）
            if (lastQueryTime) {
                const queryType = (latestData.is_auto === 1 || latestData.is_auto === '1') ? '系统自动查询' : '手动查询';
                const timeStr = BeijingTime.formatDateTime(latestData.query_time);
                lastQueryTime.textContent = `${timeStr} (${queryType})`;
            }
            
            if (queryStatus) {
                queryStatus.textContent = '数据已更新';
                queryStatus.style.color = '#28a745';
            }
        }
        
        // 页面底部显示最后一次系统自动查询时间
        const lastUpdate = document.getElementById('lastUpdate');
        const lastAutoQueryResponse = await fetch('/api/last-auto-query');
        const lastAutoQuery = await lastAutoQueryResponse.json();
        if (lastUpdate && lastAutoQuery.last_auto_query) {
            lastUpdate.textContent = lastAutoQuery.last_auto_query;
        }
        
    } catch (error) {
        Logger.error('加载统计信息失败:', error);
    }
}

// 日期导航函数
function navigateDate(days) {
    const selectedDate = document.getElementById('selectedDate');
    if (!selectedDate) return;
    
    const currentDate = new Date(selectedDate.value);
    if (isNaN(currentDate.getTime())) {
        Logger.error('无效的日期值:', selectedDate.value);
        return;
    }
    
    // 添加指定天数
    currentDate.setDate(currentDate.getDate() + days);
    
    // 更新日期选择器的值
    const newDateStr = currentDate.toISOString().split('T')[0];
    selectedDate.value = newDateStr;
    
    Logger.info('日期导航:', days > 0 ? '下一天' : '上一天', '新日期:', newDateStr);
    
    // 触发历史记录更新
    onHistoryControlChange();
}

// 切换到当天的记录
async function switchToToday() {
    const historyType = document.getElementById('historyViewType');
    const selectedDate = document.getElementById('selectedDate');
    
    // 如果当前在汇总模式，切换到详细模式
    if (historyType && historyType.value === 'summary') {
        historyType.value = 'detailed';
        Logger.info('查询余额后切换到详细模式');
    }
    
    // 设置日期为今天（北京时间）
    if (selectedDate) {
        const beijingTime = new Date(Date.now() + 8 * 60 * 60 * 1000);
        const today = beijingTime.toISOString().split('T')[0];
        selectedDate.value = today;
        Logger.info('查询余额后切换到今天:', today);
    }
    
    // 触发界面更新，但不需要重新加载数据（因为外层函数会调用loadHistory）
    const summaryTimeRange = document.getElementById('summaryTimeRange');
    const detailedDatePicker = document.getElementById('detailedDatePicker');
    const clearSelectedBtn = document.getElementById('clearSelectedBtn');
    const clearOldDataBtn = document.getElementById('clearOldDataBtn');
    const timeRangeSlider = document.getElementById('timeRangeSlider');
    const chartButtons = document.querySelectorAll('.chart-btn[data-period]');
    
    // 调整界面显示（详细模式）
    if (summaryTimeRange) summaryTimeRange.style.display = 'none';
    if (detailedDatePicker) detailedDatePicker.style.display = 'flex';
    if (timeRangeSlider) timeRangeSlider.style.display = 'block';
    if (clearOldDataBtn) clearOldDataBtn.style.display = 'none';
    
    // 隐藏所有图表按钮
    chartButtons.forEach(btn => {
        btn.style.display = 'none';
    });
    
    Logger.timeline.info('界面已切换到详细模式，准备在数据加载后初始化时间轴控制条');
}

// 历史记录类型和天数变化处理
async function onHistoryControlChange() {
    const historyType = document.getElementById('historyViewType');
    const chartButtons = document.querySelectorAll('.chart-btn[data-period]');
    const summaryTimeRange = document.getElementById('summaryTimeRange');
    const detailedDatePicker = document.getElementById('detailedDatePicker');
    const clearSelectedBtn = document.getElementById('clearSelectedBtn');
    const clearOldDataBtn = document.getElementById('clearOldDataBtn');
    const timeRangeSlider = document.getElementById('timeRangeSlider');
    
    // 根据视图类型调整界面
    if (historyType && historyType.value === 'summary') {
        // 汇总模式：显示时间范围选择，隐藏日期选择器、时间轴控制条和删除选中按钮，显示清理旧数据按钮
        if (summaryTimeRange) summaryTimeRange.style.display = 'block';
        if (detailedDatePicker) detailedDatePicker.style.display = 'none';
        if (timeRangeSlider) timeRangeSlider.style.display = 'none';
        if (clearSelectedBtn) clearSelectedBtn.style.display = 'none';
        if (clearOldDataBtn) clearOldDataBtn.style.display = 'none';
        
        // 显示图表按钮
        chartButtons.forEach(btn => {
            btn.style.display = 'inline-block';
        });
        
        // 根据历史记录的天数选择同步按钮状态
        const historyDays = document.getElementById('historyDays');
        const selectedDays = historyDays ? historyDays.value : '7';
        
        // 先清除所有按钮的active状态
        chartButtons.forEach(b => b.classList.remove('active'));
        
        // 根据选择的天数设置对应按钮为active
        let targetButton = null;
        if (selectedDays === '-1') {
            targetButton = document.querySelector('.chart-btn[data-period="all"]');
        } else if (selectedDays === '7') {
            targetButton = document.querySelector('.chart-btn[data-period="week"]');
        } else if (selectedDays === '30') {
            targetButton = document.querySelector('.chart-btn[data-period="month"]');
        }
        
        if (targetButton) {
            targetButton.classList.add('active');
        } else if (selectedDays !== '-1') {
            // 如果没有匹配的按钮且不是"全部"选项，默认选择"最近7天"
            const weekBtn = document.querySelector('.chart-btn[data-period="week"]');
            if (weekBtn) {
                weekBtn.classList.add('active');
            }
        }
    } else {
        // 详细模式：显示日期选择器和时间轴控制条，隐藏时间范围选择、图表按钮和清理旧数据按钮
        if (summaryTimeRange) summaryTimeRange.style.display = 'none';
        if (detailedDatePicker) detailedDatePicker.style.display = 'block';
        if (timeRangeSlider) timeRangeSlider.style.display = 'block';
        if (clearOldDataBtn) clearOldDataBtn.style.display = 'none';
        
        // 设置默认日期为今天（北京时间）
        const selectedDate = document.getElementById('selectedDate');
        if (selectedDate && !selectedDate.value) {
            const beijingTime = new Date(Date.now() + 8 * 60 * 60 * 1000);
            const today = beijingTime.toISOString().split('T')[0];
            selectedDate.value = today;
            Logger.debug('设置默认日期为:', today);
        }
        
        // 隐藏所有图表按钮
        chartButtons.forEach(btn => {
            btn.style.display = 'none';
        });
        
        // 延迟初始化时间轴控制条，确保数据已加载
        setTimeout(() => {
            initializeTimeRangeSlider();
        }, 200);
    }
    
    // 无论何种模式切换，都要确保管理员按钮的显示状态符合权限设置
    updateAdminButtonsVisibility();
    
    await loadHistory();
    await loadStats(); // 重新加载统计信息以更新标签（模式切换时需要更新今日耗电量）
}

// 同步历史记录时间范围选择与图表按钮
function syncHistoryDaysWithChartPeriod(period) {
    const historyDays = document.getElementById('historyDays');
    if (!historyDays) return;
    
    let daysValue = '7'; // 默认值
    switch (period) {
        case 'all':
            daysValue = '-1';
            break;
        case 'week':
            daysValue = '7';
            break;
        case 'month':
            daysValue = '30';
            break;
    }
    
    // 只有当前值不同时才触发改变
    if (historyDays.value !== daysValue) {
        historyDays.value = daysValue;
        // 触发历史记录刷新
        onHistoryControlChange();
    }
}

// 按时间周期显示图表
async function showChartByPeriod(period) {
    try {
        const historyType = document.getElementById('historyViewType');
        const isDetailed = historyType && historyType.value === 'detailed';
        let apiUrl = '';
        
        // 同步更新历史记录的时间范围下拉框
        const historyDays = document.getElementById('historyDays');
        if (historyDays && !isDetailed) {
            if (period === 'all') {
                historyDays.value = '-1';
            } else if (period === 'week') {
                historyDays.value = '7';
            } else if (period === 'month') {
                historyDays.value = '30';
            }
        }
        
        switch (period) {
            case 'all':
                if (isDetailed) {
                    apiUrl = '/api/history?type=detailed&days=-1';
                } else {
                    apiUrl = '/api/stats/daily-consumption?days=-1';
                }
                break;
            case 'week':
                if (isDetailed) {
                    apiUrl = '/api/history?type=detailed&days=7';
                } else {
                    apiUrl = '/api/stats/daily-consumption?days=7';
                }
                break;
            case 'month':
                if (isDetailed) {
                    apiUrl = '/api/history?type=detailed&days=30';
                } else {
                    apiUrl = '/api/stats/daily-consumption?days=30';
                }
                break;
        }
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (response.ok) {
            if (isDetailed) {
                currentRecords = Array.isArray(data) ? data : [];
                updateChart();
            } else {
                // 汇总模式：重新加载历史记录和统计信息以确保表格数据同步
                // 但不更新今日耗电量，因为它不会因时间范围改变而变化
                await loadHistory();
                await loadStats(false);
            }
        }
    } catch (error) {
        Logger.chart.error('加载图表数据失败:', error);
    }
}

// 测试连接功能
async function testConnection() {
    let popup = null;
    
    try {
        const testConnectionBtn = document.getElementById('testConnectionBtn');
        
        if (testConnectionBtn) {
            testConnectionBtn.disabled = true;
            testConnectionBtn.textContent = '测试中...';
        }
        
        // 创建弹窗显示详细测试结果
        popup = createTestResultPopup();
        popup.addStep('正在测试API连接...', 'pending');
        
        // 测试基本API连接
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (response.ok) {
            popup.updateStep(0, `API连接成功 - 数据库有 ${data.total_queries || 0} 条记录`, 'success');
            popup.addStep('正在测试电费查询系统...', 'pending');
            
            // 测试电费查询系统
            const testQueryResponse = await fetch('/api/test-query');
            const testQueryData = await testQueryResponse.json();
            
            if (testQueryResponse.ok) {
                popup.updateStep(1, '电费查询系统正常', 'success');
                popup.addStep('✓ 所有测试通过！系统运行正常', 'success');
            } else {
                popup.updateStep(1, `电费查询系统异常: ${testQueryData.error}`, 'warning');
            }
        } else {
            popup.updateStep(0, 'API连接失败', 'error');
            throw new Error('API响应异常');
        }
    } catch (error) {
        if (popup) {
            popup.addStep(`❌ 测试失败: ${error.message}`, 'error');
        }
    } finally {
        const testConnectionBtn = document.getElementById('testConnectionBtn');
        if (testConnectionBtn) {
            testConnectionBtn.disabled = false;
            testConnectionBtn.textContent = '测试连接';
        }
    }
}

// 创建测试结果弹窗
function createTestResultPopup() {
    // 创建弹窗元素
    const overlay = document.createElement('div');
    overlay.className = 'test-popup-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
        background: rgba(0,0,0,0.5); z-index: 10000; 
        display: flex; align-items: center; justify-content: center;
    `;
    
    const popup = document.createElement('div');
    popup.className = 'test-popup';
    popup.style.cssText = `
        background: white; border-radius: 8px; padding: 20px; 
        max-width: 500px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    
    const title = document.createElement('h3');
    title.textContent = '连接测试结果';
    title.style.cssText = 'margin: 0 0 15px 0; color: #333;';
    
    const stepsList = document.createElement('div');
    stepsList.className = 'test-steps';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '关闭';
    closeBtn.style.cssText = `
        margin-top: 15px; padding: 8px 16px; background: #007bff; 
        color: white; border: none; border-radius: 4px; cursor: pointer;
    `;
    closeBtn.onclick = () => overlay.remove();
    
    popup.appendChild(title);
    popup.appendChild(stepsList);
    popup.appendChild(closeBtn);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    return {
        addStep: (text, status) => {
            const step = document.createElement('div');
            step.style.cssText = 'margin: 8px 0; padding: 8px; border-radius: 4px;';
            step.textContent = text;
            
            const colors = {
                pending: '#ffa500',
                success: '#28a745',
                warning: '#ffc107',
                error: '#dc3545'
            };
            step.style.color = colors[status] || '#333';
            step.style.backgroundColor = colors[status] ? colors[status] + '20' : '#f8f9fa';
            
            stepsList.appendChild(step);
            return stepsList.children.length - 1;
        },
        updateStep: (index, text, status) => {
            const step = stepsList.children[index];
            if (step) {
                step.textContent = text;
                const colors = {
                    success: '#28a745',
                    warning: '#ffc107',
                    error: '#dc3545'
                };
                step.style.color = colors[status] || '#333';
                step.style.backgroundColor = colors[status] ? colors[status] + '20' : '#f8f9fa';
            }
        }
    };
}

// 选择记录删除模态框（用于详细记录模式）
function showSelectRecordsModal() {
    // 这里可以实现选择具体记录进行删除的功能
    // 暂时使用简化版本，直接显示日期范围选择
    const dateRangeDiv = document.getElementById('dateRangeDiv');
    const clearDataMessage = document.getElementById('clearDataMessage');
    if (dateRangeDiv) dateRangeDiv.style.display = 'flex';
    if (clearDataMessage) clearDataMessage.textContent = '请选择要删除的日期范围（详细记录模式）：';
    showClearModal();
}

// 清空记录功能
function showClearModal() {
    const modal = document.getElementById('clearDataModal');
    if (modal) {
        modal.style.display = 'flex'; // 使用flex以启用居中样式
        modal.classList.remove('hide');
        // 触发重排以确保display:flex生效
        modal.offsetHeight;
        modal.classList.add('show');
    }
}

function hideClearModal() {
    const modal = document.getElementById('clearDataModal');
    if (modal) {
        modal.classList.remove('show');
        modal.classList.add('hide');
        
        // 等待动画完成后隐藏模态框
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('hide');
        }, 300);
        
        // 重置表单
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');
        if (startDate) startDate.value = '';
        if (endDate) endDate.value = '';
    }
}

async function confirmClearRecords() {
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
    if (!startDate || !endDate || !startDate.value || !endDate.value) {
        alert('请选择开始和结束日期');
        return;
    }
    
    if (startDate.value > endDate.value) {
        alert('开始日期不能晚于结束日期');
        return;
    }
    
    try {
        const response = await fetch('/api/records', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                startDate: startDate.value,
                endDate: endDate.value
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert(`成功清空 ${data.deletedCount} 条记录`);
            hideClearModal();
            await loadHistory();
            await loadStats();
        } else {
            alert(`清空失败：${data.error}`);
        }
    } catch (error) {
        alert(`清空失败：${error.message}`);
    }
}

async function clearAllRecords() {
    try {
        hideClearModal(); // 先关闭模态框
        
        const response = await fetch('/api/records/all', {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert(`成功清空 ${data.deletedCount} 条记录`);
            await loadHistory();
            await loadStats();
        } else {
            alert(`清空失败：${data.error}`);
        }
    } catch (error) {
        alert(`清空失败：${error.message}`);
    }
}
// 删除选中的记录
async function clearSelectedRecords(selectedIds) {
    try {
        hideClearModal(); // 先关闭模态框
        
        const response = await fetch('/api/records/selected', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids: selectedIds })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert(`成功删除 ${data.deletedCount} 条记录`);
            await loadHistory();
            await loadStats();
        } else {
            alert(`删除失败：${data.error}`);
        }
    } catch (error) {
        alert(`删除失败：${error.message}`);
    }
}

// 删除选中的记录（用于模态框确认）
async function clearSelectedData() {
    const selectedIds = getSelectedRecordIds();
    if (selectedIds.length === 0) {
        alert('请先选择要删除的记录');
        return;
    }
    await clearSelectedRecords(selectedIds);
}

// 刷新历史记录
async function refreshHistory() {
    const refreshBtn = document.getElementById('refreshHistoryBtn');
    const refreshStatus = document.getElementById('refreshStatus');
    
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.textContent = '刷新中...';
    }
    
    try {
        await loadHistory();
        await loadStats();
        
        if (refreshStatus) {
            refreshStatus.style.display = 'inline';
            refreshStatus.textContent = '刷新完成';
            refreshStatus.style.color = '#28a745';
            
            setTimeout(() => {
                refreshStatus.style.display = 'none';
            }, 2000);
        }
    } catch (error) {
        if (refreshStatus) {
            refreshStatus.style.display = 'inline';
            refreshStatus.textContent = '刷新失败';
            refreshStatus.style.color = '#dc3545';
            
            setTimeout(() => {
                refreshStatus.style.display = 'none';
            }, 2000);
        }
    } finally {
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.textContent = '刷新';
        }
    }
}

// 时间轴控制条相关变量
let timeRangeData = {
    startTime: 0,    // 数据的开始时间戳
    endTime: 24 * 60 * 60 * 1000,  // 数据的结束时间戳（一天的毫秒数）
    viewStart: 0,    // 当前显示的开始时间戳
    viewEnd: 24 * 60 * 60 * 1000,   // 当前显示的结束时间戳
    isDragging: false,
    dragType: null,  // 'range', 'left', 'right'
    lastMouseX: 0,
    initialized: false,
    lastValidYAxisRange: null  // 保存最后一次有数据时的Y轴范围
};

// 初始化时间轴控制条
function initializeTimeRangeSlider() {
    Logger.timeline.debug('🔧 开始初始化时间轴控制条');
    
    // 重置保存的Y轴范围
    timeRangeData.lastValidYAxisRange = null;
    
    const slider = document.getElementById('timeRangeSlider');
    Logger.timeline.debug('🔍 查找时间轴控制条元素:', !!slider, slider);
    if (!slider) {
        Logger.timeline.error('❌ 找不到时间轴控制条元素');
        return;
    }
    
    const sliderRange = document.getElementById('sliderRange');
    const leftHandle = document.getElementById('leftHandle');
    const rightHandle = document.getElementById('rightHandle');
    const startLabel = document.getElementById('sliderLabelStart');
    const endLabel = document.getElementById('sliderLabelEnd');
    
    Logger.timeline.debug('🔍 查找子元素:', {
        sliderRange: !!sliderRange,
        leftHandle: !!leftHandle,
        rightHandle: !!rightHandle,
        startLabel: !!startLabel,
        endLabel: !!endLabel
    });
    
    if (!sliderRange || !leftHandle || !rightHandle || !startLabel || !endLabel) {
        Logger.timeline.error('❌ 时间轴控制条子元素缺失:', {
            sliderRange: !!sliderRange,
            leftHandle: !!leftHandle,
            rightHandle: !!rightHandle,
            startLabel: !!startLabel,
            endLabel: !!endLabel
        });
        return;
    }
    
    // 获取选择的日期
    const selectedDate = document.getElementById('selectedDate');
    // 获取北京时间的当前日期
    const now = new Date();
    const beijingNow = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
    const beijingDateStr = beijingNow.toISOString().split('T')[0];
    const dateStr = selectedDate?.value || beijingDateStr;
    
    Logger.timeline.debug('使用日期:', dateStr);
    
    // 计算当天的开始和结束时间
    // 注意：dayEnd设置为第二天00:00:00以包含24:00:00时间的记录
    const dayStart = new Date(dateStr + 'T00:00:00').getTime();
    const dayEnd = new Date(dateStr + 'T23:59:59').getTime() + 1000; // 加1秒到24:00:00
    
    timeRangeData.startTime = dayStart;
    timeRangeData.endTime = dayEnd;
    
    Logger.timeline.debug('日期范围:', {
        dayStart: new Date(dayStart).toLocaleString(),
        dayEnd: new Date(dayEnd).toLocaleString()
    });
    
    if (currentRecords && currentRecords.length > 0) {
        // 计算数据时间范围
        const timestamps = currentRecords.map(record => {
            const time = record.query_time || record.timestamp;
            return new Date(time).getTime();
        }).filter(t => !isNaN(t) && t >= dayStart && t <= dayEnd);
        
        Logger.timeline.debug('有效时间戳数量:', timestamps.length);
        
        if (timestamps.length > 0) {
            const minTime = Math.min(...timestamps);
            const maxTime = Math.max(...timestamps);
            const dataRange = maxTime - minTime;
            
            Logger.timeline.debug('数据时间范围:', {
                minTime: new Date(minTime).toLocaleString(),
                maxTime: new Date(maxTime).toLocaleString(),
                dataRange: dataRange / (60 * 60 * 1000) + '小时'
            });
            
            // 初始视图显示数据范围的150%，最小2小时
            const minViewRange = 2 * 60 * 60 * 1000; // 2小时
            const viewRange = Math.max(dataRange * 1.5, minViewRange);
            
            const center = (minTime + maxTime) / 2;
            timeRangeData.viewStart = Math.max(dayStart, center - viewRange / 2);
            timeRangeData.viewEnd = Math.min(dayEnd, center + viewRange / 2);
            
            Logger.timeline.info('基于数据设置视图范围:', {
                viewStart: new Date(timeRangeData.viewStart).toLocaleString(),
                viewEnd: new Date(timeRangeData.viewEnd).toLocaleString()
            });
        } else {
            // 没有有效数据，显示全天
            timeRangeData.viewStart = dayStart;
            timeRangeData.viewEnd = dayEnd;
            Logger.timeline.warn('没有有效数据，显示全天');
        }
    } else {
        // 没有数据，显示全天
        timeRangeData.viewStart = dayStart;
        timeRangeData.viewEnd = dayEnd;
        Logger.timeline.warn('没有数据，显示全天');
    }
    
    // 更新显示
    updateSliderDisplay();
    
    // 绑定事件（只绑定一次）
    if (!timeRangeData.initialized) {
        bindSliderEvents();
        timeRangeData.initialized = true;
        Logger.timeline.debug('绑定时间轴事件');
    }
    
    // 更新图表
    updateChartTimeRange();
    
    Logger.timeline.info('时间轴控制条初始化完成');
}

// 更新滑块显示
function updateSliderDisplay() {
    const sliderRange = document.getElementById('sliderRange');
    const startLabel = document.getElementById('sliderLabelStart');
    const endLabel = document.getElementById('sliderLabelEnd');
    
    if (!sliderRange || !startLabel || !endLabel) return;
    
    const totalRange = timeRangeData.endTime - timeRangeData.startTime;
    if (totalRange <= 0) return;
    
    const startPercent = Math.max(0, Math.min(100, ((timeRangeData.viewStart - timeRangeData.startTime) / totalRange) * 100));
    const endPercent = Math.max(0, Math.min(100, ((timeRangeData.viewEnd - timeRangeData.startTime) / totalRange) * 100));
    
    sliderRange.style.left = startPercent + '%';
    sliderRange.style.width = Math.max(1, endPercent - startPercent) + '%';
    
    // 更新标签
    startLabel.textContent = formatTimeForSlider(timeRangeData.viewStart);
    endLabel.textContent = formatTimeForSlider(timeRangeData.viewEnd);
}

// 格式化时间显示
function formatTimeForSlider(timestamp) {
    if (!timestamp || isNaN(timestamp)) return "00:00";
    
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "00:00";
    
    return date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
    });
}

// 绑定滑块事件
function bindSliderEvents() {
    const sliderTrack = document.querySelector('.slider-track');
    const sliderRange = document.getElementById('sliderRange');
    const leftHandle = document.getElementById('leftHandle');
    const rightHandle = document.getElementById('rightHandle');
    
    Logger.timeline.debug('🔗 绑定滑块事件', {
        sliderTrack: !!sliderTrack,
        sliderRange: !!sliderRange,
        leftHandle: !!leftHandle,
        rightHandle: !!rightHandle
    });
    
    if (!sliderTrack || !sliderRange || !leftHandle || !rightHandle) {
        Logger.timeline.error('❌ 滑块元素未找到');
        return;
    }
    
    // 清除之前的事件监听器
    const newSliderRange = sliderRange.cloneNode(true);
    const newLeftHandle = leftHandle.cloneNode(true);
    const newRightHandle = rightHandle.cloneNode(true);
    
    sliderRange.parentNode.replaceChild(newSliderRange, sliderRange);
    newSliderRange.appendChild(newLeftHandle);
    newSliderRange.appendChild(newRightHandle);
    
    Logger.timeline.debug('🔧 重新创建滑块元素完成');
    
    // 重新绑定事件
    
    // 拖拽范围条（移动整个视图窗口）
    newSliderRange.addEventListener('mousedown', (e) => {
        // 如果点击的是控制点，不处理
        if (e.target === newLeftHandle || e.target === newRightHandle) {
            Logger.timeline.debug('👆 点击到控制点，跳过范围条处理');
            return;
        }
        
        Logger.timeline.debug('🎯 开始拖拽范围条');
        timeRangeData.isDragging = true;
        timeRangeData.dragType = 'range';
        timeRangeData.lastMouseX = e.clientX;
        newSliderRange.classList.add('dragging');
        e.preventDefault();
        e.stopPropagation();
    });
    
    // 触摸事件支持 - 范围条
    newSliderRange.addEventListener('touchstart', (e) => {
        if (e.target === newLeftHandle || e.target === newRightHandle) {
            return;
        }
        
        Logger.timeline.debug('👆 开始触摸拖拽范围条');
        timeRangeData.isDragging = true;
        timeRangeData.dragType = 'range';
        timeRangeData.lastMouseX = e.touches[0].clientX;
        newSliderRange.classList.add('dragging');
        e.preventDefault();
        e.stopPropagation();
    });
    
    // 拖拽左边控制点（调整开始时间）
    newLeftHandle.addEventListener('mousedown', (e) => {
        Logger.timeline.debug('👈 开始拖拽左控制点');
        timeRangeData.isDragging = true;
        timeRangeData.dragType = 'left';
        timeRangeData.lastMouseX = e.clientX;
        newLeftHandle.classList.add('dragging');
        e.preventDefault();
        e.stopPropagation();
    });
    
    // 触摸事件支持 - 左控制点
    newLeftHandle.addEventListener('touchstart', (e) => {
        Logger.timeline.debug('👈 开始触摸拖拽左控制点');
        timeRangeData.isDragging = true;
        timeRangeData.dragType = 'left';
        timeRangeData.lastMouseX = e.touches[0].clientX;
        newLeftHandle.classList.add('dragging');
        e.preventDefault();
        e.stopPropagation();
    });
    
    // 拖拽右边控制点（调整结束时间）
    newRightHandle.addEventListener('mousedown', (e) => {
        Logger.timeline.debug('👉 开始拖拽右控制点');
        timeRangeData.isDragging = true;
        timeRangeData.dragType = 'right';
        timeRangeData.lastMouseX = e.clientX;
        newRightHandle.classList.add('dragging');
        e.preventDefault();
        e.stopPropagation();
    });
    
    // 触摸事件支持 - 右控制点
    newRightHandle.addEventListener('touchstart', (e) => {
        Logger.timeline.debug('👉 开始触摸拖拽右控制点');
        timeRangeData.isDragging = true;
        timeRangeData.dragType = 'right';
        timeRangeData.lastMouseX = e.touches[0].clientX;
        newRightHandle.classList.add('dragging');
        e.preventDefault();
        e.stopPropagation();
    });
    
    // 全局鼠标移动事件（只绑定一次）
    if (!window.sliderMouseMoveHandler) {
        Logger.timeline.debug('🌐 绑定全局鼠标移动事件');
        window.sliderMouseMoveHandler = handleSliderMouseMove;
        document.addEventListener('mousemove', window.sliderMouseMoveHandler);
    } else {
        Logger.timeline.debug('✅ 全局鼠标移动事件已存在');
    }
    
    // 全局触摸移动事件（只绑定一次）
    if (!window.sliderTouchMoveHandler) {
        Logger.timeline.debug('🌐 绑定全局触摸移动事件');
        window.sliderTouchMoveHandler = handleSliderTouchMove;
        document.addEventListener('touchmove', window.sliderTouchMoveHandler, { passive: false });
    } else {
        Logger.timeline.debug('✅ 全局触摸移动事件已存在');
    }
    
    // 全局鼠标释放事件（只绑定一次）
    if (!window.sliderMouseUpHandler) {
        Logger.timeline.debug('🌐 绑定全局鼠标释放事件');
        window.sliderMouseUpHandler = handleSliderMouseUp;
        document.addEventListener('mouseup', window.sliderMouseUpHandler);
    } else {
        Logger.timeline.debug('✅ 全局鼠标释放事件已存在');
    }
    
    // 全局触摸结束事件（只绑定一次）
    if (!window.sliderTouchEndHandler) {
        Logger.timeline.debug('🌐 绑定全局触摸结束事件');
        window.sliderTouchEndHandler = handleSliderTouchEnd;
        document.addEventListener('touchend', window.sliderTouchEndHandler);
    } else {
        Logger.timeline.debug('✅ 全局触摸结束事件已存在');
    }
    
    Logger.timeline.info('✨ 滑块事件绑定完成');
}

// 处理滑块鼠标移动
function handleSliderMouseMove(e) {
    if (!timeRangeData.isDragging) return;
    
    Logger.timeline.debug('🖱️ 鼠标移动处理中，拖拽类型:', timeRangeData.dragType);
    
    const sliderTrack = document.querySelector('.slider-track');
    if (!sliderTrack) {
        Logger.timeline.error('❌ 找不到滑块轨道元素');
        return;
    }
    
    const rect = sliderTrack.getBoundingClientRect();
    const deltaX = e.clientX - timeRangeData.lastMouseX;
    const totalRange = timeRangeData.endTime - timeRangeData.startTime;
    const deltaTime = (deltaX / rect.width) * totalRange;
    
    Logger.timeline.debug('🖱️ 鼠标移动详情', {
        dragType: timeRangeData.dragType,
        deltaX,
        deltaTime: (deltaTime / (60 * 60 * 1000)).toFixed(2) + '小时',
        rectWidth: rect.width
    });
    
    switch (timeRangeData.dragType) {
        case 'range':
            // 移动整个视图窗口
            const currentViewRange = timeRangeData.viewEnd - timeRangeData.viewStart;
            let newStart = timeRangeData.viewStart + deltaTime;
            let newEnd = newStart + currentViewRange;
            
            // 限制在有效范围内
            if (newStart < timeRangeData.startTime) {
                newStart = timeRangeData.startTime;
                newEnd = newStart + currentViewRange;
            }
            if (newEnd > timeRangeData.endTime) {
                newEnd = timeRangeData.endTime;
                newStart = newEnd - currentViewRange;
            }
            
            timeRangeData.viewStart = newStart;
            timeRangeData.viewEnd = newEnd;
            break;
            
        case 'left':
            // 调整开始时间（缩放）
            let newViewStart = timeRangeData.viewStart + deltaTime;
            
            // 限制最小范围（30分钟）和最大范围
            const minRange = 30 * 60 * 1000; // 30分钟
            if (newViewStart < timeRangeData.startTime) {
                newViewStart = timeRangeData.startTime;
            }
            if (timeRangeData.viewEnd - newViewStart < minRange) {
                newViewStart = timeRangeData.viewEnd - minRange;
            }
            
            timeRangeData.viewStart = newViewStart;
            break;
            
        case 'right':
            // 调整结束时间（缩放）
            let newViewEnd = timeRangeData.viewEnd + deltaTime;
            
            // 限制最小范围（30分钟）和最大范围
            const minRange2 = 30 * 60 * 1000; // 30分钟
            if (newViewEnd > timeRangeData.endTime) {
                newViewEnd = timeRangeData.endTime;
            }
            if (newViewEnd - timeRangeData.viewStart < minRange2) {
                newViewEnd = timeRangeData.viewStart + minRange2;
            }
            
            timeRangeData.viewEnd = newViewEnd;
            break;
    }
    
    timeRangeData.lastMouseX = e.clientX;
    updateSliderDisplay();
    updateChartTimeRange();
}

// 处理滑块鼠标释放
function handleSliderMouseUp(e) {
    if (!timeRangeData.isDragging) return;
    
    Logger.timeline.debug('结束拖拽', timeRangeData.dragType);
    
    timeRangeData.isDragging = false;
    timeRangeData.dragType = null;
    
    // 移除拖拽样式
    const sliderRange = document.getElementById('sliderRange');
    const leftHandle = document.getElementById('leftHandle');
    const rightHandle = document.getElementById('rightHandle');
    
    if (sliderRange) sliderRange.classList.remove('dragging');
    if (leftHandle) leftHandle.classList.remove('dragging');
    if (rightHandle) rightHandle.classList.remove('dragging');
}

// 处理滑块触摸移动
function handleSliderTouchMove(e) {
    if (!timeRangeData.isDragging) return;
    
    Logger.timeline.debug('📱 触摸移动处理中，拖拽类型:', timeRangeData.dragType);
    
    const sliderTrack = document.querySelector('.slider-track');
    if (!sliderTrack) {
        Logger.timeline.error('❌ 找不到滑块轨道元素');
        return;
    }
    
    const rect = sliderTrack.getBoundingClientRect();
    const currentX = e.touches[0].clientX;
    const deltaX = currentX - timeRangeData.lastMouseX;
    const trackWidth = rect.width;
    const totalTimeRange = timeRangeData.endTime - timeRangeData.startTime;
    const deltaTime = (deltaX / trackWidth) * totalTimeRange;
    
    Logger.timeline.debug('📱 触摸移动计算: deltaX=', deltaX, 'deltaTime=', deltaTime);
    
    switch (timeRangeData.dragType) {
        case 'range':
            // 移动整个视图窗口
            let newStart = timeRangeData.viewStart - deltaTime;
            let newEnd = timeRangeData.viewEnd - deltaTime;
            
            const currentViewRange = timeRangeData.viewEnd - timeRangeData.viewStart;
            
            // 边界检查
            if (newStart < timeRangeData.startTime) {
                newStart = timeRangeData.startTime;
                newEnd = newStart + currentViewRange;
            }
            if (newEnd > timeRangeData.endTime) {
                newEnd = timeRangeData.endTime;
                newStart = newEnd - currentViewRange;
            }
            
            timeRangeData.viewStart = newStart;
            timeRangeData.viewEnd = newEnd;
            break;
            
        case 'left':
            // 调整开始时间（缩放）
            let newViewStart = timeRangeData.viewStart + deltaTime;
            
            // 限制最小范围（30分钟）和最大范围
            const minRange = 30 * 60 * 1000; // 30分钟
            if (newViewStart < timeRangeData.startTime) {
                newViewStart = timeRangeData.startTime;
            }
            if (timeRangeData.viewEnd - newViewStart < minRange) {
                newViewStart = timeRangeData.viewEnd - minRange;
            }
            
            timeRangeData.viewStart = newViewStart;
            break;
            
        case 'right':
            // 调整结束时间（缩放）
            let newViewEnd = timeRangeData.viewEnd + deltaTime;
            
            // 限制最小范围（30分钟）和最大范围
            const minRangeRight = 30 * 60 * 1000; // 30分钟
            if (newViewEnd > timeRangeData.endTime) {
                newViewEnd = timeRangeData.endTime;
            }
            if (newViewEnd - timeRangeData.viewStart < minRangeRight) {
                newViewEnd = timeRangeData.viewStart + minRangeRight;
            }
            
            timeRangeData.viewEnd = newViewEnd;
            break;
    }
    
    timeRangeData.lastMouseX = currentX;
    updateSliderDisplay();
    updateChartTimeRange();
    
    // 阻止页面滚动
    e.preventDefault();
}

// 处理滑块触摸结束
function handleSliderTouchEnd(e) {
    if (!timeRangeData.isDragging) return;
    
    Logger.timeline.debug('📱 结束触摸拖拽', timeRangeData.dragType);
    
    timeRangeData.isDragging = false;
    timeRangeData.dragType = null;
    
    // 移除拖拽样式
    const sliderRange = document.getElementById('sliderRange');
    const leftHandle = document.getElementById('leftHandle');
    const rightHandle = document.getElementById('rightHandle');
    
    if (sliderRange) sliderRange.classList.remove('dragging');
    if (leftHandle) leftHandle.classList.remove('dragging');
    if (rightHandle) rightHandle.classList.remove('dragging');
}

// 更新图表的时间范围和Y轴精度
function updateChartTimeRange() {
    if (!chart || !currentRecords || currentRecords.length === 0) {
        Logger.timeline.warn('updateChartTimeRange: 图表或数据不存在');
        return;
    }
    
    const historyType = document.getElementById('historyViewType');
    if (!historyType || historyType.value !== 'detailed') {
        Logger.timeline.warn('updateChartTimeRange: 不在详细模式');
        return;
    }
    
    Logger.timeline.debug('更新图表时间范围', {
        viewStart: new Date(timeRangeData.viewStart).toLocaleString(),
        viewEnd: new Date(timeRangeData.viewEnd).toLocaleString(),
        totalRecords: currentRecords.length
    });
    
    // 扩展时间范围以包含边界数据点，避免数据线消失
    const extendedViewStart = timeRangeData.viewStart - (60 * 60 * 1000); // 向前扩展1小时
    const extendedViewEnd = timeRangeData.viewEnd + (60 * 60 * 1000); // 向后扩展1小时
    
    // 获取所有相关数据（包括扩展范围内的数据）
    const allData = currentRecords.map(record => {
        const timestamp = new Date(record.query_time || record.timestamp).getTime();
        const amount = parseFloat(record.remaining_amount || 0);
        const isAuto = record.is_auto === 1 || record.is_auto === '1';
        
        return { 
            x: timestamp, 
            y: amount,
            isAuto: isAuto,
            inViewRange: timestamp >= timeRangeData.viewStart && timestamp <= timeRangeData.viewEnd
        };
    }).filter(point => {
        // 只保留扩展范围内的数据
        return !isNaN(point.x) && point.x >= extendedViewStart && point.x <= extendedViewEnd;
    });
    
    // 按时间排序
    allData.sort((a, b) => a.x - b.x);
    
    Logger.timeline.debug('扩展范围数据', allData.length, '条记录，视图范围内', allData.filter(p => p.inViewRange).length, '条');
    
    // 确保图表有数据集，使用更稳定的样式配置方式
    if (!chart.data.datasets || chart.data.datasets.length === 0) {
        chart.data.datasets = [{
            label: '剩余电量',
            data: allData,
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: 3, // 统一数据点大小
            pointBackgroundColor: function(context) {
                // 使用当前数据集中的数据点
                if (!context.dataset.data || context.dataIndex >= context.dataset.data.length) {
                    return 'rgb(54, 162, 235)'; // 默认颜色
                }
                const dataPoint = context.dataset.data[context.dataIndex];
                return dataPoint && dataPoint.isAuto ? 'rgb(54, 162, 235)' : 'rgb(255, 99, 132)';
            },
            pointBorderColor: function(context) {
                // 使用当前数据集中的数据点
                if (!context.dataset.data || context.dataIndex >= context.dataset.data.length) {
                    return 'rgb(54, 162, 235)'; // 默认颜色
                }
                const dataPoint = context.dataset.data[context.dataIndex];
                return dataPoint && dataPoint.isAuto ? 'rgb(54, 162, 235)' : 'rgb(255, 99, 132)';
            },
            pointBorderWidth: 2
        }];
    } else {
        // 更新现有数据集，保持样式配置的一致性
        const dataset = chart.data.datasets[0];
        dataset.data = allData;
        
        // 重新设置样式函数以确保正确的引用
        dataset.pointRadius = 3; // 统一数据点大小
        dataset.pointBackgroundColor = function(context) {
            if (!context.dataset.data || context.dataIndex >= context.dataset.data.length) {
                return 'rgb(54, 162, 235)'; // 默认颜色
            }
            const dataPoint = context.dataset.data[context.dataIndex];
            return dataPoint && dataPoint.isAuto ? 'rgb(54, 162, 235)' : 'rgb(255, 99, 132)';
        };
        dataset.pointBorderColor = function(context) {
            if (!context.dataset.data || context.dataIndex >= context.dataset.data.length) {
                return 'rgb(54, 162, 235)'; // 默认颜色
            }
            const dataPoint = context.dataset.data[context.dataIndex];
            return dataPoint && dataPoint.isAuto ? 'rgb(54, 162, 235)' : 'rgb(255, 99, 132)';
        };
        dataset.pointBorderWidth = 2;
    }
    
    // 计算时间范围来调整时间轴精度
    const timeRange = timeRangeData.viewEnd - timeRangeData.viewStart;
    const hours = timeRange / (60 * 60 * 1000);
    
    // 根据时间范围调整时间轴单位
    let timeUnit = 'minute';
    let stepSize = 1;
    if (hours > 12) {
        timeUnit = 'hour';
        stepSize = 1;
    } else if (hours > 6) {
        timeUnit = 'minute';
        stepSize = 30;
    } else if (hours > 2) {
        timeUnit = 'minute';
        stepSize = 15;
    } else if (hours > 1) {
        timeUnit = 'minute';
        stepSize = 10;
    } else {
        timeUnit = 'minute';
        stepSize = 5;
    }
    
    // 确保scales对象存在
    if (!chart.options.scales) {
        chart.options.scales = {};
    }
    
    // 更新X轴配置
    // 为X轴添加padding，确保最右端的数据点能完全显示
    const viewTimeRange = timeRangeData.viewEnd - timeRangeData.viewStart;
    const timePadding = Math.max(viewTimeRange * 0.02, 1 * 60 * 1000); // 至少1分钟的padding
    
    chart.options.scales.x = {
        type: 'time',
        time: {
            unit: timeUnit,
            stepSize: stepSize,
            displayFormats: {
                hour: 'HH:mm',
                minute: 'HH:mm'
            },
            tooltipFormat: 'yyyy-MM-dd HH:mm:ss'
        },
        min: timeRangeData.viewStart - timePadding,
        max: timeRangeData.viewEnd + timePadding,
        title: {
            display: true,
            text: '时间'
        },
        ticks: {
            maxTicksLimit: 20,
            autoSkip: true
        }
    };
    
    // 计算Y轴范围 - 只基于视图范围内的数据点
    const viewRangeData = allData.filter(point => point.inViewRange);
    
    if (viewRangeData.length > 0) {
        const yValues = viewRangeData.map(d => d.y);
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);
        const yRange = maxY - minY;
        
        Logger.chart.debug('Y轴计算基础数据:', {
            minY: minY.toFixed(3),
            maxY: maxY.toFixed(3),
            yRange: yRange.toFixed(3),
            dataPoints: viewRangeData.length
        });
        
        // 根据数据范围动态调整步长，但最小0.05
        let yStepSize = 0.05; // 最小步长
        if (yRange > 10) {
            yStepSize = 1;
        } else if (yRange > 5) {
            yStepSize = 0.5;
        } else if (yRange > 2) {
            yStepSize = 0.2;
        } else if (yRange > 1) {
            yStepSize = 0.1;
        } else {
            yStepSize = 0.05; // 最小步长
        }
        
        // 新的边界对齐逻辑：确保刻度一致性和数据点完整显示
        function calculateAlignedBounds(dataMin, dataMax, stepSize) {
            // 步骤1：将边界对齐到stepSize的倍数
            let alignedMin = Math.floor(dataMin / stepSize) * stepSize;
            let alignedMax = Math.ceil(dataMax / stepSize) * stepSize;
            
            // 步骤2：确保数据点不会贴在边界上 - 关键修复
            // 如果alignedMin等于dataMin，需要向下扩展一个步长
            if (Math.abs(alignedMin - dataMin) < 0.001) {
                alignedMin = Math.max(0, alignedMin - stepSize);
            }
            // 如果alignedMax等于dataMax，需要向上扩展一个步长  
            if (Math.abs(alignedMax - dataMax) < 0.001) {
                alignedMax = alignedMax + stepSize;
            }
            
            // 步骤3：确保对齐到0或5结尾（仅当stepSize < 1时需要）
            if (stepSize < 1) {
                function alignTo05End(value, isMin) {
                    const rounded = Math.round(value * 100) / 100;
                    const lastDigit = Math.abs(Math.round(rounded * 100)) % 10;
                    
                    if (lastDigit === 0 || lastDigit === 5) {
                        return rounded;
                    }
                    
                    // 找到最近的0或5结尾值
                    const base = Math.floor(rounded * 10) / 10;
                    const option1 = base; // .0结尾
                    const option2 = base + 0.05; // .05结尾
                    
                    if (isMin) {
                        // 最小值：选择不大于原值的最大选项
                        return option2 <= value ? option2 : option1;
                    } else {
                        // 最大值：选择不小于原值的最小选项
                        return option1 >= value ? option1 : option2;
                    }
                }
                
                alignedMin = Math.max(0, alignTo05End(alignedMin, true));
                alignedMax = alignTo05End(alignedMax, false);
                
                // 重新确保对齐到stepSize的倍数
                alignedMin = Math.floor(alignedMin / stepSize) * stepSize;
                alignedMax = Math.ceil(alignedMax / stepSize) * stepSize;
            }
            
            // 步骤4：确保最小显示范围
            if (alignedMax - alignedMin < stepSize * 2) {
                const center = (alignedMin + alignedMax) / 2;
                alignedMin = Math.floor((center - stepSize) / stepSize) * stepSize;
                alignedMax = Math.ceil((center + stepSize) / stepSize) * stepSize;
                
                // 确保最小值不小于0
                alignedMin = Math.max(0, alignedMin);
            }
            
            return {
                min: Math.max(0, alignedMin),
                max: alignedMax
            };
        }
        
        // 使用新的边界计算方法
        const bounds = calculateAlignedBounds(minY, maxY, yStepSize);
        let finalMin = bounds.min;
        let finalMax = bounds.max;
        
        Logger.chart.debug('Y轴范围计算:', {
            yStepSize: yStepSize,
            originalMin: minY.toFixed(3),
            originalMax: maxY.toFixed(3),
            finalMin: finalMin.toFixed(3),
            finalMax: finalMax.toFixed(3),
            range: (finalMax - finalMin).toFixed(3)
        });
        
        // 更新Y轴配置，强制设置min和max
        chart.options.scales.y = {
            title: {
                display: true,
                text: '剩余电量 (度)'
            },
            min: finalMin,
            max: finalMax,
            // 添加suggestedMin和suggestedMax作为备用
            suggestedMin: finalMin,
            suggestedMax: finalMax,
            // 确保不使用自动缩放
            beginAtZero: false,
            ticks: {
                stepSize: yStepSize,
                // 强制显示边界值
                includeBounds: true,
                callback: function(value) {
                    // 改进的刻度显示逻辑，确保与边界对齐一致
                    const rounded = Math.round(value * 100) / 100;
                    
                    // 检查是否是有效的刻度点（stepSize的倍数）
                    const stepMultiple = Math.round(rounded / yStepSize);
                    const expectedValue = stepMultiple * yStepSize;
                    const diff = Math.abs(rounded - expectedValue);
                    
                    // 如果不是stepSize的倍数，不显示
                    if (diff > 0.001) {
                        return null;
                    }
                    
                    // 检查是否符合0或5结尾的要求（仅当stepSize < 1时）
                    if (yStepSize < 1) {
                        const lastDigit = Math.abs(Math.round(rounded * 100)) % 10;
                        if (lastDigit !== 0 && lastDigit !== 5) {
                            return null;
                        }
                    }
                    
                    // 格式化显示
                    if (yStepSize >= 1) {
                        return rounded.toFixed(0);
                    } else if (yStepSize >= 0.1) {
                        return rounded.toFixed(1);
                    } else {
                        return rounded.toFixed(2);
                    }
                }
            },
            grid: {
                color: 'rgba(0, 0, 0, 0.1)'
            }
        };
        
        // 保存这次的Y轴范围作为最后有效范围
        timeRangeData.lastValidYAxisRange = {
            min: finalMin,
            max: finalMax,
            stepSize: yStepSize
        };
    } else {
        // 没有视图范围内的数据时，检查当天是否有任何数据
        Logger.chart.info('视图范围内无数据点');
        
        // 检查当天是否有任何数据（不仅仅是扩展范围内的数据）
        const hasAnyDataToday = currentRecords && currentRecords.length > 0;
        
        if (hasAnyDataToday && timeRangeData.lastValidYAxisRange) {
            // 如果当天有数据且有保存的范围，使用最后的有效范围
            Logger.chart.debug('当天有数据，使用最后有效的Y轴范围:', timeRangeData.lastValidYAxisRange);
            chart.options.scales.y = {
                title: {
                    display: true,
                    text: '剩余电量 (度)'
                },
                min: timeRangeData.lastValidYAxisRange.min,
                max: timeRangeData.lastValidYAxisRange.max,
                ticks: {
                    stepSize: timeRangeData.lastValidYAxisRange.stepSize,
                    callback: function(value) {
                        // 改进的刻度显示逻辑，确保与边界对齐一致
                        const rounded = Math.round(value * 100) / 100;
                        const stepSize = timeRangeData.lastValidYAxisRange.stepSize;
                        
                        // 检查是否是有效的刻度点（stepSize的倍数）
                        const stepMultiple = Math.round(rounded / stepSize);
                        const expectedValue = stepMultiple * stepSize;
                        const diff = Math.abs(rounded - expectedValue);
                        
                        // 如果不是stepSize的倍数，不显示
                        if (diff > 0.001) {
                            return null;
                        }
                        
                        // 检查是否符合0或5结尾的要求（仅当stepSize < 1时）
                        if (stepSize < 1) {
                            const lastDigit = Math.abs(Math.round(rounded * 100)) % 10;
                            if (lastDigit !== 0 && lastDigit !== 5) {
                                return null;
                            }
                        }
                        
                        // 格式化显示
                        if (stepSize >= 1) {
                            return rounded.toFixed(0);
                        } else if (stepSize >= 0.1) {
                            return rounded.toFixed(1);
                        } else {
                            return rounded.toFixed(2);
                        }
                    }
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)'
                }
            };
        } else {
            // 完全没有数据的日期（当天没有任何数据记录），使用默认范围
            Logger.chart.debug('完全没有数据的日期，使用默认Y轴范围 0-100');
            chart.options.scales.y = {
                title: {
                    display: true,
                    text: '剩余电量 (度)'
                },
                min: 0,
                max: 100,
                ticks: {
                    stepSize: 10,
                    callback: function(value) {
                        return value.toFixed(0);
                    }
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)'
                }
            };
        }
    }
    
    try {
        // 更新图表，使用resize模式保持顺滑效果
        Logger.chart.debug('🔄 准备更新图表，当前图表状态:', {
            chartExists: !!chart,
            datasetCount: chart?.data?.datasets?.length || 0,
            xAxisConfig: !!chart?.options?.scales?.x,
            yAxisConfig: !!chart?.options?.scales?.y
        });
        
        chart.update('resize');
        
        // 额外验证：确保Y轴配置确实被应用
        const actualYAxisConfig = chart.options.scales.y;
        const actualXAxisConfig = chart.options.scales.x;
        Logger.chart.debug('📊 图表更新后的配置验证:', {
            yAxisMin: actualYAxisConfig.min,
            yAxisMax: actualYAxisConfig.max,
            yAxisStepSize: actualYAxisConfig.ticks?.stepSize,
            xAxisMin: new Date(actualXAxisConfig.min).toLocaleString(),
            xAxisMax: new Date(actualXAxisConfig.max).toLocaleString(),
            dataPointCount: chart.data.datasets[0]?.data?.length || 0
        });
        
        Logger.chart.info('✅ 图表更新成功');
    } catch (error) {
        Logger.chart.error('❌ 图表更新失败:', error);
    }
}

// 数据恢复相关函数
async function showRestoreModal() {
    const modal = document.getElementById('restoreDataModal');
    const backupSelect = document.getElementById('backupSelect');
    const restoreStatus = document.getElementById('restoreStatus');
    const backupStatus = document.getElementById('backupStatus');
    const globalBackupStatus = document.getElementById('globalBackupStatus');
    const backupManageContent = document.getElementById('backupManageContent');
    const showBackupManageBtn = document.getElementById('showBackupManageBtn');
    const confirmRestoreBtn = document.getElementById('confirmRestoreBtn');
    
    if (!modal || !backupSelect) return;
    
    // 重置状态
    restoreStatus.style.display = 'none';
    backupStatus.style.display = 'none';
    if (globalBackupStatus) {
        globalBackupStatus.style.display = 'none';
    }
    
    // 隐藏确认恢复按钮
    if (confirmRestoreBtn) {
        confirmRestoreBtn.style.display = 'none';
    }
    
    // 隐藏备份管理内容并重置按钮文本
    if (backupManageContent) {
        backupManageContent.style.display = 'none';
    }
    if (showBackupManageBtn) {
        showBackupManageBtn.textContent = '管理备份文件';
    }
    
    // 显示模态框
    modal.style.display = 'block';
    modal.classList.remove('hide');
    // 触发重排以确保display:block生效
    modal.offsetHeight;
    modal.classList.add('show');
    
    // 只加载恢复用的备份列表
    await loadRestoreBackupList();
}

async function loadBackupList() {
    // 调用支持Shift多选的新版本
    await loadBackupListWithShiftSelect();
}

// 只加载恢复用的备份下拉列表
async function loadRestoreBackupList() {
    const backupSelect = document.getElementById('backupSelect');
    
    if (backupSelect) {
        backupSelect.innerHTML = '<option value="">正在加载备份列表...</option>';
    }
    
    try {
        // 获取备份列表
        const response = await fetch('/api/backups');
        const data = await response.json();
        
        const backups = data.data ? data.data.backups : data.backups;
        if (data.success && backups && backups.length > 0) {
            // 更新下拉选择列表
            if (backupSelect) {
                backupSelect.innerHTML = '<option value="">请选择要恢复的备份</option>';
                
                backups.forEach(backup => {
                    const option = document.createElement('option');
                    option.value = backup.tableName;
                    option.textContent = backup.displayName;
                    backupSelect.appendChild(option);
                });
                
                // 添加事件监听器来控制确认按钮的显示
                backupSelect.addEventListener('change', function() {
                    toggleConfirmRestoreButton();
                });
            }
        } else {
            if (backupSelect) {
                backupSelect.innerHTML = '<option value="">没有找到可用的备份</option>';
            }
        }
    } catch (error) {
        Logger.backup.error('获取备份列表失败:', error);
        if (backupSelect) {
            backupSelect.innerHTML = '<option value="">获取备份列表失败</option>';
        }
    }
}

// 控制确认恢复按钮的显示/隐藏
function toggleConfirmRestoreButton() {
    const backupSelect = document.getElementById('backupSelect');
    const confirmRestoreBtn = document.getElementById('confirmRestoreBtn');
    
    if (!backupSelect || !confirmRestoreBtn) return;
    
    // 只有当选择了有效的备份时才显示确认按钮
    if (backupSelect.value && backupSelect.value !== '') {
        confirmRestoreBtn.style.display = 'inline-block';
    } else {
        confirmRestoreBtn.style.display = 'none';
    }
}

function hideRestoreModal() {
    const modal = document.getElementById('restoreDataModal');
    if (modal) {
        modal.classList.remove('show');
        modal.classList.add('hide');
        
        // 等待动画完成后隐藏模态框
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('hide');
        }, 300);
    }
}

async function confirmRestore() {
    const backupSelect = document.getElementById('backupSelect');
    const restoreStatus = document.getElementById('restoreStatus');
    const confirmBtn = document.getElementById('confirmRestoreBtn');
    
    if (!backupSelect || !restoreStatus || !confirmBtn) return;
    
    const selectedBackup = backupSelect.value;
    if (!selectedBackup) {
        showRestoreStatus('请选择要恢复的备份', 'error');
        return;
    }
    
    if (!confirm('确定要执行数据恢复吗？这将清空当前所有数据并从备份中恢复！\n\n系统会在恢复前自动创建当前数据的备份。')) {
        return;
    }
    
    // 禁用按钮并显示加载状态
    confirmBtn.disabled = true;
    confirmBtn.textContent = '恢复中...';
    showRestoreStatus('正在恢复数据，请稍候...', 'info');
    
    try {
        const response = await fetch('/api/restore', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                backupTableName: selectedBackup
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showRestoreStatus(`恢复成功！已恢复 ${result.restoredCount} 条记录。\n当前数据已备份为: ${result.currentDataBackup}`, 'success');
            
            // 延迟2秒后关闭模态框并刷新页面
            setTimeout(() => {
                hideRestoreModal();
                window.location.reload();
            }, 2000);
        } else {
            showRestoreStatus(`恢复失败: ${result.error}`, 'error');
        }
    } catch (error) {
        Logger.backup.error('恢复请求失败:', error);
        showRestoreStatus(`恢复失败: ${error.message}`, 'error');
    } finally {
        // 恢复按钮状态
        confirmBtn.disabled = false;
        confirmBtn.textContent = '确认恢复';
    }
}

// 通用状态显示函数 - 合并了之前4个重复的状态显示函数
function showStatus(elementId, message, type, autoHide = false) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.textContent = message;
    element.className = `status-message ${type}`;
    element.style.display = 'block';
    
    // 自动隐藏功能
    if (autoHide && (type === 'success' || type === 'info')) {
        setTimeout(() => {
            element.style.display = 'none';
        }, 3000);
    }
}

// 兼容性包装函数
function showRestoreStatus(message, type) {
    showStatus('restoreStatus', message, type);
}

function showBackupStatus(message, type) {
    showStatus('backupStatus', message, type);
}

function showGlobalBackupStatus(message, type) {
    showStatus('globalBackupStatus', message, type, true); // 启用自动隐藏
}

// 手动创建备份
async function createManualBackup() {
    const createBackupBtn = document.getElementById('createBackupBtn');
    if (!createBackupBtn) return;
    
    // 禁用按钮并显示加载状态
    createBackupBtn.disabled = true;
    createBackupBtn.textContent = '创建中...';
    showGlobalBackupStatus('正在创建备份，请稍候...', 'info');
    
    try {
        const response = await fetch('/api/create-backup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            const backupId = result.data ? result.data.backupId : result.backupId;
            showGlobalBackupStatus(`备份创建成功！备份ID: ${backupId}`, 'success');
            // 刷新备份列表
            await loadBackupList();
        } else {
            showGlobalBackupStatus(`备份创建失败: ${result.error}`, 'error');
        }
    } catch (error) {
        Logger.backup.error('创建备份失败:', error);
        showGlobalBackupStatus(`备份创建失败: ${error.message}`, 'error');
    } finally {
        // 恢复按钮状态
        createBackupBtn.disabled = false;
        createBackupBtn.textContent = '创建手动备份';
    }
}

// 刷新备份列表
async function refreshBackupList() {
    const refreshBackupListBtn = document.getElementById('refreshBackupListBtn');
    if (refreshBackupListBtn) {
        refreshBackupListBtn.disabled = true;
        refreshBackupListBtn.textContent = '刷新中...';
    }
    
    try {
        await loadBackupList();
        showGlobalBackupStatus('备份列表已刷新', 'success');
    } catch (error) {
        showGlobalBackupStatus('刷新失败: ' + error.message, 'error');
    } finally {
        if (refreshBackupListBtn) {
            refreshBackupListBtn.disabled = false;
            refreshBackupListBtn.textContent = '刷新列表';
        }
    }
}

// 备份管理相关函数
function updateBackupManageButtons() {
    const selectedCheckboxes = document.querySelectorAll('#backupCheckboxList input[type="checkbox"]:checked');
    const allCheckboxes = document.querySelectorAll('#backupCheckboxList input[type="checkbox"]');
    
    const selectAllBtn = document.getElementById('selectAllBackupsBtn');
    const unselectAllBtn = document.getElementById('unselectAllBackupsBtn');
    const deleteBtn = document.getElementById('deleteSelectedBackupsBtn');
    
    if (selectAllBtn && unselectAllBtn && deleteBtn) {
        const hasAnyBackups = allCheckboxes.length > 0;
        const hasSelectedBackups = selectedCheckboxes.length > 0;
        const allSelected = allCheckboxes.length > 0 && selectedCheckboxes.length === allCheckboxes.length;
        
        // 启用/禁用按钮
        selectAllBtn.disabled = !hasAnyBackups || allSelected;
        unselectAllBtn.disabled = !hasSelectedBackups;
        deleteBtn.disabled = !hasSelectedBackups;
        
        // 更新删除按钮文本
        if (hasSelectedBackups) {
            deleteBtn.textContent = `删除选中的备份 (${selectedCheckboxes.length})`;
        } else {
            deleteBtn.textContent = '删除选中的备份';
        }
    }
}

function disableBackupManageButtons() {
    const selectAllBtn = document.getElementById('selectAllBackupsBtn');
    const unselectAllBtn = document.getElementById('unselectAllBackupsBtn');
    const deleteBtn = document.getElementById('deleteSelectedBackupsBtn');
    
    if (selectAllBtn) selectAllBtn.disabled = true;
    if (unselectAllBtn) unselectAllBtn.disabled = true;
    if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.textContent = '删除选中的备份';
    }
}

// 通用复选框切换函数
function toggleAllBackups(checked) {
    const checkboxes = document.querySelectorAll('#backupCheckboxList input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = checked;
    });
    updateBackupManageButtons();
}

function selectAllBackups() {
    toggleAllBackups(true);
}

function unselectAllBackups() {
    toggleAllBackups(false);
}

async function deleteSelectedBackups() {
    const selectedCheckboxes = document.querySelectorAll('#backupCheckboxList input[type="checkbox"]:checked');
    
    if (selectedCheckboxes.length === 0) {
        showDeleteBackupStatus('请选择要删除的备份', 'error');
        return;
    }
    
    const selectedBackups = Array.from(selectedCheckboxes).map(cb => cb.value);
    const backupNames = Array.from(selectedCheckboxes).map(cb => {
        const label = document.querySelector(`label[for="${cb.id}"]`);
        return label ? label.textContent : cb.value;
    });
    
    const confirmMessage = `确定要删除以下 ${selectedBackups.length} 个备份吗？\n\n${backupNames.join('\n')}\n\n注意：删除后无法恢复！`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    const deleteBtn = document.getElementById('deleteSelectedBackupsBtn');
    if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.textContent = '删除中...';
    }
    
    showDeleteBackupStatus('正在删除备份，请稍候...', 'info');
    
    try {
        const response = await fetch('/api/backups', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                backupTableNames: selectedBackups
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showDeleteBackupStatus(result.message, 'success');
            
            // 刷新备份列表
            setTimeout(async () => {
                await loadBackupList();
                
                // 隐藏状态消息
                setTimeout(() => {
                    const deleteBackupStatus = document.getElementById('deleteBackupStatus');
                    if (deleteBackupStatus) {
                        deleteBackupStatus.style.display = 'none';
                    }
                }, 2000);
            }, 1000);
        } else {
            showDeleteBackupStatus('删除失败: ' + result.error, 'error');
        }
    } catch (error) {
        Logger.backup.error('删除备份失败:', error);
        showDeleteBackupStatus('删除失败: ' + error.message, 'error');
    } finally {
        if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.textContent = '删除选中的备份';
        }
    }
}

function showDeleteBackupStatus(message, type) {
    showStatus('deleteBackupStatus', message, type);
}

// 展开/收起备份管理内容
function toggleBackupManageContent() {
    const content = document.getElementById('backupManageContent');
    const button = document.getElementById('showBackupManageBtn');
    
    if (!content || !button) return;
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        button.textContent = '收起备份管理';
        // 首次打开时加载备份列表
        loadBackupList();
    } else {
        content.style.display = 'none';
        button.textContent = '管理备份文件';
    }
}

// 全局变量用于支持Shift多选
let lastSelectedCheckbox = null;

// 修改loadBackupList函数以支持Shift多选
async function loadBackupListWithShiftSelect() {
    const backupSelect = document.getElementById('backupSelect');
    const backupCheckboxList = document.getElementById('backupCheckboxList');
    
    if (backupSelect) {
        backupSelect.innerHTML = '<option value="">正在加载备份列表...</option>';
    }
    
    if (backupCheckboxList) {
        backupCheckboxList.innerHTML = '<div class="loading-message">正在加载备份列表...</div>';
    }
    
    try {
        // 获取备份列表
        const response = await fetch('/api/backups');
        const data = await response.json();
        
        const backups = data.data ? data.data.backups : data.backups;
        if (data.success && backups && backups.length > 0) {
            // 更新下拉选择列表
            if (backupSelect) {
                backupSelect.innerHTML = '<option value="">请选择要恢复的备份</option>';
                
                backups.forEach(backup => {
                    const option = document.createElement('option');
                    option.value = backup.tableName;
                    option.textContent = backup.displayName;
                    backupSelect.appendChild(option);
                });
            }
            
            // 更新复选框列表（支持Shift多选）
            if (backupCheckboxList) {
                backupCheckboxList.innerHTML = '';
                
                backups.forEach((backup, index) => {
                    const checkboxItem = document.createElement('div');
                    checkboxItem.className = 'backup-checkbox-item';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `backup_${backup.tableName}`;
                    checkbox.value = backup.tableName;
                    checkbox.dataset.index = index; // 添加索引用于Shift选择
                    
                    // 添加支持Shift多选的事件监听器
                    checkbox.addEventListener('change', function(event) {
                        handleCheckboxChange(event, this);
                        updateBackupManageButtons();
                    });
                    
                    // 添加点击事件监听器支持Shift多选
                    checkbox.addEventListener('click', function(event) {
                        handleShiftSelect(event, this);
                    });
                    
                    const label = document.createElement('label');
                    label.htmlFor = `backup_${backup.tableName}`;
                    label.textContent = backup.displayName;
                    
                    checkboxItem.appendChild(checkbox);
                    checkboxItem.appendChild(label);
                    backupCheckboxList.appendChild(checkboxItem);
                });
                
                // 启用管理按钮
                updateBackupManageButtons();
            }
        } else {
            if (backupSelect) {
                backupSelect.innerHTML = '<option value="">没有找到可用的备份</option>';
            }
            if (backupCheckboxList) {
                backupCheckboxList.innerHTML = '<div class="loading-message">没有找到可用的备份</div>';
                disableBackupManageButtons();
            }
        }
    } catch (error) {
        Logger.backup.error('获取备份列表失败:', error);
        if (backupSelect) {
            backupSelect.innerHTML = '<option value="">获取备份列表失败</option>';
        }
        if (backupCheckboxList) {
            backupCheckboxList.innerHTML = '<div class="loading-message">获取备份列表失败</div>';
            disableBackupManageButtons();
        }
    }
}

// 处理复选框变化事件
function handleCheckboxChange(event, checkbox) {
    lastSelectedCheckbox = checkbox;
}

// 处理Shift多选
function handleShiftSelect(event, checkbox) {
    if (event.shiftKey && lastSelectedCheckbox && lastSelectedCheckbox !== checkbox) {
        const allCheckboxes = Array.from(document.querySelectorAll('#backupCheckboxList input[type="checkbox"]'));
        const currentIndex = parseInt(checkbox.dataset.index);
        const lastIndex = parseInt(lastSelectedCheckbox.dataset.index);
        
        const startIndex = Math.min(currentIndex, lastIndex);
        const endIndex = Math.max(currentIndex, lastIndex);
        
        // 获取选择状态（基于当前点击的复选框状态）
        const shouldCheck = checkbox.checked;
        
        // 选择范围内的所有复选框
        for (let i = startIndex; i <= endIndex; i++) {
            const targetCheckbox = allCheckboxes.find(cb => parseInt(cb.dataset.index) === i);
            if (targetCheckbox) {
                targetCheckbox.checked = shouldCheck;
            }
        }
        
        // 更新按钮状态
        updateBackupManageButtons();
    }
}

// 密码保护相关函数
function showPasswordModal() {
    // 创建密码输入模态框
    let modal = document.getElementById('passwordModal');
    if (!modal) {
        modal = createPasswordModal();
        document.body.appendChild(modal);
    }
    
    // 清空输入框和错误信息
    const passwordInput = modal.querySelector('#passwordInput');
    const errorDiv = modal.querySelector('#passwordError');
    if (passwordInput) {
        passwordInput.value = '';
    }
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
    
    // 显示模态框
    modal.style.display = 'flex';
    modal.classList.remove('hide');
    
    // 使用 requestAnimationFrame 确保DOM更新后再添加show类
    requestAnimationFrame(() => {
        modal.classList.add('show');
        // 确保输入框获得焦点
        if (passwordInput) {
            setTimeout(() => {
                passwordInput.focus();
            }, 100);
        }
    });
}

function hidePasswordModal() {
    const modal = document.getElementById('passwordModal');
    if (modal) {
        modal.classList.remove('show');
        modal.classList.add('hide');
        
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('hide');
        }, 300);
    }
}

function createPasswordModal() {
    const modal = document.createElement('div');
    modal.id = 'passwordModal';
    modal.className = 'modal';
    modal.style.cssText = `
        display: none;
        position: fixed;
        z-index: 10000;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0,0,0,0.5);
        opacity: 0;
        transition: opacity 0.3s ease;
        justify-content: center;
        align-items: center;
    `;
    
    modal.innerHTML = `
        <div class="modal-content" style="
            background-color: #fefefe;
            padding: 30px;
            border: none;
            border-radius: 15px;
            width: 400px;
            max-width: 90%;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            position: relative;
            animation: slideIn 0.3s ease;
            z-index: 10001;
        ">
            <h2 style="color: #333; margin-bottom: 20px; text-align: center;">管理员验证</h2>
            <div style="margin-bottom: 20px;">
                <input type="password" id="passwordInput" style="
                    width: 100%;
                    padding: 12px;
                    border: 2px solid #ddd;
                    border-radius: 4px;
                    font-size: 16px;
                    box-sizing: border-box;
                    transition: border-color 0.3s ease;
                " />
            </div>
            <div style="text-align: center;">
                <button id="confirmPasswordBtn" style="
                    background-color: #28A745;
                    color: white;
                    padding: 12px 24px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    margin-right: 10px;
                    transition: background-color 0.3s ease;
                ">确认</button>
                <button id="cancelPasswordBtn" style="
                    background-color: #6C757D;
                    color: white;
                    padding: 12px 24px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    transition: background-color 0.3s ease;
                ">取消</button>
            </div>
            <div id="passwordError" style="
                color: #dc3545;
                text-align: center;
                margin-top: 10px;
                display: none;
                font-size: 14px;
            "></div>
        </div>
    `;
    
    // 添加CSS动画
    const style = document.createElement('style');
    style.textContent = `
        .modal.show { opacity: 1 !important; }
        .modal.hide { opacity: 0 !important; }
        @keyframes slideIn {
            from { transform: translateY(-50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        .modal input:focus {
            border-color: #007bff !important;
            outline: none !important;
            box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25) !important;
        }
        .modal button:hover {
            opacity: 0.9 !important;
        }
        .modal .modal-content {
            margin: 10% auto !important;
            max-height: 80vh !important;
            overflow-y: auto !important;
        }
    `;
    document.head.appendChild(style);
    
    // 绑定事件
    const confirmBtn = modal.querySelector('#confirmPasswordBtn');
    const cancelBtn = modal.querySelector('#cancelPasswordBtn');
    const passwordInput = modal.querySelector('#passwordInput');
    
    cancelBtn.addEventListener('click', hidePasswordModal);
    confirmBtn.addEventListener('click', verifyPassword);
    
    // 回车键确认
    passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            verifyPassword();
        }
    });
    
    // 输入时清除错误信息
    passwordInput.addEventListener('input', function() {
        const errorDiv = modal.querySelector('#passwordError');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    });
    
    return modal;
}

function verifyPassword() {
    const modal = document.getElementById('passwordModal');
    const passwordInput = modal.querySelector('#passwordInput');
    const errorDiv = modal.querySelector('#passwordError');
    const password = passwordInput.value;
    
    if (password === ADMIN_PASSWORD) {
        isAdminUnlocked = true;
        updateAdminButtonsVisibility();
        hidePasswordModal();
        
        // 显示成功提示
        const queryStatus = document.getElementById('queryStatus');
        if (queryStatus) {
            const originalText = queryStatus.textContent;
            const originalColor = queryStatus.style.color;
            queryStatus.textContent = '管理员功能已启用';
            queryStatus.style.color = '#28a745';
            
            setTimeout(() => {
                queryStatus.textContent = originalText;
                queryStatus.style.color = originalColor;
            }, 3000);
        }
    } else {
        if (errorDiv) {
            errorDiv.textContent = '密码错误，请重试';
            errorDiv.style.display = 'block';
        }
        passwordInput.value = '';
        passwordInput.focus();
    }
}

function updateAdminButtonsVisibility() {
    const historyType = document.getElementById('historyViewType');
    const isDetailed = historyType && historyType.value === 'detailed';
    
    const adminButtons = [
        'clearOldDataBtn',
        'clearAllDataBtn'
    ];
    
    // 这些按钮在"每天所有记录"模式下不显示
    adminButtons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
            if (isDetailed) {
                button.style.display = 'none';
            } else {
                button.style.display = isAdminUnlocked ? 'inline-block' : 'none';
            }
        }
    });
    
    // "数据备份与恢复"按钮在两种模式下都应该显示（如果已验证密码）
    const restoreDataBtn = document.getElementById('restoreDataBtn');
    if (restoreDataBtn) {
        restoreDataBtn.style.display = isAdminUnlocked ? 'inline-block' : 'none';
    }
}

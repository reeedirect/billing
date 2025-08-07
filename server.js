const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 获取北京时间 Date 对象
function getBeijingTime() {
    return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
}

// 获取北京时间格式化字符串 (YYYY/M/D HH:mm:ss 格式，用于显示)
function getBeijingTimeString() {
    const beijingTime = getBeijingTime();
    return beijingTime.toLocaleString('zh-CN', { 
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: 'numeric', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).replace(/\//g, '/');
}

// 获取北京时间日期字符串 (YYYY-MM-DD 格式)
function getCurrentBeijingDate() {
    const beijingTime = getBeijingTime();
    // 手动格式化避免时区问题
    const year = beijingTime.getFullYear();
    const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
    const day = String(beijingTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 获取北京时间日期时间字符串 (YYYY-MM-DD HH:MM:SS 格式)
function getCurrentBeijingDateTime() {
    const beijingTime = getBeijingTime();
    // 手动格式化避免时区问题
    const year = beijingTime.getFullYear();
    const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
    const day = String(beijingTime.getDate()).padStart(2, '0');
    const hour = String(beijingTime.getHours()).padStart(2, '0');
    const minute = String(beijingTime.getMinutes()).padStart(2, '0');
    const second = String(beijingTime.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

// 获取N天前的北京时间日期
function getBeijingDateDaysAgo(days) {
    const beijingTime = getBeijingTime();
    beijingTime.setDate(beijingTime.getDate() - days);
    // 手动格式化避免时区问题
    const year = beijingTime.getFullYear();
    const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
    const day = String(beijingTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const app = express();
const PORT = process.env.PORT || 3000;

// API响应处理工具函数
const ApiResponse = {
    success: (res, data = null, message = null) => {
        const response = { success: true };
        if (data !== null) response.data = data;
        if (message !== null) response.message = message;
        res.json(response);
    },
    error: (res, error, statusCode = 500) => {
        console.error('API错误:', error);
        res.status(statusCode).json({
            success: false,
            error: error.message || error
        });
    }
};

// 异步路由错误处理包装器
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 数据库初始化
const db = new sqlite3.Database('electricity.db');

// 创建数据表
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS electricity_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        remaining_amount REAL,
        query_time TEXT,
        is_auto INTEGER DEFAULT 0
    )`);
    
    // 为现有记录添加is_auto列（如果不存在）
    db.run(`ALTER TABLE electricity_records ADD COLUMN is_auto INTEGER DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('添加is_auto列失败:', err.message);
        }
    });
});

// 电费查询配置
const ELECTRICITY_CONFIG = {
    // CAS统一身份认证登录页面
    casLoginUrl: 'http://ids2.just.edu.cn/cas/login?service=http%3A%2F%2F202.195.206.214%2Fepay%2Fj_spring_cas_security_check',
    // 电费查询页面
    electricityUrl: 'http://202.195.206.214/epay/electric/load4electricbill?elcsysid=2',
    building: '学生公寓C14',
    floor: '学生公寓C14四层',
    room: 'C14-418'
};

// Cookie 存储
let authCookies = '';

// 多用户登录状态管理
const userSessions = new Map(); // IP -> 登录会话信息
const MAX_CONCURRENT_USERS = 5; // 最大同时登录用户数

// 多用户认证会话管理 - 每个用户独立的认证会话
const userAuthSessions = new Map(); // IP -> 认证会话信息

// 获取客户端真实IP地址
function getClientIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress || 
           (req.connection.socket ? req.connection.socket.remoteAddress : null) || 
           'unknown';
}

// 清理过期的用户会话（超过24小时未活动）
function cleanupExpiredSessions() {
    const now = Date.now();
    const EXPIRE_TIME = 7 * 24 * 60 * 60 * 1000; // 24小时
    
    for (const [ip, session] of userSessions.entries()) {
        if (now - session.lastActivity > EXPIRE_TIME) {
            userSessions.delete(ip);
            userAuthSessions.delete(ip); // 同时清理认证会话
            console.log(`清理过期会话: ${ip}`);
        }
    }
}

// 获取用户会话
function getUserSession(ip) {
    cleanupExpiredSessions();
    return userSessions.get(ip) || null;
}

// 创建或更新用户会话
function setUserSession(ip, sessionData) {
    cleanupExpiredSessions();
    
    // 如果是新用户且已达到最大用户数限制
    if (!userSessions.has(ip) && userSessions.size >= MAX_CONCURRENT_USERS) {
        // 找到最久未活动的用户并移除
        let oldestIP = null;
        let oldestTime = Date.now();
        
        for (const [userIP, session] of userSessions.entries()) {
            if (session.lastActivity < oldestTime) {
                oldestTime = session.lastActivity;
                oldestIP = userIP;
            }
        }
        
        if (oldestIP) {
            userSessions.delete(oldestIP);
            userAuthSessions.delete(oldestIP); // 同时清理认证会话
            console.log(`达到最大用户数限制，移除最久未活动用户: ${oldestIP}`);
        }
    }
    
    userSessions.set(ip, {
        ...sessionData,
        lastActivity: Date.now()
    });
}

// 删除用户会话
function deleteUserSession(ip) {
    userAuthSessions.delete(ip); // 同时清理认证会话
    return userSessions.delete(ip);
}

// 检查是否有任何用户处于登录状态
function hasAnyLoggedInUser() {
    cleanupExpiredSessions();
    for (const [ip, session] of userSessions.entries()) {
        if (session.isLoggedIn) {
            return true;
        }
    }
    return false;
}

// 用户认证会话管理
const UserAuthSession = {
    // 获取用户的认证会话
    get(userIP) {
        return userAuthSessions.get(userIP) || {
            cookies: '',
            jsessionid: '',
            lastUpdate: null,
            isValid: false
        };
    },
    
    // 保存用户的认证会话
    save(userIP, cookies, jsessionid) {
        const session = {
            cookies: cookies,
            jsessionid: jsessionid,
            lastUpdate: Date.now(),
            isValid: true
        };
        userAuthSessions.set(userIP, session);
        
        const saveTime = new Date(session.lastUpdate).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
        console.log(`用户 ${userIP} 的认证会话已保存，保存时间: ${saveTime}`);
    },
    
    // 使用户的认证会话失效
    invalidate(userIP, silent = false) {
        if (userAuthSessions.has(userIP)) {
            userAuthSessions.delete(userIP);
            if (!silent) {
                console.log(`用户 ${userIP} 的认证会话已失效`);
            }
        }
    },
    
    // 检查用户的认证会话是否有效
    async isSessionValid(userIP) {
        const session = this.get(userIP);
        
        if (!session.cookies) {
            console.log(`用户 ${userIP} 会话信息不完整 - 缺少cookies`);
            return false;
        }
        
        try {
            console.log(`\n正在验证用户 ${userIP} 的会话有效性...`);
            
            // 发送测试请求到电费查询页面
            const testUrl = session.jsessionid ? 
                `http://202.195.206.214/epay/electric/load4electricbill;jsessionid=${session.jsessionid}?elcsysid=2` :
                'http://202.195.206.214/epay/electric/load4electricbill?elcsysid=2';
            
            console.log(`用户 ${userIP} 测试URL: ${testUrl}`);
            
            const testResponse = await axios.get(testUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Cookie': session.cookies,
                    'Referer': 'http://202.195.206.214/epay/'
                },
                timeout: 10000 // 10秒超时
            });

            // 检查响应状态和内容
            if (testResponse.status === 200) {
                const cheerio = require('cheerio');
                const $ = cheerio.load(testResponse.data);
                const title = $('title').text();
                
                console.log(`用户 ${userIP} 测试页面标题: ${title}`);
                
                // 如果页面标题包含"充值页面"或"电费"等关键词，说明会话有效
                if (title.includes('充值页面') || title.includes('电费') || title.includes('一卡通')) {
                    console.log(`✅ 用户 ${userIP} 会话验证通过`);
                    return true;
                } else {
                    console.log(`❌ 用户 ${userIP} 会话验证失败 - 页面标题不匹配: ${title}`);
                    this.invalidate(userIP, true); // 静默失效
                    return false;
                }
            } else {
                console.log(`❌ 用户 ${userIP} 会话验证失败 - HTTP状态: ${testResponse.status}`);
                this.invalidate(userIP, true); // 静默失效
                return false;
            }
            
        } catch (error) {
            console.log(`❌ 用户 ${userIP} 会话验证异常: ${error.message}`);
            this.invalidate(userIP, true); // 静默失效
            return false;
        }
    },
    
    // 获取用户会话保存时间
    getLastUpdateTime(userIP) {
        const session = this.get(userIP);
        if (!session.lastUpdate) {
            return null;
        }
        return new Date(session.lastUpdate).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    }
};

// 直接执行AJAX查询（复用现有会话）
async function performDirectQuery(userIP) {
    console.log(`\n用户 ${userIP} 使用现有会话直接查询电费...`);
    
    const userAuthSession = UserAuthSession.get(userIP);
    const queryUrl = userAuthSession.jsessionid ? 
        `http://202.195.206.214/epay/electric/queryelectricbill;jsessionid=${userAuthSession.jsessionid}` : 
        'http://202.195.206.214/epay/electric/queryelectricbill';

    console.log(`用户 ${userIP} AJAX查询URL: ${queryUrl}`);

    // 构建查询参数
    const queryFormData = new URLSearchParams();
    queryFormData.append('sysid', '2');
    queryFormData.append('roomNo', '4791');
    queryFormData.append('elcarea', '2');
    queryFormData.append('elcbuis', '4708');
    
    console.log('AJAX查询参数:');
    for (const [key, value] of queryFormData.entries()) {
        console.log(`  ${key} = ${value}`);
    }

    // 提交AJAX查询请求
    const queryResponse = await axios.post(queryUrl, queryFormData, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Cookie': userAuthSession.cookies,
            'Referer': userAuthSession.jsessionid ? 
                `http://202.195.206.214/epay/electric/load4electricbill;jsessionid=${userAuthSession.jsessionid}?elcsysid=2` : 
                'http://202.195.206.214/epay/electric/load4electricbill?elcsysid=2',
            'X-Requested-With': 'XMLHttpRequest'
        }
    });

    console.log('AJAX查询响应状态:', queryResponse.status);
    console.log('AJAX查询响应数据:', JSON.stringify(queryResponse.data, null, 2));

    // 解析查询结果
    let remainingAmount = 0;
    
    if (queryResponse.data && typeof queryResponse.data === 'object') {
        const responseData = queryResponse.data;
        
        if (responseData.retcode === 0) {
            if (responseData.restElecDegree !== undefined) {
                remainingAmount = parseFloat(responseData.restElecDegree) || 0;
                console.log(`从AJAX响应中获取到剩余电量: ${remainingAmount} 度`);
            } else {
                console.log('AJAX响应中没有找到restElecDegree字段');
            }
        } else {
            // 可能是会话失效，抛出错误以便重新认证
            if (responseData.retmsg && responseData.retmsg.includes('登录') || responseData.retmsg && responseData.retmsg.includes('认证')) {
                throw new Error('会话已失效，需要重新认证');
            }
            console.log('查询失败，错误信息:', responseData.retmsg || '未知错误');
        }
    } else {
        console.log('响应不是JSON格式，可能会话已失效');
        throw new Error('响应格式异常，可能会话已失效');
    }

    return remainingAmount;
}

// 执行完整的认证流程
async function performFullAuthentication(username = null, password = null, triggerUserIP = null) {
    console.log('\n执行完整认证流程...');
    
    // 如果没有提供用户名密码，从已登录的密码用户中找一个
    if (!username || !password) {
        let foundCredentials = false;
        
        // 遍历用户会话，找到一个使用密码登录的用户
        for (const [userIP, session] of userSessions.entries()) {
            if (session.loginMethod === 'password' && session.username && session.password) {
                username = session.username;
                password = session.password;
                console.log(`使用用户 ${userIP} 的凭据进行重新认证`);
                foundCredentials = true;
                break;
            }
        }
        
        if (!foundCredentials) {
            throw new Error('缺少用户名或密码，无法执行认证');
        }
    }
    
    // 原有的完整认证逻辑（步骤①到⑪）将在这里执行
    // 为了保持代码整洁，我们将把原有的认证逻辑移到这个函数中
    
    // 第一步：直接访问CAS登录页面
    console.log('\n①: 访问CAS登录页面...');
    const casLoginResponse = await axios.get(ELECTRICITY_CONFIG.casLoginUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });

    const $ = cheerio.load(casLoginResponse.data);
    console.log('CAS页面标题:', $('title').text());
    
    // 第二步：提取CAS登录表单的隐藏字段并登录
    console.log('\n②: 提取登录表单字段...');
    const loginFormData = new URLSearchParams();
    loginFormData.append('username', username);
    loginFormData.append('password', password);
    
    // 提取execution、_eventId等隐藏字段
    $('input[type="hidden"]').each((i, elem) => {
        const name = $(elem).attr('name');
        const value = $(elem).attr('value');
        if (name && value) {
            loginFormData.append(name, value);
            console.log(`找到隐藏字段: ${name} = ${value}`);
        }
    });

    // 查找登录表单的action URL
    let loginActionUrl = $('form').attr('action');
    if (loginActionUrl && !loginActionUrl.startsWith('http')) {
        if (loginActionUrl.startsWith('/')) {
            loginActionUrl = 'http://ids2.just.edu.cn' + loginActionUrl;
        } else {
            loginActionUrl = 'http://ids2.just.edu.cn/cas/' + loginActionUrl;
        }
    }
    
    if (!loginActionUrl) {
        loginActionUrl = ELECTRICITY_CONFIG.casLoginUrl;
    }

    console.log(`登录表单URL: ${loginActionUrl}`);

    // 第三步：提交CAS登录表单
    console.log('\n③: 提交CAS登录表单...');
    const casSubmitResponse = await axios.post(loginActionUrl, loginFormData, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': ELECTRICITY_CONFIG.casLoginUrl,
            'Cookie': casLoginResponse.headers['set-cookie'] ? casLoginResponse.headers['set-cookie'].join('; ') : ''
        },
        maxRedirects: 5,
        validateStatus: function (status) {
            return status >= 200 && status < 400; // 接受重定向状态码
        }
    });

    // 检查重定向URL并提取jsessionid
    const finalUrl = casSubmitResponse.request.res.responseUrl || casSubmitResponse.config.url;
    let jsessionid = '';
    const jsessionMatch = finalUrl.match(/jsessionid=([^&?]+)/);
    if (jsessionMatch) {
        jsessionid = jsessionMatch[1];
        console.log(`提取到 jsessionid: ${jsessionid}`);
    }

    // 第四步：保存认证cookies
    console.log('\n④: 保存认证cookies...');
    let allCookies = [];
    if (casLoginResponse.headers['set-cookie']) {
        allCookies = allCookies.concat(casLoginResponse.headers['set-cookie']);
    }
    if (casSubmitResponse.headers['set-cookie']) {
        allCookies = allCookies.concat(casSubmitResponse.headers['set-cookie']);
    }
    
    // 处理cookie格式，只保留cookie值部分
    const cookieMap = new Map();
    allCookies.forEach(cookie => {
        const cookieParts = cookie.split(';')[0].split('=');
        if (cookieParts.length === 2) {
            cookieMap.set(cookieParts[0].trim(), cookieParts[1].trim());
        }
    });
    
    let newAuthCookies = Array.from(cookieMap.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');

    // 如果有jsessionid，添加到cookies中
    if (jsessionid) {
        newAuthCookies += `; JSESSIONID=${jsessionid}`;
    }

    console.log('认证Cookie已保存:', newAuthCookies);

    // 第五步：访问一卡通服务平台首页
    console.log('\n⑤: 访问一卡通服务平台首页...');
    const epayMainUrl = jsessionid ? 
        `http://202.195.206.214/epay/;jsessionid=${jsessionid}` : 
        'http://202.195.206.214/epay/';

    const epayMainResponse = await axios.get(epayMainUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Cookie': newAuthCookies,
            'Referer': 'http://ids2.just.edu.cn/'
        }
    });

    const epayMain$ = cheerio.load(epayMainResponse.data);
    console.log('一卡通首页标题:', epayMain$('title').text());

    // 更新cookies（可能有新的会话信息）
    if (epayMainResponse.headers['set-cookie']) {
        console.log('发现新的会话cookie，正在更新...');
        const newCookies = epayMainResponse.headers['set-cookie'];
        newCookies.forEach(cookie => {
            const cookieParts = cookie.split(';')[0].split('=');
            if (cookieParts.length === 2) {
                cookieMap.set(cookieParts[0].trim(), cookieParts[1].trim());
            }
        });
        
        newAuthCookies = Array.from(cookieMap.entries())
            .map(([name, value]) => `${name}=${value}`)
            .join('; ');
        
        console.log('更新后的认证Cookie:', newAuthCookies);
    }

    // 第六步：访问电费查询页面验证会话
    console.log('\n⑥: 访问电费查询页面...');
    const electricityUrl = jsessionid ? 
        `http://202.195.206.214/epay/electric/load4electricbill;jsessionid=${jsessionid}?elcsysid=2` : 
        ELECTRICITY_CONFIG.electricityUrl;

    const billPageResponse = await axios.get(electricityUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Cookie': newAuthCookies,
            'Referer': 'http://202.195.206.214/epay/'
        }
    });

    const billPage$ = cheerio.load(billPageResponse.data);
    console.log('电费页面标题:', billPage$('title').text());

    // 保存会话状态到指定用户的认证会话管理器
    if (triggerUserIP) {
        UserAuthSession.save(triggerUserIP, newAuthCookies, jsessionid);
    } else {
        // 如果没有指定用户IP，为所有密码登录用户更新认证会话
        for (const [userIP, session] of userSessions.entries()) {
            if (session.loginMethod === 'password' && session.isLoggedIn) {
                UserAuthSession.save(userIP, newAuthCookies, jsessionid);
            }
        }
    }
    
    // 验证会话有效性并执行查询
    console.log('\n⑦: 使用新会话执行查询...');
    const targetUserIP = triggerUserIP || Array.from(userSessions.entries())
        .find(([ip, session]) => session.loginMethod === 'password' && session.isLoggedIn)?.[0];
    
    if (targetUserIP) {
        const remainingAmount = await performDirectQuery(targetUserIP);
        return remainingAmount;
    } else {
        throw new Error('没有找到有效的用户会话');
    }
}

// 模拟登录并获取电费余额
async function queryElectricityBalance(isAutoQuery = true, triggerUserIP = null) {
    try {
        console.log('\n开始查询电费余额...');
        
        let remainingAmount = 0;
        let sessionReused = false;
        let targetUserIP = triggerUserIP;
        
        // 如果是自动查询且没有指定用户IP，找到一个可用的密码登录用户
        if (isAutoQuery && !targetUserIP) {
            cleanupExpiredSessions();
            for (const [ip, session] of userSessions.entries()) {
                if (session.isLoggedIn && session.loginMethod === 'password' && session.username && session.password) {
                    targetUserIP = ip;
                    console.log(`自动查询选择用户: ${ip}`);
                    break;
                }
            }
            
            if (!targetUserIP) {
                throw new Error('没有可用的密码登录用户进行自动查询');
            }
        }
        
        // 如果是手动查询，必须提供用户IP
        if (!isAutoQuery && !targetUserIP) {
            throw new Error('手动查询需要指定用户IP');
        }
        
        // 检查目标用户的认证会话是否有效
        const sessionValid = await UserAuthSession.isSessionValid(targetUserIP);
        
        if (sessionValid) {
            console.log(`\n用户 ${targetUserIP} 会话验证通过，使用现有会话`);
            
            try {
                // 使用现有会话直接查询
                remainingAmount = await performDirectQuery(targetUserIP);
                sessionReused = true;
            } catch (error) {
                console.log(`用户 ${targetUserIP} 会话复用失败:`, error.message);
                
                // 会话失效，清除状态
                UserAuthSession.invalidate(targetUserIP);
                sessionReused = false;
            }
        } else {
            console.log(`\n用户 ${targetUserIP} 会话验证失败或无会话，需要重新认证`);
        }
        
        // 如果会话复用失败或没有有效会话，处理重新认证
        if (!sessionReused) {
            // 寻找可用的密码登录用户进行重新认证
            let passwordUser = null;
            let authUserIP = null;
            
            if (isAutoQuery) {
                // 自动查询时，找任何可用的密码登录用户
                for (const [ip, session] of userSessions.entries()) {
                    if (session.isLoggedIn && session.loginMethod === 'password' && session.username && session.password) {
                        passwordUser = session;
                        authUserIP = ip;
                        break;
                    }
                }
            } else if (targetUserIP) {
                // 手动查询时，使用指定用户的凭据
                const userSession = getUserSession(targetUserIP);
                if (userSession && userSession.loginMethod === 'password' && userSession.username && userSession.password) {
                    passwordUser = userSession;
                    authUserIP = targetUserIP;
                }
            }
            
            if (passwordUser && authUserIP) {
                console.log(`\n用户 ${authUserIP} 使用密码登录凭据进行重新认证...`);
                try {
                    remainingAmount = await performFullAuthentication(passwordUser.username, passwordUser.password, authUserIP);
                    console.log('✅ 重新认证成功');
                } catch (error) {
                    console.log('❌ 重新认证失败:', error.message);
                    throw error;
                }
            } else if (isAutoQuery) {
                console.log('\n自动查询：没有可用的密码登录用户');
                throw new Error('没有可用的密码登录用户进行重新认证');
            } else {
                console.log('\n手动查询：用户会话失效，需要重新登录');
                throw new Error('登录会话已失效，请重新登录');
            }
        }
        
        console.log(`\n最终查询结果 - 剩余电量: ${remainingAmount} 度`);

        // 检查查询结果是否异常并决定是否重新查询
        const shouldRetry = await checkAndHandleAbnormalResult(remainingAmount, isAutoQuery);
        
        if (shouldRetry) {
            console.log('检测到异常数据，5秒后进行重新查询...');
            await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒
            
            // 重新执行查询逻辑（优先使用会话复用）
            console.log('开始重新查询...');
            
            try {
                const retrySessionValid = await UserAuthSession.isSessionValid(targetUserIP);
                if (retrySessionValid) {
                    const retryAmount = await performDirectQuery(targetUserIP);
                    console.log(`重新查询结果: ${retryAmount} 度`);
                    
                    // 如果重新查询的结果也是0或相同的异常值，仍然保存原结果，但标记为可能异常
                    if (retryAmount > 0 && Math.abs(retryAmount - remainingAmount) > 0.1) {
                        console.log(`重新查询结果不同，使用新结果: ${retryAmount} 度`);
                        remainingAmount = retryAmount;
                    } else {
                        console.log('重新查询结果相同，可能确实存在异常，将在前端标记该数据');
                    }
                } else {
                    console.log('会话已失效，无法进行重新查询');
                }
            } catch (retryError) {
                console.log('重新查询失败:', retryError.message);
            }
        }

        // 保存到数据库，根据函数参数判断是否为自动查询
        const queryTime = getCurrentBeijingDateTime();
        const finalIsAuto = isAutoQuery; // 直接使用函数参数判断
        
        // 保存当前查询数据
        db.run('INSERT INTO electricity_records (remaining_amount, query_time, is_auto) VALUES (?, ?, ?)', 
               [remainingAmount, queryTime, finalIsAuto ? 1 : 0],
               function(err) {
                   if (err) {
                       console.error('保存数据失败:', err);
                   } else {
                       const methodText = sessionReused ? '' : ' (重新认证)';
                       console.log(`数据已保存，ID: ${this.lastID}, 查询类型: ${finalIsAuto ? '自动' : '手动'}${methodText}, 时间: ${queryTime}`);
                   }
               });

        return {
            success: true,
            remainingAmount,
            queryTime,
            sessionReused,
            message: remainingAmount >= 0 ? 
                (sessionReused ? '查询成功' : '查询成功 (重新认证)') : 
                '查询完成，但可能需要确认数据准确性'
        };

    } catch (error) {
        console.error('查询电费余额失败:', error.message);
        
        // 如果是认证相关错误，清除对应用户的会话状态
        if (error.message.includes('认证') || error.message.includes('登录') || error.message.includes('会话')) {
            if (triggerUserIP) {
                UserAuthSession.invalidate(triggerUserIP);
            }
        }
        
        if (error.response) {
            console.error('响应状态:', error.response.status);
            console.error('响应头:', error.response.headers);
            console.error('响应数据片段:', error.response.data?.substring(0, 500));
        }
        return {
            success: false,
            error: error.message,
            sessionReused: false,
            message: '查询失败: ' + error.message
        };
    }
}

// 检查查询结果是否异常，并决定是否需要重新查询
async function checkAndHandleAbnormalResult(currentAmount, isAutoQuery) {
    return new Promise((resolve) => {
        // 情况1：如果查询结果为0度，直接重新查询
        if (currentAmount === 0) {
            console.log('⚠️ 检测到查询结果为0度，将进行重新查询');
            resolve(true);
            return;
        }

        // 情况2：检查相比上一次查询是否减少超过1度
        const thirtyMinutesAgo = getBeijingTime();
        thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);
        // 手动格式化避免时区问题
        const year = thirtyMinutesAgo.getFullYear();
        const month = String(thirtyMinutesAgo.getMonth() + 1).padStart(2, '0');
        const day = String(thirtyMinutesAgo.getDate()).padStart(2, '0');
        const hour = String(thirtyMinutesAgo.getHours()).padStart(2, '0');
        const minute = String(thirtyMinutesAgo.getMinutes()).padStart(2, '0');
        const second = String(thirtyMinutesAgo.getSeconds()).padStart(2, '0');
        const thirtyMinutesAgoStr = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
        
        db.get(
            `SELECT remaining_amount, query_time 
             FROM electricity_records 
             WHERE query_time >= ? 
             ORDER BY query_time DESC 
             LIMIT 1`,
            [thirtyMinutesAgoStr],
            (err, row) => {
                if (err) {
                    console.error('查询历史数据失败:', err);
                    resolve(false);
                    return;
                }

                if (row) {
                    const lastAmount = parseFloat(row.remaining_amount);
                    const decrease = lastAmount - currentAmount;
                    
                    console.log(`上次查询(${row.query_time}): ${lastAmount}度, 本次查询: ${currentAmount}度, 减少量: ${decrease.toFixed(3)}度`);
                    
                    // 如果减少量大于1度，进行重新查询
                    if (decrease > 1.0) {
                        console.log(`⚠️ 检测到异常减少量 ${decrease.toFixed(3)}度 (>1度)，将进行重新查询`);
                        resolve(true);
                        return;
                    }
                }
                
                resolve(false);
            }
        );
    });
}

// 创建数据备份
function createDataBackup() {
    // 使用北京时间格式 yyyy-mm-dd hh:mm:ss
    const timestamp = getCurrentBeijingDateTime().replace(/[: ]/g, '-');
    
    return new Promise((resolve, reject) => {
        const backupSql = `
            CREATE TABLE IF NOT EXISTS electricity_records_backup_${timestamp.replace(/-/g, '_')} AS 
            SELECT * FROM electricity_records;
        `;
        
        db.run(backupSql, (err) => {
            if (err) {
                console.error('创建数据备份失败:', err);
                reject(err);
            } else {
                console.log(`\n数据备份已创建: electricity_records_backup_${timestamp.replace(/-/g, '_')}`);
                resolve(timestamp.replace(/-/g, '_'));
            }
        });
    });
}

// 获取所有备份表列表
function listBackupTables() {
    return new Promise((resolve, reject) => {
        const sql = "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'electricity_records_backup_%' ORDER BY name DESC";
        
        db.all(sql, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                const backups = rows.map(row => {
                    const name = row.name;
                    // 从表名中提取时间戳
                    const timestampMatch = name.match(/backup_(.+)$/);
                    let timestamp = '';
                    let displayName = '';
                    if (timestampMatch) {
                        const rawTimestamp = timestampMatch[1];
                        // 处理新格式 yyyy-mm-dd-hh-mm-ss
                        if (rawTimestamp.match(/^\d{4}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}$/)) {
                            // 新格式：2025_01_15_14_30_25 -> 2025-01-15 14:30:25
                            timestamp = rawTimestamp.replace(/(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})/, '$1-$2-$3 $4:$5:$6');
                            displayName = `${timestamp}`;
                        } else {
                            // 旧格式处理
                            timestamp = rawTimestamp.replace(/_/g, '-').replace(/-(\d{2})-(\d{2})-(\d{3})Z$/, ':$1:$2.$3Z');
                            displayName = timestamp;
                        }
                    }
                    return {
                        tableName: name,
                        timestamp: timestamp,
                        displayName: displayName || name
                    };
                });
                resolve(backups);
            }
        });
    });
}

// 从备份表恢复数据
async function restoreFromBackup(backupTableName) {
    return new Promise((resolve, reject) => {
        console.log(`\n=== 开始从备份恢复数据 ===`);
        console.log(`备份来源: ${backupTableName}`);
        
        // 首先检查备份表是否存在
        const checkBackupSql = "SELECT name FROM sqlite_master WHERE type='table' AND name = ?";
        
        db.get(checkBackupSql, [backupTableName], (err, row) => {
            if (err) {
                console.error('检查备份表失败:', err);
                reject(err);
                return;
            }
            
            if (!row) {
                const error = new Error(`备份来源 ${backupTableName} 不存在`);
                console.error(error.message);
                reject(error);
                return;
            }
            
            // 创建当前数据的备份（在恢复之前）
            createDataBackup().then(currentBackupName => {
                console.log(`当前数据备份为: electricity_records_backup_${currentBackupName}`);
                
                // 清空当前主表
                db.run('DELETE FROM electricity_records', [], function(deleteErr) {
                    if (deleteErr) {
                        console.error('清空主表失败:', deleteErr);
                        reject(deleteErr);
                        return;
                    }
                    
                    console.log(`已清空主表，删除了 ${this.changes} 条记录`);
                    
                    // 从备份表恢复数据
                    const restoreSQL = `
                        INSERT INTO electricity_records (id, timestamp, remaining_amount, query_time, is_auto)
                        SELECT id, timestamp, remaining_amount, query_time, is_auto 
                        FROM ${backupTableName}
                    `;
                    
                    db.run(restoreSQL, [], function(restoreErr) {
                        if (restoreErr) {
                            console.error('恢复数据失败:', restoreErr);
                            reject(restoreErr);
                            return;
                        }
                        
                        console.log(`成功恢复 ${this.changes} 条记录`);
                        
                        // 验证恢复结果
                        db.get('SELECT COUNT(*) as count FROM electricity_records', [], (countErr, countRow) => {
                            if (countErr) {
                                console.error('验证恢复结果失败:', countErr);
                                reject(countErr);
                                return;
                            }
                            
                            console.log(`\n=== 数据恢复完成 ===`);
                            console.log(`恢复的记录数: ${countRow.count}`);
                            console.log(`备份来源: ${backupTableName}`);
                            console.log(`当前数据备份: electricity_records_backup_${currentBackupName}`);
                            console.log(`===================\n`);
                            
                            // 将备份名称转换为显示格式
                            const displayBackupName = currentBackupName.replace(/(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})/, '$1-$2-$3 $4:$5:$6');
                            
                            resolve({
                                success: true,
                                restoredCount: this.changes,
                                totalRecords: countRow.count,
                                backupTable: backupTableName,
                                currentDataBackup: displayBackupName
                            });
                        });
                    });
                });
            }).catch(backupErr => {
                console.error('创建当前数据备份失败:', backupErr);
                reject(backupErr);
            });
        });
    });
}

// 清理超过指定天数的旧备份
async function cleanupOldBackups(retentionDays = 14) {
    return new Promise((resolve, reject) => {
        console.log(`\n=== 开始清理超过 ${retentionDays} 天的旧备份 ===`);
        
        // 计算截止日期 - 使用北京时间
        const beijingTime = getBeijingTime();
        beijingTime.setDate(beijingTime.getDate() - retentionDays);
        // 手动格式化时间戳，避免时区问题
        const year = beijingTime.getFullYear();
        const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
        const day = String(beijingTime.getDate()).padStart(2, '0');
        const hour = String(beijingTime.getHours()).padStart(2, '0');
        const minute = String(beijingTime.getMinutes()).padStart(2, '0');
        const second = String(beijingTime.getSeconds()).padStart(2, '0');
        const cutoffTimestamp = `${year}_${month}_${day}_${hour}_${minute}_${second}`;
        
        console.log(`截止日期: ${beijingTime.toLocaleDateString('zh-CN')} (${cutoffTimestamp})`);
        
        // 获取所有备份表
        listBackupTables().then(backups => {
            if (backups.length === 0) {
                resolve({
                    success: true,
                    message: '没有找到备份表',
                    deletedCount: 0,
                    totalBackups: 0
                });
                return;
            }
            
            // 筛选出需要删除的旧备份
            const backupsToDelete = backups.filter(backup => {
                // 从表名中提取时间戳
                const timestampMatch = backup.tableName.match(/backup_(.+)$/);
                if (!timestampMatch) {
                    return false; // 无法解析时间戳，保留
                }
                
                const backupTimestamp = timestampMatch[1];
                
                // 比较时间戳（字符串比较对于格式化的时间戳是有效的）
                return backupTimestamp < cutoffTimestamp;
            });
            
            if (backupsToDelete.length === 0) {
                resolve({
                    success: true,
                    message: `所有 ${backups.length} 个备份都在保留期内，无需删除`,
                    deletedCount: 0,
                    totalBackups: backups.length
                });
                return;
            }
            
            console.log(`找到 ${backupsToDelete.length} 个需要删除的旧备份，总备份数: ${backups.length}`);
            
            // 删除旧备份
            let deletedCount = 0;
            let errorCount = 0;
            const deletePromises = backupsToDelete.map(backup => {
                return new Promise((deleteResolve) => {
                    const dropSql = `DROP TABLE ${backup.tableName}`;
                    db.run(dropSql, [], (err) => {
                        if (err) {
                            console.error(`删除备份表失败 (${backup.tableName}):`, err.message);
                            errorCount++;
                        } else {
                            console.log(`已删除旧备份: ${backup.tableName} (${backup.displayName})`);
                            deletedCount++;
                        }
                        deleteResolve();
                    });
                });
            });
            
            // 等待所有删除操作完成
            Promise.all(deletePromises).then(() => {
                const remainingBackups = backups.length - deletedCount;
                const message = `清理完成: 删除了 ${deletedCount} 个旧备份，保留 ${remainingBackups} 个备份`;
                
                if (errorCount > 0) {
                    console.warn(`清理过程中有 ${errorCount} 个删除操作失败`);
                }
                
                console.log(`=== 备份清理完成 ===\n`);
                
                resolve({
                    success: deletedCount > 0 || errorCount === 0,
                    message: message,
                    deletedCount: deletedCount,
                    errorCount: errorCount,
                    totalBackups: backups.length,
                    remainingBackups: remainingBackups,
                    retentionDays: retentionDays
                });
            });
            
        }).catch(err => {
            console.error('获取备份列表失败:', err);
            reject(err);
        });
    });
}

// API 路由

// 获取备份列表
app.get('/api/backups', asyncHandler(async (req, res) => {
    const backups = await listBackupTables();
    ApiResponse.success(res, { backups });
}));

// 手动创建备份
app.post('/api/create-backup', asyncHandler(async (req, res) => {
    const backupId = await createDataBackup();
    ApiResponse.success(res, { backupId }, '手动备份创建成功');
}));

// 从备份恢复数据
app.post('/api/restore', async (req, res) => {
    const { backupTableName } = req.body;
    
    if (!backupTableName) {
        return res.status(400).json({
            success: false,
            error: '请提供备份来源'
        });
    }
    
    try {
        const result = await restoreFromBackup(backupTableName);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 删除选中的备份
app.delete('/api/backups', async (req, res) => {
    const { backupTableNames } = req.body;
    
    if (!backupTableNames || !Array.isArray(backupTableNames) || backupTableNames.length === 0) {
        return res.status(400).json({
            success: false,
            error: '请提供要删除的备份表名称'
        });
    }
    
    try {
        const results = [];
        let successCount = 0;
        let errorCount = 0;
        
        for (const tableName of backupTableNames) {
            try {
                // 检查表是否存在
                const checkSql = "SELECT name FROM sqlite_master WHERE type='table' AND name = ?";
                const tableExists = await new Promise((resolve, reject) => {
                    db.get(checkSql, [tableName], (err, row) => {
                        if (err) reject(err);
                        else resolve(!!row);
                    });
                });
                
                if (!tableExists) {
                    results.push({
                        tableName: tableName,
                        success: false,
                        error: '备份表不存在'
                    });
                    errorCount++;
                    continue;
                }
                
                // 删除备份表
                const dropSql = `DROP TABLE ${tableName}`;
                await new Promise((resolve, reject) => {
                    db.run(dropSql, [], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                
                results.push({
                    tableName: tableName,
                    success: true,
                    message: '删除成功'
                });
                successCount++;
                console.log(`备份表已删除: ${tableName}`);
                
            } catch (error) {
                results.push({
                    tableName: tableName,
                    success: false,
                    error: error.message
                });
                errorCount++;
                console.error(`删除备份表失败 (${tableName}):`, error.message);
            }
        }
        
        res.json({
            success: successCount > 0,
            message: `删除完成: 成功 ${successCount} 个，失败 ${errorCount} 个`,
            successCount: successCount,
            errorCount: errorCount,
            results: results
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 清理旧备份
app.post('/api/cleanup-backups', async (req, res) => {
    try {
        const { retentionDays = 14 } = req.body;
        
        // 验证参数
        if (typeof retentionDays !== 'number' || retentionDays < 1 || retentionDays > 365) {
            return res.status(400).json({
                success: false,
                error: '保留天数必须是1-365之间的数字'
            });
        }
        
        const result = await cleanupOldBackups(retentionDays);
        res.json(result);
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取会话状态
app.get('/api/session-status', async (req, res) => {
    const clientIP = getClientIP(req);
    const userSession = getUserSession(clientIP);
    
    if (userSession && userSession.isLoggedIn) {
        const isValid = await UserAuthSession.isSessionValid(clientIP);
        const authSession = UserAuthSession.get(clientIP);
        
        res.json({
            isValid: isValid,
            lastUpdate: UserAuthSession.getLastUpdateTime(clientIP),
            hasSession: !!authSession.cookies,
            jsessionid: authSession.jsessionid ? 'xxx...' + authSession.jsessionid.slice(-8) : null
        });
    } else {
        res.json({
            isValid: false,
            lastUpdate: null,
            hasSession: false,
            jsessionid: null
        });
    }
});

// 手动清除会话
app.post('/api/clear-session', (req, res) => {
    const clientIP = getClientIP(req);
    UserAuthSession.invalidate(clientIP);
    deleteUserSession(clientIP);
    
    res.json({
        success: true,
        message: '会话已清除'
    });
});

// 全局查询时间管理（所有用户共享30秒间隔）
let lastGlobalQueryTime = 0;

// 登录相关API

// 检查登录状态
app.get('/api/login-status', (req, res) => {
    const clientIP = getClientIP(req);
    const userSession = getUserSession(clientIP);
    
    if (userSession && userSession.isLoggedIn) {
        // 更新最后活动时间
        setUserSession(clientIP, userSession);
        
        res.json({
            isLoggedIn: true,
            loginTime: userSession.loginTime,
            loginMethod: userSession.loginMethod
        });
    } else {
        res.json({
            isLoggedIn: false,
            loginTime: null,
            loginMethod: null
        });
    }
});

// 获取二维码登录URL
app.get('/api/qrcode-login', async (req, res) => {
    try {
        // 访问CAS登录页面获取登录token
        const casResponse = await axios.get(ELECTRICITY_CONFIG.casLoginUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        // 从JavaScript代码中提取loginLT和qrCodeUrl
        const htmlContent = casResponse.data;
        
        // 使用正则表达式提取loginLT
        const loginLTMatch = htmlContent.match(/var\s+qrCodeUrl\s*=\s*"[^"]*loginLT=([^"&]+)/);
        
        if (!loginLTMatch || !loginLTMatch[1]) {
            return res.status(500).json({
                success: false,
                error: '无法从页面中提取登录token'
            });
        }
        
        const loginLT = loginLTMatch[1];
        
        // 构造完整的二维码URL
        const qrCodeUrl = `http://ids2.just.edu.cn/cas/generateQRCode?loginLT=${loginLT}`;
        
        console.log('获取到新的二维码URL:', qrCodeUrl);
        
        res.json({
            success: true,
            qrCodeUrl: qrCodeUrl,
            loginLT: loginLT
        });
        
    } catch (error) {
        console.error('获取二维码失败:', error);
        res.status(500).json({
            success: false,
            error: `获取二维码失败: ${error.message}`
        });
    }
});

// 检查二维码登录状态
app.post('/api/check-qrcode-login', async (req, res) => {
    try {
        const { loginLT } = req.body;
        const clientIP = getClientIP(req);
        
        if (!loginLT) {
            return res.status(400).json({
                success: false,
                error: '缺少登录token'
            });
        }
        
        // 检查二维码登录状态 - 使用POST请求调用analogLogin接口
        const checkUrl = `http://ids2.just.edu.cn/cas/analogLogin?loginLT=${loginLT}`;
        
        const checkResponse = await axios.post(checkUrl, {}, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            maxRedirects: 0, // 不自动跟随重定向
            validateStatus: function (status) {
                return status >= 200 && status < 400; // 接受重定向状态码
            }
        });
        
        console.log('二维码登录检查响应状态:', checkResponse.status);
        console.log('二维码登录检查响应数据:', checkResponse.data);
        console.log('二维码登录检查响应头:', checkResponse.headers.location);
        console.log('二维码登录检查响应cookies:', checkResponse.headers['set-cookie']);
        
        // 检查登录结果
        // 根据CAS系统的返回值判断登录状态
        if (checkResponse.data === "success") {
            // 登录成功，需要获取登录后的cookie
            console.log('✅ 扫码登录成功！CAS返回success');
            
            try {
                // 扫码登录成功后，执行完整认证流程获取电费系统的jsessionid
                console.log('扫码登录成功，执行完整认证流程获取电费系统会话...');
                
                // 等待1秒让CAS系统同步扫码登录状态
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // 检查扫码登录接口返回的cookies
                let initialCookies = '';
                if (checkResponse.headers['set-cookie']) {
                    console.log('扫码登录接口返回的cookies:', checkResponse.headers['set-cookie']);
                    const cookieParts = checkResponse.headers['set-cookie']
                        .map(cookie => cookie.split(';')[0])
                        .join('; ');
                    initialCookies = cookieParts;
                    console.log('处理后的初始cookies:', initialCookies);
                }
                
                // 第一步：以认证状态访问CAS登录页面，这应该会重定向到电费系统
                const casAuthResponse = await axios.get(ELECTRICITY_CONFIG.casLoginUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Cookie': initialCookies // 使用扫码登录获取的cookies
                    },
                    maxRedirects: 5,
                    validateStatus: function (status) {
                        return status >= 200 && status < 400;
                    }
                });
                
                console.log('CAS认证响应状态:', casAuthResponse.status);
                
                // 检查是否被重定向到了电费系统（说明已经有有效的CAS会话）
                const finalUrl = casAuthResponse.request.res.responseUrl || casAuthResponse.config.url;
                console.log('最终重定向URL:', finalUrl);
                
                let jsessionid = '';
                const jsessionMatch = finalUrl.match(/jsessionid=([^&?]+)/);
                if (jsessionMatch) {
                    jsessionid = jsessionMatch[1];
                    console.log(`从重定向URL提取到 jsessionid: ${jsessionid}`);
                }
                
                // 收集所有cookies
                let allCookies = [];
                if (casAuthResponse.headers['set-cookie']) {
                    allCookies = allCookies.concat(casAuthResponse.headers['set-cookie']);
                }
                
                // 处理cookie格式
                const cookieMap = new Map();
                allCookies.forEach(cookie => {
                    const cookieParts = cookie.split(';')[0].split('=');
                    if (cookieParts.length === 2) {
                        cookieMap.set(cookieParts[0].trim(), cookieParts[1].trim());
                    }
                });
                
                let newAuthCookies = Array.from(cookieMap.entries())
                    .map(([name, value]) => `${name}=${value}`)
                    .join('; ');

                // 如果有jsessionid，添加到cookies中
                if (jsessionid) {
                    newAuthCookies += `; JSESSIONID=${jsessionid}`;
                }

                console.log('扫码登录初步Cookie:', newAuthCookies);
                
                // 第二步：如果没有被直接重定向到电费系统，访问一卡通服务平台首页
                if (!finalUrl.includes('202.195.206.214')) {
                    console.log('访问一卡通服务平台首页获取电费系统会话...');
                    const epayMainUrl = jsessionid ? 
                        `http://202.195.206.214/epay/;jsessionid=${jsessionid}` : 
                        'http://202.195.206.214/epay/';

                    const epayMainResponse = await axios.get(epayMainUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                            'Cookie': newAuthCookies,
                            'Referer': 'http://ids2.just.edu.cn/'
                        }
                    });

                    console.log('一卡通首页响应状态:', epayMainResponse.status);
                    
                    // 更新cookies（可能有新的会话信息）
                    if (epayMainResponse.headers['set-cookie']) {
                        console.log('发现新的会话cookie，正在更新...');
                        const newCookies = epayMainResponse.headers['set-cookie'];
                        newCookies.forEach(cookie => {
                            const cookieParts = cookie.split(';')[0].split('=');
                            if (cookieParts.length === 2) {
                                cookieMap.set(cookieParts[0].trim(), cookieParts[1].trim());
                            }
                        });
                        
                        newAuthCookies = Array.from(cookieMap.entries())
                            .map(([name, value]) => `${name}=${value}`)
                            .join('; ');
                        
                        if (jsessionid) {
                            newAuthCookies += `; JSESSIONID=${jsessionid}`;
                        }
                        
                        console.log('更新后的认证Cookie:', newAuthCookies);
                    }
                }

                // 第三步：尝试直接访问电费查询页面验证会话
                console.log('验证电费系统会话...');
                const electricityUrl = jsessionid ? 
                    `http://202.195.206.214/epay/electric/load4electricbill;jsessionid=${jsessionid}?elcsysid=2` : 
                    'http://202.195.206.214/epay/electric/load4electricbill?elcsysid=2';

                const billPageResponse = await axios.get(electricityUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Cookie': newAuthCookies,
                        'Referer': 'http://202.195.206.214/epay/'
                    }
                });

                const cheerio = require('cheerio');
                const billPage$ = cheerio.load(billPageResponse.data);
                const pageTitle = billPage$('title').text();
                console.log('电费页面标题:', pageTitle);

                // 如果仍然被重定向到登录页面，说明扫码登录的CAS会话无效，需要等待
                if (pageTitle.includes('登录') || pageTitle.includes('认证')) {
                    console.log('❌ CAS会话可能还未完全生效，扫码登录会话验证失败');
                    res.json({
                        success: false,
                        message: '扫码登录处理中，请稍后重试...'
                    });
                    return;
                }

                // 获取客户端IP
                const clientIP = getClientIP(req);
                
                // 保存会话状态到该用户的认证会话管理器
                UserAuthSession.save(clientIP, newAuthCookies, jsessionid);
                
                // 电费页面可以正常访问，说明会话有效，直接标记登录成功
                console.log('✅ 扫码登录成功，电费页面可正常访问');
                
                // 登录成功，更新登录状态
                setUserSession(clientIP, {
                    isLoggedIn: true,
                    loginTime: getCurrentBeijingDateTime(),
                    loginMethod: 'qrcode',
                    username: null,
                    password: null
                });
                
                res.json({
                    success: true,
                    message: '扫码登录成功'
                });
                
                // 登录成功后执行一次查询
                setTimeout(async () => {
                    const timeString = getBeijingTimeString();
                    console.log(`\n=== 用户扫码登录成功，执行查询 ${timeString} ===`);
                    await queryElectricityBalance(true, clientIP);
                    
                    const endTimeString = getBeijingTimeString();
                    console.log(`=== ${endTimeString} 查询结束 ===\n`);
                }, 1000);
                
            } catch (sessionError) {
                console.error('获取扫码登录会话失败:', sessionError.message);
                res.json({
                    success: false,
                    message: '登录验证失败，请重试'
                });
            }
            
        } else if (checkResponse.data === "userlimit") {
            res.json({
                success: false,
                message: '用户登录受限，请稍后重试'
            });
        } else if (checkResponse.status === 302 && checkResponse.headers.location) {
            // 如果返回302重定向到包含ticket的URL，也说明登录成功
            const redirectLocation = checkResponse.headers.location;
            console.log('检测到重定向URL:', redirectLocation);
            
            if (redirectLocation.includes('ticket=ST-') || redirectLocation.includes('?ticket=')) {
                console.log('✅ 扫码登录成功！重定向URL包含ticket');
                
                try {
                    // 跟随重定向获取最终的会话状态
                    const redirectResponse = await axios.get(redirectLocation, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        },
                        maxRedirects: 5,
                        validateStatus: function (status) {
                            return status >= 200 && status < 400;
                        }
                    });
                    
                    // 检查重定向URL并提取jsessionid
                    const finalUrl = redirectResponse.request.res.responseUrl || redirectResponse.config.url;
                    let jsessionid = '';
                    const jsessionMatch = finalUrl.match(/jsessionid=([^&?]+)/);
                    if (jsessionMatch) {
                        jsessionid = jsessionMatch[1];
                        console.log(`从重定向提取到 jsessionid: ${jsessionid}`);
                    }
                    
                    // 保存认证cookies
                    let allCookies = [];
                    if (checkResponse.headers['set-cookie']) {
                        allCookies = allCookies.concat(checkResponse.headers['set-cookie']);
                    }
                    if (redirectResponse.headers['set-cookie']) {
                        allCookies = allCookies.concat(redirectResponse.headers['set-cookie']);
                    }
                    
                    // 处理cookie格式
                    const cookieMap = new Map();
                    allCookies.forEach(cookie => {
                        const cookieParts = cookie.split(';')[0].split('=');
                        if (cookieParts.length === 2) {
                            cookieMap.set(cookieParts[0].trim(), cookieParts[1].trim());
                        }
                    });
                    
                    let newAuthCookies = Array.from(cookieMap.entries())
                        .map(([name, value]) => `${name}=${value}`)
                        .join('; ');

                    // 如果有jsessionid，添加到cookies中
                    if (jsessionid) {
                        newAuthCookies += `; JSESSIONID=${jsessionid}`;
                    }

                    console.log('重定向登录认证Cookie已保存:', newAuthCookies);

                    // 获取客户端IP
                    const clientIP = getClientIP(req);
                    
                    // 保存会话状态到该用户的认证会话管理器
                    UserAuthSession.save(clientIP, newAuthCookies, jsessionid);
                    
                    // 验证会话有效性
                    const sessionValid = await UserAuthSession.isSessionValid(clientIP);
                    
                    if (sessionValid) {
                        const clientIP = getClientIP(req);
                        
                        // 设置用户会话状态
                        setUserSession(clientIP, {
                            isLoggedIn: true,
                            loginTime: getCurrentBeijingDateTime(),
                            loginMethod: 'qrcode',
                            lastActivity: new Date()
                        });
                        
                        res.json({
                            success: true,
                            message: '扫码登录成功'
                        });
                        
                        setTimeout(async () => {
                            console.log('\n=== 用户扫码登录成功，执行查询 ===');
                            await queryElectricityBalance(true, clientIP);
                        }, 1000);
                    } else {
                        console.log('重定向登录会话验证失败');
                        // 注意：不需要再次调用 invalidate()，因为 isSessionValid() 已经调用过了
                        res.json({
                            success: false,
                            message: '登录验证失败，请重试'
                        });
                    }
                    
                } catch (redirectError) {
                    console.error('处理重定向登录失败:', redirectError.message);
                    res.json({
                        success: false,
                        message: '登录验证失败，请重试'
                    });
                }
            } else {
                res.json({
                    success: false,
                    message: '等待扫码确认...'
                });
            }
        } else {
            res.json({
                success: false,
                message: '等待扫码确认...'
            });
        }
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: `检查登录状态失败: ${error.message}`
        });
    }
});

// 账户密码登录
app.post('/api/password-login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const clientIP = getClientIP(req);
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: '用户名和密码不能为空'
            });
        }
        
        // 通过CAS系统验证用户名和密码
        try {
            console.log('\n=== 开始密码登录验证 ===');
            
            // 第一步：访问CAS登录页面
            console.log('①: 访问CAS登录页面...');
            const casLoginResponse = await axios.get(ELECTRICITY_CONFIG.casLoginUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            const $ = cheerio.load(casLoginResponse.data);
            console.log('CAS页面标题:', $('title').text());
            
            // 第二步：提取CAS登录表单的隐藏字段
            console.log('②: 提取登录表单字段...');
            const loginFormData = new URLSearchParams();
            loginFormData.append('username', username);
            loginFormData.append('password', password);
            
            // 提取execution、_eventId等隐藏字段
            $('input[type="hidden"]').each((i, elem) => {
                const name = $(elem).attr('name');
                const value = $(elem).attr('value');
                if (name && value) {
                    loginFormData.append(name, value);
                    console.log(`找到隐藏字段: ${name} = ${value}`);
                }
            });

            // 查找登录表单的action URL
            let loginActionUrl = $('form').attr('action');
            if (loginActionUrl && !loginActionUrl.startsWith('http')) {
                if (loginActionUrl.startsWith('/')) {
                    loginActionUrl = 'http://ids2.just.edu.cn' + loginActionUrl;
                } else {
                    loginActionUrl = 'http://ids2.just.edu.cn/cas/' + loginActionUrl;
                }
            }
            
            if (!loginActionUrl) {
                loginActionUrl = ELECTRICITY_CONFIG.casLoginUrl;
            }

            console.log(`登录表单URL: ${loginActionUrl}`);

            // 第三步：提交CAS登录表单
            console.log('③: 提交CAS登录表单...');
            const casSubmitResponse = await axios.post(loginActionUrl, loginFormData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Referer': ELECTRICITY_CONFIG.casLoginUrl,
                    'Cookie': casLoginResponse.headers['set-cookie'] ? casLoginResponse.headers['set-cookie'].join('; ') : ''
                },
                maxRedirects: 5,
                validateStatus: function (status) {
                    return status >= 200 && status < 400; // 接受重定向状态码
                }
            });

            // 检查重定向URL并提取jsessionid
            const finalUrl = casSubmitResponse.request.res.responseUrl || casSubmitResponse.config.url;
            let jsessionid = '';
            const jsessionMatch = finalUrl.match(/jsessionid=([^&?]+)/);
            if (jsessionMatch) {
                jsessionid = jsessionMatch[1];
                console.log(`提取到 jsessionid: ${jsessionid}`);
            }

            // 第四步：保存认证cookies
            console.log('④: 保存认证cookies...');
            let allCookies = [];
            if (casLoginResponse.headers['set-cookie']) {
                allCookies = allCookies.concat(casLoginResponse.headers['set-cookie']);
            }
            if (casSubmitResponse.headers['set-cookie']) {
                allCookies = allCookies.concat(casSubmitResponse.headers['set-cookie']);
            }
            
            // 处理cookie格式，只保留cookie值部分
            const cookieMap = new Map();
            allCookies.forEach(cookie => {
                const cookieParts = cookie.split(';')[0].split('=');
                if (cookieParts.length === 2) {
                    cookieMap.set(cookieParts[0].trim(), cookieParts[1].trim());
                }
            });
            
            let newAuthCookies = Array.from(cookieMap.entries())
                .map(([name, value]) => `${name}=${value}`)
                .join('; ');

            // 如果有jsessionid，添加到cookies中
            if (jsessionid) {
                newAuthCookies += `; JSESSIONID=${jsessionid}`;
            }

            console.log('认证Cookie已保存:', newAuthCookies);

            // 保存会话状态到该用户的认证会话管理器
            UserAuthSession.save(clientIP, newAuthCookies, jsessionid);
            
            // 验证会话有效性
            const sessionValid = await UserAuthSession.isSessionValid(clientIP);
            
            if (sessionValid) {
                // 登录成功，更新登录状态并保存用户凭据
                const clientIP = getClientIP(req);
                setUserSession(clientIP, {
                    isLoggedIn: true,
                    loginTime: getCurrentBeijingDateTime(),
                    loginMethod: 'password',
                    username: username,
                    password: password
                });
                
                console.log('✅ 密码登录成功！');
                
                res.json({
                    success: true,
                    message: '密码登录成功'
                });
                
                // 登录成功后执行一次查询
                setTimeout(async () => {
                    const timeString = getBeijingTimeString();
                    console.log(`\n=== 用户密码登录成功，执行查询 ${timeString} ===`);
                    await queryElectricityBalance(true, clientIP);
                    
                    const endTimeString = getBeijingTimeString();
                    console.log(`=== ${endTimeString} 查询结束 ===\n`);
                }, 1000);
                
            } else {
                // 会话验证失败，说明用户名或密码错误
                // 注意：不需要再次调用 invalidate()，因为 isSessionValid() 已经调用过了
                res.status(401).json({
                    success: false,
                    error: '用户名或密码错误'
                });
            }
            
        } catch (authError) {
            console.error('CAS认证失败:', authError.message);
            
            // 检查是否是认证失败的错误
            if (authError.response && authError.response.status === 401) {
                res.status(401).json({
                    success: false,
                    error: '用户名或密码错误'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: '登录验证失败，请稍后重试'
                });
            }
        }
        
    } catch (error) {
        console.error('密码登录失败:', error.message);
        res.status(500).json({
            success: false,
            error: `登录失败: ${error.message}`
        });
    }
});

// 登出
app.post('/api/logout', (req, res) => {
    const clientIP = getClientIP(req);
    deleteUserSession(clientIP);
    
    res.json({
        success: true,
        message: '已退出登录'
    });
});

// 手动查询电费余额（需要登录）
app.get('/api/query', async (req, res) => {
    try {
        // 获取客户端IP地址
        const clientIP = getClientIP(req);
        const userSession = getUserSession(clientIP);
        
        // 检查登录状态
        if (!userSession || !userSession.isLoggedIn) {
            return res.status(401).json({
                success: false,
                error: '请先登录'
            });
        }
        
        // 检查会话有效性
        const sessionValid = await UserAuthSession.isSessionValid(clientIP);
        
        if (!sessionValid) {
            // 会话失效，清除登录状态，提示重新登录
            deleteUserSession(clientIP);
            
            return res.status(401).json({
                success: false,
                error: '登录已过期，请重新登录'
            });
        }
        
        // 检查全局30秒限制（所有用户共享）
        const now = Date.now();
        const timeSinceLastQuery = now - lastGlobalQueryTime;
        
        if (timeSinceLastQuery < 30000) {
            const remainingTime = Math.ceil((30000 - timeSinceLastQuery) / 1000);
            return res.status(429).json({
                success: false,
                error: `查询过于频繁，请等待 ${remainingTime} 秒后再试`,
                remainingTime: remainingTime
            });
        }
        
        // 记录本次查询时间
        lastGlobalQueryTime = now;
        
        // 更新用户最后活动时间
        setUserSession(clientIP, userSession);
        
        // 使用统一的查询函数进行查询
        try {
            // 添加手动查询开始时间提示
            const startTimeString = getBeijingTimeString();
            console.log(`\n=== ${startTimeString} 执行手动查询 ===`);
            
            const queryResult = await queryElectricityBalance(false, clientIP); // false表示手动查询，传入用户IP
            
            // 添加手动查询结束时间提示
            const endTimeString = getBeijingTimeString();
            console.log(`=== ${endTimeString} 查询结束 ===\n`);
            
            if (queryResult.success) {
                const result = {
                    success: true,
                    remainingAmount: queryResult.remainingAmount,
                    queryTime: queryResult.queryTime,
                    message: queryResult.message
                };
                
                res.json(result);
            } else {
                res.status(500).json({
                    success: false,
                    error: queryResult.message || '查询失败'
                });
            }
            
        } catch (queryError) {
            console.error('查询失败:', queryError.message);
            
            // 如果是会话相关错误，清除登录状态
            if (queryError.message.includes('会话') || queryError.message.includes('认证') || queryError.message.includes('登录')) {
                deleteUserSession(clientIP);
                UserAuthSession.invalidate(clientIP);
                
                return res.status(401).json({
                    success: false,
                    error: '登录已过期，请重新登录'
                });
            }
            
            res.status(500).json({ 
                success: false, 
                error: queryError.message 
            });
        }
        
    } catch (error) {
        console.error('查询API错误:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 获取历史记录 - 支持按天查看和每天的所有查询记录
app.get('/api/history', (req, res) => {
    const days = parseInt(req.query.days) || 7;
    const viewType = req.query.type || 'summary'; // 'summary' 或 'detailed'
    
    if (viewType === 'detailed') {
        // 详细模式：返回每天的所有查询记录
        const startDate = getBeijingDateDaysAgo(days);
        const sql = `
            SELECT 
                remaining_amount,
                query_time,
                timestamp,
                DATE(query_time) as date
            FROM electricity_records 
            WHERE DATE(query_time) >= ?
            ORDER BY timestamp DESC
        `;
        
        db.all(sql, [startDate], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                // 按日期分组
                const groupedByDate = {};
                rows.forEach(row => {
                    if (!groupedByDate[row.date]) {
                        groupedByDate[row.date] = [];
                    }
                    groupedByDate[row.date].push({
                        remaining_amount: row.remaining_amount,
                        query_time: row.query_time,
                        timestamp: row.timestamp
                    });
                });
                res.json(groupedByDate);
            }
        });
    } else {
        // 汇总模式：返回按天汇总的记录
        let sql, params = [];
        
        if (days === -1) {
            // "全部"选项：返回所有数据
            sql = `
                SELECT 
                    DATE(query_time) as date,
                    AVG(remaining_amount) as avg_amount,
                    MIN(remaining_amount) as min_amount,
                    MAX(remaining_amount) as max_amount,
                    COUNT(*) as query_count,
                    MIN(query_time) as first_query_time,
                    MAX(query_time) as last_query_time
                FROM electricity_records 
                GROUP BY DATE(query_time)
                ORDER BY date DESC
            `;
        } else {
            // 指定天数：严格按照天数过滤
            // 修正逻辑：确保正好返回指定天数的数据
            const startDate = getBeijingDateDaysAgo(days - 1); // days-1确保包含今天
            sql = `
                SELECT 
                    DATE(query_time) as date,
                    AVG(remaining_amount) as avg_amount,
                    MIN(remaining_amount) as min_amount,
                    MAX(remaining_amount) as max_amount,
                    COUNT(*) as query_count,
                    MIN(query_time) as first_query_time,
                    MAX(query_time) as last_query_time
                FROM electricity_records 
                WHERE DATE(query_time) >= ?
                GROUP BY DATE(query_time)
                ORDER BY date DESC
                LIMIT ?
            `;
            params = [startDate, days];
        }
        
        db.all(sql, params, (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(rows);
            }
        });
    }
});

// 获取今日详细记录
app.get('/api/today', (req, res) => {
    const todayDate = getCurrentBeijingDate();
    const sql = `
        SELECT remaining_amount, query_time, timestamp
        FROM electricity_records 
        WHERE DATE(query_time) = ?
        ORDER BY query_time DESC
    `;
    
    db.all(sql, [todayDate], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});



// 获取指定日期的详细记录
app.get('/api/history/date/:date', (req, res) => {
    const date = req.params.date;
    
    const sql = `
        SELECT remaining_amount, query_time, timestamp, id
        FROM electricity_records 
        WHERE DATE(query_time) = ?
        ORDER BY query_time DESC
    `;
    
    db.all(sql, [date], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// 清空记录功能 - 可以选择时间范围
app.delete('/api/records', (req, res) => {
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
        return res.status(400).json({ error: '请提供开始日期和结束日期' });
    }
    
    const sql = `
        DELETE FROM electricity_records 
        WHERE DATE(timestamp) >= ? AND DATE(timestamp) <= ?
    `;
    
    db.run(sql, [startDate, endDate], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ 
                success: true, 
                message: `已删除从 ${startDate} 到 ${endDate} 的 ${this.changes} 条记录`,
                deletedCount: this.changes
            });
        }
    });
});

// 清空所有记录
app.delete('/api/records/all', (req, res) => {
    const sql = 'DELETE FROM electricity_records';
    
    db.run(sql, [], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ 
                success: true, 
                message: `已删除所有 ${this.changes} 条记录`,
                deletedCount: this.changes
            });
        }
    });
});

// 删除选中的记录
app.delete('/api/records/selected', (req, res) => {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: '未提供要删除的记录ID' });
    }
    
    const placeholders = ids.map(() => '?').join(',');
    const sql = `DELETE FROM electricity_records WHERE id IN (${placeholders})`;
    
    db.run(sql, ids, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ 
                success: true, 
                message: `已删除 ${this.changes} 条记录`,
                deletedCount: this.changes
            });
        }
    });
});

// 测试查询API
app.get('/api/test-query', async (req, res) => {
    try {
        // 简单测试CAS系统连接
        const axios = require('axios');
        const testResponse = await axios.get(ELECTRICITY_CONFIG.casLoginUrl, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (testResponse.status === 200) {
            res.json({ 
                success: true, 
                message: 'CAS系统连接正常',
                status: testResponse.status
            });
        } else {
            res.json({ 
                success: false, 
                error: `CAS系统响应异常: ${testResponse.status}`
            });
        }
    } catch (error) {
        res.json({ 
            success: false, 
            error: `CAS系统连接失败: ${error.message}`
        });
    }
});

// 清空旧数据 - 删除指定时间之前的数据
app.delete('/api/records/before/:date', (req, res) => {
    const beforeDate = req.params.date;
    
    const sql = `
        DELETE FROM electricity_records 
        WHERE timestamp < ?
    `;
    
    db.run(sql, [beforeDate + ' 00:00:00'], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ 
                success: true, 
                message: `已删除 ${beforeDate} 之前的 ${this.changes} 条记录`,
                deletedCount: this.changes
            });
        }
    });
});

// 获取统计信息
app.get('/api/stats', (req, res) => {
    const sql = `
        SELECT 
            COUNT(*) as total_queries,
            MIN(remaining_amount) as min_amount,
            MAX(remaining_amount) as max_amount,
            AVG(remaining_amount) as avg_amount,
            MIN(timestamp) as first_query,
            MAX(timestamp) as last_query
        FROM electricity_records
    `;
    
    db.get(sql, [], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(row);
        }
    });
});

// 获取今日统计信息
app.get('/api/stats/today', (req, res) => {
    // 支持可选的日期参数，默认为今日
    const targetDate = req.query.date || getCurrentBeijingDate();
    const sql = `
        SELECT 
            COUNT(*) as today_queries,
            MIN(remaining_amount) as min_amount,
            MAX(remaining_amount) as max_amount,
            AVG(remaining_amount) as avg_amount,
            MIN(query_time) as first_query,
            MAX(query_time) as last_query
        FROM electricity_records
        WHERE DATE(query_time) = ?
    `;
    
    db.get(sql, [targetDate], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(row);
        }
    });
});

// 获取今日耗电量统计
app.get('/api/stats/consumption', (req, res) => {
    // 支持可选的日期参数，默认为今日
    const targetDate = req.query.date || getCurrentBeijingDate();
    
    // 获取指定日期的所有记录
    const todayRecordsSql = `
        SELECT remaining_amount, query_time
        FROM electricity_records 
        WHERE DATE(query_time) = ?
        ORDER BY query_time ASC
    `;
    
    // 获取指定日期的所有记录按时间排序（用于计算每小时真实耗电量）
    // 只包含当天的记录，不再查询下一天的00:00:00记录
    const hourlyRecordsSql = `
        SELECT 
            remaining_amount,
            query_time,
            strftime('%H:%M:%S', query_time) as time_part,
            strftime('%H', query_time) as raw_hour
        FROM electricity_records
        WHERE DATE(query_time) = ?
        ORDER BY query_time ASC
    `;
    
    db.all(todayRecordsSql, [targetDate], (err, todayRecords) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // 使用新的计算方法计算指定日期的耗电量
        const todayConsumption = calculateDailyConsumption(todayRecords);
        
        db.all(hourlyRecordsSql, [targetDate], (err, hourlyRecords) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            // 计算每小时的真实耗电量
            const hourlyConsumptions = calculateHourlyConsumptions(hourlyRecords, targetDate);
            
            let maxHourlyChange = 0;
            let minHourlyChange = 0;
            let maxChangePeriod = '--';
            let minChangePeriod = '--';
            
            if (hourlyConsumptions.length > 0) {
                // 只考虑有实际耗电的小时
                const validHours = hourlyConsumptions.filter(h => h.consumption > 0);
                
                if (validHours.length > 0) {
                    const consumptions = validHours.map(h => h.consumption);
                    maxHourlyChange = Math.max(...consumptions);
                    minHourlyChange = Math.min(...consumptions);
                    
                    // 找到对应的时间段
                    const maxHourData = validHours.find(h => h.consumption === maxHourlyChange);
                    const minHourData = validHours.find(h => h.consumption === minHourlyChange);
                    
                    if (maxHourData) {
                        maxChangePeriod = maxHourData.period;
                    }
                    if (minHourData) {
                        minChangePeriod = minHourData.period;
                    }
                }
            }
            
            res.json({
                today_consumption: todayConsumption,
                max_daily_change: maxHourlyChange,
                min_daily_change: minHourlyChange,
                max_change_period: maxChangePeriod,
                min_change_period: minChangePeriod
            });
        });
    });
});

// 计算单日的真实耗电量（考虑充值情况）
function calculateDailyConsumption(records) {
    if (!records || records.length < 2) {
        return 0;
    }
    
    // 按时间排序（升序）
    const sortedRecords = records.sort((a, b) => new Date(a.query_time) - new Date(b.query_time));
    
    let totalConsumption = 0;
    let segmentStart = sortedRecords[0];
    
    for (let i = 1; i < sortedRecords.length; i++) {
        const current = sortedRecords[i];
        const previous = sortedRecords[i - 1];
        
        // 检测是否为充值：电量突然增加且增加量大于合理范围（比如超过1度）
        const amountChange = current.remaining_amount - previous.remaining_amount;
        const isRecharge = amountChange > 1.0; // 假设充值至少1度，可以根据实际情况调整
        
        if (isRecharge) {
            // 发生了充值，结算当前段的耗电量
            const segmentConsumption = segmentStart.remaining_amount - previous.remaining_amount;
            if (segmentConsumption > 0) {
                totalConsumption += segmentConsumption;
            }
            // 开始新的段
            segmentStart = current;
        }
    }
    
    // 计算最后一段的耗电量
    const lastRecord = sortedRecords[sortedRecords.length - 1];
    const finalSegmentConsumption = segmentStart.remaining_amount - lastRecord.remaining_amount;
    if (finalSegmentConsumption > 0) {
        totalConsumption += finalSegmentConsumption;
    }
    
    return totalConsumption;
}

// 计算每小时的真实耗电量（考虑充值情况和时间偏差）
function calculateHourlyConsumptions(records, targetDate) {
    if (!records || records.length === 0) {
        return [];
    }

    // 定义北京时间的小时时间点（精确到整点）
    const hours = Array.from({length: 24}, (_, i) => i);
    const hourlyConsumptions = [];
    
    for (let hour of hours) {
        const nextHour = (hour + 1) % 24;
        const periodLabel = `${String(hour).padStart(2, '0')}:00-${String(nextHour).padStart(2, '0')}:00`;
        
        // 寻找开始时间点的记录（优先找整点，然后在±1分钟范围内查找）
        let startRecord = null;
        const hourStr = String(hour).padStart(2, '0');
        
        // 首先尝试找到精确的整点时间
        for (let record of records) {
            if (record.query_time.includes(`${targetDate} ${hourStr}:00:00`)) {
                startRecord = record;
                break;
            }
        }
        
        // 如果没找到精确整点，在±1分钟范围内查找
        if (!startRecord) {
            for (let record of records) {
                const recordTime = new Date(record.query_time);
                const targetStartTime = new Date(`${targetDate} ${hourStr}:00:00`);
                const timeDiff = Math.abs(recordTime.getTime() - targetStartTime.getTime());
                const oneMinute = 60 * 1000; // 1分钟的毫秒数
                
                if (timeDiff <= oneMinute) { // ±1分钟容差
                    startRecord = record;
                    break;
                }
            }
        }
        
        // 寻找结束时间点的记录
        let endRecord = null;
        const nextHourStr = String(nextHour).padStart(2, '0');
        
        if (nextHour === 0) {
            // 特殊处理23:00-24:00时段
            // 查找当天23:59:30左右的记录（±1分钟容差）
            for (let record of records) {
                const recordTime = new Date(record.query_time);
                const targetEndTime = new Date(`${targetDate} 23:59:30`);
                const timeDiff = Math.abs(recordTime.getTime() - targetEndTime.getTime());
                const oneMinute = 60 * 1000; // 1分钟的毫秒数
                
                if (timeDiff <= oneMinute) { // ±1分钟容差
                    endRecord = record;
                    break;
                }
            }
        } else {
            // 常规小时时段
            // 首先尝试找到精确的整点时间
            for (let record of records) {
                if (record.query_time.includes(`${targetDate} ${nextHourStr}:00:00`)) {
                    endRecord = record;
                    break;
                }
            }
            
            // 如果没找到精确时间，在±1分钟范围内查找
            if (!endRecord) {
                for (let record of records) {
                    const recordTime = new Date(record.query_time);
                    const targetEndTime = new Date(`${targetDate} ${nextHourStr}:00:00`);
                    const timeDiff = Math.abs(recordTime.getTime() - targetEndTime.getTime());
                    const oneMinute = 60 * 1000; // 1分钟的毫秒数
                    
                    if (timeDiff <= oneMinute) { // ±1分钟容差
                        endRecord = record;
                        break;
                    }
                }
            }
        }
        
        // 如果找到了开始和结束记录，计算这一小时的耗电量
        if (startRecord && endRecord) {
            let consumption = startRecord.remaining_amount - endRecord.remaining_amount;
            
            // 确保耗电量为正数（如果出现负数，可能是充值了）
            if (consumption > 0) {
                hourlyConsumptions.push({
                    period: periodLabel,
                    consumption: Math.round(consumption * 100) / 100, // 保留两位小数
                    start_time: startRecord.query_time,
                    end_time: endRecord.query_time
                });
            }
        }
    }
    
    return hourlyConsumptions;
}

// 获取汇总模式的耗电量统计
app.get('/api/stats/daily-consumption', (req, res) => {
    const days = parseInt(req.query.days) || 7;
    
    // 构建SQL查询
    let dailyRecordsSql, params = [];
    
    if (days === -1) {
        // "全部"选项：返回所有数据
        dailyRecordsSql = `
            SELECT 
                DATE(query_time) as date,
                remaining_amount,
                query_time
            FROM electricity_records 
            ORDER BY date ASC, query_time ASC
        `;
    } else {
        // 指定天数：严格按照天数过滤
        const startDate = getBeijingDateDaysAgo(days - 1);
        dailyRecordsSql = `
            SELECT 
                DATE(query_time) as date,
                remaining_amount,
                query_time
            FROM electricity_records 
            WHERE DATE(query_time) >= ?
            ORDER BY date ASC, query_time ASC
        `;
        params = [startDate];
    }
    
    db.all(dailyRecordsSql, params, (err, allRecords) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (allRecords.length === 0) {
            res.json({
                avg_daily_consumption: 0,
                max_daily_consumption: 0,
                min_daily_consumption: 0,
                max_consumption_date: '--',
                min_consumption_date: '--',
                chart_data: []
            });
            return;
        }
        
        // 按日期分组记录
        const recordsByDate = {};
        allRecords.forEach(record => {
            if (!recordsByDate[record.date]) {
                recordsByDate[record.date] = [];
            }
            recordsByDate[record.date].push(record);
        });
        
        // 计算每日的真实耗电量
        const dailyConsumptions = [];
        for (const [date, records] of Object.entries(recordsByDate)) {
            if (records.length >= 2) {
                const consumption = calculateDailyConsumption(records);
                dailyConsumptions.push({
                    date: date,
                    consumption: consumption,
                    query_count: records.length,
                    min_amount: Math.min(...records.map(r => r.remaining_amount)),
                    max_amount: Math.max(...records.map(r => r.remaining_amount))
                });
            }
        }
        
        if (dailyConsumptions.length === 0) {
            res.json({
                avg_daily_consumption: 0,
                max_daily_consumption: 0,
                min_daily_consumption: 0,
                max_consumption_date: '--',
                min_consumption_date: '--',
                chart_data: []
            });
            return;
        }
        
        // 只计算有正耗电量的天数
        const validDays = dailyConsumptions.filter(day => day.consumption > 0);
        
        // 计算统计值
        const consumptions = validDays.map(day => day.consumption);
        const avgConsumption = consumptions.length > 0 ? 
            consumptions.reduce((a, b) => a + b, 0) / consumptions.length : 0;
        const maxConsumption = consumptions.length > 0 ? Math.max(...consumptions) : 0;
        const minConsumption = consumptions.length > 0 ? Math.min(...consumptions) : 0;
        
        // 找到最大和最小消费的日期
        const maxDate = validDays.find(day => day.consumption === maxConsumption)?.date || '--';
        const minDate = validDays.find(day => day.consumption === minConsumption)?.date || '--';
        
        // 为图表准备数据（包括所有有数据的天，即使耗电量为0）
        let chartData = dailyConsumptions.map(day => ({
            date: day.date,
            consumption: day.consumption
        }));
        
        // 如果不是"全部"选项，需要严格限制返回的天数
        if (days !== -1) {
            // 按日期倒序排列，然后取前N天
            chartData = chartData
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, days)
                .sort((a, b) => new Date(a.date) - new Date(b.date)); // 重新按升序排列用于图表显示
        }
        
        res.json({
            avg_daily_consumption: avgConsumption,
            max_daily_consumption: maxConsumption,
            min_daily_consumption: minConsumption,
            max_consumption_date: maxDate,
            min_consumption_date: minDate,
            chart_data: chartData
        });
    });
});

// 获取所有记录（用于前端显示）
app.get('/api/records', (req, res) => {
    const days = parseInt(req.query.days) || 7;
    const date = req.query.date;
    let sql, params = [];
    
    if (date) {
        // 指定日期的记录 - 按query_time降序排列，确保00:00:00在最下面
        sql = `SELECT * FROM electricity_records 
               WHERE DATE(query_time) = ?
               ORDER BY query_time DESC`;
        params = [date];
    } else {
        // 最近几天的记录 - 按query_time降序排列
        sql = `SELECT * FROM electricity_records 
               ORDER BY query_time DESC 
               LIMIT ?`;
        params = [days * 50]; // 假设每天最多50次查询
    }
    
    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // 为每条记录添加异常标记
        const recordsWithAbnormalFlag = rows.map((record, index) => {
            // 检查是否为异常数据
            let isAbnormal = false;
            let abnormalReason = '';
            
            // 检查是否为0度
            if (record.remaining_amount === 0) {
                isAbnormal = true;
                abnormalReason = '查询结果为0度';
            }
            
            // 检查相比前一条记录是否减少超过1度（在30分钟内）
            if (!isAbnormal && index < rows.length - 1) {
                const nextRecord = rows[index + 1]; // 由于降序排列，下一条是更早的记录
                const currentTime = new Date(record.query_time).getTime();
                const nextTime = new Date(nextRecord.query_time).getTime();
                const timeDiff = currentTime - nextTime; // 时间差（毫秒）
                
                // 如果在30分钟内
                if (timeDiff <= 30 * 60 * 1000) {
                    const decrease = nextRecord.remaining_amount - record.remaining_amount;
                    if (decrease > 1.0) {
                        isAbnormal = true;
                        abnormalReason = `半小时内减少${decrease.toFixed(2)}度`;
                    }
                }
            }
            
            return {
                ...record,
                is_abnormal: isAbnormal,
                abnormal_reason: abnormalReason
            };
        });
        
        res.json(recordsWithAbnormalFlag);
    });
});

// 获取最后一次自动查询时间
app.get('/api/last-auto-query', (req, res) => {
    const sql = `SELECT query_time FROM electricity_records 
                 WHERE is_auto = 1 
                 ORDER BY query_time DESC 
                 LIMIT 1`;
    
    db.get(sql, [], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (row) {
            // 格式化时间为中文格式
            const date = new Date(row.query_time);
            const formattedTime = date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZone: 'Asia/Shanghai'
            }).replace(/\//g, '/');
            
            res.json({ 
                last_auto_query: formattedTime,
                raw_time: row.query_time
            });
        } else {
            res.json({ 
                last_auto_query: '暂无自动查询记录',
                raw_time: null
            });
        }
    });
});


// 添加测试端点
app.get('/api/test-cron', (req, res) => {
    const now = getBeijingTime();
    const nextCronTimes = [];
    
    // 计算接下来几次执行时间
    for (let i = 0; i < 5; i++) {
        const next = getBeijingTime();
        next.setMinutes(now.getMinutes() < 30 ? 30 : 60, 0, 0);
        if (next.getMinutes() === 60) {
            next.setHours(next.getHours() + 1, 0, 0, 0);
        }
        next.setTime(next.getTime() + i * 30 * 60 * 1000);
        nextCronTimes.push(next.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
    }
    
    res.json({
        current_time: now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
        cron_expression: '0,30 * * * *',
        next_execution_times: nextCronTimes,
        server_uptime: process.uptime(),
        memory_usage: process.memoryUsage()
    });
});


// 修改定时任务部分 - 每半小时查询一次（需要用户已登录）
cron.schedule('0,30 * * * *', async () => {
    const now = getBeijingTime();
    const timeStr = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    
    console.log(`\n=== [${timeStr}] 定时任务触发 ===`);
    
    // 检查是否有用户已登录
    if (!hasAnyLoggedInUser()) {
        console.log(`[${timeStr}] 没有用户登录，跳过自动查询`);
        console.log(`=== [${timeStr}] 定时任务结束 ===\n`);
        return;
    }
    
    // 查找一个有效的用户会话进行自动查询
    let validUserFound = false;
    for (const [userIP, session] of userSessions.entries()) {
        if (session.isLoggedIn && session.loginMethod === 'password') {
            const sessionValid = await UserAuthSession.isSessionValid(userIP);
            if (sessionValid) {
                validUserFound = true;
                console.log(`[${timeStr}] 找到有效用户会话: ${userIP}`);
                break;
            } else {
                // 会话失效，清除该用户的登录状态
                console.log(`[${timeStr}] 用户 ${userIP} 会话已失效，清除登录状态`);
                deleteUserSession(userIP);
            }
        }
    }
    
    if (!validUserFound) {
        console.log(`[${timeStr}] 没有有效的用户会话，跳过自动查询`);
        console.log(`=== [${timeStr}] 定时任务结束 ===\n`);
        return;
    }
    
    try {
        // 使用完整的查询流程，保持与手动查询一致的输出
        console.log(`[${timeStr}] 开始定时查询...`);
        const result = await queryElectricityBalance(true); // 自动查询
        
        if (result.success) {
            console.log(`[${timeStr}] 定时查询成功: ${result.remainingAmount}度`);
        } else {
            console.log(`[${timeStr}] 定时查询失败: ${result.error || result.message}`);
        }
        
    } catch (error) {
        console.error(`[${timeStr}] 定时查询失败:`, error.message);
        
        // 如果是会话相关错误，清除所有用户的登录状态
        if (error.message.includes('会话') || error.message.includes('认证') || error.message.includes('登录')) {
            console.log(`[${timeStr}] 会话相关错误，清除所有用户的登录状态`);
            userSessions.clear();
            userAuthSessions.clear();
        }
    }
    
    console.log(`=== [${timeStr}] 定时任务结束 ===\n`);
}, {
    scheduled: true,
    timezone: "Asia/Shanghai"
});

// 添加每天23:59:30的查询任务（需要用户已登录）
cron.schedule('30 59 23 * * *', async () => {
    const now = getBeijingTime();
    const timeStr = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    
    console.log(`\n=== [${timeStr}] 每日收尾查询触发 ===`);
    
    // 检查是否有用户已登录
    if (!hasAnyLoggedInUser()) {
        console.log(`[${timeStr}] 没有用户登录，跳过每日收尾查询`);
        console.log(`=== [${timeStr}] 每日收尾查询结束 ===\n`);
        return;
    }
    
    // 查找一个有效的用户会话进行每日收尾查询
    let validUserFound = false;
    for (const [userIP, session] of userSessions.entries()) {
        if (session.isLoggedIn && session.loginMethod === 'password') {
            const sessionValid = await UserAuthSession.isSessionValid(userIP);
            if (sessionValid) {
                validUserFound = true;
                console.log(`[${timeStr}] 找到有效用户会话进行收尾查询: ${userIP}`);
                break;
            } else {
                // 会话失效，清除该用户的登录状态
                console.log(`[${timeStr}] 用户 ${userIP} 会话已失效，清除登录状态`);
                deleteUserSession(userIP);
            }
        }
    }
    
    if (!validUserFound) {
        console.log(`[${timeStr}] 没有有效的用户会话，跳过每日收尾查询`);
        console.log(`=== [${timeStr}] 每日收尾查询结束 ===\n`);
        return;
    }
    
    try {
        // 使用完整的查询流程，保持与手动查询一致的输出
        console.log(`[${timeStr}] 开始每日收尾查询...`);
        const result = await queryElectricityBalance(true); // 自动查询
        
        if (result.success) {
            console.log(`[${timeStr}] 每日收尾查询成功: ${result.remainingAmount}度`);
        } else {
            console.log(`[${timeStr}] 每日收尾查询失败: ${result.error || result.message}`);
        }
        
    } catch (error) {
        console.error(`[${timeStr}] 每日收尾查询失败:`, error.message);
        
        // 如果是会话相关错误，清除所有用户的登录状态
        if (error.message.includes('会话') || error.message.includes('认证') || error.message.includes('登录')) {
            console.log(`[${timeStr}] 会话相关错误，清除所有用户的登录状态`);
            userSessions.clear();
            userAuthSessions.clear();
        }
    }
    
    console.log(`=== [${timeStr}] 每日收尾查询结束 ===\n`);
}, {
    scheduled: true,
    timezone: "Asia/Shanghai"
});


// 设置定时任务 - 每天凌晨2点创建备份并清理旧备份
cron.schedule('0 2 * * *', async () => {
    const now = getBeijingTime();
    const timeStr = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    
    console.log(`\n=== [${timeStr}] 每日自动备份任务触发 ===`);
    
    try {
        // 创建新备份
        const backupId = await createDataBackup();
        console.log(`[${timeStr}] 每日自动备份创建成功: electricity_records_backup_${backupId}`);
        
        // 清理超过14天的旧备份
        const cleanupResult = await cleanupOldBackups(14);
        console.log(`[${timeStr}] 旧备份清理结果: ${cleanupResult.message}`);
        
    } catch (error) {
        console.error(`[${timeStr}] 每日自动备份任务失败:`, error.message);
    }
    
    console.log(`=== [${timeStr}] 每日自动备份任务结束 ===\n`);
}, {
    scheduled: true,
    timezone: "Asia/Shanghai"
});

// 全局错误处理器
app.use((err, req, res, next) => {
    ApiResponse.error(res, err);
});

// 启动服务器
function startServer(port) {
    const now = getBeijingTime();
    const timeStr = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const server = app.listen(port, () => {
        console.log(`\n=== 电费查询系统启动 ===`);
        console.log(`服务器启动时间: ${timeStr}`);
        console.log(`服务器地址: http://localhost:${port}`);
        console.log(`定时查询: 每半小时 (0,30 * * * *)`);
        console.log(`每天凌晨2点自动备份`);
        console.log(`请先登录后开始使用`);
        console.log(`========================\n`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`端口 ${port} 已被占用，尝试使用端口 ${port + 1}`);
            startServer(port + 1);
        } else {
            console.error('服务器启动失败:', err);
            process.exit(1);
        }
    });

    return server;
}

startServer(PORT);

// 导出函数供测试使用
module.exports = {
    calculateHourlyConsumptions
};

// 优雅关闭
process.on('SIGINT', () => {
    console.log('正在关闭服务器...');
    db.close((err) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log('数据库连接已关闭');
        }
    });
    process.exit(0);
});

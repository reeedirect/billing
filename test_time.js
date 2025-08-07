// 测试时间函数
function getBeijingTime() {
    return new Date(new Date().toLocaleString('en-US', {timeZone: 'Asia/Shanghai'}));
}

function getCurrentBeijingDateTime() {
    const beijingTime = getBeijingTime();
    const year = beijingTime.getFullYear();
    const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
    const day = String(beijingTime.getDate()).padStart(2, '0');
    const hour = String(beijingTime.getHours()).padStart(2, '0');
    const minute = String(beijingTime.getMinutes()).padStart(2, '0');
    const second = String(beijingTime.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function getCurrentBeijingDate() {
    const beijingTime = getBeijingTime();
    const year = beijingTime.getFullYear();
    const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
    const day = String(beijingTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getBeijingTimeString() {
    const beijingTime = getBeijingTime();
    return beijingTime.toLocaleString('zh-CN', { 
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

console.log('=== 时间函数测试 ===');
console.log('当前北京时间对象:', getBeijingTime());
console.log('当前北京日期时间字符串:', getCurrentBeijingDateTime());
console.log('当前北京日期字符串:', getCurrentBeijingDate());
console.log('格式化北京时间字符串:', getBeijingTimeString());
console.log('UTC时间 (作为对比):', new Date().toISOString());
console.log('本地时间 (作为对比):', new Date().toLocaleString());

// 测试时间转换差异
const utcNow = new Date();
const beijingNow = getBeijingTime();
const utcString = utcNow.toISOString().slice(0, 19).replace('T', ' ');
const beijingString = getCurrentBeijingDateTime();

console.log('\n=== 时间差异对比 ===');
console.log('UTC时间字符串:', utcString);
console.log('北京时间字符串:', beijingString);
console.log('时间差（小时）:', (beijingNow.getTime() - utcNow.getTime()) / (1000 * 60 * 60));

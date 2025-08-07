# 电费余额查询系统

这是一个自动监控学生公寓电费余额的Web应用系统。

## 功能特点

- **自动查询**: 每小时自动查询一次电费余额
- **实时监控**: 显示当前剩余电量和查询## 🔧 故障排除

### 端口被占用 (EADDRINUSE)
- **问题**: 提示端口3000被占用
- **解决**: 系统会自动寻找可用端口（3001, 3002...）
- **手动解决**: 运行 `检查端口.bat` 查看端口使用情况

### 查询失败
- 检查网络连接
- 确认学校网站是否正常
- 查看控制台错误日志

### Node.js未找到
- **问题**: 提示 'node' is not recognized
- **解决**: 安装Node.js并确保添加到系统PATH
- **检查**: 运行 `环境检查.bat` 检查环境

### 数据不更新
- 检查定时任务是否正常运行
- 查看服务器日志
- 确认数据库文件权限

### 页面显示异常
- 清除浏览器缓存
- 检查JavaScript控制台错误
- 确认API接口正常响应提供详细的使用统计信息
- **趋势图表**: 按天显示电费使用折线图
- **历史记录**: 查看过去几天的电费使用情况
- **响应式设计**: 支持移动端访问

## 技术栈

### 后端
- Node.js + Express
- SQLite 数据库
- Axios (HTTP 请求)
- Cheerio (HTML 解析)
- node-cron (定时任务)

### 前端
- HTML5 + CSS3
- JavaScript (ES6+)
- Chart.js (图表库)
- 响应式设计

## 安装和运行

### 1. 安装依赖
```bash
npm install
```

### 2. 启动服务
```bash
npm start
```

或者开发模式：
```bash
npm run dev
```

### 3. 访问应用
打开浏览器访问: http://localhost:3000

## 系统配置

系统已预配置以下信息：
- **查询网址**: http://202.195.206.214/epay/electric/load4electricbill?elcsysid=2
- **用户账号**: 232241821136
- **用户密码**: 3.1415926QweAsd
- **缴费楼栋**: 学生公寓C14
- **缴费楼层**: 学生公寓C14四层
- **缴费房间**: C14-418

## API 接口

### GET /api/query
手动查询电费余额

### GET /api/history?days=7
获取历史记录（默认7天）

### GET /api/today
获取今日详细查询记录

### GET /api/stats
获取统计信息

## 数据库结构

```sql
CREATE TABLE electricity_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    remaining_amount REAL,
    query_time TEXT
);
```

## 项目结构

```
billing/
├── server.js              # 后端服务器
├── package.json           # 项目配置
├── electricity.db         # SQLite数据库(运行时生成)
└── public/                # 前端文件
    ├── index.html         # 主页面
    ├── style.css          # 样式文件
    └── script.js          # 前端脚本
```

## 注意事项

1. **网络连接**: 确保能够访问学校内网
2. **认证信息**: 系统使用预设的统一身份认证信息
3. **查询频率**: 系统每小时自动查询一次，避免频繁请求
4. **数据存储**: 所有查询记录保存在本地SQLite数据库中
5. **错误处理**: 系统具备完善的错误处理和重试机制

## 故障排除

### 查询失败
- 检查网络连接
- 确认学校网站是否正常
- 查看控制台错误日志

### 数据不更新
- 检查定时任务是否正常运行
- 查看服务器日志
- 确认数据库文件权限

### 页面显示异常
- 清除浏览器缓存
- 检查JavaScript控制台错误
- 确认API接口正常响应

## 许可证

MIT License

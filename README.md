# 星空 AI 对话助手

一款面向个人与小型团队的 AI 对话 Web 应用。采用星空主题 UI，支持用户注册登录、多会话管理、流式 AI 回复与全站数据统计，前后端分离，开箱即用。

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | Vue 3、Vite |
| 状态管理 | Pinia |
| 路由 | Vue Router |
| UI 组件 | Element Plus |
| 数据可视化 | ECharts |
| HTTP 客户端 | Axios |
| 后端 | json-server（自定义 Express 中间层） |
| 身份认证 | JWT（jsonwebtoken + bcryptjs） |
| AI 能力 | DeepSeek Chat API（SSE 流式响应） |

---

## 功能特性

### 用户注册 / 登录
- 登录 / 注册二合一页面，表单校验完善
- JWT 鉴权，Token 持久化至 `localStorage`
- 路由守卫保护聊天页与统计页

### 历史对话存储
- 对话数据存储于后端 `db.json`，按用户隔离
- 支持新建对话、切换会话、自动标题生成
- 用户消息与 AI 回复实时同步至服务端

### 流式对话
- 调用 DeepSeek Chat Completions 接口
- SSE 流式解析，打字机效果逐字展示
- AI 回复期间显示 Loading 动画

### 全站统计
- 总对话数、总消息数、今日消息、活跃天数
- 近 7 天消息量折线图
- 热门话题 TOP5 饼图分布

---

## 本地启动

### 环境要求

- Node.js `^22.18.0` 或 `>=24.12.0`
- npm 9+

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

在项目根目录创建 `.env` 文件（参考下方「环境变量配置」）。

### 3. 启动后端服务

```bash
npm run server
```

后端默认运行在 [http://localhost:3000](http://localhost:3000)。

### 4. 启动前端开发服务器

```bash
npm run dev
```

前端默认运行在 [http://localhost:5173](http://localhost:5173)。

> 建议同时开启两个终端，分别运行 `npm run server` 与 `npm run dev`。

### 5. 构建生产版本（可选）

```bash
npm run build
npm run preview
```

---

## 环境变量配置

在项目根目录创建 `.env` 文件：

```env
# DeepSeek API Key（必填，用于 AI 对话）
VITE_AI_API_KEY=your_deepseek_api_key
```

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `VITE_AI_API_KEY` | 是 | DeepSeek API 密钥，仅在前端构建时注入，请勿提交至公开仓库 |

**安全提示：**

- 将 `.env` 加入 `.gitignore`，避免密钥泄露
- 修改 `.env` 后需重启 `npm run dev` 方可生效
- 后端 JWT 密钥目前写死于 `server.js`（`your-secret-key`），生产环境请替换为强随机字符串

---

## 部署到 Vercel

本项目前端为静态 SPA，后端为 Node.js 服务，部署时需分别处理：

### 前端（Vercel）

1. 将仓库推送至 GitHub / GitLab
2. 在 [Vercel](https://vercel.com) 导入项目
3. 构建配置：
   - **Framework Preset**：Vite
   - **Build Command**：`npm run build`
   - **Output Directory**：`dist`
4. 在 Vercel 项目 Settings → Environment Variables 中添加：
   - `VITE_AI_API_KEY` = 你的 DeepSeek API Key
5. 部署完成后，将 `src/utils/request.js` 中的 `baseURL` 改为线上后端地址

### 后端

json-server 自定义后端需部署至支持 Node.js 的平台（如 Railway、Render、Fly.io 等），Vercel Serverless 不适合长期运行 `server.js` 与 `db.json` 文件存储。

部署后端后，更新前端 `request.js` 的 `baseURL` 指向线上 API 域名，并确保后端开启 CORS。

---

## 项目结构

```
my-ai-chat/
├── db.json                 # 用户与对话数据
├── server.js               # 后端 API 服务
├── src/
│   ├── api/                # 接口封装
│   ├── router/             # 路由与守卫
│   ├── stores/             # Pinia 状态
│   ├── utils/              # Axios 封装
│   └── views/              # 页面组件
│       ├── LoginView.vue   # 登录 / 注册
│       ├── ChatView.vue    # 聊天主界面
│       └── StatsView.vue   # 数据统计
└── package.json
```

---

## API 接口一览

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/register` | 用户注册 | 否 |
| POST | `/login` | 用户登录 | 否 |
| GET | `/me` | 获取当前用户 | 是 |
| GET | `/api/conversations` | 获取当前用户对话列表 | 是 |
| POST | `/api/conversations` | 保存 / 更新对话 | 是 |
| DELETE | `/api/conversations/:id` | 删除对话 | 是 |
| GET | `/api/stats` | 全站统计数据 | 是 |

---

## 项目展示

> 截图占位，后期补充

| 登录页 | 聊天页 |
|--------|--------|
| ![登录页](./docs/screenshots/login.png) | ![聊天页](./docs/screenshots/chat.png) |

| 统计页 |
|--------|
| ![统计页](./docs/screenshots/stats.png) |

---

## License

Private — 仅供学习与个人使用。

# Python Sandbox Service API 文档

本文档描述了 Python Sandbox Service 提供的 HTTP 接口。该服务允许用户在安全的沙箱环境中执行 Python 代码。

## 基础信息

- **默认端口**: `8080` (可通过环境变量 `PORT` 修改)
- **Base URL**: `http://localhost:8080` (本地默认)
- **认证方式**: Bearer Token
  - 所有请求（包括健康检查）都必须包含 HTTP 头部: `Authorization: Bearer <AUTH_TOKEN>`
  - `<AUTH_TOKEN>` 必须匹配服务启动时设置的环境变量 `AUTH_TOKEN`。

---

## 接口列表

### 1. 执行代码

提交 Python 代码并在沙箱环境中同步运行，等待并返回执行结果。

- **URL**: `/execute`
- **Method**: `POST`
- **Content-Type**: `application/json`

#### 请求参数 (Body)

| 字段名 | 类型 | 必填 | 描述 | 限制 |
| :--- | :--- | :--- | :--- | :--- |
| `code` | string | 是 | 需要执行的 Python 源代码 | 非空字符串 |
| `timeoutMs` | number | 否 | 执行超时时间（毫秒） | 整数，范围 1 - 120000 (即 1ms 到 2分钟) |
| `fileUploadUrl` | string | 否 | 文件上传服务基础 URL，例如 `https://files.example.com/upload` | 有效 URL |
| `uploadToken` | string | 否 | 上传服务的 Bearer Token | 非空字符串 |
| `public` | boolean | 否 | 上传时是否公开（作为查询参数 `public=true/false`） | 默认 `false` |

#### 请求示例

```bash
curl -X POST http://localhost:8080/execute \
  -H "Authorization: Bearer your-secret-token" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "print(1 + 1)",
    "timeoutMs": 1000,
    "fileUploadUrl": "https://files.example.com/upload",
    "uploadToken": "file-service-token",
    "public": true
  }'
```

#### 成功响应 (200 OK)

```json
{
  "exitCode": 0,
  "stdout": "2\n",
  "stderr": "",
  "signal": null,
  "uploads": [
    { "filename": "chart.png", "url": "https://files.example.com/files/123", "status": 200 }
  ]
}
```

#### 响应字段说明

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `exitCode` | number \| null | 进程退出状态码。`0` 表示正常成功退出，非 `0` 表示错误。如果进程被信号终止，可能为 `null`。 |
| `stdout` | string | 程序的标准输出内容。 |
| `stderr` | string | 程序的标准错误内容。如果发生沙箱违规（如尝试访问受限文件），系统可能会在此追加警告信息。 |
| `signal` | string \| null | 如果进程被信号强行终止（例如超时被杀），此字段显示信号名称（如 `"SIGKILL"`）。正常结束为 `null`。 |
| `uploads` | Array | 如果配置了上传，返回每个上传文件的结果（`filename`、`url`、`status`） |

#### 错误响应

- **400 Bad Request**: 请求体格式错误或参数校验失败（例如 `code` 字段缺失）。
  ```json
  {
    "error": "Invalid request",
    "details": { ... }
  }
  ```
- **401 Unauthorized**: 未提供认证 Token 或格式错误。
- **403 Forbidden**: 提供的 Token 无效。
- **500 Internal Server Error**: 服务内部错误或沙箱环境初始化失败。

---

### 2. 健康检查

检查服务是否正常运行。

- **URL**: `/health`
- **Method**: `GET`

#### 请求示例

```bash
curl http://localhost:8080/health \
  -H "Authorization: Bearer your-secret-token"
```

> **注意**: 根据当前服务配置，健康检查接口同样受鉴权保护。

#### 成功响应 (200 OK)

```json
{
  "ok": true
}
```

---

### 3. 浏览器沙箱 (Browser Sandbox)

提供高隔离、指纹混淆的浏览器环境，支持页面导航和交互。

#### 3.1 创建会话

创建一个新的浏览器会话（Context）。每个会话拥有独立的指纹和存储。

- **URL**: `/browser/sessions`
- **Method**: `POST`
- **Content-Type**: `application/json`

**请求参数 (Body):**

| 字段名 | 类型 | 必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `device` | string | 否 | 设备类型，可选 `desktop` (默认) 或 `mobile` |
| `viewport` | object | 否 | 自定义视口大小 `{ width: number, height: number }` |

**请求示例:**

```bash
curl -X POST http://localhost:8080/browser/sessions \
  -H "Authorization: Bearer your-secret-token" \
  -H "Content-Type: application/json" \
  -d '{
    "device": "desktop"
  }'
```

**成功响应 (200 OK):**

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### 3.2 页面跳转

控制会话中的页面跳转到指定 URL。

- **URL**: `/browser/sessions/:id/navigate`
- **Method**: `POST`
- **Content-Type**: `application/json`

**请求参数 (Body):**

| 字段名 | 类型 | 必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `url` | string | 是 | 目标 URL |
| `waitUntil` | string | 否 | 等待条件: `load`, `domcontentloaded`, `networkidle`, `commit` (默认 `load`) |

**请求示例:**

```bash
curl -X POST http://localhost:8080/browser/sessions/YOUR_SESSION_ID/navigate \
  -H "Authorization: Bearer your-secret-token" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "waitUntil": "domcontentloaded"
  }'
```

**成功响应 (200 OK):**

```json
{
  "url": "https://example.com/",
  "screenshot": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ..." // Base64 编码的页面截图
}
```

#### 3.3 页面交互

在当前页面执行交互操作。

- **URL**: `/browser/sessions/:id/action`
- **Method**: `POST`
- **Content-Type**: `application/json`

**请求参数 (Body):**

| 字段名 | 类型 | 必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `action` | string | 是 | 动作类型: `click`, `fill`, `type`, `press`, `scroll`, `evaluate`, `screenshot` |
| `selector` | string | 否 | CSS 选择器 (部分动作必填) |
| `value` | string | 否 | 输入值 (fill, type, press 必填) |
| `script` | string | 否 | JavaScript 脚本 (evaluate 必填) |
| `x` | number | 否 | 坐标点击/滚动时使用的 X 轴像素位置 |
| `y` | number | 否 | 坐标点击/滚动时使用的 Y 轴像素位置 |

**请求示例 (点击):**

```bash
curl -X POST http://localhost:8080/browser/sessions/YOUR_SESSION_ID/action \
  -H "Authorization: Bearer your-secret-token" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "click",
    "selector": "#submit-button"
  }'
```

**请求示例 (坐标点击):**

```bash
curl -X POST http://localhost:8080/browser/sessions/YOUR_SESSION_ID/action \
  -H "Authorization: Bearer your-secret-token" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "click",
    "x": 200,
    "y": 300
  }'
```

> 注意：当提供 `x` 与 `y` 坐标时，`selector` 可省略。坐标以页面视口左上角为原点，单位为像素。

**请求示例 (输入):**

```bash
curl -X POST http://localhost:8080/browser/sessions/YOUR_SESSION_ID/action \
  -H "Authorization: Bearer your-secret-token" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "fill",
    "selector": "input[name=\"q\"]",
    "value": "search query"
  }'
```

**成功响应 (200 OK):**

```json
{
  "result": null, // evaluate 操作会有返回值
  "screenshot": "..." // 操作后的页面截图
}
```

#### 3.4 销毁会话

关闭并销毁浏览器会话，释放资源。

- **URL**: `/browser/sessions/:id`
- **Method**: `DELETE`

**请求示例:**

```bash
curl -X DELETE http://localhost:8080/browser/sessions/YOUR_SESSION_ID \
  -H "Authorization: Bearer your-secret-token"
```

**成功响应 (200 OK):**

```json
{
  "success": true
}
```

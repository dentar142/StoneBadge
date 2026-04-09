# Stone Badge 部署说明

Stone Badge 是一个基于 GitHub 仓库最近一次提交 SHA 生成石墩子 SVG 徽章的 Node.js 服务。项目本身没有前端构建步骤，启动后会直接提供静态页面和 API：

- 首页：输入 GitHub 仓库地址并生成徽章
- 模板上传 API：上传 SVG 模板供服务端使用
- API：按仓库 owner / repo 返回着色后的 SVG 徽章

## 目录说明

```text
project/
├── server.js              # 服务入口
├── lib/                   # 业务逻辑
├── public/                # 静态前端页面
├── templates/             # 生成后的 SVG 模板输出目录
├── seatstone.glb          # 3D 模型文件，必须保留
├── package.json
└── README.md
```

## 运行要求

- Node.js 18 或更高版本
- npm
- 服务器可以访问 GitHub API：`https://api.github.com`
- 服务器上要保留 `seatstone.glb` 文件

为什么建议 Node.js 18+：项目代码使用了原生 `fetch`，并且 `package.json` 采用 ESM 模式。

## 环境变量

项目可用的环境变量只有两个：

- `PORT`：服务监听端口，默认 `3000`
- `GITHUB_TOKEN`：可选。建议配置，用于提高 GitHub API 限流上限，避免高频访问时触发 rate limit

示例：

```bash
export PORT=3000
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

## 本地启动

如果你只是想先在服务器上直接跑起来，可以按下面的步骤执行：

```bash
cd /path/to/project
npm install
npm start
```

启动后默认访问：

- 首页：`http://服务器IP:3000/`

模板会在服务启动时自动生成；如果模板缺失，先检查服务日志和 `seatstone.glb` 文件是否存在。

## 服务器部署步骤

下面以 Linux 服务器为例，推荐使用 `systemd + Nginx` 的方式部署。这样可以保证服务开机自启，并通过反向代理提供 80 / 443 端口访问。

### 1. 准备目录

建议把项目放到一个固定目录，例如：

```bash
sudo mkdir -p /opt/stone-badge
```

把项目文件上传或拉取到该目录，确保最终目录中至少包含：

```text
server.js
package.json
lib/
public/
seatstone.glb
```

如果缺少 `seatstone.glb`，自动模板生成和 SVG 着色流程都无法正常工作。

如果模板自动生成失败，通常是 `seatstone.glb` 缺失、Node 版本不满足要求，或者服务器没有写入 `templates/` 的权限。

### 2. 安装依赖

```bash
cd /opt/stone-badge
npm install
```

安装完成后，`node_modules` 会生成在项目目录下。项目没有额外的构建步骤。

### 3. 配置服务账号和写权限

为了让首次模板生成和模板上传接口都能正常写入，建议先确保 `templates/` 目录可写：

```bash
sudo mkdir -p /opt/stone-badge/templates
sudo chown -R www-data:www-data /opt/stone-badge/templates
```

如果你打算用别的用户运行 systemd 服务，也可以把上面的 `www-data` 换成对应用户名，但一定要保证 `templates/` 可写。

### 4. 配置环境变量

推荐把环境变量写入单独文件，便于 systemd 管理：

```bash
sudo tee /etc/stone-badge.env >/dev/null <<'EOF'
PORT=3000
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
EOF
```

如果暂时不想配置 GitHub Token，也可以只写 `PORT`，但在访问量较高时更容易触发 API 限流。

### 5. 先手动验证一次启动

```bash
cd /opt/stone-badge
PORT=3000 npm start
```

第一次启动时，服务会尝试自动生成 `templates/stone-template.svg`。如果自动生成失败，请查看服务日志、确认 `seatstone.glb` 存在，并检查 `templates/` 目录可写；必要时也可以通过 `/api/template` 手动上传模板。

### 6. 配置 systemd 开机自启

创建服务文件：

```bash
sudo tee /etc/systemd/system/stone-badge.service >/dev/null <<'EOF'
[Unit]
Description=Stone Badge Service
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/stone-badge
EnvironmentFile=/etc/stone-badge.env
ExecStart=/usr/bin/node /opt/stone-badge/server.js
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
EOF
```

如果你的 Node.js 安装路径不是 `/usr/bin/node`，请先运行：

```bash
which node
```

然后把上面的 `ExecStart` 改成实际路径。

接着加载并启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable stone-badge
sudo systemctl start stone-badge
sudo systemctl status stone-badge
```

查看日志：

```bash
sudo journalctl -u stone-badge -f
```

## Nginx 反向代理

建议不要直接把 3000 端口暴露给公网，而是让 Nginx 监听 80 / 443，再把请求转发到本地的 Node 服务。

下面是一个基础配置示例：

```nginx
server {
    listen 80;
    server_name badge.example.com;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

说明：

- `client_max_body_size 20m` 很重要，因为模板上传接口 `/api/template` 可能提交较大的 SVG 内容
- 如果你后面接入 HTTPS，只需要给这个 `server` 块补充证书配置即可

启用配置后执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 如果开启了防火墙

如果服务器使用 `ufw`，建议只开放 80 和 443：

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

如果你不使用 Nginx，而是直接暴露 Node 端口，则至少要开放 `PORT` 对应端口，但不推荐这种方式用于生产环境。

## 首次上线检查清单

- 首页能正常打开
- `seatstone.glb` 可以从浏览器直接请求到
- `templates/stone-template.svg` 已成功生成
- 输入一个 GitHub 仓库链接后可以返回徽章
- 反向代理后静态资源和 API 都能正常工作

## API 说明

### 1. 获取 SVG 徽章

```text
GET /api/stone/:owner/:repo
```

示例：

```text
GET /api/stone/vercel/next.js
```

返回内容是 SVG 图像。

### 2. 解析仓库链接

```text
POST /api/generate
```

请求体：

```json
{
  "repoUrl": "https://github.com/owner/repo"
}
```

返回仓库 owner、repo、short SHA 以及徽章链接。

### 3. 上传模板 SVG

```text
POST /api/template
```

这个接口用于上传一段 SVG 文本，并保存到 `templates/stone-template.svg`。

## 常见问题

### 1. 页面提示模板尚未生成

说明 `templates/stone-template.svg` 不存在，或者首次启动时自动生成失败。处理方法：

1. 确认 `seatstone.glb` 文件存在
2. 查看服务日志中的模板生成错误
3. 确认 `templates/` 目录可写后重启服务

### 2. GitHub API 访问失败或限流

通常是因为没有配置 `GITHUB_TOKEN`，或者服务器出口网络不通。建议：

1. 确认服务器可以访问 `api.github.com`
2. 配置 `GITHUB_TOKEN`
3. 检查代理、防火墙和 DNS

### 3. 模板上传失败

检查这几个点：

1. Nginx 的 `client_max_body_size` 是否过小
2. `templates/` 目录是否有写权限
3. `seatstone.glb` 是否存在

### 4. 服务启动后立刻退出

检查：

1. Node.js 版本是否是 18 以上
2. `ExecStart` 里的 Node 路径是否正确
3. `WorkingDirectory` 是否指向项目根目录
4. `journalctl -u stone-badge -f` 的报错内容

## 更新发布流程

以后更新代码时，建议按下面的流程：

```bash
cd /opt/stone-badge
git pull
npm install
sudo systemctl restart stone-badge
```

如果这次更新没有修改依赖，`npm install` 也可以省略，但保留执行习惯更稳妥。

## 备注

- 项目没有前端打包流程，`public/` 下的文件会被直接静态托管
- 模板 SVG 会优先在服务端生成，失败时可以通过 `/api/template` 手动上传
- 服务器部署时最推荐的方式是：`systemd` 保活 + `Nginx` 反向代理 + `GITHUB_TOKEN` 降低限流风险
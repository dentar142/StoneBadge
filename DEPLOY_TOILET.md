# 部署 Toilet/Stone Badge 服务

把这个 fork 部署到一个 HTTPS 公网地址后，任何 GitHub README 就能引用：

```md
![Toilet Badge](https://YOUR_DOMAIN/api/toilet/owner/repo)
![Stone Badge](https://YOUR_DOMAIN/api/stone/owner/repo)
```

下面给三条路径，按自己的偏好挑：

| 方式 | 适合 | 成本 | 冷启动 |
|------|------|------|--------|
| ① **Render**（推荐）   | 想用最少步骤把服务跑起来 | 免费档够用 | 15 min 闲置后 ~30s 唤醒 |
| ② **Fly.io**           | 想自己控制 region / 配置 | 免费额度受限 | 一直在线（设 1 instance） |
| ③ **GitHub Action 静态** | 只给自己 1-2 个仓库挂图 | 0 元 | 无（提交时手动跑） |

---

## ① Render（一键蓝图部署）

仓库已带 `render.yaml`，所以走 Blueprint 流程，不用一格一格填表单。

**首次部署：**

1. 打开 <https://render.com> → GitHub 登录
2. 顶部 **New +** → **Blueprint**
3. 选你 fork 的 `dentar142/StoneBadge` 仓库
4. Render 会读取 `render.yaml`，自动建一个 Web Service：
   - Name: `stonebadge`
   - Branch: `main`
   - Build: `npm install`
   - Start: `node server.js`
   - Plan: Free
5. 点 **Apply** → 等 5–10 分钟
   - 首次启动会自动跑 `template-generator.js` 生成石墩 + 马桶模板（这部分耗时 30s 左右，日志可见 "帧 1/20…20/20"）
6. 部署完成后拿到一个 URL，形如：
   ```
   https://stonebadge-xxxx.onrender.com
   ```

**测试：**

```bash
curl -sI https://stonebadge-xxxx.onrender.com/api/stone/dentar142/quiz-gen   # 应返 200 image/svg+xml
curl -sI https://stonebadge-xxxx.onrender.com/api/toilet/dentar142/quiz-gen  # 同上
```

**绑域名（可选）**：Render 的 Settings → Custom Domains 加你的域名，CNAME 到 `stonebadge-xxxx.onrender.com`，Render 自动签 Let's Encrypt 证书。

**冷启动注意**：Free 档闲置 15 分钟会休眠，第一个请求触发唤醒（约 30s）。GitHub 渲染 README 时图加载会慢一点。要永远在线就升 Starter (~7 USD/月) 或挂个外部 cron 每 10 分钟 ping 一下。

---

## ② Fly.io（一直在线 + 自选 region）

```bash
# 安装 flyctl
curl -L https://fly.io/install.sh | sh

# 登录
flyctl auth login

# 在仓库根目录初始化（首次会问几个问题，按默认回车即可）
cd /e/StoneBadge
flyctl launch --no-deploy

# flyctl 会生成 fly.toml；编辑确认 PORT/internal_port = 3000

# 部署
flyctl deploy

# 拿域名
flyctl status   # 看 Hostname
```

部署后可访问 `https://stonebadge.fly.dev/api/toilet/owner/repo`。

`fly.toml` 关键字段：
```toml
app = "stonebadge"
primary_region = "nrt"        # 东京机房，国内访问较快

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false  # 关掉自动休眠，避免冷启动
  min_machines_running = 1
```

---

## ③ 不部署 — 用 GitHub Action 生成静态 SVG（仅自用 1-2 个仓库时）

如果你只想给自己的几个仓库挂徽章，不打算给别人用，**完全不需要部署**。
quiz-gen 仓库里已经有这套：`.github/workflows/refresh-toilet-badge.yml`。

工作原理：
```
Actions 标签页 → Run workflow（手动触发）
    ↓
checkout 你的仓库
    ↓
git clone dentar142/StoneBadge fork
    ↓
MODEL=toilet 跑 template-generator.js 生成灰度模板
    ↓
用当前 HEAD SHA 跑 colorizer.js 染色
    ↓
git commit assets/toilet.svg 回到仓库
```

README 里直接引用相对路径：
```md
![Toilet](./assets/toilet.svg)
```

**优点**：零服务器、零费用、永不冷启动。
**缺点**：commit SHA 变了得手动点一下 Run workflow 才会更新颜色。

---

## 部署后的下一步

1. **更新 quiz-gen README**：把 `./assets/toilet.svg` 换成 `https://YOUR_DOMAIN/api/toilet/dentar142/quiz-gen`，删掉 `assets/toilet.svg` 和 `.github/workflows/refresh-toilet-badge.yml`（不再需要静态文件）。
2. **公告**：在 `dentar142/StoneBadge` 的 README 顶部贴出你的部署地址，让别人能直接用。
3. **监控**（可选）：UptimeRobot 加一个 5 分钟 ping，既保活又能在挂掉时邮件提醒。

---

## 常见问题

**Q: 为什么 Render 部署后第一次访问 `/api/toilet/...` 慢？**
A: 服务启动后才会按需生成 `templates/toilet-template.svg`（耗时约 30s）。生成一次后会一直缓存，后续请求 ~50ms。

**Q: 模板能预先生成提交进 git 吗？**
A: 可以，把 `templates/*.svg` 从 `.gitignore` 移除即可。我们的 fork 实际上已经把 `templates/toilet-template.svg` 提交进仓库了，省去 Render 上的首次冷启动模板生成。

**Q: 想换成自己设计的几何体？**
A: 编辑 `lib/toilet-geometry.js`，所有形状都是 Three.js 原生 primitives（CylinderGeometry / TorusGeometry / BoxGeometry）。改完跑 `MODEL=toilet node lib/template-generator.js` 重新生成模板，commit + push 即可。

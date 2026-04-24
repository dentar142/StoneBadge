# StoneBadge —— 石墩子 & 马桶版

> 给每个 GitHub 仓库挂一颗独一无二的 3D 旋转 SVG 徽章，颜色由该仓库最新
> commit SHA 决定 —— 每个仓库都长得不一样，颜色还会随 commit 演化。
>
> Fork 自 [professor-lee/StoneBadge](https://github.com/professor-lee/StoneBadge)，
> 在原有石墩子之外新增了程序化构建的**马桶**模型与 `/api/toilet` 端点。

[🇬🇧 English](./README.md) | 🇨🇳 中文

---

## 两个端点

```md
![石墩子](https://YOUR_DOMAIN/api/stone/<owner>/<repo>)
![马桶](https://YOUR_DOMAIN/api/toilet/<owner>/<repo>)
```

| 路径 | 模型来源 | 出处 |
|------|----------|------|
| `/api/stone/:owner/:repo` | `seatstone.glb`（二进制 3D 网格）| 上游 |
| `/api/toilet/:owner/:repo` | `lib/toilet-geometry.js`（用代码拼起来的 Three.js 原生几何体）| 本 fork |

---

## 工作原理（一段话）

构建时服务器用 **Three.js + JSDOM** 把 3D 模型烘焙成 20 帧逐帧动画的灰度
SVG（缓存为 `templates/*-template.svg`）。请求到来时 **`colorizer.js`** 调
GitHub API 拿到最新 commit SHA，把字节哈希成 HSL 参数（色相 / 饱和度 /
亮度都限定在安全区间），扫一遍 SVG 把所有 `fill` 改成配色版本，同时保留
原始的 3D 灰度梯度 —— ~50 ms、无状态。动画通过 SVG `<animate>` 标签每
0.5 秒切换一帧 visibility 实现。完整算法见上游 README。

---

## 本地启动

```bash
git clone https://github.com/dentar142/StoneBadge.git
cd StoneBadge
npm install
node server.js     # http://localhost:3000
```

首次启动时若缺模板会自动生成（石墩子约 30 秒、马桶约 30 秒）。改了几何
之后手动重新生成马桶模板：

```bash
MODEL=toilet node lib/template-generator.js
```

---

## 部署

详见 [DEPLOY_TOILET.md](./DEPLOY_TOILET.md)，提供三种路径：

1. **Render Blueprint** —— 一键部署，免费档；仓库已带 `render.yaml`
2. **Fly.io** —— 一直在线、可选 region
3. **GitHub Action 静态** —— 无需服务器，自家仓库手动触发刷新

---

## 想换个形状？

编辑 `lib/toilet-geometry.js`，全部用 Three.js 原生 primitives
（`CylinderGeometry` / `TorusGeometry` / `BoxGeometry`）。改完跑
`MODEL=toilet node lib/template-generator.js` 重新生成模板再 commit 即可。
渲染管线不关心源是 GLB 文件还是程序化拼出来的 `THREE.Group`。

---

## 致谢

- 原项目构思、渲染管线、染色算法：
  **[professor-lee / StoneBadge](https://github.com/professor-lee/StoneBadge)**
- 马桶模型 + `/api/toilet` 路由 + Render 蓝图 + 本 README：本 fork

MIT 协议。

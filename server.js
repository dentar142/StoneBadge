import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateTemplate } from './lib/template-generator.js';
import { colorizeSVG } from './lib/colorizer.js';
import { getRepoShortSHA } from './lib/github.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TEMPLATE_DIR = path.join(__dirname, 'templates');
const TEMPLATE_PATH = path.join(TEMPLATE_DIR, 'stone-template.svg');

// 提供模型文件给前端模板生成流程使用
app.get('/seatstone.glb', (req, res) => {
  res.type('model/gltf-binary');
  res.sendFile(path.join(__dirname, 'seatstone.glb'));
});

// 确认模板 SVG 是否存在，不存在则尝试服务端生成
async function ensureTemplate() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.log('模板 SVG 不存在，正在尝试服务端生成...');
    if (!fs.existsSync(TEMPLATE_DIR)) {
      fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
    }
    try {
      await generateTemplate(TEMPLATE_PATH);
      console.log('模板 SVG 生成成功。');
    } catch (err) {
      console.error('服务端生成模板失败:', err.message);
    }
  } else {
    console.log('模板 SVG 已存在。');
  }
}

// API: 获取着色后的石墩子 SVG
app.get('/api/stone/:owner/:repo', async (req, res) => {
  try {
    if (!fs.existsSync(TEMPLATE_PATH)) {
      return res.status(503).json({
        error: '模板尚未生成，请先生成模板文件。'
      });
    }
    const { owner, repo } = req.params;
    const sha = await getRepoShortSHA(owner, repo);
    const svg = colorizeSVG(TEMPLATE_PATH, sha);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(svg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// API: 解析仓库链接，返回徽章信息
app.post('/api/generate', async (req, res) => {
  try {
    const { repoUrl } = req.body;
    if (!repoUrl || typeof repoUrl !== 'string') {
      return res.status(400).json({ error: '请提供仓库链接' });
    }
    const match = repoUrl.match(/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/);
    if (!match) {
      return res.status(400).json({ error: '无效的 GitHub 仓库链接' });
    }
    const owner = match[1];
    const repo = match[2].replace(/\.git$/, '');
    const sha = await getRepoShortSHA(owner, repo);
    const badgeUrl = `/api/stone/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    res.json({ owner, repo, sha, badgeUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

ensureTemplate().then(() => {
  app.listen(PORT, () => {
    console.log(`Stone Badge 服务运行于 http://localhost:${PORT}`);
  });
});

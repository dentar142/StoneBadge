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
const TOILET_TEMPLATE_PATH = path.join(TEMPLATE_DIR, 'toilet-template.svg');

// 提供模型文件给前端模板生成流程使用
app.get('/seatstone.glb', (req, res) => {
  res.type('model/gltf-binary');
  res.sendFile(path.join(__dirname, 'seatstone.glb'));
});

// 确认指定模板 SVG 是否存在，不存在则尝试服务端生成
// model: undefined 走默认 GLB；'toilet' 切换到程序化马桶
async function ensureTemplateAt(targetPath, model) {
  if (fs.existsSync(targetPath)) {
    console.log(`${path.basename(targetPath)} 已存在。`);
    return;
  }
  if (!fs.existsSync(TEMPLATE_DIR)) fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
  console.log(`${path.basename(targetPath)} 不存在，正在尝试服务端生成...`);
  const prev = process.env.MODEL;
  if (model) process.env.MODEL = model;
  try {
    await generateTemplate(targetPath);
    console.log(`${path.basename(targetPath)} 生成成功。`);
  } catch (err) {
    console.error(`生成 ${path.basename(targetPath)} 失败:`, err.message);
  } finally {
    if (model) {
      if (prev === undefined) delete process.env.MODEL;
      else process.env.MODEL = prev;
    }
  }
}

// API: 获取着色后的石墩子 SVG
app.get('/api/stone/:owner/:repo', (req, res) => serveBadge(req, res, TEMPLATE_PATH));

// API: 获取着色后的马桶 SVG
app.get('/api/toilet/:owner/:repo', (req, res) => serveBadge(req, res, TOILET_TEMPLATE_PATH));

async function serveBadge(req, res, templatePath) {
  try {
    if (!fs.existsSync(templatePath)) {
      return res.status(503).json({
        error: '模板尚未生成，请先生成模板文件。'
      });
    }
    const { owner, repo } = req.params;
    const sha = await getRepoShortSHA(owner, repo);
    const svg = colorizeSVG(templatePath, sha);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(svg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

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

Promise.all([
  ensureTemplateAt(TEMPLATE_PATH, undefined),       // 石墩子（默认 GLB）
  ensureTemplateAt(TOILET_TEMPLATE_PATH, 'toilet'), // 马桶（程序化）
]).then(() => {
  app.listen(PORT, () => {
    console.log(`Stone Badge 服务运行于 http://localhost:${PORT}`);
    console.log(`  石墩子: GET /api/stone/:owner/:repo`);
    console.log(`  马桶:   GET /api/toilet/:owner/:repo`);
  });
});

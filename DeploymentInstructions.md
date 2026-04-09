# Stone Badge Deployment Instructions

Stone Badge is a Node.js service that generates a stone badge SVG from the latest commit SHA of a GitHub repository. The project has no frontend build step; once started, it serves a static page and API endpoints directly:

- Home page: enter a GitHub repository URL and generate a badge
- Template upload API: upload an SVG template for the service to use
- API: return a colored SVG badge by repository owner / repo

## Directory Layout

```text
project/
├── server.js              # Service entry point
├── lib/                   # Business logic
├── public/                # Static frontend page
├── templates/             # Output directory for generated SVG templates
├── seatstone.glb          # 3D model file, must be kept
├── package.json
└── README.md
```

## Requirements

- Node.js 18 or later
- npm
- Server access to GitHub API: `https://api.github.com`
- `seatstone.glb` must remain on the server

Node.js 18+ is recommended because the code uses native `fetch` and the project is configured as an ESM package in `package.json`.

## Environment Variables

The project uses only two environment variables:

- `PORT`: service port, default `3000`
- `GITHUB_TOKEN`: optional. Recommended to raise GitHub API rate limits and avoid throttling under higher traffic

Example:

```bash
export PORT=3000
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

## Local Startup

If you just want to run the service directly on the server, follow these steps:

```bash
cd /path/to/project
npm install
npm start
```

After startup, the default address is:

- Home page: `http://server-ip:3000/`

The template is generated automatically when the service starts. If the template is missing, check the service logs and confirm that `seatstone.glb` exists.

## Server Deployment Steps

The following example uses a Linux server. The recommended setup is `systemd + Nginx`, which keeps the service running at boot and exposes it through ports 80 / 443 via reverse proxy.

### 1. Prepare the Directory

It is recommended to place the project in a fixed directory, for example:

```bash
sudo mkdir -p /opt/stone-badge
```

Upload or clone the project into that directory, and make sure the final directory contains at least:

```text
server.js
package.json
lib/
public/
seatstone.glb
```

If `seatstone.glb` is missing, the automatic template generation and SVG coloring pipeline will not work.

If template generation fails, the usual causes are a missing `seatstone.glb`, an unsupported Node version, or insufficient write permissions for `templates/`.

### 2. Install Dependencies

```bash
cd /opt/stone-badge
npm install
```

After installation, `node_modules` will be created in the project directory. There is no additional build step.

### 3. Configure Service Account and Write Permissions

To make sure the first template generation and the template upload endpoint can write successfully, ensure that `templates/` is writable:

```bash
sudo mkdir -p /opt/stone-badge/templates
sudo chown -R www-data:www-data /opt/stone-badge/templates
```

If you plan to run the systemd service with a different user, replace `www-data` with that username, but keep `templates/` writable.

### 4. Configure Environment Variables

It is recommended to store environment variables in a separate file for easier systemd management:

```bash
sudo tee /etc/stone-badge.env >/dev/null <<'EOF'
PORT=3000
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
EOF
```

If you do not want to configure a GitHub token yet, you can keep only `PORT`, but API rate limiting is more likely under higher traffic.

### 5. Manually Verify the Startup Once

```bash
cd /opt/stone-badge
PORT=3000 npm start
```

On the first startup, the service will try to generate `templates/stone-template.svg` automatically. If generation fails, check the logs, confirm that `seatstone.glb` exists, and verify that `templates/` is writable. You can also upload the template manually through `/api/template` if needed.

### 6. Configure systemd Autostart

Create the service file:

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

If your Node.js binary is not located at `/usr/bin/node`, run:

```bash
which node
```

Then update `ExecStart` to use the actual path.

Next, reload and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable stone-badge
sudo systemctl start stone-badge
sudo systemctl status stone-badge
```

View logs:

```bash
sudo journalctl -u stone-badge -f
```

## Nginx Reverse Proxy

It is recommended not to expose port 3000 directly to the public. Instead, let Nginx listen on 80 / 443 and forward requests to the local Node service.

Basic example:

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

Notes:

- `client_max_body_size 20m` is important because the `/api/template` upload endpoint may receive larger SVG payloads
- If you later add HTTPS, you only need to add certificate configuration to this `server` block

After enabling the config, run:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### If a Firewall Is Enabled

If the server uses `ufw`, it is recommended to open only 80 and 443:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

If you do not use Nginx and expose the Node port directly, you must at least open the `PORT` value, but this is not recommended for production.

## First Launch Checklist

- The home page opens successfully
- `seatstone.glb` can be requested directly from the browser
- `templates/stone-template.svg` has been generated successfully
- Entering a GitHub repository URL returns a badge
- Static assets and APIs work correctly behind the reverse proxy

## API Reference

### 1. Get SVG Badge

```text
GET /api/stone/:owner/:repo
```

Example:

```text
GET /api/stone/vercel/next.js
```

The response body is an SVG image.

### 2. Parse Repository URL

```text
POST /api/generate
```

Request body:

```json
{
  "repoUrl": "https://github.com/owner/repo"
}
```

Returns the repository owner, repo, short SHA, and badge URL.

### 3. Upload Template SVG

```text
POST /api/template
```

This endpoint uploads SVG text and saves it to `templates/stone-template.svg`.

## Common Issues

### 1. The page says the template has not been generated yet

This means `templates/stone-template.svg` does not exist, or the automatic generation failed on first startup. Fix it by:

1. Confirming that `seatstone.glb` exists
2. Checking the service logs for template generation errors
3. Making `templates/` writable and restarting the service

### 2. GitHub API fails or rate limits

This is usually caused by a missing `GITHUB_TOKEN` or network access problems from the server. Recommended actions:

1. Confirm that the server can reach `api.github.com`
2. Configure `GITHUB_TOKEN`
3. Check proxy, firewall, and DNS settings

### 3. Template upload fails

Check the following:

1. Whether Nginx `client_max_body_size` is too small
2. Whether `templates/` has write permission
3. Whether `seatstone.glb` exists

### 4. The service exits immediately after startup

Check the following:

1. Whether Node.js is version 18 or later
2. Whether the Node path in `ExecStart` is correct
3. Whether `WorkingDirectory` points to the project root
4. The error output from `journalctl -u stone-badge -f`

## Update and Release Flow

When updating the code later, it is recommended to follow this flow:

```bash
cd /opt/stone-badge
git pull
npm install
sudo systemctl restart stone-badge
```

If the update does not change dependencies, `npm install` can be skipped, but keeping it in the process is safer.

## Notes

- The project has no frontend bundling step; files under `public/` are served directly as static assets
- The SVG template is generated on the server first, and if that fails, it can be uploaded manually through `/api/template`
- The recommended production setup is: `systemd` keepalive + `Nginx` reverse proxy + `GITHUB_TOKEN` to reduce rate-limit risk
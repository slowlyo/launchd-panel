import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * 归一化版本号，统一移除可选的 v 前缀。
 */
function normalizeVersion(rawVersion) {
  const version = String(rawVersion || '').trim().replace(/^v/, '');

  // 版本号为空时直接失败，避免把错误值写回仓库。
  if (!version) {
    throw new Error('缺少可用版本号');
  }

  return version;
}

/**
 * 同步 wails.json 中的产品版本号。
 */
function updateWailsConfig(rootDir, version) {
  const configPath = path.join(rootDir, 'wails.json');
  const content = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(content);

  config.info = {
    ...(config.info || {}),
    productVersion: version,
  };

  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

/**
 * 同步 Go 运行时默认版本号。
 */
function updateGoVersion(rootDir, version) {
  const versionPath = path.join(rootDir, 'version.go');
  const content = fs.readFileSync(versionPath, 'utf8');
  const versionPattern = /var appVersion = ".*"/;
  const nextContent = content.replace(versionPattern, `var appVersion = "${version}"`);

  // 未找到固定版本声明时直接失败，避免悄悄漏更。
  if (!versionPattern.test(content)) {
    throw new Error('未找到 version.go 中的 appVersion 声明');
  }

  fs.writeFileSync(versionPath, nextContent);
}

/**
 * 主入口负责协调多个版本文件的同步。
 */
function main() {
  const version = normalizeVersion(process.argv[2]);
  const rootDir = fileURLToPath(new URL('..', import.meta.url));

  updateWailsConfig(rootDir, version);
  updateGoVersion(rootDir, version);
}

main();

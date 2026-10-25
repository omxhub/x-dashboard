#!/usr/bin/env node

import { access, lstat, mkdir, readdir, realpath, rename, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ID = "x-dashboard";

export function defaultHermesHome(env = process.env, platform = process.platform) {
  if (env.HERMES_HOME) return path.resolve(env.HERMES_HOME);
  if (platform === "win32" && env.LOCALAPPDATA) return path.join(env.LOCALAPPDATA, "hermes");
  return path.join(os.homedir(), ".hermes");
}

function resolveBackupDir(hermesHome) {
  return path.resolve(hermesHome, "cache", "scratch", "archived-plugin-backups");
}

async function sweepSiblingBackups(parentDir, pluginId, backupRoot) {
  const entries = await readdir(parentDir, { withFileTypes: true }).catch(() => []);
  const prefix = `${pluginId}.backup-`;
  for (const entry of entries) {
    if (!entry.name.startsWith(prefix)) continue;
    await mkdir(backupRoot, { recursive: true });
    const src = path.join(parentDir, entry.name);
    const dst = path.join(backupRoot, `${path.basename(parentDir)}-${entry.name}`);
    await rm(dst, { recursive: true, force: true }).catch(() => {});
    await rename(src, dst);
  }
}

async function ensureDirectoryLink(source, destination, platform = process.platform, backupRoot = null) {
  const parentDir = path.dirname(destination);
  await mkdir(parentDir, { recursive: true });
  const effectiveBackupRoot = backupRoot || path.resolve(parentDir, "..", "cache", "scratch", "archived-plugin-backups");
  await sweepSiblingBackups(parentDir, path.basename(destination), effectiveBackupRoot);

  let backup;
  try {
    const current = await lstat(destination);
    if (current.isSymbolicLink()) {
      try {
        if ((await realpath(destination)) === (await realpath(source))) {
          return { status: "already-linked", source, destination };
        }
      } catch {
        // Broken or unreadable symlink is backed up below.
      }
    }

    await mkdir(effectiveBackupRoot, { recursive: true });
    const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
    backup = path.join(
      effectiveBackupRoot,
      `${path.basename(parentDir)}-${path.basename(destination)}.backup-${stamp}`,
    );
    await rename(destination, backup);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  await symlink(source, destination, platform === "win32" ? "junction" : "dir");
  return { status: "linked", source, destination, backup };
}

export async function installDesktopPlugin({
  repoRoot,
  hermesHome = defaultHermesHome(),
  platform = process.platform,
  linkWebPlugin = true,
}) {
  const desktopSource = path.resolve(repoRoot, "desktop");
  const desktopDest = path.resolve(hermesHome, "desktop-plugins", PLUGIN_ID);
  const backupRoot = resolveBackupDir(hermesHome);

  await access(path.join(desktopSource, "plugin.js"));
  const desktopResult = await ensureDirectoryLink(desktopSource, desktopDest, platform, backupRoot);

  let webResult = null;
  if (linkWebPlugin) {
    const webDestination = path.resolve(hermesHome, "plugins", PLUGIN_ID);
    if (path.resolve(repoRoot) !== webDestination) {
      webResult = await ensureDirectoryLink(path.resolve(repoRoot), webDestination, platform, backupRoot);
    } else {
      webResult = { status: "already-in-place", source: repoRoot, destination: webDestination };
    }
  }

  return {
    ...desktopResult,
    webPlugin: webResult,
  };
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const repoRoot = path.resolve(path.dirname(scriptPath), "..");
  installDesktopPlugin({ repoRoot })
    .then(({ destination, backup, status, webPlugin }) => {
      process.stdout.write(
        status === "already-linked"
          ? `X Dashboard Desktop is already linked at ${destination}\n`
          : `X Dashboard Desktop linked at ${destination}\n`,
      );
      if (backup) process.stdout.write(`Previous desktop plugin copy preserved at ${backup}\n`);
      if (webPlugin) {
        process.stdout.write(
          webPlugin.status === "already-linked" || webPlugin.status === "already-in-place"
            ? `X Dashboard Web plugin is ready at ${webPlugin.destination}\n`
            : `X Dashboard Web plugin linked at ${webPlugin.destination}\n`,
        );
        if (webPlugin.backup) {
          process.stdout.write(`Previous web plugin copy preserved at ${webPlugin.backup}\n`);
        }
      }
      process.stdout.write("In Hermes Desktop run Ctrl/Cmd+K → Reload desktop plugins.\n");
    })
    .catch((error) => {
      process.stderr.write(`Could not install X Dashboard Desktop: ${error.message}\n`);
      process.exitCode = 1;
    });
}

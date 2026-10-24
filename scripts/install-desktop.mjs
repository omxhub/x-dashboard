#!/usr/bin/env node

import { access, lstat, mkdir, realpath, rename, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ID = "x-dashboard";

export function defaultHermesHome(env = process.env, platform = process.platform) {
  if (env.HERMES_HOME) return path.resolve(env.HERMES_HOME);
  if (platform === "win32" && env.LOCALAPPDATA) return path.join(env.LOCALAPPDATA, "hermes");
  return path.join(os.homedir(), ".hermes");
}

async function ensureDirectoryLink(source, destination, platform = process.platform) {
  await mkdir(path.dirname(destination), { recursive: true });

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

    const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
    backup = `${destination}.backup-${stamp}`;
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

  await access(path.join(desktopSource, "plugin.js"));
  const desktopResult = await ensureDirectoryLink(desktopSource, desktopDest, platform);

  let webResult = null;
  if (linkWebPlugin) {
    const webDestination = path.resolve(hermesHome, "plugins", PLUGIN_ID);
    if (path.resolve(repoRoot) !== webDestination) {
      webResult = await ensureDirectoryLink(path.resolve(repoRoot), webDestination, platform);
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

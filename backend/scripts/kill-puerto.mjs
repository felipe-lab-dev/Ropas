#!/usr/bin/env node
/**
 * Mata cualquier proceso escuchando en el puerto indicado.
 *
 * Uso:
 *   node scripts/kill-puerto.mjs 3001
 *
 * Necesario en Windows: Stop-Process / Ctrl+C de pnpm dev NO mata a los
 * procesos hijos (nest start --watch, ts-node-dev), que quedan vivos
 * ocupando el puerto. Este script los limpia antes de cada `pnpm dev`
 * vía el hook `predev`.
 *
 * Cross-platform (Windows / Linux / Mac). Idempotente y silencioso si el
 * puerto ya está libre.
 */
import { execSync } from 'node:child_process';

const puerto = process.argv[2];
if (!puerto || !/^\d+$/.test(puerto)) {
  console.error('Uso: node kill-puerto.mjs <puerto>');
  process.exit(1);
}

const esWindows = process.platform === 'win32';

function exec(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
}

try {
  let pids = [];
  if (esWindows) {
    const ps = `Get-NetTCPConnection -State Listen -LocalPort ${puerto} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`;
    const out = exec(`powershell -NoProfile -Command "${ps}"`);
    pids = out.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  } else {
    try {
      const out = exec(`lsof -ti:${puerto}`);
      pids = out.split('\n').filter(Boolean);
    } catch { /* lsof retorna error si no hay matches */ }
  }

  if (pids.length === 0) {
    process.exit(0); // puerto libre, nada que hacer
  }

  for (const pid of pids) {
    try {
      if (esWindows) execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
      else execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
      console.log(`[kill-puerto] Liberado :${puerto} (PID ${pid})`);
    } catch {
      // El proceso pudo haber muerto entre la detección y el kill — OK.
    }
  }
} catch {
  // Silencio: no encontrar el puerto no es un error.
}

process.exit(0);

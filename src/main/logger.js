'use strict';
const fs = require('fs');
const path = require('path');

function createLogger(baseDir) {
  const dir = path.join(baseDir, 'logs');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'app.log');
  function write(level, message, details) {
    const safe = details instanceof Error ? { name: details.name, message: details.message, stack: details.stack } : details;
    const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...(safe ? { details: safe } : {}) });
    fs.appendFileSync(file, `${line}\n`, 'utf8');
  }
  return { file, info: (m,d) => write('info',m,d), warn: (m,d) => write('warn',m,d), error: (m,d) => write('error',m,d) };
}
module.exports = { createLogger };

'use strict';
const { spawn } = require('child_process');
const electron = require('electron');
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron,['.'],{cwd:require('path').resolve(__dirname,'..'),env,stdio:'inherit'});
child.on('exit',code=>process.exitCode=code ?? 1);

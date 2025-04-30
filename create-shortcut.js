const { writeFileSync } = require('fs');
const path = require('path');

const desktopPath = path.join(require('os').homedir(), 'Desktop');
const shortcutPath = path.join(desktopPath, 'CameraFrame.lnk');

const ws = require('windows-shortcuts');

ws.create(shortcutPath, {
    target: path.join(__dirname, 'node_modules', '.bin', 'electron.cmd'),
    args: '.',
    icon: path.join(__dirname, 'iconnn.png'),
    desc: 'Camera Frame Application'
}); 
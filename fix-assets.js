const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'assets');
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}

// 1x1 transparent PNG base64
const emptyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const files = ['icon.png', 'splash.png', 'adaptive-icon.png', 'favicon.png'];

files.forEach(file => {
    fs.writeFileSync(path.join(dir, file), Buffer.from(emptyPng, 'base64'));
});

console.log('Assets creados correctamente.');

const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, '..', 'pantallaf.jpg');
const destPath = path.join(__dirname, 'assets', 'pantallaf.jpg');

try {
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log('[Assets] pantallaf.jpg copiado exitosamente a assets/');
  } else {
    console.warn('[Assets] No se encontró el archivo origen en ' + sourcePath);
  }
} catch (error) {
  console.error('[Assets] Error al copiar pantallaf.jpg:', error.message);
}

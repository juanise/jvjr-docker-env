import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Read jvjr-env.json from the project root (where it's generated)
let VARS = {};
try {
  const projectRoot = process.cwd();
  const envJsonPath = path.join(projectRoot, 'jvjr-env.json');
  if (fs.existsSync(envJsonPath)) {
    VARS = JSON.parse(fs.readFileSync(envJsonPath, 'utf8'));
  }
} catch (e) {
  // File doesn't exist yet, will be created during install
}

class EnvProvider {

  static get envVars() {
    return VARS;
  }

  static value(name) {
    if (!(name in this.envVars)) {
      return;
    }

    const value = this.envVars[name];
    // console.log('El valor de la clave es:', value);
    if (!value) {
      return;
    }

    if (value.startsWith('$VUE_APP_') || value.startsWith('$REACT_APP_')) {
      const envName = value.substr(1);
      const envValue = process.env[envName];
      // console.log('Valor de entorno devuelto', envValue);
      if (envValue) {
        return envValue;
      } else {
        return;
      }
    } else {
      // console.log('valor introducido', value);
      return value;
    }
  }
}

export default EnvProvider;

var dotenv = require('dotenv');

dotenv.config();

const VARS = require('../../jvjr-env.json');

class EnvProvider {

  static get envVars() {
    return VARS;
  }

  static value(name) {
    //console.log('Searching key', name);
    // if (!name.startsWith('JVJR_CONFIG_') && !(name in this.envVars)) {
    //   //console.log('Not found', name);
    //   return;
    // }
    if (!(name in this.envVars)) {
      return;
    }


    // let value = '';
    //
    // if (name.startsWith('JVJR_CONFIG_')) {
    //   if (process.env.NODE_ENV === 'development') {
    //     name = name.replace('JVJR_CONFIG_', '');
    //     value = this.envVars[name];
    //   } else {
    //     return '#' + name;
    //   }
    // } else {
    //   value = this.envVars[name];
    // }

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

module.exports = EnvProvider;

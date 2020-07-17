import dotenv from 'dotenv';


dotenv.config();

const VARS = require('./DOCKER_APP_ENV_VARS.json');

export default class ConfigProvider {

  static get CONFIG() {
    return VARS;
  }

  static value(name) {
    if (!(name in this.CONFIG)) {
      return;
    }

    const value = this.CONFIG[name];

    if (!value) {
      return;
    }

    if (value.startsWith('$VUE_APP_')) {
      const envName = value.substr(1);
      const envValue = process.env[envName];
      if (envValue) {
        return envValue;
      } else {
        return;
      }
    } else {
      return value;
    }
  }

}

import dotenv from 'dotenv';

dotenv.config();

const VARS = require('./DOCKER_APP_ENV_VARS.json');

function config() {
  return VARS;
}

export function value(name) {
  if (!(name in config())) {
    return;
  }

  const value = config()[name];

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


#!/bin/sh
mkdir -p dist/js
printf 'window.config={base_url:"$VUE_APP_BASE_URL"};' > dist/js/app.main.js
printf '<html><body><script src="/js/app.main.js"></script></body></html>' > dist/index.html

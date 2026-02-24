#!/bin/sh
mkdir -p dist/js
printf 'window.config={api_url:"$VUE_APP_API_URL",title:"$VUE_APP_TITLE",version:"$VUE_APP_VERSION"};' > dist/js/app.main.js
printf '<html><body><script src="/js/app.main.js"></script></body></html>' > dist/index.html

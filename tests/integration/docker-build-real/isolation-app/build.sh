#!/bin/sh
mkdir -p dist/js
printf 'window.config={secret:"$VUE_APP_SECRET",public:"$VUE_APP_PUBLIC"};' > dist/js/app.main.js
printf '<html><body><script src="/js/app.main.js"></script></body></html>' > dist/index.html

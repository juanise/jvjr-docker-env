#!/bin/sh
mkdir -p dist/js
printf 'window.config={api_url:"$REACT_APP_API_URL",api_key:"$REACT_APP_API_KEY",version:"$REACT_APP_VERSION"};' > dist/js/app.main.js
printf '<html><body><script src="/js/app.main.js"></script></body></html>' > dist/index.html

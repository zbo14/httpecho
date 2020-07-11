#!/bin/sh

if [ -z "$1" ]; then
  node index.js > /var/log/httpecho/http.log
else
  node index.js \
    -c /etc/httpecho/cert \
    -k /etc/httpecho/private/key \
    -s \
    > /var/log/httpecho/https.log
fi

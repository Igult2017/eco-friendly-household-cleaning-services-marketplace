FROM nginx:1.27-alpine

RUN apk add --no-cache openssl

COPY nginx.conf    /etc/nginx/nginx.conf
COPY proxy_params  /etc/nginx/proxy_params
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

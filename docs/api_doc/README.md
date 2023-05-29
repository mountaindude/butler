# Generate API docs

```bash
cd src
npm i -g @redocly/cli@latest
node butler.js -c ./config/config-gen-api-docs.yaml --no-qs-connection &
sleep 10
curl localhost:8081/documentation/yaml > ../docs/api_doc/butler-api.yaml
curl localhost:8081/documentation/json > ../docs/api_doc/butler-api.json
npx @redocly/cli build-docs ../docs/api_doc/butler-api.yaml --output ../docs/api_doc/butler-api.html
ls -la ../docs/api_doc
pkill -f 'node butler.js'
```
# Running Sapper in a Google Cloud Function

This readme describes my experiment to get a Sapper site to run in a Google Cloud Function. Better ways to run Sapper in production are available, for instance the svelte.dev website runs on Google Cloud Run.

## Project

Created an new Sapper project and build the project:

```bash
npx degit sveltejs/sapper-template#rollup gcloud-sapper
cd gcloud-sapper
npm install
```

## Entry Point

We will use Express because it is already part of the cloud environment and Polka has an issue
[Cannot set property path](https://github.com/lukeed/polka/pull/86). In the `src/server.js` we
will only listen when the script is started as main and we export the request handler:

```js
const app = express()
    .use(
        compression({ threshold: 0 }),
        sirv('static', { dev }),
        sapper.middleware()
    );

if (require.main === module) {
    // only listen when started as main
    app.listen(PORT, err => {
        if (err) console.log('error', err);
    });
}

exports.app = app;
```

Functions are started from the `index.js` and its entry point must be exported. The entry point has to expose a node request handler with the name of the deploy function. After `npm run build` the request handler of the Sapper server is inside `__sapper__/build/server/server.js`.

```js
// index.js
const server = require('./__sapper__/build/server/server.js');
exports.sapper = (req, res) => {
    server.app(req, res);
};
```

The build files are in .gitignore but they need to be deployed so lets remove them from .gitignonore:

```
# changes to .gitignore
# remove /__sapper__/ and add:
/__sapper__/dev
/__sapper__/export
```

The deploy command can be added as a script in the `package.json`:

```json
"deploy": "gcloud functions deploy sapper --runtime nodejs10 --trigger-http --region=europe-west1"
```

The app can now be deployed using `npm run deploy`.

## Changing BaseURL

Deploying again now gives responses but the assets show up as broken links because the base href is `/`. So we change the baseUrl of the request to include the function name:

```js
// index.js
const server = require('./__sapper__/build/server/server.js');
exports.sapper = (req, res) => {
    // ...
    req.baseUrl = `/${process.env.FUNCTION_TARGET}`;
    server.app(req, res);
};
```

## Fetch Fix

The site now seems to work however doing a page refresh on `/sapper/blog` gives an error:

```
invalid json response body at http://127.0.0.1:8080/sapper/blog.json
reason: Unexpected token < in JSON at position 0
```

The blog index page `src/routes/blog/index.svelte` executes a ``this.fetch(`blog.json`)`` however fetch request default to http://localhost:8080/ when no url is supplied. This doesn't work in the cloud environment so we need to supply the
full trigger url. The trigger url can be extracted from the request headers:

```js
// index.js
    const func = process.env.FUNCTION_TARGET;
    req.baseUrl = `/${func}`;
    process.env.TRIGGER_URL = `https://${req.headers.host}/${func}`;
```

The trigger url is now available in the process env when the code is executed on the server:

```js
// src/routes/blog/index.svelte
    const base = typeof process === "undefined" ? "" : process.env.TRIGGER_URL;
    return this.fetch(`${base}blog.json`).then(r => r.json()).then(posts => {

// src/routes/blog/[slug].svelte
    const base = typeof process === "undefined" ? "" : process.env.TRIGGER_URL;
    const res = await this.fetch(`${base}blog/${params.slug}.json`);
```

## Conclusion

Using some workarounds its possible to get Sapper to run on a Google Cloud Function. This can be useful for development/testing purposes. Please let me know if these workarounds can be performed in more convenient ways :)

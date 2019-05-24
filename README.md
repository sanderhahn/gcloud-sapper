# Running Sapper in a Google Cloud Function

This readme describes my experiment to get a Sapper site to run in a Google Cloud Function. Better ways to run Sapper in production are available, for instance the svelte.dev website runs on Google Cloud Run.

## Project

Created an new Sapper project and build the project:

```bash
npx degit sveltejs/sapper-template#rollup gcloud-sapper
cd gcloud-sapper
npm install && npm run build
```

## Entry Point

Functions are loaded from the `index.js` and its entry point must be exported. The entry point has to expose a node request handler and starting a server is not necessary.

For instance a minimal hello world would be:

```js
// index.js
exports.hello = (req, res) => {
  res.send('Hello World!');
};
```

The command to deploy this to a node version 10 environment in Europe is:

```bash
gcloud functions deploy hello --runtime nodejs10 --trigger-http --region=europe-west1
```

The deploy command can be added as a script in the `package.json`:

```json
"deploy": "gcloud functions deploy sapper --runtime nodejs10 --trigger-http --region=europe-west1"
```

The entry point of the Sapper server is inside `__sapper__/build/server/server.js`.
However the server starts listening to a port and we only need the request handler.
So lets change to the last lines of the server to expose the polka handler:

```js
polka() // You can also use Express
    .use(
        compression({ threshold: 0 }),
        sirv('static', { dev }),
        middleware()
    )
    .listen(PORT, err => {
        if (err) console.log('error', err);
    });
//# sourceMappingURL=server.js.map
```

We will use Express because it is already part of the cloud environment and Polka has an issue
[Cannot set property path](https://github.com/lukeed/polka/pull/86):

```js
// export handler as app
const express = require('express');
exports.app = express()
    .use(
        compression({ threshold: 0 }),
        sirv('static', { dev }),
        middleware()
    )
    // we don't want to listen
    // .listen(PORT, err => {
    //     if (err) console.log('error', err);
    // });
//# sourceMappingURL=server.js.map
```

Beware: rerunning `npm run build` will overwrite these changes.

Now we can import the app handler in our index.js:

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

The app can now be deployed using `npm run deploy`, however visiting its url results in `Error: could not handle the request`. The log entries of the functions will show:

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

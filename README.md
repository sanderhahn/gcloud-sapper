# Running Sapper on Google Cloud

This readme describes my experiments to get a Sapper site to run in a Google Cloud Function. Another way to run Sapper in production is to user Google Cloud Run described below.

## Deploy on Google Cloud Function

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

The build files should be deployed so we change `.gcloudignore` to include the build directory.

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
    const base = typeof process !== "undefined" ? process.env.TRIGGER_URL || "" : "";
    return this.fetch(`${base}blog.json`).then(r => r.json()).then(posts => {

// src/routes/blog/[slug].svelte
    const base = typeof process !== "undefined" ? process.env.TRIGGER_URL || "" : "";
    const res = await this.fetch(`${base}blog/${params.slug}.json`);
```

## Deploy on Google Cloud Run

Running in a Google Cloud Run instance is not very complicated.
However Google Cloud Run is at the moment limited to in the `us-central1` region.
The Svelte site is deployed using Google Cloud Run and the relevant parts are:

- [.dockerignore](https://github.com/sveltejs/svelte/blob/master/site/.dockerignore)
- [.gcloudignore](https://github.com/sveltejs/svelte/blob/master/site/.gcloudignore)
- [Dockerfile](https://github.com/sveltejs/svelte/blob/master/site/Dockerfile)
- [Makefile](https://github.com/sveltejs/svelte/blob/master/site/Makefile)
- [package.json sapper script](https://github.com/sveltejs/svelte/blob/master/site/package.json#L9)

These files/snippets can be copied to your own Sapper project and you will have to replace `PROJECT` with the one you setup in the Google Console. Also the Google command line tools sometimes give a errors if your user doesn't have enough priviledges. However the error message does include a link that you can follow to fix this!

Sometimes when things don't work as expected it is handy to test your Docker image locally first.
One of the problems i keep running into is that the `__sapper__/build` directory is in .gitignore.
However default .gcloudignore generated includes the .gitignore and this will ensure that the sapper build assets are not deployed.
So if things don't work best check if these assets are correctly deployed in the docker image first.
You can also check the Google Cloud Run log files for messages.

```bash
# build your image locally (note the hash output: it identifies your image)
docker build .
export IMAGE_HASH=3bd5f8a99d18
# list all images
docker images
# start a shell on your image
docker run -p 3000:3000 -it $IMAGE_HASH sh
# start your image demonized and map port 3000 to http://localhost:3000/ to try in your browser
docker run -d --restart=always -p 3000:3000 $IMAGE_HASH
# list all active containers
docker ps
# kill off one process
docker kill 03b21c05a96d

# build the remote gcr hosted image (note the full gcr.io/ url: it identifies your remote image)
make deploy

export REMOTE_IMAGE=gcr.io/your-project-239306/sapper-website:892e0b2
# start a shell the remotely build image on your local system
docker run -p 3000:3000 -it $REMOTE_IMAGE sh
ls __sapper__/build
# start the remote image as demon
docker run -d -p 3000:3000 -it $REMOTE_IMAGE
```

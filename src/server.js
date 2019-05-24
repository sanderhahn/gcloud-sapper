import sirv from 'sirv';
import express from 'express';
import compression from 'compression';
import * as sapper from '@sapper/server';

const { PORT, NODE_ENV } = process.env;
const dev = NODE_ENV === 'development';

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

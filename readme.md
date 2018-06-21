# hapi-version

* [Server decorations](#server-decorations)
    * [`server.routev([options])`](#serverroutevoptions)
* [Options](#options)
* [Example](#example)


Inspired by [Your API versioning is wrong, which is why I decided to do it 3 different wrong ways]
this plugin makes it simple to implement all three methods of API versioning described in the article.

1.  URL versioning
1.  custom header
1.  Accept header

The accept header must contain `version=<version>`, for example:
`curl -i http://localhost:3000/api/bar -H 'Accept: version=v2'`

## Server decorations

The plugin decorates the server with a methods for adding routes.

### `server.routev([options])`

The options are the same as the route configuration object with the following
additions:

- `version` - the version of the route. [default: 'v1']
- `isDefault` - the default version of the route. This route, without version
  prefix, will invoke the appropriate version of the route. [default: false]

## Options

The following plugin options are available:

- `header` - the custom header to look at in order to choose which endpoint to
  invoke.
- `responseHeader` - response header to indicate which version of the route
  was invoked. [default: 'version']
- `prefix` - prefix for the route [default: '/']
- `redirect` - whether the plugin should rewrite the url or redirect the user
  with a 302 to the new endpoint [default: false]

## Example

```
const Hapi = require('hapi');
const Hoek = require('hoek');
const HapiVersion = require('./lib');
const Blipp = require('blipp');

const server = new Hapi.Server();
server.connection({ port: 3000 });

server.register([Blipp, { register: HapiVersion, options: { prefix: '/api', redirect: true } }]);

server.routev({ version: 'v1', isDefault: true, method: 'GET', path: '/', handler: (request, reply) => {

    return reply('foo');
} });

server.routev({ version: 'v1', isDefault: false, method: 'GET', path: '/bar', handler: (request, reply) => {

    return reply('foo');
} });

server.routev({ version: 'v2', isDefault: true, method: 'GET', path: '/bar', handler: (request, reply) => {

    return reply('bar v2');
} });

server.start((err) => {

    Hoek.assert(!err, err);
});
```


The code above makes the following routes available:

```
*  GET    /api             # alias of /api/v1
*  GET    /api/bar         # alias of /api/v2/bar
*  GET    /api/v1
*  GET    /api/v1/bar
*  GET    /api/v2/bar
```

[Your API versioning is wrong, which is why I decided to do it 3 different wrong ways]: https://www.troyhunt.com/your-api-versioning-is-wrong-which-is/

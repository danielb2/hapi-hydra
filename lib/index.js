'use strict';
const Hoek = require('hoek');
const Joi = require('joi');
const Path = require('path');

const internals = {
    versions: {},
    defaults: {},
    schema: {
        header: Joi.string().default('api-version'),
        responseHeader: Joi.string().default('version'),
        prefix: Joi.string().default('/'),
        redirect: Joi.boolean().default(false)
    },
    routeSchema: Joi.object({
        version: Joi.string().default('v1'),
        isDefault: Joi.boolean().default(false)
    }).unknown()
};

exports.register = function (server, options, next) {

    options = Joi.attempt(options, internals.schema);
    server.decorate('server', 'routev', internals.versions.bind({ server, options }));
    server.ext('onRequest', internals.route.bind({ options }));
    server.ext('onPostHandler', internals.setVersionHeader.bind({ options }));

    return next();
};


exports.register.attributes = {
    pkg: require('../package.json')
};

internals.versions = function (args) {

    if (toString.call(args).indexOf('Array') === -1) {
        internals.version.bind(this)(args);
        return;
    }

    args.forEach((route) => {
        internals.version.bind(this)(route);
    })
};

internals.version = function (args) {

    args = Joi.attempt(args, internals.routeSchema);
    const { version, isDefault } = args;
    delete args.version;
    delete args.isDefault;

    let path = args.path;
    if (path[path.length - 1 ] === '/') {
        path = path.substring(0, path.length - 1);
    }

    const uri_path = Path.join(this.options.prefix, version, path);
    args.path = Path.join(this.options.prefix, path);

    internals.versions[uri_path] = version;
    if (isDefault) {
        Hoek.assert(!internals.defaults[args.path], `Default route already exists for ${args.path}`);
        this.server.route(args);
        internals.versions[args.path] = version;
        internals.defaults[args.path] = version;
    }
    args.path = uri_path;
    this.server.route(args);
};


internals.route = function (request, reply) {

    if (!internals.defaults[request.path]) {
        return reply.continue();
    }

    let version;
    version = request.headers[this.options.header.toLowerCase()];
    version = version || internals.parseAcceptHeader(request.headers.accept);

    if (version) {
        let path = request.path.split(this.options.prefix);
        path = Path.join(this.options.prefix, version, ...path);
        if (this.options.redirect) {
            if (internals.defaults[request.path]) {
                return reply.redirect(path);
            }
            return reply.continue();
        }
        request.setUrl(path);
    }

    return reply.continue();
};


internals.parseAcceptHeader = function (accept) {

    if (!accept) {
        return;
    }
    const version = accept.match(/version=([^;]*)/);
    if (version) {
        return version[1];
    }
    return version;
};


internals.setVersionHeader = function (request, reply) {

    request.response.headers[this.options.responseHeader] = internals.versions[request.path];
    return reply.continue();
};

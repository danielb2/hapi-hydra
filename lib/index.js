'use strict';
const Call = require('call');
const Hoek = require('hoek');
const Joi = require('joi');
const Path = require('path');
const Url = require('url');

const Pkg = require('../package.json');

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
        method: Joi.string().lowercase(),
        isDefault: Joi.boolean().default(false)
    }).unknown()
};


exports.register = function (server, options, next) {

    options = Joi.attempt(options, internals.schema);

    const hydra = new Hydra(options);
    server.expose({ hydra });

    server.decorate('server', 'routev', function (args) {

        const { hydra } = this.plugins[Pkg.name];
        hydra.server = this;

        if (toString.call(args).indexOf('Array') === -1) {
            hydra.addRoute(args);
            return;
        }

        args.forEach((route) => {
            hydra.addRoute(route);
        })
    });

    server.ext('onRequest', internals.route);
    server.ext('onPreResponse', internals.setVersionHeader);

    return next();
};


exports.register.attributes = {
    pkg: Pkg
};


class Hydra {
    constructor (options) {

        this.versions = new Call.Router();
        this.defaults = new Call.Router();
        this.map = {};
        this.server = undefined;
        this.options = options;
    }

    addRoute (args) {

        args = Joi.attempt(args, internals.routeSchema);
        const { version, isDefault } = args;
        delete args.version;
        delete args.isDefault;

        let path = args.path;
        if (path[path.length - 1 ] === '/') {
            path = path.substring(0, path.length - 1);
        }

        const uri_path = Path.join(this.options.prefix, version, path);
        this.setVersion(uri_path, args.method, version);
        args.path = Path.join(this.options.prefix, path);

        if (isDefault) {
            // Hoek.assert(!this.defaultMatch(args.method, args.path), `Default route already exists for ${args.path}`);
            this.server.route(args);
            this.setVersion(args.path, args.method, version);
            this.defaults.add({ method: args.method, path: args.path });
        }
        args.path = uri_path;
        this.server.route(args);
    };

    setVersion (path, method, version) {

        this.map[method] = this.map[method] || {};
        this.map[method][path] = version;
        const route = this.versions.add({ path, method });
    };

    versionMatch (method, path) {

        const route = this.versions.route(method, path);
        if (route.isBoom) {
            return null;
        }
        return this.map[method][route.route];
    };

    defaultMatch (method, path) {

        return !this.defaults.route(method, path).isBoom;
    };

    parseAcceptHeader (accept) {

        if (!accept) {
            return;
        }
        const version = accept.match(/version=([^;]*)/);
        if (version) {
            return version[1];
        }
        return version;
    };
}


internals.route  = function (request, reply) {

    const uri = request.url.href;
    const parsed = Url.parse(uri, true)

    const { hydra } = request.server.plugins[Pkg.name];
    const isDefault = hydra.defaultMatch(request.method, request.path);
    if (!isDefault) {
        return reply.continue();
    }
    const version = request.headers[hydra.options.header.toLowerCase()] ||
        hydra.parseAcceptHeader(request.headers.accept);

    if (version) {
        const splitPath = request.path.split(hydra.options.prefix);
        parsed.pathname = Path.join(hydra.options.prefix, version, ...splitPath);
        const path = Url.format(parsed);
        if (hydra.options.redirect) {
            return reply.redirect(path);
        }
        request.setUrl(path);
    }

    return reply.continue();
};


internals.setVersionHeader = function (request, reply) {

    const { hydra } = request.server.plugins[Pkg.name];
    request.response.headers = request.response.headers || {}; // bug in hapi ?

    request.response.headers[hydra.options.responseHeader] = hydra.versionMatch(request.method, request.path);
    return reply.continue();
};

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

    server.decorate('server', 'routev', function (args) {

        if (toString.call(args).indexOf('Array') === -1) {
            internals.addRoute.bind({ self: this, options, server })(args);
            return;
        }

        args.forEach((route) => {
            internals.addRoute.bind({ self: this, options, server })(route);
        })
    });

    server.ext('onRequest', internals.route.bind({ options }));
    server.ext('onPostHandler', internals.setVersionHeader.bind({ options }));

    return next();
};


exports.register.attributes = {
    pkg: require('../package.json')
};


internals.addRoute = function (args) {

    args = Joi.attempt(args, internals.routeSchema);
    const { version, isDefault } = args;
    delete args.version;
    delete args.isDefault;

    let path = args.path;
    if (path[path.length - 1 ] === '/') {
        path = path.substring(0, path.length - 1);
    }

    const uri_path = Path.join(this.options.prefix, version, path);
    internals.setVersion(uri_path, version);
    args.path = Path.join(this.options.prefix, path);

    if (isDefault) {
        Hoek.assert(!internals.defaultMatch(args.path), `Default route already exists for ${args.path}`);
        this.server.route.bind(this.self)(args);
        internals.setVersion(args.path, version);
        internals.setDefault(args.path, version);
    }
    args.path = uri_path;
    this.server.route.bind(this.self)(args);
};


internals.setPath = function (path, version, obj) {

    obj[path.replace(/{[^}]*}/, '.*')] = version;
};


internals.setVersion = function (path, version) {

    internals.setPath(path, version, internals.versions);
};


internals.setDefault = function (path, version) {

    internals.setPath(path, version, internals.defaults);
};


internals.versionMatch = function (path) {

    return internals.pathMatch(path, internals.versions);
};


internals.defaultMatch = function (path) {

    return internals.pathMatch(path, internals.defaults);
};


internals.pathMatch = function (path, pathObj) {

    for (const versionPath in pathObj) {
        const version = pathObj[versionPath];
        const match = new RegExp('^' + versionPath + '$');
        const res = path.match(match);
        if (!res) { continue; }
        return version;
    }
};


internals.route = function (request, reply) {

    const v = internals.defaultMatch(request.path);
    if (!v) {
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

    request.response.headers = request.response.headers || {}; // bug in hapi ?
    request.response.headers[this.options.responseHeader] = internals.versionMatch(request.path);
    return reply.continue();
};

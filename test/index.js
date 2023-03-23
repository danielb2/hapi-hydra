'use strict';
const Blipp = require('blipp');
const Boom = require('@hapi/boom');
const Code = require('@hapi/code');
const Hapi = require('@hapi/hapi');
const Joi = require('joi');
const Lab = require('@hapi/lab');

const HapiVersion = require('../lib');

const internals = {};

// Test shortcuts

const lab = exports.lab = Lab.script();
const { describe, it, before } = lab;
const expect = Code.expect;

internals.server = async function (options) {

    options = Joi.attempt(options, Joi.object({
        header: Joi.any(),
        responseHeader: Joi.string().default('version'),
        prefix: Joi.string().default('/'),
        redirect: Joi.boolean().default(false)
    }));

    const server = new Hapi.Server();

    await server.register([{
        plugin: HapiVersion,
        options
    }, {
        plugin: Blipp
    }]).catch(err => {

        if (err) {
            console.log(err);
        }
    });

    server.bind({ message: 'bind must work' });

    server.routev({
        method: 'GET',
        version: 'v1',
        isDefault: true,
        path: '/',
        handler: function (request, h) {

            return 'root 1';
        }
    });

    server.routev({
        method: 'GET',
        version: 'v1',
        path: '/test',
        handler: function (request, h) {

            return ('version 1' + ( request.query.hello || ''));
        }
    });

    server.routev({
        method: 'GET',
        version: 'v2',
        isDefault: true,
        path: '/test',
        handler: function (request, h) {

            return 'version 2';
        }
    });

    server.routev({
        method: 'GET',
        version: 'v3',
        path: '/test',
        handler: function (request, h) {

            return 'version 3';
        }
    });

    server.routev({
        config: { description: 'Just a versioned path but with no default' },
        method: 'GET',
        path: '/nodefault',
        handler: function (request, h) {

            return 'nodefault';
        }
    });

    // var p = require('purdy');
    // p(server.plugins.blipp.info(), { depth: 99 });

    // process.exit();
    return server;
};


describe('default options', () => {

    let server;

    describe('with params', () => {

        before(async() => {

            server  = await internals.server();
            server.routev({
                method: 'GET',
                version: 'v1',
                isDefault: false,
                path: '/we/use/{params}/here',
                handler: function (request, h) {

                    return 'version 1';
                }
            });
            server.routev({
                method: 'GET',
                version: 'v2',
                isDefault: true,
                path: '/we/use/{params}/here',
                handler: function (request, h) {

                    return 'version 2';
                }
            });
            server.routev({
                method: 'GET',
                version: 'v2',
                isDefault: false,
                path: '/we/use/{params}/here/{too}',
                handler: function (request, h) {

                    return 'version 2';
                }
            });
            server.routev({
                method: 'GET',
                version: 'v1',
                isDefault: true,
                path: '/we/use/{params}/here/{too}',
                handler: function (request, h) {

                    return 'version 1';
                }
            });

        });

        it('should work with multiple params for default route', async() => {

            const res = await server.inject({ url: '/we/use/123/here/too' });

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('version 1');
            expect(res.headers.version).to.equal('v1');
        });

        it('should work with params for default route', async() => {

            const res = await server.inject({ url: '/we/use/123/here' });

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('version 2');
            expect(res.headers.version).to.equal('v2');
        });

        it('should fail to set the same default route', async() => {

            const fail = function () {
                server.routev({
                    method: 'GET',
                    version: 'v2',
                    isDefault: true,
                    path: '/we/use/{params}/here',
                    handler: function (request, h) {

                        return 'version 2';
                    }
                });
            };

            expect(fail).to.throw();
        });

        it('should work with params when calling using header', async() => {

            const headers = { 'api-version': 'v1' };
            const res = await server.inject({ url: '/we/use/123/here', headers });

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('version 1');
            expect(res.headers.version).to.equal('v1');
        });
    });

    describe('multiple routes', () => {

        before(async() => {

            server  = await internals.server();
            const handler = function (request, h) {

                return 'generic';
            };

            server.routev([
                { method: 'GET', path: '/generic', handler: handler },
                { version: 'v2', method: 'GET', path: '/generic', handler: handler }
            ]);
        });

        it('should create multiple routes with array', async() => {

            const res = await server.inject({ url: '/v1/generic' });

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('generic');
            expect(res.headers.version).to.equal('v1');
        });

        it('should create multiple routes with array v2', async() => {

            const res = await server.inject({ url: '/v2/generic' });

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('generic');
            expect(res.headers.version).to.equal('v2');
        });
    });

    describe('using header', () => {

        before(async() => {

            server.route({
                method: 'GET',
                path: '/regular',
                handler: function (request, h) {

                    return 'regular';
                }
            });
        });

        it('should not change route based on header when accessing normal route', async() => {

            const headers = { 'api-version': 'v1' };
            const res = await server.inject({ url: '/regular', headers });

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('regular');
            expect(res.headers.version).to.not.exist();
        });

        it('should not change route based on header when accessing route with no default', async() => {

            const headers = { 'api-version': 'v1' };
            const res = await server.inject({ url: '/v1/nodefault', headers });

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('nodefault');
            expect(res.headers.version).to.equal('v1');
        });

        it('should not set header for regular route', async() => {

            const res = await server.inject({ url: '/regular' });

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('regular');
            expect(res.headers.version).to.not.exist();
        });

        it('should get v1 with custom header', async() => {

            const headers = { 'api-version': 'v1' };
            const res = await server.inject({ url: '/test', headers });

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('version 1');
            expect(res.headers.version).to.equal('v1');
        });

        it('should get v1 with accept header', async() => {

            const headers = { 'Accept': 'vnd.walmart.foo;version=v1;blah=bar;' };
            const res = await server.inject({ url: '/test', headers });

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('version 1');
            expect(res.headers.version).to.equal('v1');
        });

        it('should trump with custom header vs accept header', async() => {

            const headers = { 'Accept': 'vnd.walmart.foo;version=v1;blah=bar;', 'api-version': 'v3' };
            const res = await server.inject({ url: '/test', headers });

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('version 3');
            expect(res.headers.version).to.equal('v3');
        });
    });

    describe('uri only', () => {

        before(async() => {

            server  = await internals.server();
            server.routev({
                method: 'GET',
                path: '/bindtest',
                handler: function (request, h) {

                    return this.message;
                }
            });
        });

        it('should work with bind', async() => {

            const res = await server.inject('/v1/bindtest');

            expect(res.result).to.equal('bind must work');
            expect(res.headers.version).to.equal('v1');
        });

        it('should get v1', async() => {

            const res = await server.inject('/v1/test');

            expect(res.result).to.equal('version 1');
            expect(res.headers.version).to.equal('v1');
        });

        it('should get v2', async() => {

            const res = await server.inject('/v2/test');

            expect(res.result).to.equal('version 2');
            expect(res.headers.version).to.equal('v2');
        });

        it('should get v3', async() => {

            const res = await server.inject('/v3/test');

            expect(res.result).to.equal('version 3');
            expect(res.headers.version).to.equal('v3');
        });

        it('should get root default', async() => {

            const res = await server.inject('/');

            expect(res.result).to.equal('root 1');
            expect(res.headers.version).to.equal('v1');
        });

        it('should get root', async() => {

            const res = await server.inject('/v1');

            expect(res.result).to.equal('root 1');
            expect(res.headers.version).to.equal('v1');
        });

        it('should get default', async() => {

            const res = await server.inject('/test');

            expect(res.result).to.equal('version 2');
            expect(res.headers.version).to.equal('v2');
        });
    });
});

describe('multiple header options', () => {

    let server;
    
    before(async() => {

        server  = await internals.server({
            header: ['version', 'api_version']
        });
    });

    it('should work with version header', async() => {

        const headers = { api_version: 'v1' };
        const res = await server.inject({ url: '/test', headers });

        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal('version 1');
        expect(res.headers.version).to.equal('v1');
    });

    it('should work with api_version header', async() => {

        const headers = { version: 'v1' };
        const res = await server.inject({ url: '/test', headers });

        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal('version 1');
        expect(res.headers.version).to.equal('v1');
    });
});


describe('other options', () => {

    let server;

    before(async() => {

        server  = await internals.server({
            redirect: true,
            prefix: '/api'
        });
    });

    describe('using header', () => {

        it('should not change route based on header when accessing route with no default', async() => {

            const headers = { 'api-version': 'v1' };
            const res = await server.inject({ url: '/api/v1/nodefault', headers });

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('nodefault');
            expect(res.headers.version).to.equal('v1');
        });

        it('should get v1 with custom header', async() => {

            const headers = { 'api-version': 'v1' };
            const resp = await server.inject({ url: '/api/test', headers });

            expect(resp.statusCode).to.equal(302);

            const res = await server.inject({ url: resp.headers.location, headers });

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('version 1');
            expect(res.headers.version).to.equal('v1');
        });

        it('should get v1 with custom header and query', async() => {

            const headers = { 'api-version': 'v1' };
            const resp = await server.inject({ url: '/api/test?hello=there', headers });

            expect(resp.statusCode).to.equal(302);

            const res = await server.inject({ url: resp.headers.location, headers });

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('version 1there');
            expect(res.headers.version).to.equal('v1');
        });

        it('should not bail with accept without version', async() => {

            const headers = { 'Accept': 'vnd.walmart.foo;;blah=bar;' };
            const res = await server.inject({ url: '/api/test', headers });

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('version 2');
            expect(res.headers.version).to.equal('v2');
            
        });

        it('should get v1 with accept header', async() => {

            const headers = { 'Accept': 'vnd.walmart.foo;version=v1;blah=bar;' };
            const res = await server.inject({ url: '/api/test', headers });

            expect(res.statusCode).to.equal(302);

            const resp = await server.inject({ url: res.headers.location, headers });

            expect(resp.statusCode).to.equal(200);
            expect(resp.result).to.equal('version 1');
            expect(resp.headers.version).to.equal('v1');
        });
    });

    describe('uri only', () => {

        it('should get v1', async() => {

            const res = await server.inject('/api/v1/test');

            expect(res.result).to.equal('version 1');
            expect(res.headers.version).to.equal('v1');

        });

        it('should get v2', async() => {

            const res = await server.inject('/api/v2/test');

            expect(res.result).to.equal('version 2');
            expect(res.headers.version).to.equal('v2');
        });

        it('should get v3', async() => {

            const res = await server.inject('/api/v3/test');

            expect(res.result).to.equal('version 3');
            expect(res.headers.version).to.equal('v3');
        });

        it('should get root default', async() => {

            const res = await server.inject('/api');

            expect(res.result).to.equal('root 1');
            expect(res.headers.version).to.equal('v1');
        });

        it('should get root', async() => {

            const res = await server.inject('/api/v1');

            expect(res.result).to.equal('root 1');
            expect(res.headers.version).to.equal('v1');
        });

        it('should get default', async() => {

            const res = await server.inject('/api/test');

            expect(res.result).to.equal('version 2');
            expect(res.headers.version).to.equal('v2');
        });
    });
});

describe('other', () => {

    let server;
    
    before(async() => {
        server  = await internals.server();

        server.route({
            method: 'GET',
            path: '/boom',
            handler: function (request, h) {
    
                throw Boom.unauthorized('not welcome');
            }
        });
    });

    it('should work without response headers', async() => {

        const res = await server.inject('/boom');

        expect(res.statusCode).to.equal(401);
    });
});

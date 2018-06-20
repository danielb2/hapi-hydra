'use strict';
const Blipp = require('blipp');
const Code = require('code');
const Hapi = require('hapi');
const Joi = require('joi');
const Lab = require('lab');

const HapiVersioning = require('../lib');

const internals = {};

// Test shortcuts

const lab = exports.lab = Lab.script();
const { describe, it } = lab;
const expect = Code.expect;

internals.server = function (options) {

    options = Joi.attempt(options, {
        header: Joi.string().default('api-version'),
        responseHeader: Joi.string().default('version'),
        prefix: Joi.string().default('/'),
        redirect: Joi.boolean().default(false)
    });

    const server = new Hapi.Server();

    server.connection();

    server.register([{
        register: HapiVersioning,
        options
    }, {
        register: Blipp
    }], (err) => {

        if (err) {
            console.log(err);
        }
    });

    server.routev({
        method: 'GET',
        version: 'v1',
        isDefault: true,
        path: '/',
        handler: function (request, reply) {

            return reply('root 1');
        }
    });

    server.routev({
        method: 'GET',
        version: 'v1',
        path: '/test',
        handler: function (request, reply) {

            return reply('version 1');
        }
    });

    server.routev({
        method: 'GET',
        version: 'v2',
        isDefault: true,
        path: '/test',
        handler: function (request, reply) {

            return reply('version 2');
        }
    });

    server.routev({
        method: 'GET',
        version: 'v3',
        path: '/test',
        handler: function (request, reply) {

            return reply('version 3');
        }
    });

    it('should get root default', (done) => {

        server.inject('/', (res) => {

            expect(res.result).to.equal('root 1');
            expect(res.headers.version).to.equal('v1');
            done();
        });
    });

    it('should get root', (done) => {

        server.inject('/v1', (res) => {

            expect(res.result).to.equal('root 1');
            expect(res.headers.version).to.equal('v1');
            done();
        });
    });

    // var p = require('purdy');
    // p(server.plugins.blipp.info(), { depth: 99 });

    return server;
};


describe('default options', () => {

    const server  = internals.server();

    describe('using header', () => {

        it('should get v1 with custom header', (done) => {

            const headers = { 'api-version': 'v1' };
            server.inject({ url: '/test', headers }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('version 1');
                expect(res.headers.version).to.equal('v1');
                done();
            });
        });

        it('should get v1 with accept header', (done) => {

            const headers = { 'Accept': 'vnd.walmart.foo;version=v1;blah=bar;' };
            server.inject({ url: '/test', headers }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.equal('version 1');
                expect(res.headers.version).to.equal('v1');
                done();
            });
        });
    });

    describe('uri only', () => {

        it('should get v1', (done) => {

            server.inject('/v1/test', (res) => {

                expect(res.result).to.equal('version 1');
                expect(res.headers.version).to.equal('v1');
                done();
            });
        });

        it('should get v2', (done) => {

            server.inject('/v2/test', (res) => {

                expect(res.result).to.equal('version 2');
                expect(res.headers.version).to.equal('v2');
                done();
            });
        });

        it('should get v3', (done) => {

            server.inject('/v3/test', (res) => {

                expect(res.result).to.equal('version 3');
                expect(res.headers.version).to.equal('v3');
                done();
            });
        });

        it('should get default', (done) => {

            server.inject('/test', (res) => {

                expect(res.result).to.equal('version 2');
                expect(res.headers.version).to.equal('v2');
                done();
            });
        });
    });
});


describe('other options', () => {

    const server  = internals.server({
        redirect: true,
        prefix: '/api'
    });

    describe('using header', () => {

        it('should get v1 with custom header', (done) => {

            const headers = { 'api-version': 'v1' };
            server.inject({ url: '/api/test', headers }, (res) => {

                expect(res.statusCode).to.equal(302);
                expect(res.result).to.equal('version 1');
                expect(res.headers.version).to.equal('v1');
                done();
            });
        });

        it('should not bail with accept without version', (done) => {

            const headers = { 'Accept': 'vnd.walmart.foo;;blah=bar;' };
            server.inject({ url: '/api/test', headers }, (resp) => {

                expect(resp.statusCode).to.equal(302);

                server.inject({ url: resp.headers.location, headers }, (res) => {

                    expect(res.statusCode).to.equal(200);
                    expect(res.result).to.equal('version 2');
                    expect(res.headers.version).to.equal('v2');
                    done();
                });
            });
        });

        it('should get v1 with accept header', (done) => {

            const headers = { 'Accept': 'vnd.walmart.foo;version=v1;blah=bar;' };
            server.inject({ url: '/api/test', headers }, (res) => {

                expect(res.statusCode).to.equal(302);

                server.inject({ url: res.headers.location, headers }, (resp) => {

                    expect(resp.statusCode).to.equal(200);
                    expect(resp.result).to.equal('version 1');
                    expect(resp.headers.version).to.equal('v1');
                    done();
                });
            });
        });
    });

    describe('uri only', () => {

        it('should get v1', (done) => {

            server.inject('/api/v1/test', (res) => {

                expect(res.result).to.equal('version 1');
                expect(res.headers.version).to.equal('v1');
                done();
            });
        });

        it('should get v2', (done) => {

            server.inject('/api/v2/test', (res) => {

                expect(res.result).to.equal('version 2');
                expect(res.headers.version).to.equal('v2');
                done();
            });
        });

        it('should get v3', (done) => {

            server.inject('/api/v3/test', (res) => {

                expect(res.result).to.equal('version 3');
                expect(res.headers.version).to.equal('v3');
                done();
            });
        });

        it('should get root default', (done) => {

            server.inject('/api', (res) => {

                expect(res.result).to.equal('root 1');
                expect(res.headers.version).to.equal('v1');
                done();
            });
        });

        it('should get root', (done) => {

            server.inject('/api/v1', (res) => {

                expect(res.result).to.equal('root 1');
                expect(res.headers.version).to.equal('v1');
                done();
            });
        });

        it('should get default', (done) => {

            server.inject('/api/test', (res) => {

                expect(res.result).to.equal('version 2');
                expect(res.headers.version).to.equal('v2');
                done();
            });
        });
    });
});

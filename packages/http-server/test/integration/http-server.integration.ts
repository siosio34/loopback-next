// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: @loopback/http-server
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT
import {HttpServer, HttpServerOptions} from '../../';
import {supertest, expect} from '@loopback/testlab';
import * as makeRequest from 'request-promise-native';
import {ServerRequest, ServerResponse, get, IncomingMessage} from 'http';
import {get as httpsGet, Agent} from 'https';
import * as path from 'path';
import * as fs from 'fs';

describe('HttpServer (integration)', () => {
  let server: HttpServer | undefined;

  afterEach(stopServer);

  it('formats IPv6 url correctly', async () => {
    server = new HttpServer(dummyRequestHandler, {host: '::1'});
    await server.start();
    expect(server.address!.family).to.equal('IPv6');
    const response = await getAsync(server.url);
    expect(response.statusCode).to.equal(200);
  });

  it('starts server', async () => {
    server = new HttpServer(dummyRequestHandler);
    await server.start();
    await supertest(server.url)
      .get('/')
      .expect(200);
  });

  it('stops server', async () => {
    server = new HttpServer(dummyRequestHandler);
    await server.start();
    await server.stop();
    await expect(
      makeRequest({
        uri: server.url,
      }),
    ).to.be.rejectedWith(/ECONNREFUSED/);
  });

  it('exports original port', async () => {
    server = new HttpServer(dummyRequestHandler, {port: 0});
    expect(server)
      .to.have.property('port')
      .which.is.equal(0);
  });

  it('exports reported port', async () => {
    server = new HttpServer(dummyRequestHandler);
    await server.start();
    expect(server)
      .to.have.property('port')
      .which.is.a.Number()
      .which.is.greaterThan(0);
  });

  it('does not permanently bind to the initial port', async () => {
    server = new HttpServer(dummyRequestHandler);
    await server.start();
    const port = server.port;
    await server.stop();
    await server.start();
    expect(server)
      .to.have.property('port')
      .which.is.a.Number()
      .which.is.not.equal(port);
  });

  it('exports original host', async () => {
    server = new HttpServer(dummyRequestHandler);
    expect(server)
      .to.have.property('host')
      .which.is.equal(undefined);
  });

  it('exports reported host', async () => {
    server = new HttpServer(dummyRequestHandler);
    await server.start();
    expect(server)
      .to.have.property('host')
      .which.is.a.String();
  });

  it('exports protocol', async () => {
    server = new HttpServer(dummyRequestHandler);
    await server.start();
    expect(server)
      .to.have.property('protocol')
      .which.is.a.String()
      .match(/http|https/);
  });

  it('exports url', async () => {
    server = new HttpServer(dummyRequestHandler);
    await server.start();
    expect(server)
      .to.have.property('url')
      .which.is.a.String()
      .match(/http|https\:\/\//);
  });

  it('exports address', async () => {
    server = new HttpServer(dummyRequestHandler);
    await server.start();
    expect(server)
      .to.have.property('address')
      .which.is.an.Object();
  });

  it('resets address when server is stopped', async () => {
    server = new HttpServer(dummyRequestHandler);
    await server.start();
    expect(server)
      .to.have.property('address')
      .which.is.an.Object();
    await server.stop();
    expect(server.address).to.be.undefined();
  });

  it('exports listening', async () => {
    server = new HttpServer(dummyRequestHandler);
    await server.start();
    expect(server.listening).to.be.true();
    await server.stop();
    expect(server.listening).to.be.false();
  });

  it('reports error when the server cannot be started', async () => {
    server = new HttpServer(dummyRequestHandler);
    await server.start();
    const port = server.port;
    const anotherServer = new HttpServer(dummyRequestHandler, {port: port});
    expect(anotherServer.start()).to.be.rejectedWith(/EADDRINUSE/);
  });

  it('supports HTTPS protocol with key and certificate files', async () => {
    const httpsServer: HttpServer = givenHttpsServer();
    await httpsServer.start();
    const response = await httpsGetAsync(httpsServer.host!, httpsServer.port);
    expect(response.statusCode).to.equal(200);
  });

  it('supports HTTPS protocol with a pfx file', async () => {
    const usePfx = true;
    const httpsServer: HttpServer = givenHttpsServer(usePfx);
    await httpsServer.start();
    const response = await httpsGetAsync(httpsServer.host!, httpsServer.port);
    expect(response.statusCode).to.equal(200);
  });

  function dummyRequestHandler(req: ServerRequest, res: ServerResponse): void {
    res.end();
  }

  async function stopServer() {
    if (!server) return;
    await server.stop();
  }

  function getAsync(url: string): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
      get(url, resolve).on('error', reject);
    });
  }

  function givenHttpsServer(usePfx: boolean = false): HttpServer {
    const options: HttpServerOptions = {protocol: 'https'};
    if (usePfx) {
      const pfxPath = path.join(__dirname, 'pfx.pfx');
      options.pfx = fs.readFileSync(pfxPath);
      options.passphrase = 'loopback4';
    } else {
      const keyPath = path.join(__dirname, 'key.pem');
      const certPath = path.join(__dirname, 'cert.pem');
      options.key = fs.readFileSync(keyPath);
      options.cert = fs.readFileSync(certPath);
    }
    return new HttpServer(dummyRequestHandler, options);
  }

  function httpsGetAsync(host: string, port: number): Promise<IncomingMessage> {
    const options = {
      host: host,
      port: port,
      path: '/',
      cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
      agent: new Agent({
        rejectUnauthorized: false,
      }),
    };

    return new Promise((resolve, reject) => {
      httpsGet(options, resolve).on('error', reject);
    });
  }
});

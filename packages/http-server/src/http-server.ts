// Copyright IBM Corp. 2017,2018. All Rights Reserved.
// Node module: @loopback/http-server
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {createServer, Server, ServerRequest, ServerResponse} from 'http';
import {createServer as createHttpsServer, Server as HttpsServer} from 'https';
import * as https from 'https';
import {AddressInfo} from 'net';

import * as pEvent from 'p-event';

export type RequestListener = (req: ServerRequest, res: ServerResponse) => void;

export interface ListenerOptions {
  host?: string;
  port?: number;
}

export interface HttpOptions extends ListenerOptions, https.ServerOptions {
  protocol?: HttpProtocol;
}

export interface HttpServerOptions extends HttpOptions {}

export type HttpProtocol = 'http' | 'https'; // Will be extended to `http2` in the future

/**
 * HTTP / HTTPS server used by LoopBack's RestServer
 *
 * @export
 * @class HttpServer
 */
export class HttpServer {
  private _port: number;
  private _host?: string;
  private _listening: boolean = false;
  private _protocol: HttpProtocol;
  private _address: AddressInfo;
  private requestListener: RequestListener;
  private server: Server | HttpsServer;
  private serverOptions?: HttpServerOptions;

  /**
   * @param requestListener
   * @param serverOptions
   */
  constructor(
    requestListener: RequestListener,
    serverOptions?: HttpServerOptions,
  ) {
    this.requestListener = requestListener;
    this.serverOptions = serverOptions;
    this._port = serverOptions ? serverOptions.port || 0 : 0;
    this._host = serverOptions ? serverOptions.host : undefined;
    this._protocol = serverOptions ? serverOptions.protocol || 'http' : 'http';
  }

  /**
   * Starts the HTTP / HTTPS server
   */
  public async start() {
    if (this._protocol === 'https') {
      const httpsOptions = Object.assign({}, this.serverOptions);
      this.server = createHttpsServer(
        httpsOptions as https.ServerOptions,
        this.requestListener,
      );
    } else {
      this.server = createServer(this.requestListener);
    }
    this.server.listen(this._port, this._host);
    try {
      await pEvent(this.server, 'listening');
      this._listening = true;
      this._address = this.server.address() as AddressInfo;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * Stops the HTTP / HTTPS server
   */
  public async stop() {
    if (this.server) {
      this.server.close();
      await pEvent(this.server, 'close');
      this._listening = false;
    }
  }

  /**
   * Protocol of the HTTP / HTTPS server
   */
  public get protocol(): HttpProtocol {
    return this._protocol;
  }

  /**
   * Port number of the HTTP / HTTPS server
   */
  public get port(): number {
    return (this._address && this._address.port) || this._port;
  }

  /**
   * Host of the HTTP / HTTPS server
   */
  public get host(): string | undefined {
    return (this._address && this._address.address) || this._host;
  }

  /**
   * URL of the HTTP / HTTPS server
   */
  public get url(): string {
    let host = this.host;
    if (this._address.family === 'IPv6') {
      host = `[${host}]`;
    }
    return `${this._protocol}://${host}:${this.port}`;
  }

  /**
   * State of the HTTP / HTTPS server
   */
  public get listening(): boolean {
    return this._listening;
  }

  /**
   * Address of the HTTP / HTTPS server
   */
  public get address(): AddressInfo | undefined {
    return this._listening ? this._address : undefined;
  }
}

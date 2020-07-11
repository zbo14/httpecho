#!/usr/bin/env node

'use strict'

const commander = require('commander')
const fs = require('fs')
const http = require('http')
const https = require('https')
const zlib = require('zlib')

const error = msg => console.error('\x1b[31m%s\x1b[0m', msg)
const warn = msg => console.warn('\x1b[33m%s\x1b[0m', msg)

const reqListener = async (req, resp) => {
  const encoding = req.headers['content-encoding']

  let decompress

  if (encoding === 'br') {
    decompress = zlib.createBrotliDecompress()
  } else if (encoding === 'gzip') {
    decompress = zlib.createGunzip()
  } else if (encoding === 'deflate') {
    decompress = zlib.createInflate()
  }

  const stream = decompress ? req.pipe(decompress) : req

  let data = ''

  try {
    await new Promise((resolve, reject) => {
      req
        .once('end', resolve)
        .once('error', reject)

      stream.on('data', chunk => {
        data += chunk
      })
    })
  } catch {
    resp.writeHead(500)
    return resp.end()
  }

  data = data.trim()

  const lines = [
    'FROM ' + req.socket.remoteAddress,
    `${req.method} ${req.url} HTTP/${req.httpVersion}`,
    ...Object
      .entries(req.headers)
      .map(([name, value]) => name + ': ' + value),
    data,
    '-'.repeat(30)
  ].filter(Boolean)

  console.log(lines.join('\n'))

  resp.writeHead(200)
  resp.end(data)
}

const program = new commander.Command()

program
  .version('0.0.0')
  .option('-a, --address <ip>', 'local address to listen on', '0.0.0.0')
  .option('-c, --certificate <file>', 'file containing TLS certificate for server')
  .option('-k, --key <file>', 'file containing server private key')
  .option('-p, --port <int>', 'port for server to listen on')
  .option('-s, --secure', 'use HTTPS')
  .action(async opts => {
    let port

    if (opts.port) {
      port = +opts.port

      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        error('[!] Invalid port number: ' + port)
        process.exit(1)
      }
    }

    const address = opts.address || '0.0.0.0'
    const secure = opts.hasOwnProperty('secure') ? opts.secure : port === 443
    const { createServer } = secure ? https : http
    port = port || (secure ? 443 : 80)
    const proto = secure ? 'HTTPS' : 'HTTP'

    let cert, key

    if (secure) {
      if (!opts.certificate) {
        error('[!] HTTPS server requires certificate file')
        process.exit(1)
      }

      if (!opts.key) {
        error('[!] HTTPS server requires key file')
        process.exit(1)
      }

      ([cert, key] = await Promise.all([
        fs.promises.readFile(opts.certificate).catch(() => {
          error('[!] Couldn\'t read certificate file')
          process.exit(1)
        }),

        fs.promises.readFile(opts.key).catch(() => {
          error('[!] Couldn\'t read key file')
          process.exit(1)
        })
      ]))
    }

    await new Promise((resolve, reject) => {
      createServer({ cert, key }, reqListener)
        .once('close', () => {
          warn(`[-] ${proto} server closed`)
          resolve()
        })
        .on('error', err => error('[!] ' + err.message))
        .listen(port, address, () => warn(`[-] ${proto} server listening on ${address}:${port}`))
    })
  })
  .parseAsync(process.argv)
  .catch(err => error(err) || 1)
  .then(process.exit)

const { EventEmitter } = require('events');
const net = require('net');
const Struct = require('./struct');
const Compose = require('./compose');

const VERSION = Buffer.from([0x05]);

const COMMAND_TYPE_CONNECT = Buffer.from([0x01]);

const commandTypeList = [
  COMMAND_TYPE_CONNECT,
];

const ADDRESS_TYPE_IP_V4 = Buffer.from([0x01]);
const ADDRESS_TYPE_IP_V6 = Buffer.from([0x04]);
const ADDRESS_TYPE_DOMAIN = Buffer.from([0x03]);

const addressTypeList = [
  ADDRESS_TYPE_IP_V4,
  ADDRESS_TYPE_IP_V6,
  ADDRESS_TYPE_DOMAIN,
];

const addressTypeMap = {
  [ADDRESS_TYPE_IP_V4.toString('hex')]: {
    getLength: () => 4,
    getHostname: buf => buf.join('.'),
    getBuf: hostname => Buffer
      .concat(hostname.split('.').map(v => Buffer.from([parseInt(v, 10)]))),
  },
  [ADDRESS_TYPE_IP_V6.toString('hex')]: {
    getLength: () => 16,
    getHostname: buf => buf.join(':'),
    getBuf: hostname => Buffer
      .concat(hostname.split(':').map(v => Buffer.from([parseInt(v, 10)]))),
  },
  [ADDRESS_TYPE_DOMAIN.toString('hex')]: {
    getLength: buf => buf.readUInt8(0) + 1,
    getHostname: buf => buf.slice(1).toString(),
    getBuf: (hostname) => {
      const compose = Compose()
        .chars('hostname', hostname)
        .addLength8('length');
      return compose();
    },
  },
};

class Record extends EventEmitter {
  constructor() {
    super();
    this.isAuth = false;
    this.isConnect = false;
  }

  output(chunk) {
    if (!this.isAuth) {
      this.isAuth = true;
      Struct(chunk)
        .buf('version', 1, v => v.equals(VERSION))
        .int8('length')
        .payload();
      this.emit('input', Buffer.concat([
        VERSION,
        Buffer.from([0x00]),
      ]));
      return;
    }
    if (!this.isConnect) {
      this.isConnect = true;
      const struct = Struct(chunk)
        .buf('version', 1, v => v.equals(VERSION))
        .buf('commandType', 1, v => commandTypeList.some(commandTypeItem => v.equals(commandTypeItem)))
        .buf('reserved', 1)
        .buf('addressType', 1, v => addressTypeList.some(addressTypeItem => v.equals(addressTypeItem)))
        .buf('hostname', (data, buf) => addressTypeMap[data.addressType.toString('hex')].getLength(buf))
        .int16('port')
        .final();

      const hostname = addressTypeMap[struct.addressType.toString('hex')]
        .getHostname(struct.hostname);
      this.emit('connectRemote', {
        hostname,
        port: struct.port,
      });
      return;
    }

    this.emit('output', chunk);
  }

  input(chunk) {
    this.emit('input', chunk);
  }

  onConnect(address, port) {
    let addressType = ADDRESS_TYPE_DOMAIN;
    if (net.isIPv6(address)) {
      addressType = ADDRESS_TYPE_IP_V6;
    } else if (net.isIPv4(address)) {
      addressType = ADDRESS_TYPE_IP_V4;
    }
    const compose = Compose()
      .int16('port', port)
      .set('address', addressTypeMap[addressType.toString('hex')].getBuf(address))
      .set('addressType', addressType)
      .set('reserved', Buffer.from([0x00]))
      .set('success', Buffer.from([0x00]))
      .set('version', VERSION);
    this.emit('input', compose());
  }
}


module.exports = Record;

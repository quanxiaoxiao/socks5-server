const assert = require('assert');
const crypto = require('crypto');

module.exports = () => {
  const data = {};
  let length = 0;

  const buf = () => {
    if (length === 0) {
      return Buffer.alloc(0);
    }
    return Buffer.concat(
      Object
        .keys(data)
        .reverse()
        .map(key => data[key].buffer),
      length,
    );
  };

  buf.chars = (name, str) => {
    assert.ok(typeof str === 'string');
    const buffer = Buffer.from(str, 'utf-8');
    return buf.set(name, buffer);
  };

  buf.hex = (name, hex) => {
    const buffer = Buffer.from(hex, 'hex');
    return buf.set(name, buffer);
  };

  buf.skip = (name, size) => {
    assert.ok(typeof size === 'number');
    const buffer = Buffer.alloc(size);
    return buf.set(name, buffer);
  };

  buf.set = (name, buffer) => {
    assert.ok(!data[name]);
    assert.ok(Buffer.isBuffer(buffer));
    length += buffer.length;
    data[name] = {
      buffer,
      length: buffer.length,
    };
    return buf;
  };

  buf.tap = (fn) => {
    fn(buf());
    return buf;
  };

  buf.addLength8 = (name) => {
    const buffer = Buffer.alloc(1);
    buffer.writeUInt8(length);
    return buf.set(name, buffer);
  };

  buf.addLength = (name) => {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16BE(length);
    return buf.set(name, buffer);
  };

  buf.addLength24 = (name) => {
    const buffer = Buffer.alloc(3);
    buffer.writeUIntBE(length, 0, 3);
    return buf.set(name, buffer);
  };

  buf.int8 = (name, num = 0) => {
    const buffer = Buffer.alloc(1);
    buffer.writeUInt8(num);
    return buf.set(name, buffer);
  };

  buf.int16 = (name, num = 0) => {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16BE(num, 0);
    return buf.set(name, buffer);
  };

  buf.random = (name, size = 32) => {
    const buffer = crypto.randomBytes(size);
    return buf.set(name, buffer);
  };

  buf.array = (name, arr) => {
    const buffer = Buffer.concat(arr);
    return buf.set(name, buffer);
  };

  buf.hmac = (secret, type = 'sha256') => {
    const hmac = crypto.createHmac(type, secret);
    hmac.update(buf());
    return hmac.digest();
  };

  buf.hash = () => {
    const hash = crypto.createHash('sha256');
    hash.update(buf());
    return hash.digest();
  };

  buf.size = () => length;

  buf.get = (name) => {
    if (!name) {
      return data;
    }
    const item = data[name];
    return item ? item.buffer : null;
  };

  buf.pad = (size = 16) => {
    const paddingLength = size - length % size;
    if (paddingLength === size) {
      return Buffer.concat([
        buf(),
        Buffer.alloc(16, 15),
      ]);
    }
    return Buffer.concat([
      buf(),
      Buffer.alloc(paddingLength, paddingLength - 1),
    ]);
  };

  return buf;
};

const assert = require('assert');

module.exports = (chunk) => {
  let buf = chunk;
  const data = {};

  const getBufSize = (size) => {
    const len = typeof size === 'function' ? size(data, buf) : size;
    assert.ok(typeof len === 'number');
    return len;
  };

  const struct = () => ({
    ...data,
    data: buf,
  });

  struct.skip = (size, fn) => {
    const len = getBufSize(size);
    if (fn) {
      assert.ok(fn(buf.slice(0, len)));
    }
    buf = buf.slice(len);
    return struct;
  };

  struct.int = (name, size, fn) => {
    assert.ok(name !== 'data' && !data[name]);
    const len = getBufSize(size);
    assert.ok(len <= 8);
    if (buf.length < len) {
      data[name] = 0;
      return struct;
    }
    data[name] = buf.readUIntBE(0, len);
    buf = buf.slice(len);
    if (fn) {
      assert.ok(fn(data[name]));
    }
    return struct;
  };

  struct.int8 = (name, fn) => {
    assert.ok(name !== 'data' && !data[name]);
    if (buf.length === 0) {
      data[name] = 0;
      return struct;
    }
    data[name] = buf.readUInt8();
    buf = buf.slice(1);
    if (fn) {
      assert.ok(fn(data[name]));
    }
    return struct;
  };

  struct.hex = (name, size, fn) => {
    assert.ok(name !== 'data' && !data[name]);
    if (buf.length === 0) {
      data[name] = '';
      return struct;
    }
    const len = getBufSize(size);
    data[name] = buf.slice(0, len).toString('hex');
    buf = buf.slice(len);
    if (fn) {
      assert.ok(fn(data[name]));
    }
    return struct;
  };

  struct.int16 = (name, fn) => {
    assert.ok(name !== 'data' && !data[name]);
    if (buf.length < 2) {
      data[name] = 0;
      return struct;
    }
    data[name] = buf.readUInt16BE(0);
    buf = buf.slice(2);
    if (fn) {
      assert.ok(fn(data[name]));
    }
    return struct;
  };

  struct.int24 = (name) => {
    assert.ok(name !== 'data' && !data[name]);
    if (buf.length < 3) {
      data[name] = 0;
      return struct;
    }
    data[name] = buf.readUIntBE(0, 3);
    buf = buf.slice(3);
    return struct;
  };

  struct.buf = (name, size, fn) => {
    assert.ok(name !== 'data' && !data[name]);
    if (buf.length === 0) {
      data[name] = Buffer.from([]);
      return struct;
    }
    const len = getBufSize(size);
    data[name] = buf.slice(0, len);
    buf = buf.slice(len);
    if (fn) {
      assert.ok(fn(data[name]));
    }
    return struct;
  };

  struct.tap = (fn) => {
    fn(chunk.slice(0, chunk.length - buf.length));
    return struct;
  };

  struct.trim = () => {
    let padLen = 0;
    if (buf.slice(-1).toString('hex') === '00') {
      padLen = 1;
    } else if (/(0[0-9a-f])(\1)+$/.test(buf.slice(-16).toString('hex'))) {
      padLen = parseInt(RegExp.$1, 16) + 1;
    }
    if (padLen !== 0) {
      buf = buf.slice(0, buf.length - padLen);
    }
    return struct;
  };

  struct.get = name => data[name] || null;

  struct.payload = (payloadLengthName = 'length') => {
    const payloadLength = data[payloadLengthName];
    assert.ok(typeof payloadLength === 'number' && buf.length === payloadLength);
    struct.buf('payload', payloadLength);
    return struct.final();
  };

  struct.final = () => {
    assert.ok(buf.length === 0);
    return data;
  };

  return struct;
};

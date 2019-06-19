/* eslint no-use-before-define: 0 */
const net = require('net');

module.exports = (options, cb, onConnect) => {
  const bufList = [];
  const state = {
    isWait: false,
    isConnect: true,
    isClientConnect: false,
    isClose: false,
  };
  const client = net.Socket();

  function handleData(chunk) {
    cb(null, chunk);
  }

  function handleConnect() {
    if (state.isClose) {
      return;
    }
    if (!state.isConnect) {
      return;
    }
    if (onConnect) {
      onConnect(client.localAddress, client.localPort);
    }
    state.isClientConnect = true;
    client.on('data', handleData);
    client.on('drain', handleDrain);
    client.on('end', handleClose);
    client.on('close', handleClose);
    handleDrain();
  }

  function handleError(error) {
    cb(error || new Error('close'));
    cleanup();
  }

  function handleClose() {
    cb();
    cleanup();
  }

  client.setNoDelay(true);

  client.on('error', handleError);
  if (!state.isClose) {
    client.on('connect', handleConnect);
  }

  const connect = () => {
    state.isConnect = false;
    cleanup();
  };

  connect.write = (chunk) => {
    if (state.isClose) {
      cb(new Error('client is closed'));
      return false;
    }
    if (!state.isClientConnect || state.isWait) {
      bufList.push(chunk);
      return false;
    }
    const ret = client.write(chunk);
    if (!ret) {
      state.isWait = true;
    }
    return ret;
  };

  function cleanup() {
    client.off('data', handleData);
    client.off('connect', handleConnect);
    client.off('drain', handleDrain);
    client.off('end', handleClose);
    client.off('close', handleClose);
    if (!state.isClose) {
      console.log(`-> X ${options.hostname}:${options.port}`);
      client.isClose = true;
      client.destroy();
    }
    if (state.isConnect) {
      state.isConnect = false;
      cb();
    }
    client.off('error', handleError);
  }

  function handleDrain() {
    state.isWait = false;
    while (!state.isClose
      && !state.isWait
      && bufList.length > 0) {
      const ret = connect.write(bufList.shift());
      if (!ret) {
        state.isWait = true;
      }
    }
  }

  console.log(`-> ${options.hostname}:${options.port}`);
  client.connect({
    host: options.hostname,
    port: options.port,
  });

  return connect;
};

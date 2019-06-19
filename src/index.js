/* eslint no-use-before-define: 0 */
const net = require('net');
const config = require('./config');
const Record = require('./record');
const connect = require('./connect');

const server = net.createServer((socket) => {
  console.log(`<- ${socket.remoteAddress}`);
  socket.setNoDelay(true);
  const state = {
    isClose: false,
    isConnect: false,
    isWait: false,
  };

  let remote;
  const outputBufList = [];
  const inputBufList = [];

  const record = new Record();

  function handleData(chunk) {
    try {
      record.output(chunk);
    } catch (error) {
      cleanup();
    }
  }

  function handleOutputOnRecord(buf) {
    if (state.isClose) {
      return;
    }
    if (remote && state.isConnect) {
      remote.write(buf);
    } else {
      outputBufList.push(buf);
    }
  }

  function handleClose() {
    cleanup();
  }

  function handleInputOnRecord(chunk) {
    if (state.isClose) {
      return;
    }
    if (state.isWait) {
      inputBufList.push(chunk);
    } else {
      state.isWait = !socket.write(chunk);
    }
  }

  function handleError() {
    cleanup();
  }

  function handleDrain() {
    state.isWait = false;
    while (!state.isClose
      && !state.isWait
      && inputBufList.length > 0) {
      const ret = socket.write(inputBufList.shift());
      if (!ret) {
        state.isWait = true;
      }
    }
  }

  function handleConnectRemote(options) {
    if (state.isClose) {
      return;
    }
    state.isConnect = true;
    remote = connect({
      hostname: options.hostname,
      port: options.port,
    }, (error, chunk) => {
      if (error) {
        state.isConnect = false;
        cleanup();
        return;
      }
      if (chunk == null) {
        state.isConnect = false;
        if (inputBufList.length === 0) {
          cleanup();
        } else {
          setTimeout(() => {
            cleanup();
          }, 3000);
        }
        return;
      }
      record.input(chunk);
    }, record.onConnect.bind(record));

    while (outputBufList.length > 0) {
      remote.write(outputBufList.shift());
    }
  }

  socket.on('error', handleError);

  if (!state.isClose) {
    socket.on('data', handleData);
    socket.on('close', handleClose);
    socket.on('end', handleClose);
    socket.on('drain', handleDrain);

    record.on('connectRemote', handleConnectRemote);
    record.on('input', handleInputOnRecord);
    record.on('output', handleOutputOnRecord);
  }

  function cleanup() {
    record.off('connectRemote', handleConnectRemote);
    record.off('output', handleOutputOnRecord);
    record.off('input', handleInputOnRecord);


    socket.off('data', handleData);
    socket.off('close', handleClose);
    socket.off('end', handleClose);
    socket.off('drain', handleDrain);
    if (state.isConnect && remote) {
      remote();
      state.isConnect = false;
    }
    if (!state.isClose) {
      state.isClose = true;
      socket.destroy();
    }
    socket.off('error', handleError);
  }
});

server.listen(config.port, () => {
  console.log(`listen at port ${config.port}`);
});

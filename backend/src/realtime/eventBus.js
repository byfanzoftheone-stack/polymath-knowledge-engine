let broadcaster = null;

function setBroadcaster(nextBroadcaster) {
  broadcaster = nextBroadcaster;
}

function emit(sessionId, payload) {
  if (broadcaster) {
    broadcaster(sessionId, payload);
  }
}

module.exports = { setBroadcaster, emit };

let nextExtranonce = 0;

function isJSON(str) {
    try {
        JSON.parse(str.toString('utf8'));
        return true;
    } catch (e) {
        return false;
    }
}

// session ID is also used as extranonce1 it is a valid 4 byte hex it auutomatically rolls over 
// after 2^32
function generateSessionId() {
  if (typeof sessionCounter !== "number" || !Number.isFinite(sessionCounter)) {
    sessionCounter = 0;
  }

  const id = sessionCounter.toString(16).padStart(8, "0");
  sessionCounter = (sessionCounter + 1) & 0xffffffff;
  return id;
}

module.exports = { isJSON, generateSessionId };
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

//varint encoding for Bitcoin protocol
function encodeVarInt(n) {
    if (n < 0xfd) return Buffer.from([n]);

    if (n <= 0xffff) {
        return Buffer.from([
            0xfd,
            n & 0xff,
            (n >> 8) & 0xff
        ]);
    }

    if (n <= 0xffffffff) {
        return Buffer.from([
            0xfe,
            n & 0xff,
            (n >> 8) & 0xff,
            (n >> 16) & 0xff,
            (n >> 24) & 0xff
        ]);
    }

    throw new Error("varint too large");
}

function swapHexEndian(hex) {
    return hex.match(/../g).reverse().join("");
}

module.exports = { isJSON, generateSessionId, encodeVarInt, swapHexEndian };
function isJSON(str) {
    try {
        JSON.parse(str.toString('utf8'));
        return true;
    } catch (e) {
        return false;
    }
}

// extranonce1 it is a valid 4 byte hex
let sessionCounter = 0;

function generateExtranonce1() {
    // 16-bit rolling counter
    const counterPart = sessionCounter & 0xffff;
    sessionCounter = (sessionCounter + 1) & 0xffff;

    // 16-bit timestamp (lower bits of Date.now())
    const ts = Date.now() & 0xffff;

    // pack into 4 bytes: [ts_hi, ts_lo, ctr_hi, ctr_lo]
    const buf = Buffer.alloc(4);
    buf.writeUInt16BE(ts, 0);
    buf.writeUInt16BE(counterPart, 2);

    return buf.toString("hex");
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

module.exports = { isJSON, generateExtranonce1, encodeVarInt, swapHexEndian  };
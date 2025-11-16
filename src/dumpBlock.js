const fs = require("fs");

// hex string → spaced groups for readability
function group(hex, size = 2) {
    return hex.match(new RegExp(".{1," + size + "}", "g")).join(" ");
}

function dumpBlock(blockHex, filename = "block_dump.txt") {
    const buf = Buffer.from(blockHex, "hex");

    let offset = 0;
    function take(n) {
        const part = buf.slice(offset, offset + n);
        offset += n;
        return part;
    }

    const version     = take(4);
    const prevHash    = take(32);
    const merkleRoot  = take(32);
    const nTime       = take(4);
    const bits        = take(4);
    const nonce       = take(4);

    // read varint txn count
    function readVarInt() {
        const first = buf[offset];
        offset++;
        if (first < 0xfd) return first;
        if (first === 0xfd) {
            const v = buf.readUInt16LE(offset);
            offset += 2;
            return v;
        }
        if (first === 0xfe) {
            const v = buf.readUInt32LE(offset);
            offset += 4;
            return v;
        }
        // 0xff
        const v = Number(buf.readBigUInt64LE(offset));
        offset += 8;
        return v;
    }

    const txCount = readVarInt();
    const remaining = buf.slice(offset);

    const out = [];
    out.push("=== BLOCK HEADER ===");
    out.push("");
    out.push("Version (LE):       " + group(version.toString("hex")));
    out.push("Version (int):      " + version.readUInt32LE());
    out.push("");
    out.push("PrevHash (LE):      " + group(prevHash.toString("hex")));
    out.push("PrevHash (BE):      " + group(Buffer.from(prevHash).reverse().toString("hex")));
    out.push("");
    out.push("MerkleRoot (LE):    " + group(merkleRoot.toString("hex")));
    out.push("MerkleRoot (BE):    " + group(Buffer.from(merkleRoot).reverse().toString("hex")));
    out.push("");
    out.push("nTime (LE):         " + group(nTime.toString("hex")));
    out.push("nTime (BE):         " + group(Buffer.from(nTime).reverse().toString("hex")));
    out.push("");
    out.push("Bits (LE):          " + group(bits.toString("hex")));
    out.push("Bits (BE):          " + group(Buffer.from(bits).reverse().toString("hex")));
    out.push("");
    out.push("Nonce (LE):         " + group(nonce.toString("hex")));
    out.push("Nonce (BE):         " + group(Buffer.from(nonce).reverse().toString("hex")));
    out.push("");
    out.push("Txn count (varint): " + txCount);
    out.push("");
    out.push("=== TRANSACTIONS (raw) ===");
    out.push(remaining.toString("hex"));
    out.push("");

    fs.writeFileSync(`blocks/${filename}`, out.join("\n"));
    console.log("Saved formatted block to:", filename);
}

module.exports = { dumpBlock };
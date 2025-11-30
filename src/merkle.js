const bitcoin = require("bitcoinjs-lib");
const utilities = require("./utilities");

function branches(txids) {
    // Layer 0: raw txids → Buffers
    let layer = txids.map(txid =>
        Buffer.from(txid, "hex").reverse()
    );
    let index = 0; // coinbase is always index 0
    const branches = [];

    while (layer.length > 1) {
        const isEven = index % 2 === 0;
        const siblingIndex = isEven ? index + 1 : index - 1;

        // sibling for this layer
        const sibling = layer[siblingIndex] || layer[layer.length - 1];
        branches.push(sibling);

        // build next layer
        const nextLayer = [];
        for (let i = 0; i < layer.length; i += 2) {
            const left = layer[i];
            const right = layer[i + 1] || left; // duplicate if odd
            nextLayer.push(utilities.sha256d(Buffer.concat([left, right])));
        }

        layer = nextLayer;
        index = Math.floor(index / 2);
    }

    // convert branches to little-endian hex for Stratum
    return branches.map(b =>
        Buffer.from(b).reverse().toString("hex")
    );
}



function hash256(hexLE) {
    const buf = Buffer.from(hexLE, "hex"); // LE raw bytes
    const h = bitcoin.crypto.hash256(buf); // BE
    return Buffer.from(h).reverse().toString("hex"); // return LE again
}

function buildRoot(txidsBE) {
    // Convert all to LE (byte-reversed)
    let level = txidsBE.map(x =>
        Buffer.from(x, "hex").reverse().toString("hex")
    );

    while (level.length > 1) {
        if (level.length % 2 === 1) {
            level.push(level[level.length - 1]); // duplicate last LE
        }

        const next = [];
        for (let i = 0; i < level.length; i += 2) {
            // concat LE hex → hash256 (returns LE hex)
            next.push(hash256(level[i] + level[i + 1]));
        }

        level = next;
    }

    return level[0];  // LE hex
}


module.exports = { branches, buildRoot };
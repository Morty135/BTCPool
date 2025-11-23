const bitcoin = require("bitcoinjs-lib");

function buildBranches(coinbaseHashLE, txidsBE) {
    // Build the full list of tx hashes in LE form
    let level = [
        coinbaseHashLE,
        ...txidsBE.map(x => Buffer.from(x, "hex").reverse())
    ];

    const branches = [];
    let index = 0; // coinbase is always index 0

    while (level.length > 1) {

        // duplicate last hash if odd number of entries
        if (level.length % 2 === 1) {
            level.push(level[level.length - 1]);
        }

        // sibling for this level
        const sibling = level[index ^ 1];
        branches.push(sibling.toString("hex"));

        // build next level
        const next = [];
        for (let i = 0; i < level.length; i += 2) {
            const h = bitcoin.crypto.hash256(
                Buffer.concat([level[i], level[i + 1]])
            );
            next.push(Buffer.from(h).reverse());
        }

        // move index to next level
        index = index >> 1;

        level = next;
    }

    return branches;
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


module.exports = { buildBranches, buildRoot };
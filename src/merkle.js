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



function buildRootFromBranches(coinbaseHashLE, merkleBranches) {
    let hash = Buffer.from(coinbaseHashLE); // LE
    let index = 0; // coinbase starts at index 0

    for (const branchHex of merkleBranches) {
        const branchLE = Buffer.from(branchHex, "hex"); // LE

        let concat;
        if ((index & 1) === 0) {
            // our hash is left child
            concat = Buffer.concat([hash, branchLE]);
        } else {
            // our hash is right child
            concat = Buffer.concat([branchLE, hash]);
        }

        const newHashBE = bitcoin.crypto.hash256(concat);
        hash = Buffer.from(newHashBE).reverse(); // back to LE for next level

        index = index >> 1;
    }

    return hash; // LE, 32 bytes
}



module.exports = { buildBranches, buildRootFromBranches };
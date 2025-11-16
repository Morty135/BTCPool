const bitcoin = require("bitcoinjs-lib");

const DIFF1_TARGET = BigInt(
    "0x00000000FFFF0000000000000000000000000000000000000000000000000000"
);

function difficultyToTarget(diff) {
    const SCALE = 1_000_000n;
    const diffBig = BigInt(Math.round(diff * Number(SCALE)));
    return (DIFF1_TARGET * SCALE) / diffBig;
}

function validateShare(header, difficulty) {
    const headerHash = bitcoin.crypto.hash256(header);
    const hashValue = BigInt("0x" + Buffer.from(headerHash).reverse().toString("hex"));

    const shareTarget = difficultyToTarget(difficulty);

    console.log(`Share hash: ${hashValue.toString(16).padStart(64, "0")}`);
    console.log(`Share target: ${shareTarget.toString(16).padStart(64, "0")}`);

    return hashValue <= shareTarget;
}

module.exports = { validateShare };

const bitcoin = require("bitcoinjs-lib");

const DIFF1_TARGET = BigInt(
    "0x00000000FFFF0000000000000000000000000000000000000000000000000000"
);

// diff like 0.01, 0.001, 5.3, etc.
// works for floats and produces correct BigInt targets
function difficultyToTarget(diff) {
    if (diff <= 0) return DIFF1_TARGET;

    // use 1e8 fixed-point arithmetic (same style as Bitcoin fees)
    const diffFixed = BigInt(Math.round(diff * 1e8)); // e.g. 0.01 → 1,000,000
    const scale = 100_000_000n;

    // scaled target
    let target = (DIFF1_TARGET * scale) / diffFixed;

    // target must never exceed DIFF1
    if (target > DIFF1_TARGET) target = DIFF1_TARGET;

    return target;
}

function validateShare(header, difficulty) {
    const hashBE = bitcoin.crypto.hash256(header);
    const hashValue = BigInt("0x" + hashBE.toString("hex"));

    const shareTarget = difficultyToTarget(difficulty);

    console.log("Share hash:   ", hashValue.toString(16).padStart(64, "0"));
    console.log("Share target: ", shareTarget.toString(16).padStart(64, "0"));

    return hashValue <= shareTarget;
}

module.exports = { validateShare };
const bitcoin = require("bitcoinjs-lib");

// target for difficulty = 1
const DIFF1_TARGET = BigInt(
  "0x00000000FFFF0000000000000000000000000000000000000000000000000000"
);

// Convert share difficulty → BigInt target
function difficultyToTarget(diff) {
    if (diff <= 0) diff = 1;

    // Use fixed point to avoid float precision issues
    const SCALE = 1_000_000n;   // 6 decimal places
    const diffFixed = BigInt(Math.round(diff * Number(SCALE)));

    // target shrinks as difficulty increases
    return (DIFF1_TARGET * SCALE) / diffFixed;
}

function validateShare(header, difficulty) {
    const hashBE = bitcoin.crypto.hash256(header);

    // DO NOT reverse the header hash; miners compare BE
    const hashValue = BigInt("0x" + hashBE.toString("hex"));

    const shareTarget = difficultyToTarget(difficulty);

    console.log("Share hash:   ", hashValue.toString(16).padStart(64, "0"));
    console.log("Share target: ", shareTarget.toString(16).padStart(64, "0"));

    return hashValue <= shareTarget;
}

module.exports = { validateShare };
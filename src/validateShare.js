const bitcoin = require("bitcoinjs-lib");

function validateShare(header, difficulty)
{
    const headerHash = bitcoin.crypto.hash256(header);
    const hashValue = BigInt("0x" + Buffer.from(headerHash).reverse().toString("hex"));

    const DIFF1_TARGET = BigInt("0x00000000FFFF0000000000000000000000000000000000000000000000000000");
    const shareTarget = DIFF1_TARGET / BigInt(Math.floor(difficulty));

    return hashValue <= shareTarget;
}

module.exports = { validateShare };
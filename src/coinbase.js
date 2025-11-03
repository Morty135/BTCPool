const bitcoin = require("bitcoinjs-lib");

function encodeHeight(height) {
    let hex = height.toString(16);
    if (hex.length % 2 !== 0) hex = "0" + hex;
    const bytes = hex.match(/../g).map(b => parseInt(b, 16));
    return Buffer.from(bytes.reverse());
}

function buildCoinbaseTx(template, payoutAddress, extraNoncePlaceholder = 8) 
{
    const network = template.network === "testnet" ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
    const tx = new bitcoin.Transaction();

    // --- Coinbase input ---
    const heightBuf = encodeHeight(template.height);
    const heightScript = Buffer.concat([Buffer.from([heightBuf.length]), heightBuf]);

    // --- extranonce placeholder (string) ---
    let extranonceBuf = Buffer.from(extraNoncePlaceholder, "hex");

    const tagBuf = Buffer.from(process.env.POOL_TAG || "", "ascii");
    const tagPush = Buffer.concat([Buffer.from([tagBuf.length]), tagBuf]);

    const scriptSig = Buffer.concat([heightScript, extranonceBuf, tagPush]);
    tx.addInput(Buffer.alloc(32, 0), 0xffffffff, 0xffffffff, scriptSig);

    // --- Coinbase output (reward) ---
    const p2pkh = bitcoin.address.toOutputScript(payoutAddress, network);
    tx.addOutput(p2pkh, template.coinbasevalue);

    // --- Witness commitment (if segwit block) ---
    if (template.default_witness_commitment) {
        const commitmentScript = Buffer.from(template.default_witness_commitment, "hex");
        tx.addOutput(commitmentScript, 0);
    }

    return tx.toHex();
}

module.exports = { buildCoinbaseTx };
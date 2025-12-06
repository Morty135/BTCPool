const bitcoin = require("bitcoinjs-lib");

function encodeHeight(height) {
    let hex = height.toString(16);
    if (hex.length % 2 !== 0) hex = "0" + hex;
    const bytes = hex.match(/../g).map(b => parseInt(b, 16));
    return Buffer.from(bytes.reverse());
}

function makePushFromHex(hex) {
    const buf = Buffer.from(hex, "hex");
    const len = Buffer.from([buf.length]);
    return Buffer.concat([len, buf]);
}

function buildCoinbaseTx(template, payoutAddress, extranonce1, zeroBuffer) {
    const network = template.network === "testnet"
        ? bitcoin.networks.testnet
        : bitcoin.networks.bitcoin;

    const heightBuf = encodeHeight(template.height);
    const heightPush = Buffer.concat([Buffer.from([heightBuf.length]), heightBuf]);

    const ex1Push = makePushFromHex(extranonce1); 

    const scriptSig = Buffer.concat([
        heightPush,
        ex1Push,
        zeroBuffer,
    ]);

    const tx = new bitcoin.Transaction();
    tx.addInput(Buffer.alloc(32, 0), 0xffffffff, 0xffffffff, scriptSig);

    const p2pkh = bitcoin.address.toOutputScript(payoutAddress, network);
    tx.addOutput(p2pkh, template.coinbasevalue);

    if (template.default_witness_commitment) {
        const c = Buffer.from(template.default_witness_commitment, "hex");
        tx.addOutput(c, 0);
    }

    return tx.toHex();
}

module.exports = { buildCoinbaseTx };
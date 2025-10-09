const bitcoin = require("bitcoinjs-lib");



function encodeHeight(height) 
{
    let hex = height.toString(16);
    if (hex.length % 2 !== 0) hex = "0" + hex;
    let bytes = hex.match(/../g).map(b => parseInt(b, 16));
    return Buffer.from(bytes.reverse()); // little endian
}



function buildCoinbaseTx(template, payoutAddress) 
{
    const network = bitcoin.networks.bitcoin;

    // Create raw tx
    const tx = new bitcoin.Transaction();

    // Add the coinbase input
    const heightBuf = encodeHeight(template.height);
    const scriptSig = Buffer.concat([Buffer.from([heightBuf.length]), heightBuf]);

    tx.addInput(
        Buffer.alloc(32, 0), // prev txid = all zeroes
        0xffffffff,          // index = 0xffffffff
        0xffffffff,          // sequence
        scriptSig            // scriptSig with block height
    );

    // Add the coinbase output (reward)
    const p2pkh = bitcoin.address.toOutputScript(payoutAddress, network);
    tx.addOutput(p2pkh, template.coinbasevalue);

    return tx.toHex();
}

module.exports = { buildCoinbaseTx };

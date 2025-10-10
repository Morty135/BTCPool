let nextExtranonce = 1;

function getExtranonce1() {
  // convert counter to 4-byte hex string (8 hex chars)
  const extranonce1 = nextExtranonce.toString(16).padStart(8, "0");
  nextExtranonce++;
  return extranonce1;
}


module.exports = { getExtranonce1 }
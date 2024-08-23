const { deployToken } = require('../utils.js');


async function main() {
    const tkaAddress = await deployToken('Token TKA', 'TKA', 9, 'UQCyG3YPKZHXA50mRN3hqeCl8aH7qImXNgNAm4DXZlI9q0wS', 'EQD_OypVyiEgi7PqXNHTHuGx7ANKj8ZLX_DzSfVxV_oTt9aw')
    const tkbAddress = await deployToken('Token TKB', 'TKB', 9, 'EQBSewllwBq0oOkEoSwv0OgG1qvMK63bQQ9kf2_T5OGhko6C', 'UQCyG3YPKZHXA50mRN3hqeCl8aH7qImXNgNAm4DXZlI9q0wS')
    const tkcAddress = await deployToken('Token TKC', 'TKC', 9, 'UQAkt8jdhSqv6UjhVZr6xO3DKARyaP3UcEl7X2q-RVzaxs6l', 'EQBSewllwBq0oOkEoSwv0OgG1qvMK63bQQ9kf2_T5OGhko6C')
}


main();

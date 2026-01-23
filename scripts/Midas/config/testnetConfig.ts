export interface MidasTestnetConfig {
    depositVaultAddress: string;
    redemptionVaultAddress: string;
    dataFeed: string;
    mToken: string;
}

export const midasTestnetConfig: MidasTestnetConfig = {
    depositVaultAddress: "0x762B366fD2c460f3b08D7CB279140fe39dF2e5Ca",
    redemptionVaultAddress: "0x5E65feDa93CDf3286d4B70BA6d3e2a0e86594CDd",
    dataFeed: "0x7Afed408C766cD90d263d332F6Be70f46BbB4DAe",
    mToken: "0x06A317991F2F479a6213278b32D17a126FcaB501"
};


export const midasUSDTMainnet: MidasTestnetConfig = {
    depositVaultAddress: "0xbD2CE9D5F2c682FCA3ce587Bf1C041ad8DDd2a69",
    redemptionVaultAddress: "0x911f9aF9138284A49b29F9894571Fb86e29D1d79",
    dataFeed: "0x2cBaa3F25Aae8b03aE2b62f9630d0BA63dF1Cf09",
    mToken: "0x0a72ED3C34352Ab2dd912b30f2252638C873D6f0"
};
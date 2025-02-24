import {
    type ActionExample,
    composeContext,
    type Content,
    elizaLogger,
    generateObjectDeprecated,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    ModelClass,
    type State,
    type Action,
} from "@elizaos/core";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import {
    CREATE_CPMM_POOL_PROGRAM,
    CREATE_CPMM_POOL_FEE_ACC,
    DEVNET_PROGRAM_ID,
    getCpmmPdaAmmConfigId,
} from "@raydium-io/raydium-sdk-v2";
import { initSdk, txVersion } from "../raydiumConfig";

const createTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    baseAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
    quoteAddress: "So11111111111111111111111111111111111111112", // SOL
    baseAmount: 1000,
    quoteAmount: 10,
    startTime: 1672531200, // Unix timestamp
},
\`\`\`

{{recentMessages}}

Given the recent messages, extract the following information for liquidity pool creation:
Extract these values:
- Base token address (address of base token)
- Quote token address (address of quote token)
- Base token amount (numeric, amount of base token added to pool)
- Quote token amount (numeric, amount of quote token added to pool)
- Start time (Unix timestamp or human-readable time format)

Respond with a JSON markdown block containing only the extracted values.`;

export interface CreatePoolCpmmContent extends Content {
    baseAddress: string;
    quoteAddress: string;
    baseAmount: string | number;
    quoteAmount: string | number;
    startTime: string | number;
}

function isCreatePoolContent(content: any): content is CreatePoolCpmmContent {
    elizaLogger.log("Content for createToken", content);
    return (
        typeof content.baseAddress === "string" &&
        typeof content.quoteAddress === "string" &&
        (typeof content.baseAmount === "string" ||
            typeof content.baseAmount === "number") &&
        (typeof content.quoteAmount === "string" ||
            typeof content.quoteAmount === "number") &&
        (typeof content.startTime === "string" ||
            typeof content.startTime === "number")
    );
}

export default {
    name: "RAYDIUM_CREATE_CPMM",
    similes: [
        "create raydium pool",
        "setup raydium liquidity pool",
        "initialize raydium amm",
        "create constant product market maker",
        "setup raydium cpmm",
        "create raydium trading pair",
    ],
    validate: async (_runtime: IAgentRuntime, _message: Memory) => true,
    description:
        "Create a new Cpmm pool on Raydium with advanced features and improved efficiency",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting RAYDIUM_CREATE_CPMM handler...");
        // Initialize or update state
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        // Compose transfer context
        const transferContext = composeContext({
            state,
            template: createTemplate,
        });
        elizaLogger.log("Transfer context: ", transferContext);
        // Generate transfer content
        const content = await generateObjectDeprecated({
            runtime,
            context: transferContext,
            modelClass: ModelClass.LARGE,
        });

        // Validate transfer content
        if (!isCreatePoolContent(content)) {
            elizaLogger.error("Invalid content for RAYDIUM_CREATE_CPMM action");
            if (callback) {
                callback({
                    text: "Unable to process raydium liquidity pool request. Invalid content provided.",
                    content: {
                        error: "Invalid create raydium liquidity pool content",
                    },
                });
            }
            return false;
        }
        const raydium = await initSdk({ loadToken: true });
        const feeConfigs = await raydium.api.getCpmmConfigs();

        const mintA = await raydium.token.getTokenInfo(content.baseAddress);
        const mintB = await raydium.token.getTokenInfo(content.quoteAddress);
        const _mintAAmount = new BN(content.baseAmount);
        const _mintBAmount = new BN(content.quoteAmount);
        const _startTime = new BN(content.startTime);

        try {
            if (raydium.cluster === "devnet") {
                feeConfigs.forEach((config) => {
                    config.id = getCpmmPdaAmmConfigId(
                        DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
                        config.index
                    ).publicKey.toBase58();
                });
            }

            const { execute, extInfo } = await raydium.cpmm.createPool({
                // poolId: // your custom publicKey, default sdk will automatically calculate pda pool id
                programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, // devnet: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM
                poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC, // devnet:  DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC
                mintA,
                mintB,
                mintAAmount: _mintAAmount,
                mintBAmount: _mintBAmount,
                startTime: _startTime,
                feeConfig: feeConfigs[0],
                associatedOnly: false,
                ownerInfo: {
                    useSOLBalance: true,
                },
                txVersion,
                // optional: set up priority fee here
                // computeBudgetConfig: {
                //   units: 600000,
                //   microLamports: 46591500,
                // },
            });
            const { txId } = await execute({ sendAndConfirm: true });
            console.log("pool created", {
                txId,
                poolKeys: Object.keys(extInfo.address).reduce(
                    (acc, cur) => ({
                        ...acc,
                        [cur]: extInfo.address[
                            cur as keyof typeof extInfo.address
                        ].toString(),
                    }),
                    {}
                ),
            });

            if (callback) {
                callback({
                     text: `Successfully created raydium liquidity pool  on Solana at address ${txId} with pool keys: ${JSON.stringify(Object.keys(extInfo.address).reduce(
                        (acc, cur) => ({
                            ...acc,
                            [cur]: extInfo.address[cur as keyof typeof extInfo.address].toString(),
                        }),
                        {}
                    ),
                    null,
                    2)}`,
                    content: {
                        success: true,
                        tokenAddress: txId,
                    },
                });
            }
            return true;
        } catch (error) {
            console.log({ error });
            if (callback) {
                elizaLogger.error(
                    "Error during create raydium liquidity pool: ",
                    error
                );
                callback({
                    text: `Error creating raydium liquidity pool: ${error.message}`,
                    content: { error: error.message },
                });
            }
            if (error.message.includes("insufficient liquidity")) {
                elizaLogger.log(
                    "Error during create raydium liquidity pool insufficient liquidity ",
                    error
                );
            } else if (error.message.includes("invalid market")) {
                elizaLogger.log(
                    "Error during create raydium liquidity pool invalid market ",
                    error
                );
            }

            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create a liquidity pool on Raydium. baseAdress is 9q9zUFMLdVEmGZxtHTMdD6sNLdWwcTRQYAVZRwrisqHT and quoteAddress is 97BF6dethuWZMZtA8PJdyLj2QjhkptSFtN29auJFXt4U, base amount is 200, and quote amount is 10. Start time is 0.",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll create the liquidity pool now...",
                    action: "RAYDIUM_CREATE_CPMM",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Successfully created Raydium Cpmm V4 pool",
                    status: "success",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
